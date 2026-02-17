/**
 * 출고 데이터 Excel → 출고요청(outbound_requests) 생성 서비스
 *
 * 엑셀 업로드 → outbound_requests (pending) 생성
 * 창고 확정(confirmOutboundRequest) → 재고 차감
 */

import { db } from "@/server/db";
import { products, outboundRequests, outboundRequestItems } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  parseExcelBuffer,
  sheetToJson,
  parseExcelDate,
  formatDateToString,
  parseNumber,
} from "./parser";
import type { ExcelImportResult, ExcelImportError, SalesRecordExcelRow } from "./types";

let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 컬럼 별칭 (sales-import.ts와 동일)
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

function getColumnValue(row: Record<string, unknown>, fieldName: string): unknown {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];
  for (const alias of aliases) {
    if (row[alias] !== undefined) return row[alias];
  }
  return undefined;
}

/**
 * 요청번호 생성 (OR-YYYYMMDD-XXX)
 */
function generateRequestNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `OR-${dateStr}-${random}`;
}

export interface ImportOutboundOptions {
  organizationId: string;
  userId: string;
  buffer: ArrayBuffer;
  sheetName?: string;
  sourceWarehouseId: string;
}

/**
 * 출고 데이터 Excel → outbound_requests (pending) 생성
 *
 * 재고 차감은 하지 않음. 창고에서 확정 시 처리.
 */
export async function importOutboundData(
  options: ImportOutboundOptions
): Promise<ExcelImportResult<SalesRecordExcelRow>> {
  const { organizationId, userId, buffer, sheetName, sourceWarehouseId } = options;

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

    // 2. 조직의 제품 목록 조회 (SKU -> productId 매핑)
    const orgProducts = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(eq(products.organizationId, organizationId));

    const skuToProduct = new Map(orgProducts.map((p) => [p.sku, p]));

    // 3. 행 파싱 + 유효성 검사
    interface ParsedItem {
      productId: string;
      quantity: number;
      outboundTypeKey: string; // OUTBOUND_SALE 등
      date: string;
      notes?: string;
      row: SalesRecordExcelRow;
    }
    const parsedItems: ParsedItem[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors: ExcelImportError[] = [];

      // SKU 필수
      const sku = getColumnValue(row, "sku");
      if (!sku || String(sku).trim() === "") {
        rowErrors.push({ row: rowNum, column: "SKU", value: sku, message: "SKU가 비어있습니다" });
      }

      // 날짜 필수
      const dateValue = getColumnValue(row, "date");
      const parsedDate = await parseExcelDate(dateValue);
      if (!parsedDate) {
        rowErrors.push({ row: rowNum, column: "날짜", value: dateValue, message: "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)" });
      }

      // 수량 필수
      const quantityRaw = parseNumber(getColumnValue(row, "quantity"));
      const quantity = quantityRaw !== null ? Math.round(quantityRaw) : null;
      if (quantity === null || quantity < 1) {
        rowErrors.push({ row: rowNum, column: "수량", value: getColumnValue(row, "quantity"), message: "수량은 1 이상의 숫자여야 합니다" });
      }

      if (rowErrors.length > 0) {
        allErrors.push(...rowErrors);
        continue;
      }

      // SKU 존재 확인
      const skuStr = String(sku).trim();
      const product = skuToProduct.get(skuStr);
      if (!product) {
        allErrors.push({ row: rowNum, column: "SKU", value: skuStr, message: `존재하지 않는 SKU입니다: ${skuStr}` });
        continue;
      }

      // 출고유형 파싱 (기본: OUTBOUND_SALE)
      const outboundTypeValue = getColumnValue(row, "outboundType");
      let outboundTypeKey = "OUTBOUND_SALE";
      if (outboundTypeValue) {
        const typeStr = String(outboundTypeValue).trim();
        const mapped = OUTBOUND_TYPE_MAP[typeStr];
        if (!mapped) {
          allErrors.push({ row: rowNum, column: "출고유형", value: typeStr, message: `지원하지 않는 출고유형: ${typeStr} (판매/폐기/이동/손망실/반품/샘플/조정)` });
          continue;
        }
        outboundTypeKey = mapped;
      }

      const dateStr = formatDateToString(parsedDate!);
      const notes = getColumnValue(row, "notes");
      const channel = getColumnValue(row, "channel");

      const rowData: SalesRecordExcelRow = {
        sku: skuStr,
        date: dateStr,
        quantity: quantity!,
        outboundType: outboundTypeValue ? String(outboundTypeValue).trim() : undefined,
        channel: channel ? String(channel).trim() : undefined,
        notes: notes ? String(notes).trim() : undefined,
      };

      parsedItems.push({
        productId: product.id,
        quantity: quantity!,
        outboundTypeKey,
        date: dateStr,
        notes: [
          `출고일: ${dateStr}`,
          channel ? `채널: ${String(channel).trim()}` : null,
          notes ? String(notes).trim() : null,
        ].filter(Boolean).join(" | "),
        row: rowData,
      });
    }

    if (parsedItems.length === 0) {
      return {
        success: allErrors.length === 0,
        data: [],
        errors: allErrors,
        totalRows: rows.length,
        successCount: 0,
        errorCount: allErrors.length,
      };
    }

    // 4. 출고유형별 그룹화 → 유형당 1개 outbound_request 생성
    const groupedByType = new Map<string, ParsedItem[]>();
    for (const item of parsedItems) {
      const existing = groupedByType.get(item.outboundTypeKey) || [];
      existing.push(item);
      groupedByType.set(item.outboundTypeKey, existing);
    }

    // 5. 유형별 outbound_request + items 생성
    for (const [outboundType, items] of groupedByType) {
      const requestNumber = generateRequestNumber();

      const [request] = await db
        .insert(outboundRequests)
        .values({
          organizationId,
          sourceWarehouseId,
          requestNumber,
          status: "pending",
          outboundType,
          requestedById: userId,
          notes: `엑셀 업로드 (${items.length}건)`,
        })
        .returning({ id: outboundRequests.id });

      // 동일 제품이 여러 행에 있으면 수량 합산
      const productQuantityMap = new Map<string, { quantity: number; notes: string[] }>();
      for (const item of items) {
        const existing = productQuantityMap.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          if (item.notes) existing.notes.push(item.notes);
        } else {
          productQuantityMap.set(item.productId, {
            quantity: item.quantity,
            notes: item.notes ? [item.notes] : [],
          });
        }
      }

      // 배치 INSERT
      const itemValues = Array.from(productQuantityMap.entries()).map(
        ([productId, { quantity, notes: notesList }]) => ({
          outboundRequestId: request.id,
          productId,
          requestedQuantity: quantity,
          notes: notesList.length > 0 ? notesList.join(" / ") : null,
        })
      );

      if (itemValues.length > 0) {
        await db.insert(outboundRequestItems).values(itemValues);
      }

      // 성공 데이터 추가
      for (const item of items) {
        successData.push(item.row);
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
 * 출고 데이터 Excel 템플릿 생성
 */
export async function createOutboundTemplate(): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();

  const templateData = [
    {
      SKU: "SKU-A001",
      날짜: "2026-01-15",
      수량: 100,
      출고유형: "판매",
      채널: "온라인",
      비고: "예시 데이터",
    },
    {
      SKU: "SKU-A002",
      날짜: "2026-01-15",
      수량: 30,
      출고유형: "폐기",
      채널: "",
      비고: "유통기한 만료",
    },
    {
      SKU: "SKU-A003",
      날짜: "2026-01-16",
      수량: 5,
      출고유형: "샘플",
      채널: "",
      비고: "거래처 샘플 발송",
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  worksheet["!cols"] = [
    { wch: 12 }, // SKU
    { wch: 12 }, // 날짜
    { wch: 8 },  // 수량
    { wch: 12 }, // 출고유형
    { wch: 10 }, // 채널
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "출고데이터");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
