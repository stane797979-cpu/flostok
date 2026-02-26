/**
 * 기타 입고 Excel 임포트/템플릿 서비스
 */

import { db } from "@/server/db";
import { products, inboundRecords, inventoryLots, inventory, inventoryHistory } from "@/server/db/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
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
  let successCount = 0;

  const workbook = await parseExcelBuffer(buffer);
  const rows = await sheetToJson<Record<string, unknown>>(workbook);

  if (rows.length === 0) {
    return {
      success: false,
      message: "데이터가 없습니다",
      totalRows: 0,
      successCount: 0,
      errorCount: 0,
      errors: [],
    };
  }

  // SKU→제품 Map 미리 배치 조회 (N+1 제거)
  const allProducts = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, organizationId));
  const skuToProduct = new Map(allProducts.map((p) => [p.sku, p]));

  // 기본 창고 조회 (1번만)
  const { getDefaultWarehouse } = await import("@/server/actions/warehouses");
  const warehouse = await getDefaultWarehouse();
  if (!warehouse) {
    return {
      success: false,
      message: "기본 창고를 찾을 수 없습니다",
      totalRows: rows.length,
      successCount: 0,
      errorCount: 1,
      errors: [{ row: 0, message: "기본 창고를 찾을 수 없습니다" }],
    };
  }

  const today = new Date().toISOString().split("T")[0];

  // 1단계: 행별 검증 + 배치 데이터 수집
  const validItems: Array<{
    productId: string;
    inboundType: string;
    quantity: number;
    location?: string;
    lotNumber: string;
    expiryDate?: string;
    notes?: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const sku = String(getColumnValue(row, "sku") || "").trim();
      if (!sku) { errors.push({ row: rowNum, message: "SKU가 비어있습니다" }); continue; }

      const product = skuToProduct.get(sku);
      if (!product) { errors.push({ row: rowNum, message: `SKU '${sku}' 제품을 찾을 수 없습니다` }); continue; }

      const rawType = String(getColumnValue(row, "inboundType") || "").trim();
      const inboundType = INBOUND_TYPE_MAP[rawType];
      if (!inboundType) { errors.push({ row: rowNum, message: `입고유형 '${rawType}'이(가) 올바르지 않습니다 (반품/조정/이동)` }); continue; }

      const quantity = parseNumber(getColumnValue(row, "quantity"));
      if (!quantity || quantity <= 0) { errors.push({ row: rowNum, message: "수량이 올바르지 않습니다" }); continue; }

      const location = String(getColumnValue(row, "location") || "").trim() || undefined;
      const lotNumberRaw = String(getColumnValue(row, "lotNumber") || "").trim();
      const lotNumber = lotNumberRaw || `AUTO-${today.replace(/-/g, "")}-${Date.now().toString(36)}-${i}`;
      const notes = String(getColumnValue(row, "notes") || "").trim() || undefined;

      const expiryDateRawValue = getColumnValue(row, "expiryDate");
      const expiryDateParsed = await parseExcelDate(expiryDateRawValue);
      const expiryDate = expiryDateParsed ? formatDateToString(expiryDateParsed) : undefined;

      validItems.push({ productId: product.id, inboundType, quantity, location, lotNumber, expiryDate, notes });
    } catch (err) {
      errors.push({ row: rowNum, message: err instanceof Error ? err.message : "알 수 없는 오류" });
    }
  }

  // 2단계: 배치 INSERT (입고기록 + LOT + 재고)
  if (validItems.length > 0) {
    try {
      // 입고기록 배치 INSERT
      await db.insert(inboundRecords).values(
        validItems.map(item => ({
          organizationId,
          warehouseId: warehouse.id,
          purchaseOrderId: null,
          productId: item.productId,
          date: today,
          expectedQuantity: item.quantity,
          receivedQuantity: item.quantity,
          acceptedQuantity: item.quantity,
          rejectedQuantity: 0,
          qualityResult: "pass" as const,
          location: item.location,
          lotNumber: item.lotNumber,
          expiryDate: item.expiryDate,
          notes: item.notes,
        }))
      );

      // LOT 배치 INSERT
      await db.insert(inventoryLots).values(
        validItems.map(item => ({
          organizationId,
          warehouseId: warehouse.id,
          productId: item.productId,
          lotNumber: item.lotNumber,
          expiryDate: item.expiryDate,
          initialQuantity: item.quantity,
          remainingQuantity: item.quantity,
          receivedDate: today,
          status: "active" as const,
        }))
      );

      // 재고 증감: 제품별로 합산 후 배치 UPSERT
      const stockByProduct = new Map<string, number>();
      for (const item of validItems) {
        stockByProduct.set(item.productId, (stockByProduct.get(item.productId) || 0) + item.quantity);
      }

      // 기존 재고 조회
      const productIds = [...stockByProduct.keys()];
      const existingInventory = await db
        .select({ id: inventory.id, productId: inventory.productId, currentStock: inventory.currentStock })
        .from(inventory)
        .where(and(eq(inventory.organizationId, organizationId), eq(inventory.warehouseId, warehouse.id)))
        ;
      const invMap = new Map(existingInventory.map(inv => [inv.productId, inv]));

      // 기존 재고 배치 UPDATE
      const invUpdates = [...stockByProduct.entries()]
        .filter(([pid]) => invMap.has(pid))
        .map(([pid, qty]) => ({ id: invMap.get(pid)!.id, newStock: invMap.get(pid)!.currentStock + qty }));

      if (invUpdates.length > 0) {
        await db.execute(sql`
          UPDATE inventory SET
            current_stock = v.new_stock::numeric,
            available_stock = GREATEST(0, v.new_stock::numeric - inventory.reserved_stock),
            updated_at = NOW()
          FROM (VALUES ${sql.join(
            invUpdates.map(u => sql`(${u.id}::uuid, ${u.newStock}::numeric)`),
            sql`, `
          )}) AS v(id, new_stock)
          WHERE inventory.id = v.id
        `);
      }

      // 신규 재고 배치 INSERT
      const newInvProducts = [...stockByProduct.entries()].filter(([pid]) => !invMap.has(pid));
      if (newInvProducts.length > 0) {
        await db.insert(inventory).values(
          newInvProducts.map(([productId, qty]) => ({
            organizationId,
            warehouseId: warehouse.id,
            productId,
            currentStock: qty,
            availableStock: qty,
            reservedStock: 0,
            incomingStock: 0,
          }))
        );
      }

      // 재고 변동 이력 배치 INSERT
      await db.insert(inventoryHistory).values(
        validItems.map(item => ({
          organizationId,
          productId: item.productId,
          warehouseId: warehouse.id,
          changeType: item.inboundType,
          changeAmount: item.quantity,
          notes: item.notes || "엑셀 일괄 기타입고",
        }))
      );

      successCount = validItems.length;
    } catch (err) {
      errors.push({ row: 0, message: `배치 처리 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}` });
    }
  }

  return {
    success: successCount > 0,
    message: successCount > 0
      ? `${successCount}/${rows.length}건 입고 처리 완료`
      : "입고 처리에 실패했습니다",
    totalRows: rows.length,
    successCount,
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
