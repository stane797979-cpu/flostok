/**
 * 제품 데이터 Excel 임포트 서비스
 */

import { db } from "@/server/db";
import { products, inventory } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { parseExcelBuffer, sheetToJson, parseNumber } from "./parser";
import type { ExcelImportResult, ExcelImportError, ProductExcelRow } from "./types";

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
  reorderPoint: ["발주점", "reorderPoint", "ReorderPoint", "발주기준"],
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
  const reorderPoint = parseNumber(getColumnValue(row, "reorderPoint"));
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
      reorderPoint: reorderPoint ?? undefined,
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

    // 기존 제품 조회 (1회)
    const existingProducts = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(eq(products.organizationId, organizationId));

    const skuToId = new Map(existingProducts.map((p) => [p.sku, p.id]));

    // 1단계: 모든 행을 파싱하여 update/insert 대상 분리
    type ParsedRow = { data: ProductExcelRow; rowIndex: number };
    const toUpdate: (ParsedRow & { existingId: string })[] = [];
    const toInsert: ParsedRow[] = [];

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
          allErrors.push({ row: i + 2, column: "SKU", value: data.sku, message: `중복 SKU: ${data.sku}` });
          continue;
        }
        if (duplicateHandling === "skip") continue;
        toUpdate.push({ data, rowIndex: i, existingId });
      } else {
        toInsert.push({ data, rowIndex: i });
      }
    }

    // 2단계: 기존 제품 업데이트 — 개별 쿼리 불가피하나 Promise.all로 병렬 처리
    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ data, existingId }) =>
          db.update(products)
            .set({
              name: data.name,
              category: data.category,
              unit: data.unit ?? "EA",
              unitPrice: data.unitPrice ?? 0,
              costPrice: data.costPrice ?? 0,
              safetyStock: data.safetyStock ?? 0,
              reorderPoint: data.reorderPoint ?? 0,
              leadTime: data.leadTime ?? 7,
              moq: data.moq ?? 1,
              updatedAt: new Date(),
            })
            .where(eq(products.id, existingId))
        )
      );
      toUpdate.forEach(({ data }) => successData.push(data));
    }

    // 3단계: 신규 제품 배치 insert (1회)
    let insertedIds: string[] = [];
    if (toInsert.length > 0) {
      const insertValues = toInsert.map(({ data }) => ({
        organizationId,
        sku: data.sku,
        name: data.name,
        category: data.category,
        unit: data.unit ?? "EA",
        unitPrice: data.unitPrice ?? 0,
        costPrice: data.costPrice ?? 0,
        safetyStock: data.safetyStock ?? 0,
        reorderPoint: data.reorderPoint ?? 0,
        leadTime: data.leadTime ?? 7,
        moq: data.moq ?? 1,
      }));

      const inserted = await db.insert(products).values(insertValues).returning({ id: products.id, sku: products.sku });
      insertedIds = inserted.map((r) => r.id);
      const insertedSkuToId = new Map(inserted.map((r) => [r.sku, r.id]));
      toInsert.forEach(({ data }) => {
        if (insertedSkuToId.has(data.sku)) successData.push(data);
      });
    }

    // 4단계: inventory 배치 upsert — onConflictDoUpdate (1회)
    const inventoryValues: { organizationId: string; productId: string; currentStock: number; availableStock: number }[] = [];

    for (const { data, existingId } of toUpdate) {
      if (data.currentStock !== undefined) {
        inventoryValues.push({ organizationId, productId: existingId, currentStock: data.currentStock, availableStock: data.currentStock });
      }
    }

    if (toInsert.length > 0 && insertedIds.length > 0) {
      const insertedProducts = await db
        .select({ id: products.id, sku: products.sku })
        .from(products)
        .where(inArray(products.id, insertedIds));
      const idToSku = new Map(insertedProducts.map((p) => [p.id, p.sku]));

      for (const { data } of toInsert) {
        if (data.currentStock === undefined) continue;
        const productId = insertedProducts.find((p) => p.sku === data.sku)?.id;
        if (productId) {
          inventoryValues.push({ organizationId, productId, currentStock: data.currentStock, availableStock: data.currentStock });
        }
      }
      void idToSku; // suppress unused warning
    }

    if (inventoryValues.length > 0) {
      await db.insert(inventory).values(
        inventoryValues.map((v) => ({
          organizationId: v.organizationId,
          productId: v.productId,
          currentStock: v.currentStock,
          availableStock: v.availableStock,
          reservedStock: 0,
          incomingStock: 0,
        }))
      ).onConflictDoUpdate({
        target: [inventory.organizationId, inventory.productId],
        set: {
          currentStock: inventory.currentStock,
          availableStock: inventory.availableStock,
          updatedAt: new Date(),
        },
      });
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
 * inventory 테이블 upsert (있으면 업데이트, 없으면 생성)
 */

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
