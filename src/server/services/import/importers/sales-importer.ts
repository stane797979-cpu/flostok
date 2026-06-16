/**
 * 판매 데이터 임포터
 */

import { db } from "@/server/db";
import { products, salesRecords } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { SalesRowData } from "../validators/sales-validator";
import { processInventoryTransaction } from "@/server/actions/inventory";

// TODO: 인증 구현 후 실제 organizationId로 교체
const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{
    row: number;
    sku: string;
    error: string;
  }>;
}

/**
 * SKU -> productId 매핑 캐시 생성
 */
async function buildSkuToProductIdMap(): Promise<Map<string, string>> {
  const allProducts = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, TEMP_ORG_ID));

  const map = new Map<string, string>();
  allProducts.forEach((product) => {
    map.set(product.sku, product.id);
  });

  return map;
}

/**
 * 판매 데이터 일괄 임포트
 * @param validatedData - 검증된 판매 데이터
 * @param options.deductInventory - true일 때 재고 자동 차감 (출고 처리)
 */
export async function importSalesData(
  validatedData: SalesRowData[],
  options?: {
    skipInventory?: boolean; // deprecated, deductInventory 사용
    deductInventory?: boolean; // 재고 차감 여부
    batchSize?: number; // 배치 크기
  }
): Promise<ImportResult> {
  const { deductInventory = false, batchSize = 100 } = options || {};

  const errors: Array<{ row: number; sku: string; error: string }> = [];
  let imported = 0;
  let skipped = 0;

  try {
    // SKU -> productId 매핑
    const skuMap = await buildSkuToProductIdMap();

    // 배치 처리
    for (let i = 0; i < validatedData.length; i += batchSize) {
      const batch = validatedData.slice(i, i + batchSize);
      const batchRecords: Array<{
        organizationId: string;
        productId: string;
        date: string;
        quantity: number;
        unitPrice: number;
        totalAmount: number;
        channel: string | null;
        notes: string | null;
      }> = [];

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNumber = i + j + 2; // Excel 행 번호 (헤더 제외, 1-based)

        // SKU로 제품 조회
        const productId = skuMap.get(row.sku);
        if (!productId) {
          errors.push({
            row: rowNumber,
            sku: row.sku,
            error: "제품을 찾을 수 없습니다",
          });
          skipped++;
          continue;
        }

        // 제품 정보 조회 (단가 기본값)
        const [product] = await db
          .select({ unitPrice: products.unitPrice })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);

        const unitPrice = row.unitPrice ?? product?.unitPrice ?? 0;
        const totalAmount = unitPrice * row.quantity;

        batchRecords.push({
          organizationId: TEMP_ORG_ID,
          productId,
          date: row.date,
          quantity: row.quantity,
          unitPrice,
          totalAmount,
          channel: row.channel || null,
          notes: row.notes || null,
        });
      }

      // 배치 삽입
      if (batchRecords.length > 0) {
        await db.insert(salesRecords).values(batchRecords);
        imported += batchRecords.length;

        // 재고 차감 처리
        if (deductInventory) {
          for (const record of batchRecords) {
            try {
              await processInventoryTransaction({
                productId: record.productId,
                changeType: "OUTBOUND_SALE",
                quantity: record.quantity,
                notes: `판매 임포트: ${record.date}`,
              });
            } catch (error) {
              console.warn(
                `재고 차감 실패 (${record.productId}):`,
                error instanceof Error ? error.message : error
              );
            }
          }
        }
      }
    }

    return {
      success: true,
      imported,
      skipped,
      errors,
    };
  } catch (error) {
    console.error("판매 데이터 임포트 오류:", error);
    throw new Error(
      `판매 데이터 임포트 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
    );
  }
}

/**
 * 중복 체크 (같은 날짜, 제품, 수량)
 */
export async function checkDuplicateSales(
  productId: string,
  date: string,
  quantity: number
): Promise<boolean> {
  const existing = await db
    .select({ id: salesRecords.id })
    .from(salesRecords)
    .where(
      and(
        eq(salesRecords.organizationId, TEMP_ORG_ID),
        eq(salesRecords.productId, productId),
        eq(salesRecords.date, date),
        eq(salesRecords.quantity, quantity)
      )
    )
    .limit(1);

  return existing.length > 0;
}
