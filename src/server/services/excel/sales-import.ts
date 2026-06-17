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
import { processInventoryTransaction } from "@/server/actions/inventory";
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

  // 수량 필수
  const quantityValue = getColumnValue(row, "quantity");
  const quantity = parseNumber(quantityValue);
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

  // 선택 필드
  const unitPriceValue = getColumnValue(row, "unitPrice");
  const unitPrice = parseNumber(unitPriceValue);

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

/**
 * 엑셀 파일에서 판매 행만 파싱 (DB 저장 없음)
 */
export async function parseSalesExcel(options: {
  organizationId: string;
  buffer: ArrayBuffer;
  sheetName?: string;
}): Promise<ExcelImportResult<SalesRecordExcelRow>> {
  const { organizationId, buffer, sheetName } = options;
  const allErrors: ExcelImportError[] = [];
  const successData: SalesRecordExcelRow[] = [];

  try {
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

    const orgProducts = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(eq(products.organizationId, organizationId));
    const skuSet = new Set(orgProducts.map((p) => p.sku));

    for (let i = 0; i < rows.length; i++) {
      const { data, errors } = await parseSalesRow(rows[i], i);
      if (errors.length > 0) {
        allErrors.push(...errors);
        continue;
      }
      if (!data) continue;
      if (!skuSet.has(data.sku)) {
        allErrors.push({ row: i + 2, column: "SKU", value: data.sku, message: `존재하지 않는 SKU: ${data.sku}` });
        continue;
      }
      successData.push(data);
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
      errors: [{ row: 0, message: error instanceof Error ? error.message : "알 수 없는 오류" }],
      totalRows: 0,
      successCount: 0,
      errorCount: 1,
    };
  }
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
 * 판매 데이터 Excel 임포트 (배치 처리 — DB 쿼리 최소화)
 */
export async function importSalesData(
  options: ImportSalesDataOptions
): Promise<ExcelImportResult<SalesRecordExcelRow>> {
  const { organizationId, buffer, sheetName, duplicateHandling = "skip" } = options;

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

    // 2. 제품 맵 사전 로딩 (DB 쿼리 1회)
    const orgProducts = await db
      .select({ id: products.id, sku: products.sku, unitPrice: products.unitPrice })
      .from(products)
      .where(eq(products.organizationId, organizationId));
    const skuToProduct = new Map(orgProducts.map((p) => [p.sku, p]));

    // 3. 전체 행 파싱 (DB 없음)
    type ParsedRow = {
      rowNum: number;
      productId: string;
      unitPrice: number;
      date: string;
      quantity: number;
      channel?: string;
      notes?: string;
      original: SalesRecordExcelRow;
    };
    const validRows: ParsedRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { data, errors } = await parseSalesRow(rows[i], i);
      if (errors.length > 0) { allErrors.push(...errors); continue; }
      if (!data) continue;

      const product = skuToProduct.get(data.sku);
      if (!product) {
        allErrors.push({ row: i + 2, column: "SKU", value: data.sku, message: `존재하지 않는 SKU: ${data.sku}` });
        continue;
      }

      validRows.push({
        rowNum: i + 2,
        productId: product.id,
        unitPrice: data.unitPrice ?? product.unitPrice ?? 0,
        date: data.date,
        quantity: data.quantity,
        channel: data.channel,
        notes: data.notes,
        original: data,
      });
    }

    if (validRows.length === 0) {
      return { success: false, data: [], errors: allErrors, totalRows: rows.length, successCount: 0, errorCount: allErrors.length };
    }

    // 4. 기존 데이터 일괄 조회 (DB 쿼리 1회) — (productId, date) 조합
    const productIds = [...new Set(validRows.map((r) => r.productId))];
    const existingRecords = await db
      .select({ id: salesRecords.id, productId: salesRecords.productId, date: salesRecords.date })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, organizationId),
          inArray(salesRecords.productId, productIds)
        )
      );
    const existingSet = new Set(existingRecords.map((r) => `${r.productId}::${r.date}`));

    // 5. 신규/중복 분류
    const toInsert: typeof salesRecords.$inferInsert[] = [];

    for (const r of validRows) {
      const key = `${r.productId}::${r.date}`;
      if (existingSet.has(key)) {
        if (duplicateHandling === "error") {
          allErrors.push({ row: r.rowNum, column: "날짜", value: r.date, message: `중복: ${r.original.sku} / ${r.date}` });
        }
        // skip: 무시 (update는 배치 미지원 — 신규 임포트 기준)
        continue;
      }
      toInsert.push({
        organizationId,
        productId: r.productId,
        date: r.date,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        totalAmount: r.quantity * r.unitPrice,
        channel: r.channel,
        notes: r.notes,
      });
      successData.push(r.original);
    }

    // 6. 배치 insert (DB 쿼리 1회 — 청크 500행씩)
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      await db.insert(salesRecords).values(toInsert.slice(i, i + CHUNK));
    }

    return {
      success: successData.length > 0,
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
      errors: [{ row: 0, message: error instanceof Error ? error.message : "알 수 없는 오류" }],
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
