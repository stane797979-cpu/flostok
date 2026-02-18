/**
 * 출고 데이터 Excel → 출고요청(outbound_requests) 생성 서비스
 *
 * 엑셀 업로드 → outbound_requests (pending) 생성
 * 창고 확정(confirmOutboundRequest) → 재고 차감
 */

import { db } from "@/server/db";
import { products, outboundRequests, outboundRequestItems, warehouses } from "@/server/db/schema";
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
  customerType: ["고객유형", "B2B/B2C", "customerType", "거래유형"],
  sourceWarehouse: ["발송지", "출고창고", "발송창고", "출발창고", "sourceWarehouse"],
  targetWarehouse: ["도착창고", "도착지창고", "입고창고", "목적지창고", "targetWarehouse"],
  recipientCompany: ["상호", "수령업체", "업체명", "recipientCompany", "회사명"],
  recipientName: ["수령인", "받는분", "수취인", "recipientName"],
  recipientAddress: ["주소", "배송주소", "도착지주소", "recipientAddress", "address"],
  recipientPhone: ["연락처", "전화번호", "수령인연락처", "recipientPhone", "phone"],
  courierName: ["택배사", "배송업체", "courierName", "courier"],
  trackingNumber: ["송장번호", "운송장번호", "trackingNumber", "tracking"],
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
  "창고이동": "OUTBOUND_TRANSFER",
  "재고이동": "OUTBOUND_TRANSFER",
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

    // 2-1. 조직의 창고 목록 조회 (이름 → warehouseId 매핑, 창고이동용)
    const orgWarehouses = await db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.organizationId, organizationId));

    const warehouseNameToId = new Map(orgWarehouses.map((w) => [w.name, w.id]));

    // 3. 행 파싱 + 유효성 검사
    interface ParsedItem {
      productId: string;
      quantity: number;
      outboundTypeKey: string; // OUTBOUND_SALE 등
      date: string;
      notes?: string;
      // 창고이동용
      sourceWarehouseIdOverride?: string; // 엑셀에서 발송지 지정 시
      targetWarehouseId?: string;
      // 배송 정보 (그룹 키로 사용)
      customerType?: string;
      recipientCompany?: string;
      recipientName?: string;
      recipientAddress?: string;
      recipientPhone?: string;
      courierName?: string;
      trackingNumber?: string;
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

      // 창고이동(OUTBOUND_TRANSFER)일 때 출발/도착 창고 처리
      let sourceWarehouseIdOverride: string | undefined;
      let targetWarehouseId: string | undefined;

      if (outboundTypeKey === "OUTBOUND_TRANSFER") {
        // 도착창고 필수
        const targetWarehouseValue = getColumnValue(row, "targetWarehouse");
        if (!targetWarehouseValue || String(targetWarehouseValue).trim() === "") {
          allErrors.push({ row: rowNum, column: "도착창고", value: targetWarehouseValue, message: "창고이동 시 도착창고는 필수입니다" });
          continue;
        }
        const targetName = String(targetWarehouseValue).trim();
        const targetId = warehouseNameToId.get(targetName);
        if (!targetId) {
          allErrors.push({ row: rowNum, column: "도착창고", value: targetName, message: `존재하지 않는 창고입니다: ${targetName} (등록된 창고: ${orgWarehouses.map(w => w.name).join(", ")})` });
          continue;
        }
        targetWarehouseId = targetId;

        // 발송지(출발창고) — 있으면 override
        const sourceWarehouseValue = getColumnValue(row, "sourceWarehouse");
        if (sourceWarehouseValue && String(sourceWarehouseValue).trim() !== "") {
          const sourceName = String(sourceWarehouseValue).trim();
          const sourceId = warehouseNameToId.get(sourceName);
          if (!sourceId) {
            allErrors.push({ row: rowNum, column: "발송지", value: sourceName, message: `존재하지 않는 창고입니다: ${sourceName} (등록된 창고: ${orgWarehouses.map(w => w.name).join(", ")})` });
            continue;
          }
          if (sourceId === targetWarehouseId) {
            allErrors.push({ row: rowNum, column: "도착창고", value: targetName, message: "출발창고와 도착창고가 같을 수 없습니다" });
            continue;
          }
          sourceWarehouseIdOverride = sourceId;
        }
      }

      const dateStr = formatDateToString(parsedDate!);
      const notes = getColumnValue(row, "notes");
      const channel = getColumnValue(row, "channel");

      // 배송 관련 필드
      const customerType = getColumnValue(row, "customerType");
      const recipientCompany = getColumnValue(row, "recipientCompany");
      const recipientName = getColumnValue(row, "recipientName");
      const recipientAddress = getColumnValue(row, "recipientAddress");
      const recipientPhone = getColumnValue(row, "recipientPhone");
      const courierName = getColumnValue(row, "courierName");
      const trackingNumber = getColumnValue(row, "trackingNumber");

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
        sourceWarehouseIdOverride,
        targetWarehouseId,
        customerType: customerType ? String(customerType).trim() : undefined,
        recipientCompany: recipientCompany ? String(recipientCompany).trim() : undefined,
        recipientName: recipientName ? String(recipientName).trim() : undefined,
        recipientAddress: recipientAddress ? String(recipientAddress).trim() : undefined,
        recipientPhone: recipientPhone ? String(recipientPhone).trim() : undefined,
        courierName: courierName ? String(courierName).trim() : undefined,
        trackingNumber: trackingNumber ? String(trackingNumber).trim() : undefined,
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

    // 4. 출고유형 + 수령인별 그룹화 → 그룹당 1개 outbound_request 생성
    //    같은 유형이라도 수령인이 다르면 별도 요청
    const groupedByKey = new Map<string, ParsedItem[]>();
    for (const item of parsedItems) {
      const groupKey = [
        item.outboundTypeKey,
        item.sourceWarehouseIdOverride || "",
        item.targetWarehouseId || "",
        item.customerType || "",
        item.recipientCompany || "",
        item.recipientName || "",
        item.recipientAddress || "",
        item.recipientPhone || "",
      ].join("||");
      const existing = groupedByKey.get(groupKey) || [];
      existing.push(item);
      groupedByKey.set(groupKey, existing);
    }

    // 5. 그룹별 outbound_request + items 생성
    for (const [, items] of groupedByKey) {
      const first = items[0];
      const requestNumber = generateRequestNumber();

      const [request] = await db
        .insert(outboundRequests)
        .values({
          organizationId,
          sourceWarehouseId: first.sourceWarehouseIdOverride || sourceWarehouseId,
          targetWarehouseId: first.targetWarehouseId || null,
          requestNumber,
          status: "pending",
          outboundType: first.outboundTypeKey,
          requestedById: userId,
          notes: `엑셀 업로드 (${items.length}건)`,
          customerType: first.customerType || null,
          recipientCompany: first.recipientCompany || null,
          recipientName: first.recipientName || null,
          recipientAddress: first.recipientAddress || null,
          recipientPhone: first.recipientPhone || null,
          courierName: first.courierName || null,
          trackingNumber: first.trackingNumber || null,
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
      고객유형: "B2C",
      채널: "온라인",
      발송지: "",
      도착창고: "",
      상호: "",
      수령인: "홍길동",
      주소: "서울시 강남구 테헤란로 123",
      연락처: "010-1234-5678",
      택배사: "CJ대한통운",
      송장번호: "1234567890",
      비고: "예시 데이터",
    },
    {
      SKU: "SKU-A002",
      날짜: "2026-01-15",
      수량: 30,
      출고유형: "판매",
      고객유형: "B2B",
      채널: "",
      발송지: "",
      도착창고: "",
      상호: "(주)ABC상사",
      수령인: "김철수",
      주소: "부산시 해운대구 센텀로 45",
      연락처: "051-123-4567",
      택배사: "로젠택배",
      송장번호: "9876543210",
      비고: "B2B 거래처 출고",
    },
    {
      SKU: "SKU-A003",
      날짜: "2026-01-16",
      수량: 200,
      출고유형: "창고이동",
      고객유형: "",
      채널: "",
      발송지: "본사창고",
      도착창고: "부산창고",
      상호: "",
      수령인: "",
      주소: "",
      연락처: "",
      택배사: "",
      송장번호: "",
      비고: "부산 물류센터 이동",
    },
    {
      SKU: "SKU-A004",
      날짜: "2026-01-16",
      수량: 5,
      출고유형: "샘플",
      고객유형: "",
      채널: "",
      발송지: "",
      도착창고: "",
      상호: "",
      수령인: "",
      주소: "",
      연락처: "",
      택배사: "",
      송장번호: "",
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
    { wch: 10 }, // 고객유형
    { wch: 10 }, // 채널
    { wch: 14 }, // 발송지(출발창고)
    { wch: 14 }, // 도착창고
    { wch: 16 }, // 상호
    { wch: 10 }, // 수령인
    { wch: 30 }, // 주소
    { wch: 16 }, // 연락처
    { wch: 12 }, // 택배사
    { wch: 16 }, // 송장번호
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "출고데이터");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
