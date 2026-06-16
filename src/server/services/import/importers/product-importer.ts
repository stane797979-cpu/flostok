/**
 * 제품 마스터 임포터
 */

import { db } from "@/server/db";
import { products } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { ProductRowData } from "../validators/product-validator";

// TODO: 인증 구현 후 실제 organizationId로 교체
const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

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
async function getExistingSkuMap(): Promise<Map<string, string>> {
  const existing = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, TEMP_ORG_ID));

  const map = new Map<string, string>();
  existing.forEach((product) => {
    map.set(product.sku, product.id);
  });

  return map;
}

/**
 * 제품 마스터 일괄 임포트
 * @param validatedData - 검증된 제품 데이터
 * @param updateExisting - 기존 제품 업데이트 여부
 */
export async function importProductData(
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
    // 기존 SKU 매핑
    const existingSkuMap = await getExistingSkuMap();

    // 배치 처리
    for (let i = 0; i < validatedData.length; i += batchSize) {
      const batch = validatedData.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNumber = i + j + 2; // Excel 행 번호 (헤더 제외, 1-based)

        const existingId = existingSkuMap.get(row.sku);

        try {
          if (existingId) {
            // 기존 제품 처리
            if (updateExisting) {
              await db
                .update(products)
                .set({
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
                })
                .where(and(eq(products.id, existingId), eq(products.organizationId, TEMP_ORG_ID)));
              updated++;
            } else {
              skipped++;
            }
          } else {
            // 신규 제품 생성
            await db.insert(products).values({
              organizationId: TEMP_ORG_ID,
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
            });
            imported++;

            // 캐시 업데이트
            const [newProduct] = await db
              .select({ id: products.id })
              .from(products)
              .where(and(eq(products.sku, row.sku), eq(products.organizationId, TEMP_ORG_ID)))
              .limit(1);
            if (newProduct) {
              existingSkuMap.set(row.sku, newProduct.id);
            }
          }
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
