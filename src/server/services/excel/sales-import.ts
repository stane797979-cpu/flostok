/**
 * 판매(출고) 데이터 Excel 임포트 서비스
 */

import { db } from "@/server/db";
import { products, salesRecords } from "@/server/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  parseExcelBuffer,
  sheetToJson,
  parseExcelDate,
  formatDateToString,
  parseNumber,
} from "./parser";
import type { ExcelImportResult, ExcelImportError, SalesRecordExcelRow } from "./types";
import type { InventoryChangeTypeKey } from "@/server/services/inventory/types";

let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 판매 데이터 Excel 컬럼 매핑
 *
 * 지원하는 컬럼명:
 * - SKU / sku / 품목코드 / 제품코드
 * - 날짜 / date / 판매일
 * - 수량 / quantity / 판매수량 / 출고수량
 * - 단가 / unitPrice / 판매단가 (선택)
 * - 채널 / channel / 판매채널 (선택)
 * - 비고 / notes / 메모 (선택)
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  sku: ["SKU", "sku", "품목코드", "제품코드", "상품코드", "품번"],
  date: ["날짜", "date", "판매일", "출고일", "일자", "Date"],
  quantity: ["수량", "quantity", "판매수량", "출고수량", "Quantity", "Qty"],
  unitPrice: ["단가", "unitPrice", "판매단가", "UnitPrice", "Price"],
  channel: ["채널", "channel", "판매채널", "Channel"],
  outboundType: ["출고유형", "유형", "outboundType", "type", "Type"],
  notes: ["비고", "notes", "메모", "Notes", "Memo"],
};

/**
 * 출고유형 한국어 → changeType 키 매핑
 */
const OUTBOUND_TYPE_MAP: Record<string, string> = {
  "판매": "OUTBOUND_SALE",
  "판매출고": "OUTBOUND_SALE",
  "폐기": "OUTBOUND_DISPOSAL",
  "이동": "OUTBOUND_TRANSFER",
  "이동출고": "OUTBOUND_TRANSFER",
  "손망실": "OUTBOUND_LOSS",
  "반품": "OUTBOUND_RETURN",
  "반품출고": "OUTBOUND_RETURN",
  "샘플": "OUTBOUND_SAMPLE",
  "샘플출고": "OUTBOUND_SAMPLE",
  "조정": "OUTBOUND_ADJUSTMENT",
  "조정출고": "OUTBOUND_ADJUSTMENT",
};

/**
 * Excel 행에서 컬럼값 추출 (별칭 지원)
 */
function getColumnValue(row: Record<string, unknown>, fieldName: string): unknown {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];

  for (const alias of aliases) {
    if (row[alias] !== undefined) {
      return row[alias];
    }
  }

  return undefined;
}

/**
 * 판매 데이터 Excel 행 파싱
 */
async function parseSalesRow(
  row: Record<string, unknown>,
  rowIndex: number
): Promise<{ data: SalesRecordExcelRow | null; errors: ExcelImportError[] }> {
  const errors: ExcelImportError[] = [];
  const rowNum = rowIndex + 2; // Excel 행 번호 (헤더 + 0-인덱스)

  // SKU 필수
  const sku = getColumnValue(row, "sku");
  if (!sku || String(sku).trim() === "") {
    errors.push({
      row: rowNum,
      column: "SKU",
      value: sku,
      message: "SKU가 비어있습니다",
    });
  }

  // 날짜 필수
  const dateValue = getColumnValue(row, "date");
  const parsedDate = await parseExcelDate(dateValue);
  if (!parsedDate) {
    errors.push({
      row: rowNum,
      column: "날짜",
      value: dateValue,
      message: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)",
    });
  }

  // 수량 필수 (integer 컬럼이므로 반올림)
  const quantityValue = getColumnValue(row, "quantity");
  const quantityRaw = parseNumber(quantityValue);
  const quantity = quantityRaw !== null ? Math.round(quantityRaw) : null;
  if (quantity === null || quantity < 0) {
    errors.push({
      row: rowNum,
      column: "수량",
      value: quantityValue,
      message: "수량은 0 이상의 숫자여야 합니다",
    });
  }

  // 오류가 있으면 null 반환
  if (errors.length > 0) {
    return { data: null, errors };
  }

  // 선택 필드 (integer 컬럼이므로 반올림)
  const unitPriceValue = getColumnValue(row, "unitPrice");
  const unitPriceRaw = parseNumber(unitPriceValue);
  const unitPrice = unitPriceRaw !== null ? Math.round(unitPriceRaw) : null;

  const channel = getColumnValue(row, "channel");
  const outboundTypeValue = getColumnValue(row, "outboundType");
  const notes = getColumnValue(row, "notes");

  // 출고유형 매핑 (미입력 시 기본값: 판매)
  let outboundType: string | undefined;
  if (outboundTypeValue) {
    const typeStr = String(outboundTypeValue).trim();
    const mapped = OUTBOUND_TYPE_MAP[typeStr];
    if (!mapped) {
      errors.push({
        row: rowNum,
        column: "출고유형",
        value: typeStr,
        message: `지원하지 않는 출고유형입니다: ${typeStr} (판매/폐기/이동/손망실/반품/샘플/조정)`,
      });
      return { data: null, errors };
    }
    outboundType = typeStr;
  }

  return {
    data: {
      sku: String(sku).trim(),
      date: formatDateToString(parsedDate!),
      quantity: quantity!,
      unitPrice: unitPrice ?? undefined,
      channel: channel ? String(channel).trim() : undefined,
      outboundType,
      notes: notes ? String(notes).trim() : undefined,
    },
    errors: [],
  };
}

export interface ImportSalesDataOptions {
  /** 조직 ID */
  organizationId: string;
  /** Excel 파일 버퍼 */
  buffer: ArrayBuffer;
  /** 시트 이름 (기본: 첫 번째 시트) */
  sheetName?: string;
  /** 중복 데이터 처리: skip(무시), update(덮어쓰기), error(오류) */
  duplicateHandling?: "skip" | "update" | "error";
  /** 재고 차감 여부 (true일 때 출고 처리 + inventory_history 기록) */
  deductInventory?: boolean;
}

/**
 * 판매 데이터 Excel 임포트
 */
export async function importSalesData(
  options: ImportSalesDataOptions
): Promise<ExcelImportResult<SalesRecordExcelRow>> {
  const { organizationId, buffer, sheetName, duplicateHandling = "skip", deductInventory = false } = options;

  const allErrors: ExcelImportError[] = [];
  const successData: SalesRecordExcelRow[] = [];

  try {
    // 1. Excel 파싱
    const workbook = await parseExcelBuffer(buffer);
    const rows = await sheetToJson<Record<string, unknown>>(workbook, sheetName);

    if (rows.length === 0) {
      return {
        success: false,
        data: [],
        errors: [{ row: 0, message: "데이터가 없습니다" }],
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
      };
    }

    // 2. 조직의 제품 목록 조회 (SKU -> productId 매핑용)
    const orgProducts = await db
      .select({ id: products.id, sku: products.sku, unitPrice: products.unitPrice })
      .from(products)
      .where(eq(products.organizationId, organizationId));

    const skuToProduct = new Map(orgProducts.map((p) => [p.sku, p]));

    // 3. 행 파싱
    const parsedRows: Array<{ index: number; data: SalesRecordExcelRow; productId: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const { data, errors } = await parseSalesRow(rows[i], i);

      if (errors.length > 0) {
        allErrors.push(...errors);
        continue;
      }

      if (!data) continue;

      const product = skuToProduct.get(data.sku);
      if (!product) {
        allErrors.push({
          row: i + 2,
          column: "SKU",
          value: data.sku,
          message: `존재하지 않는 SKU입니다: ${data.sku}`,
        });
        continue;
      }

      parsedRows.push({ index: i, data, productId: product.id });
    }

    // 4. 기존 판매 기록 배치 조회 (중복 체크용, N+1 제거)
    const productIds = [...new Set(parsedRows.map((r) => r.productId))];
    const existingRecordMap = new Map<string, string>(); // "productId:date" → recordId

    if (productIds.length > 0) {
      const existingRecords = await db
        .select({ id: salesRecords.id, productId: salesRecords.productId, date: salesRecords.date })
        .from(salesRecords)
        .where(
          and(
            eq(salesRecords.organizationId, organizationId),
            inArray(salesRecords.productId, productIds)
          )
        );
      for (const rec of existingRecords) {
        existingRecordMap.set(`${rec.productId}:${rec.date}`, rec.id);
      }
    }

    // 5. 분류 처리 (신규 INSERT 배치, UPDATE 배치, 재고차감 순차)
    const newInsertValues: Array<typeof salesRecords.$inferInsert> = [];
    const salesUpdateBatch: Array<{ id: string; quantity: number; unitPrice: number; totalAmount: number; channel: string | null; notes: string | null }> = [];
    const inventoryOps: Array<{ productId: string; data: SalesRecordExcelRow }> = [];

    for (const { index: i, data, productId } of parsedRows) {
      const product = skuToProduct.get(data.sku)!;
      const dupKey = `${productId}:${data.date}`;
      const existingId = existingRecordMap.get(dupKey);

      if (existingId) {
        if (duplicateHandling === "error") {
          allErrors.push({
            row: i + 2,
            column: "날짜",
            value: data.date,
            message: `중복 데이터: ${data.sku} / ${data.date}`,
          });
          continue;
        }

        if (duplicateHandling === "skip") {
          continue;
        }

        // update: 배치 수집 (루프 종료 후 일괄 UPDATE)
        const unitPrice = Math.round(data.unitPrice ?? product.unitPrice ?? 0);
        salesUpdateBatch.push({
          id: existingId,
          quantity: Math.round(data.quantity),
          unitPrice,
          totalAmount: Math.round(data.quantity * unitPrice),
          channel: data.channel || null,
          notes: data.notes || null,
        });

        if (deductInventory) {
          inventoryOps.push({ productId, data });
        }

        successData.push(data);
        continue;
      }

      // 신규 데이터 — 배치 INSERT용 배열에 추가
      const unitPrice = Math.round(data.unitPrice ?? product.unitPrice ?? 0);
      newInsertValues.push({
        organizationId,
        productId,
        date: data.date,
        quantity: Math.round(data.quantity),
        unitPrice,
        totalAmount: Math.round(data.quantity * unitPrice),
        channel: data.channel,
        notes: data.notes,
      });

      if (deductInventory) {
        inventoryOps.push({ productId, data });
      }

      successData.push(data);
    }

    // 6-1. 중복 판매기록 배치 UPDATE (N개 → 1개 쿼리)
    if (salesUpdateBatch.length > 0) {
      const BATCH_SIZE_UPDATE = 100;
      for (let i = 0; i < salesUpdateBatch.length; i += BATCH_SIZE_UPDATE) {
        const batch = salesUpdateBatch.slice(i, i + BATCH_SIZE_UPDATE);
        await db.execute(sql`
          UPDATE sales_records SET
            quantity = v.quantity::int,
            unit_price = v.unit_price::numeric,
            total_amount = v.total_amount::numeric,
            channel = v.channel,
            notes = v.notes,
            updated_at = NOW()
          FROM (VALUES ${sql.join(
            batch.map(u => sql`(${u.id}::uuid, ${u.quantity}::int, ${u.unitPrice}::numeric, ${u.totalAmount}::numeric, ${u.channel}, ${u.notes})`),
            sql`, `
          )}) AS v(id, quantity, unit_price, total_amount, channel, notes)
          WHERE sales_records.id = v.id
        `);
      }
    }

    // 6-2. 배치 INSERT (신규 판매 기록) — 100건씩 분할하여 PG 파라미터 한도 방지
    const BATCH_SIZE = 100;
    for (let i = 0; i < newInsertValues.length; i += BATCH_SIZE) {
      const batch = newInsertValues.slice(i, i + BATCH_SIZE);
      await db.insert(salesRecords).values(batch);
    }

    // 7. 재고 차감 배치 처리 (순차 → 배치로 변경하여 타임아웃 방지)
    if (inventoryOps.length > 0) {
      const batchItems = inventoryOps.map(({ productId, data }) => ({
        productId,
        changeType: (data.outboundType
          ? OUTBOUND_TYPE_MAP[data.outboundType] || "OUTBOUND_SALE"
          : "OUTBOUND_SALE") as InventoryChangeTypeKey,
        quantity: data.quantity,
        notes: `출고 임포트: ${data.sku} / ${data.date} [${data.outboundType || "판매"}]`,
      }));
      try {
        // 동적 import: "use server" 모듈 경계 문제 방지
        const { processBatchInventoryTransactions } = await import("@/server/actions/inventory");
        await processBatchInventoryTransactions(batchItems, { skipRevalidate: true, skipActivityLog: true });
      } catch (error) {
        // 재고 차감 실패는 판매 기록 저장 자체는 성공이므로 오류로 중단하지 않고 경고로 사용자에게 안내
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn("재고 차감 배치 처리 실패:", errorMessage);
        allErrors.push({
          row: 0,
          message: `재고 차감 처리 중 일부 오류 발생: ${errorMessage}`,
        });
      }
    }

    return {
      success: allErrors.length === 0,
      data: successData,
      errors: allErrors,
      totalRows: rows.length,
      successCount: successData.length,
      errorCount: allErrors.length,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [
        {
          row: 0,
          message: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        },
      ],
      totalRows: 0,
      successCount: 0,
      errorCount: 1,
    };
  }
}

/**
 * 판매 데이터 Excel 템플릿 생성
 */
export async function createSalesTemplate(): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();

  const templateData = [
    {
      SKU: "SKU-A001",
      날짜: "2026-01-15",
      수량: 100,
      단가: 15000,
      채널: "온라인",
      출고유형: "판매",
      비고: "예시 데이터",
    },
    {
      SKU: "SKU-A002",
      날짜: "2026-01-15",
      수량: 30,
      단가: 25000,
      채널: "",
      출고유형: "폐기",
      비고: "유통기한 만료",
    },
    {
      SKU: "SKU-A003",
      날짜: "2026-01-16",
      수량: 5,
      단가: 0,
      채널: "",
      출고유형: "샘플",
      비고: "거래처 샘플 발송",
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  // 컬럼 너비 설정
  worksheet["!cols"] = [
    { wch: 12 }, // SKU
    { wch: 12 }, // 날짜
    { wch: 8 }, // 수량
    { wch: 10 }, // 단가
    { wch: 10 }, // 채널
    { wch: 12 }, // 출고유형
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "판매데이터");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
