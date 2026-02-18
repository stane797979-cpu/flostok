/**
 * 창고 간 재고이동 Excel 임포트 서비스
 *
 * 엑셀 업로드 → transferInventory() 호출 → 즉시 재고 반영
 */

import { db } from "@/server/db";
import { products, warehouses } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  parseExcelBuffer,
  sheetToJson,
  parseNumber,
} from "./parser";
import type { ExcelImportResult, ExcelImportError } from "./types";

let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 컬럼 별칭 매핑
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  sku: ["SKU", "sku", "품목코드", "제품코드", "상품코드", "품번"],
  sourceWarehouse: ["출발창고", "출고창고", "발송지", "발송창고", "sourceWarehouse"],
  targetWarehouse: ["도착창고", "도착지창고", "입고창고", "목적지창고", "targetWarehouse"],
  quantity: ["수량", "이동수량", "quantity", "Quantity", "Qty"],
  notes: ["비고", "사유", "메모", "notes", "Notes", "Memo"],
};

function getColumnValue(row: Record<string, unknown>, fieldName: string): unknown {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];
  for (const alias of aliases) {
    if (row[alias] !== undefined) return row[alias];
  }
  return undefined;
}

export interface TransferExcelRow {
  sku: string;
  sourceWarehouse: string;
  targetWarehouse: string;
  quantity: number;
  notes?: string;
}

export interface ImportTransferOptions {
  organizationId: string;
  userId: string;
  buffer: ArrayBuffer;
  sheetName?: string;
}

/**
 * 재고이동 Excel → transferInventory 호출 (즉시 반영)
 */
export async function importTransferData(
  options: ImportTransferOptions
): Promise<ExcelImportResult<TransferExcelRow>> {
  const { organizationId, buffer, sheetName } = options;

  const allErrors: ExcelImportError[] = [];
  const successData: TransferExcelRow[] = [];

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

    // 3. 조직의 창고 목록 조회 (이름/코드 → warehouseId 매핑)
    const orgWarehouses = await db
      .select({ id: warehouses.id, name: warehouses.name, code: warehouses.code })
      .from(warehouses)
      .where(eq(warehouses.organizationId, organizationId));

    const warehouseMap = new Map<string, string>();
    for (const w of orgWarehouses) {
      warehouseMap.set(w.name, w.id);
      warehouseMap.set(w.code, w.id);
    }

    // 4. 행 파싱 + 유효성 검사
    interface ParsedTransfer {
      productId: string;
      sourceWarehouseId: string;
      targetWarehouseId: string;
      quantity: number;
      notes?: string;
      row: TransferExcelRow;
    }
    const parsedItems: ParsedTransfer[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const rowErrors: ExcelImportError[] = [];

      // SKU 필수
      const sku = getColumnValue(row, "sku");
      if (!sku || String(sku).trim() === "") {
        rowErrors.push({ row: rowNum, column: "SKU", value: sku, message: "SKU가 비어있습니다" });
      }

      // 출발창고 필수
      const sourceWarehouseValue = getColumnValue(row, "sourceWarehouse");
      if (!sourceWarehouseValue || String(sourceWarehouseValue).trim() === "") {
        rowErrors.push({ row: rowNum, column: "출발창고", value: sourceWarehouseValue, message: "출발창고가 비어있습니다" });
      }

      // 도착창고 필수
      const targetWarehouseValue = getColumnValue(row, "targetWarehouse");
      if (!targetWarehouseValue || String(targetWarehouseValue).trim() === "") {
        rowErrors.push({ row: rowNum, column: "도착창고", value: targetWarehouseValue, message: "도착창고가 비어있습니다" });
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

      // 출발창고 존재 확인
      const sourceName = String(sourceWarehouseValue).trim();
      const sourceWarehouseId = warehouseMap.get(sourceName);
      if (!sourceWarehouseId) {
        allErrors.push({
          row: rowNum,
          column: "출발창고",
          value: sourceName,
          message: `존재하지 않는 창고입니다: ${sourceName} (등록된 창고: ${orgWarehouses.map((w) => w.name).join(", ")})`,
        });
        continue;
      }

      // 도착창고 존재 확인
      const targetName = String(targetWarehouseValue).trim();
      const targetWarehouseId = warehouseMap.get(targetName);
      if (!targetWarehouseId) {
        allErrors.push({
          row: rowNum,
          column: "도착창고",
          value: targetName,
          message: `존재하지 않는 창고입니다: ${targetName} (등록된 창고: ${orgWarehouses.map((w) => w.name).join(", ")})`,
        });
        continue;
      }

      // 같은 창고 방지
      if (sourceWarehouseId === targetWarehouseId) {
        allErrors.push({
          row: rowNum,
          column: "도착창고",
          value: targetName,
          message: "출발창고와 도착창고가 같을 수 없습니다",
        });
        continue;
      }

      const notes = getColumnValue(row, "notes");

      const rowData: TransferExcelRow = {
        sku: skuStr,
        sourceWarehouse: sourceName,
        targetWarehouse: targetName,
        quantity: quantity!,
        notes: notes ? String(notes).trim() : undefined,
      };

      parsedItems.push({
        productId: product.id,
        sourceWarehouseId,
        targetWarehouseId,
        quantity: quantity!,
        notes: notes ? String(notes).trim() : undefined,
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

    // 5. transferInventory 서버 액션으로 각 이동 처리
    const { transferInventory } = await import("@/server/actions/warehouses");

    for (let i = 0; i < parsedItems.length; i++) {
      const item = parsedItems[i];
      try {
        const result = await transferInventory({
          productId: item.productId,
          sourceWarehouseId: item.sourceWarehouseId,
          targetWarehouseId: item.targetWarehouseId,
          quantity: item.quantity,
          notes: item.notes || `엑셀 일괄 재고이동`,
        });

        if (result.success) {
          successData.push(item.row);
        } else {
          allErrors.push({
            row: i + 2,
            column: "수량",
            value: item.quantity,
            message: `이동 실패 (${item.row.sku}): ${result.error}`,
          });
        }
      } catch (error) {
        allErrors.push({
          row: i + 2,
          message: `처리 실패 (${item.row.sku}): ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        });
      }
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
 * 재고이동 Excel 템플릿 생성
 */
export async function createTransferTemplate(): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();

  const templateData = [
    {
      SKU: "SKU-A001",
      출발창고: "본사창고",
      도착창고: "부산창고",
      수량: 100,
      비고: "부산 물류센터 이관",
    },
    {
      SKU: "SKU-A002",
      출발창고: "본사창고",
      도착창고: "부산창고",
      수량: 50,
      비고: "",
    },
    {
      SKU: "SKU-A003",
      출발창고: "부산창고",
      도착창고: "본사창고",
      수량: 30,
      비고: "본사 재고 보충",
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  worksheet["!cols"] = [
    { wch: 14 }, // SKU
    { wch: 14 }, // 출발창고
    { wch: 14 }, // 도착창고
    { wch: 10 }, // 수량
    { wch: 24 }, // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "재고이동");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
