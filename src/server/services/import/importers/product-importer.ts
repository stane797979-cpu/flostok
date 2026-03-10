/**
 * 제품 마스터 임포터
 */

import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ProductRowData } from "../validators/product-validator";

export interface ImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{
    row: number;
    sku: string;
    error: string;
  }>;
}

/**
 * 기존 SKU 목록 조회
 */
async function getExistingSkuMap(organizationId: string): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, organizationId));

  const map = new Map<string, string>();
  existing.forEach((product) => {
    map.set(product.sku, product.id);
  });

  return map;
}

/** 행 데이터를 INSERT values 형태로 변환 */
function toInsertValues(organizationId: string, row: ProductRowData) {
  return {
    organizationId,
    sku: row.sku,
    name: row.name,
    category: row.category,
    description: row.description,
    unit: row.unit,
    unitPrice: row.unitPrice,
    costPrice: row.costPrice,
    abcGrade: row.abcGrade,
    xyzGrade: row.xyzGrade,
    moq: row.moq,
    leadTime: row.leadTime,
    safetyStock: row.safetyStock,
    reorderPoint: row.reorderPoint,
    targetStock: row.targetStock,
    barcode: row.barcode,
    imageUrl: row.imageUrl,
  };
}

/** 행 데이터를 UPDATE set 형태로 변환 */
function toUpdateSet(row: ProductRowData) {
  return {
    name: row.name,
    category: row.category,
    description: row.description,
    unit: row.unit,
    unitPrice: row.unitPrice,
    costPrice: row.costPrice,
    abcGrade: row.abcGrade,
    xyzGrade: row.xyzGrade,
    moq: row.moq,
    leadTime: row.leadTime,
    safetyStock: row.safetyStock,
    reorderPoint: row.reorderPoint,
    targetStock: row.targetStock,
    barcode: row.barcode,
    imageUrl: row.imageUrl,
    updatedAt: new Date(),
  };
}

/**
 * 제품 마스터 일괄 임포트
 * @param organizationId - 조직 ID
 * @param validatedData - 검증된 제품 데이터
 * @param options - 임포트 옵션
 */
export async function importProductData(
  organizationId: string,
  validatedData: ProductRowData[],
  options?: {
    updateExisting?: boolean; // 기존 제품 업데이트
    batchSize?: number; // 배치 크기
  }
): Promise<ImportResult> {
  const { updateExisting = false, batchSize = 50 } = options || {};

  const errors: Array<{ row: number; sku: string; error: string }> = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // 기존 SKU 매핑 — 1회 선조회
    const existingSkuMap = await getExistingSkuMap(organizationId);

    // 배치 처리
    for (let i = 0; i < validatedData.length; i += batchSize) {
      const batch = validatedData.slice(i, i + batchSize);

      // 1단계: 메모리에서 신규 / 업데이트 / 스킵 분류
      type ClassifiedRow = { row: ProductRowData; rowNumber: number; existingId?: string };
      const newRows: ClassifiedRow[] = [];
      const updateRows: ClassifiedRow[] = [];

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNumber = i + j + 2; // Excel 행 번호 (헤더 제외, 1-based)
        const existingId = existingSkuMap.get(row.sku);

        if (existingId) {
          if (updateExisting) {
            updateRows.push({ row, rowNumber, existingId });
          } else {
            skipped++;
          }
        } else {
          newRows.push({ row, rowNumber });
        }
      }

      // 2단계: 신규 제품 배치 INSERT
      if (newRows.length > 0) {
        const insertValues = newRows.map(({ row }) => toInsertValues(organizationId, row));

        let batchSuccess = false;
        try {
          const inserted = await db
            .insert(products)
            .values(insertValues)
            .returning({ id: products.id, sku: products.sku });

          // existingSkuMap 일괄 업데이트
          for (const p of inserted) {
            existingSkuMap.set(p.sku, p.id);
          }
          imported += inserted.length;
          batchSuccess = true;
        } catch {
          // 배치 INSERT 실패 시 개별 INSERT 폴백
          batchSuccess = false;
        }

        if (!batchSuccess) {
          for (const { row, rowNumber } of newRows) {
            try {
              const [newProduct] = await db
                .insert(products)
                .values(toInsertValues(organizationId, row))
                .returning({ id: products.id, sku: products.sku });

              if (newProduct) {
                existingSkuMap.set(newProduct.sku, newProduct.id);
              }
              imported++;
            } catch (error) {
              errors.push({
                row: rowNumber,
                sku: row.sku,
                error: error instanceof Error ? error.message : "알 수 없는 오류",
              });
              skipped++;
            }
          }
        }
      }

      // 3단계: 기존 제품 병렬 UPDATE
      if (updateRows.length > 0) {
        const updateResults = await Promise.all(
          updateRows.map(({ row, existingId }) =>
            db
              .update(products)
              .set(toUpdateSet(row))
              .where(and(eq(products.id, existingId!), eq(products.organizationId, organizationId)))
              .then(() => ({ ok: true as const, sku: row.sku }))
              .catch((error: unknown) => ({
                ok: false as const,
                sku: row.sku,
                rowNumber: updateRows.find((r) => r.row.sku === row.sku)?.rowNumber ?? 0,
                error: error instanceof Error ? error.message : "알 수 없는 오류",
              }))
          )
        );

        for (const result of updateResults) {
          if (result.ok) {
            updated++;
          } else {
            errors.push({
              row: result.rowNumber,
              sku: result.sku,
              error: result.error,
            });
            skipped++;
          }
        }
      }
    }

    return {
      success: true,
      imported,
      updated,
      skipped,
      errors,
    };
  } catch (error) {
    console.error("제품 마스터 임포트 오류:", error);
    throw new Error(
      `제품 마스터 임포트 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
    );
  }
}
