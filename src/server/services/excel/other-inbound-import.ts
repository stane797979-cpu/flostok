/**
 * 기타 입고 Excel 임포트/템플릿 서비스
 */

import { db } from "@/server/db";
import { products, inboundRecords, inventory, inventoryLots, inventoryHistory } from "@/server/db/schema";
import { eq, and, isNull, desc, inArray } from "drizzle-orm";
import { parseExcelBuffer, sheetToJson, parseNumber, parseExcelDate, formatDateToString } from "./parser";

/**
 * XLSX 라이브러리 lazy 로딩
 */
let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 기타 입고 Excel 컬럼 별칭
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  sku: ["SKU", "sku", "품목코드", "제품코드", "상품코드"],
  date: ["입고일", "날짜", "date", "Date", "일자", "입고날짜"],
  inboundType: ["입고유형", "유형", "입고 유형", "type", "Type"],
  quantity: ["수량", "입고수량", "quantity", "Quantity", "Qty"],
  location: ["위치", "적치위치", "적치 위치", "location", "Location"],
  lotNumber: ["LOT", "LOT번호", "LOT 번호", "lotNumber", "Lot"],
  expiryDate: ["유통기한", "만기일", "expiryDate", "Expiry"],
  notes: ["비고", "메모", "사유", "notes", "Notes"],
};

/**
 * 입고유형 한국어 → 키 매핑
 */
const INBOUND_TYPE_MAP: Record<string, string> = {
  "반품": "INBOUND_RETURN",
  "반품입고": "INBOUND_RETURN",
  "반품 입고": "INBOUND_RETURN",
  "조정": "INBOUND_ADJUSTMENT",
  "조정입고": "INBOUND_ADJUSTMENT",
  "조정 입고": "INBOUND_ADJUSTMENT",
  "이동": "INBOUND_TRANSFER",
  "이동입고": "INBOUND_TRANSFER",
  "이동 입고": "INBOUND_TRANSFER",
  "INBOUND_RETURN": "INBOUND_RETURN",
  "INBOUND_ADJUSTMENT": "INBOUND_ADJUSTMENT",
  "INBOUND_TRANSFER": "INBOUND_TRANSFER",
};

function getColumnValue(row: Record<string, unknown>, fieldName: string): unknown {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];
  for (const alias of aliases) {
    if (row[alias] !== undefined) return row[alias];
  }
  return undefined;
}

export interface OtherInboundImportResult {
  success: boolean;
  message: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * 기타 입고 Excel 임포트
 */
export async function importOtherInboundData(params: {
  organizationId: string;
  buffer: ArrayBuffer;
}): Promise<OtherInboundImportResult> {
  const { organizationId, buffer } = params;
  const errors: Array<{ row: number; message: string }> = [];

  const workbook = await parseExcelBuffer(buffer);
  const rows = await sheetToJson<Record<string, unknown>>(workbook);

  if (rows.length === 0) {
    return { success: false, message: "데이터가 없습니다", totalRows: 0, successCount: 0, errorCount: 0, errors: [] };
  }

  // 1) SKU → productId 맵 사전 로딩 (DB 쿼리 1회)
  const allProducts = await db
    .select({ id: products.id, sku: products.sku, safetyStock: products.safetyStock, reorderPoint: products.reorderPoint })
    .from(products)
    .where(eq(products.organizationId, organizationId));
  const skuMap = new Map(allProducts.map((p) => [p.sku, p]));

  // 2) 현재 재고 맵 사전 로딩 (DB 쿼리 1회)
  const productIds = allProducts.map((p) => p.id);
  const existingInventory = productIds.length > 0
    ? await db.select().from(inventory).where(inArray(inventory.productId, productIds))
    : [];
  const invMap = new Map(existingInventory.map((inv) => [inv.productId, inv]));

  // 3) 행 파싱
  type ParsedRow = {
    rowNum: number;
    productId: string;
    inboundType: string;
    quantity: number;
    date: string;
    location?: string;
    lotNumber?: string;
    expiryDate?: string;
    notes?: string;
  };
  const validRows: ParsedRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const sku = String(getColumnValue(row, "sku") || "").trim();
    if (!sku) { errors.push({ row: rowNum, message: "SKU가 비어있습니다" }); continue; }

    const product = skuMap.get(sku);
    if (!product) { errors.push({ row: rowNum, message: `SKU '${sku}' 제품을 찾을 수 없습니다` }); continue; }

    const rawType = String(getColumnValue(row, "inboundType") || "").trim();
    const inboundType = INBOUND_TYPE_MAP[rawType];
    if (!inboundType) { errors.push({ row: rowNum, message: `입고유형 '${rawType}'이(가) 올바르지 않습니다 (반품/조정/이동)` }); continue; }

    const quantity = parseNumber(getColumnValue(row, "quantity"));
    if (!quantity || quantity <= 0) { errors.push({ row: rowNum, message: "수량이 올바르지 않습니다" }); continue; }

    const rawDate = getColumnValue(row, "date");
    const today = new Date().toISOString().split("T")[0];
    const parsedDate = await parseExcelDate(rawDate);
    const date = parsedDate ? formatDateToString(parsedDate) : today;

    validRows.push({
      rowNum,
      productId: product.id,
      inboundType,
      quantity,
      date,
      location: String(getColumnValue(row, "location") || "").trim() || undefined,
      lotNumber: String(getColumnValue(row, "lotNumber") || "").trim() || undefined,
      expiryDate: String(getColumnValue(row, "expiryDate") || "").trim() || undefined,
      notes: String(getColumnValue(row, "notes") || "").trim() || undefined,
    });
  }

  if (validRows.length === 0) {
    return { success: false, message: "유효한 데이터가 없습니다", totalRows: rows.length, successCount: 0, errorCount: errors.length, errors };
  }

  // 4) inbound_records 배치 insert (DB 쿼리 1회)
  const inboundValues = validRows.map((r) => {
    const lotNum = r.lotNumber || `AUTO-${r.date.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      organizationId,
      purchaseOrderId: null as null,
      productId: r.productId,
      date: r.date,
      expectedQuantity: r.quantity,
      receivedQuantity: r.quantity,
      acceptedQuantity: r.quantity,
      rejectedQuantity: 0,
      qualityResult: "pass" as const,
      location: r.location ?? null,
      lotNumber: lotNum,
      expiryDate: r.expiryDate ?? null,
      notes: r.notes ?? null,
    };
  });
  const insertedRecords = await db.insert(inboundRecords).values(inboundValues).returning({ id: inboundRecords.id, productId: inboundRecords.productId, lotNumber: inboundRecords.lotNumber });

  // 5) inventory_lots 배치 insert (DB 쿼리 1회)
  const lotValues = insertedRecords.map((rec, idx) => ({
    organizationId,
    productId: rec.productId,
    lotNumber: rec.lotNumber!,
    expiryDate: validRows[idx].expiryDate ?? null,
    initialQuantity: validRows[idx].quantity,
    remainingQuantity: validRows[idx].quantity,
    inboundRecordId: rec.id,
    receivedDate: validRows[idx].date,
    status: "active" as const,
  }));
  await db.insert(inventoryLots).values(lotValues);

  // 6) 재고 집계 후 upsert (제품별 총 입고량 합산)
  const qtyByProduct = new Map<string, number>();
  for (const r of validRows) {
    qtyByProduct.set(r.productId, (qtyByProduct.get(r.productId) || 0) + r.quantity);
  }

  const invInserts: typeof inventory.$inferInsert[] = [];
  const invHistoryValues: typeof inventoryHistory.$inferInsert[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const [productId, totalQty] of qtyByProduct) {
    const cur = invMap.get(productId);
    const stockBefore = cur ? (cur.currentStock || 0) : 0;
    const stockAfter = stockBefore + totalQty;

    if (cur) {
      await db.update(inventory).set({ currentStock: stockAfter, availableStock: stockAfter, lastUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(inventory.id, cur.id));
    } else {
      invInserts.push({ organizationId, productId, currentStock: stockAfter, availableStock: stockAfter, status: "optimal" });
    }

    invHistoryValues.push({
      organizationId,
      productId,
      date: today,
      stockBefore,
      stockAfter,
      changeAmount: totalQty,
      changeType: "INBOUND_ADJUSTMENT",
      notes: "엑셀 일괄 입고",
    });
  }

  if (invInserts.length > 0) await db.insert(inventory).values(invInserts);
  if (invHistoryValues.length > 0) await db.insert(inventoryHistory).values(invHistoryValues);

  return {
    success: true,
    message: `${validRows.length}/${rows.length}건 입고 처리 완료`,
    totalRows: rows.length,
    successCount: validRows.length,
    errorCount: errors.length,
    errors,
  };
}

/**
 * 기타 입고 Excel 템플릿 생성 (기존 입고 기록 포함)
 */
export async function createOtherInboundTemplate(organizationId: string): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  // DB에서 기존 기타입고 기록 조회 (purchaseOrderId가 null인 것 = 기타입고)
  const existingRecords = await db
    .select({
      sku: products.sku,
      date: inboundRecords.date,
      receivedQuantity: inboundRecords.receivedQuantity,
      location: inboundRecords.location,
      lotNumber: inboundRecords.lotNumber,
      expiryDate: inboundRecords.expiryDate,
      notes: inboundRecords.notes,
    })
    .from(inboundRecords)
    .innerJoin(products, eq(inboundRecords.productId, products.id))
    .where(
      and(
        eq(inboundRecords.organizationId, organizationId),
        isNull(inboundRecords.purchaseOrderId)
      )
    )
    .orderBy(desc(inboundRecords.date))
    .limit(200);

  let data: Array<Record<string, string | number>>;

  if (existingRecords.length > 0) {
    // 기존 데이터를 양식에 포함
    data = existingRecords.map((r) => ({
      SKU: r.sku,
      "입고일": r.date,
      "입고유형": "",
      "수량": r.receivedQuantity,
      "적치위치": r.location || "",
      "LOT번호": r.lotNumber || "",
      "유통기한": r.expiryDate || "",
      "비고": r.notes || "",
    }));
  } else {
    // 데이터가 없으면 예시 행 제공
    data = [
      {
        SKU: "SKU-A001",
        "입고일": "",
        "입고유형": "반품",
        "수량": 10,
        "적치위치": "A-01-02",
        "LOT번호": "",
        "유통기한": "",
        "비고": "고객 반품",
      },
    ];
  }

  const ws = XLSX.utils.json_to_sheet(data);

  // 열 너비 설정
  ws["!cols"] = [
    { wch: 14 }, // SKU
    { wch: 12 }, // 입고일
    { wch: 12 }, // 입고유형
    { wch: 8 },  // 수량
    { wch: 12 }, // 적치위치
    { wch: 14 }, // LOT번호
    { wch: 12 }, // 유통기한
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(wb, ws, "기타입고");

  // 안내 시트
  const guideData = [
    { "컬럼명": "SKU", "필수여부": "필수", "설명": "제품 SKU 코드" },
    { "컬럼명": "입고일", "필수여부": "선택", "설명": "입고일 (YYYY-MM-DD, 미입력시 오늘)" },
    { "컬럼명": "입고유형", "필수여부": "필수", "설명": "반품 / 조정 / 이동" },
    { "컬럼명": "수량", "필수여부": "필수", "설명": "입고 수량 (양수)" },
    { "컬럼명": "적치위치", "필수여부": "선택", "설명": "창고 위치 (예: A-01-02)" },
    { "컬럼명": "LOT번호", "필수여부": "선택", "설명": "LOT 번호 (미입력시 자동생성)" },
    { "컬럼명": "유통기한", "필수여부": "선택", "설명": "유통기한 (YYYY-MM-DD)" },
    { "컬럼명": "비고", "필수여부": "선택", "설명": "입고 사유/메모" },
  ];
  const guideWs = XLSX.utils.json_to_sheet(guideData);
  guideWs["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, guideWs, "작성안내");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}
