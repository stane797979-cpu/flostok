/**
 * 제품 데이터 Excel 임포트 서비스
 */

import { db } from "@/server/db";
import { products, inventory, warehouses } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { parseExcelBuffer, sheetToJson, parseNumber } from "./parser";
import type { ExcelImportResult, ExcelImportError, ProductExcelRow } from "./types";

/**
 * 조직의 기본 창고 ID 조회 (없으면 자동 생성)
 */
async function getOrCreateDefaultWarehouseId(organizationId: string): Promise<string> {
  const [existing] = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(
      and(
        eq(warehouses.organizationId, organizationId),
        eq(warehouses.isDefault, true),
        eq(warehouses.isActive, true)
      )
    )
    .limit(1);

  if (existing) return existing.id;

  // 기본 창고가 없으면 생성
  const [created] = await db
    .insert(warehouses)
    .values({
      organizationId,
      code: "MAIN",
      name: "본사 창고",
      type: "MAIN",
      isDefault: true,
      isActive: true,
    })
    .returning({ id: warehouses.id });

  return created.id;
}

let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 제품 데이터 Excel 컬럼 매핑
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  sku: ["SKU", "sku", "품목코드", "제품코드", "상품코드", "품번"],
  name: ["제품명", "name", "상품명", "품명", "Name"],
  category: ["카테고리", "category", "분류", "Category"],
  unit: ["단위", "unit", "Unit"],
  unitPrice: ["판매단가", "unitPrice", "판매가", "UnitPrice", "Price"],
  costPrice: ["원가", "costPrice", "매입가", "CostPrice", "Cost"],
  currentStock: ["재고수량", "currentStock", "현재고", "재고", "수량", "Stock", "Qty"],
  safetyStock: ["안전재고", "safetyStock", "SafetyStock"],
  leadTime: ["리드타임", "leadTime", "LeadTime", "LT"],
  moq: ["MOQ", "moq", "최소발주수량"],
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
 * 제품 데이터 Excel 행 파싱
 */
function parseProductRow(
  row: Record<string, unknown>,
  rowIndex: number
): { data: ProductExcelRow | null; errors: ExcelImportError[] } {
  const errors: ExcelImportError[] = [];
  const rowNum = rowIndex + 2;

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

  // 제품명 필수
  const name = getColumnValue(row, "name");
  if (!name || String(name).trim() === "") {
    errors.push({
      row: rowNum,
      column: "제품명",
      value: name,
      message: "제품명이 비어있습니다",
    });
  }

  if (errors.length > 0) {
    return { data: null, errors };
  }

  // 선택 필드
  const category = getColumnValue(row, "category");
  const unit = getColumnValue(row, "unit");
  const unitPrice = parseNumber(getColumnValue(row, "unitPrice"));
  const costPrice = parseNumber(getColumnValue(row, "costPrice"));
  const currentStock = parseNumber(getColumnValue(row, "currentStock"));
  const safetyStock = parseNumber(getColumnValue(row, "safetyStock"));
  const leadTime = parseNumber(getColumnValue(row, "leadTime"));
  const moq = parseNumber(getColumnValue(row, "moq"));

  return {
    data: {
      sku: String(sku).trim(),
      name: String(name).trim(),
      category: category ? String(category).trim() : undefined,
      unit: unit ? String(unit).trim() : undefined,
      unitPrice: unitPrice ?? undefined,
      costPrice: costPrice ?? undefined,
      currentStock: currentStock ?? undefined,
      safetyStock: safetyStock ?? undefined,
      leadTime: leadTime ?? undefined,
      moq: moq ?? undefined,
    },
    errors: [],
  };
}

export interface ImportProductDataOptions {
  organizationId: string;
  buffer: ArrayBuffer;
  sheetName?: string;
  /** 중복 SKU 처리: skip, update, error */
  duplicateHandling?: "skip" | "update" | "error";
}

/**
 * 제품 데이터 Excel 임포트
 */
export async function importProductData(
  options: ImportProductDataOptions
): Promise<ExcelImportResult<ProductExcelRow>> {
  const { organizationId, buffer, sheetName, duplicateHandling = "update" } = options;

  const allErrors: ExcelImportError[] = [];
  const successData: ProductExcelRow[] = [];

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

    // 기본 창고 ID 조회 (재고 생성 시 필요)
    const defaultWarehouseId = await getOrCreateDefaultWarehouseId(organizationId);

    // 기존 제품 조회
    const existingProducts = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(eq(products.organizationId, organizationId));

    const skuToId = new Map(existingProducts.map((p) => [p.sku, p.id]));

    // 기존 재고 배치 조회 (N+1 제거) — reservedStock 포함하여 availableStock 계산에 활용
    const existingInventory = await db
      .select({ id: inventory.id, productId: inventory.productId, reservedStock: inventory.reservedStock })
      .from(inventory)
      .where(eq(inventory.organizationId, organizationId));
    const inventoryByProductId = new Map(
      existingInventory.map((inv) => [inv.productId, { id: inv.id, reservedStock: inv.reservedStock ?? 0 }])
    );

    // 재고 업데이트/생성 배치 수집용
    const inventoryUpdates: Array<{ invId: string; currentStock: number; reservedStock: number }> = [];
    const inventoryInserts: Array<{ productId: string; currentStock: number }> = [];

    for (let i = 0; i < rows.length; i++) {
      const { data, errors } = parseProductRow(rows[i], i);

      if (errors.length > 0) {
        allErrors.push(...errors);
        continue;
      }

      if (!data) continue;

      const existingId = skuToId.get(data.sku);

      if (existingId) {
        if (duplicateHandling === "error") {
          allErrors.push({
            row: i + 2,
            column: "SKU",
            value: data.sku,
            message: `중복 SKU: ${data.sku}`,
          });
          continue;
        }

        if (duplicateHandling === "skip") {
          continue;
        }

        // update: 기존 제품 업데이트
        await db
          .update(products)
          .set({
            name: data.name,
            category: data.category,
            unit: data.unit ?? "EA",
            unitPrice: data.unitPrice ?? 0,
            costPrice: data.costPrice ?? 0,
            safetyStock: data.safetyStock ?? 0,
            leadTime: data.leadTime ?? 7,
            moq: data.moq ?? 1,
            updatedAt: new Date(),
          })
          .where(eq(products.id, existingId));

        // 재고수량이 있으면 배치 수집
        if (data.currentStock !== undefined) {
          const invEntry = inventoryByProductId.get(existingId);
          if (invEntry) {
            // availableStock = currentStock - reservedStock (예약재고 유지)
            inventoryUpdates.push({
              invId: invEntry.id,
              currentStock: data.currentStock,
              reservedStock: invEntry.reservedStock,
            });
          } else {
            inventoryInserts.push({ productId: existingId, currentStock: data.currentStock });
          }
        }

        successData.push(data);
        continue;
      }

      // 새 제품 삽입
      const [newProduct] = await db.insert(products).values({
        organizationId,
        sku: data.sku,
        name: data.name,
        category: data.category,
        unit: data.unit ?? "EA",
        unitPrice: data.unitPrice ?? 0,
        costPrice: data.costPrice ?? 0,
        safetyStock: data.safetyStock ?? 0,
        leadTime: data.leadTime ?? 7,
        moq: data.moq ?? 1,
      }).returning({ id: products.id });

      // 재고수량이 있으면 배치 수집
      if (newProduct && data.currentStock !== undefined) {
        inventoryInserts.push({ productId: newProduct.id, currentStock: data.currentStock });
      }

      successData.push(data);
    }

    // 재고 배치 INSERT (신규) — warehouseId 필수
    if (inventoryInserts.length > 0) {
      await db.insert(inventory).values(
        inventoryInserts.map((item) => ({
          organizationId,
          warehouseId: defaultWarehouseId,
          productId: item.productId,
          currentStock: item.currentStock,
          availableStock: item.currentStock,
          reservedStock: 0,
          incomingStock: 0,
        }))
      );
    }

    // 재고 배치 UPDATE (기존) — Promise.all 병렬화
    // availableStock = currentStock - reservedStock (예약재고를 차감하여 실제 가용재고 반영)
    if (inventoryUpdates.length > 0) {
      await Promise.all(
        inventoryUpdates.map((item) =>
          db.update(inventory).set({
            currentStock: item.currentStock,
            availableStock: Math.max(0, item.currentStock - item.reservedStock),
            updatedAt: new Date(),
          }).where(eq(inventory.id, item.invId))
        )
      );
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
 * 제품 데이터 Excel 템플릿 생성
 */
export async function createProductTemplate(): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();

  // 필수: SKU, 제품명
  // 권장: 카테고리, 단위, 판매단가, 재고수량
  // 선택: 원가, 안전재고, 리드타임, MOQ (비워두면 기본값 적용)
  const templateData = [
    {
      SKU: "SKU-A001",
      제품명: "프리미엄 블루투스 스피커",
      카테고리: "전자기기",
      단위: "EA",
      판매단가: 89000,
      재고수량: 150,
    },
    {
      SKU: "SKU-A002",
      제품명: "무선 충전 패드",
      카테고리: "전자기기",
      단위: "EA",
      판매단가: 35000,
      재고수량: 80,
    },
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(templateData);

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 25 },
    { wch: 12 },
    { wch: 6 },
    { wch: 10 },
    { wch: 10 },
  ];

  // 안내 시트 추가
  const guideData = [
    { 항목: "SKU", 필수여부: "필수", 설명: "제품 고유 코드 (예: SKU-A001)" },
    { 항목: "제품명", 필수여부: "필수", 설명: "제품 이름" },
    { 항목: "카테고리", 필수여부: "선택", 설명: "비워두면 '기타'로 분류" },
    { 항목: "단위", 필수여부: "선택", 설명: "비워두면 'EA' (개)" },
    { 항목: "판매단가", 필수여부: "선택", 설명: "비워두면 0원" },
    { 항목: "재고수량", 필수여부: "권장", 설명: "현재 보유 재고수량 (비워두면 0)" },
    { 항목: "원가", 필수여부: "선택", 설명: "비워두면 0원" },
    { 항목: "안전재고", 필수여부: "선택", 설명: "비워두면 시스템이 자동 계산 (기본: 0)" },
    { 항목: "리드타임", 필수여부: "선택", 설명: "비워두면 7일 적용" },
    { 항목: "MOQ", 필수여부: "선택", 설명: "최소발주수량, 비워두면 1개" },
  ];
  const guideSheet = XLSX.utils.json_to_sheet(guideData);
  guideSheet["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 45 }];

  XLSX.utils.book_append_sheet(workbook, worksheet, "제품마스터");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "입력안내");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
