/**
 * 판매 데이터 임포터
 */

import { db } from "@/server/db";
import { products, salesRecords } from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { SalesRowData } from "../validators/sales-validator";
import { processBatchInventoryTransactions, type BatchInventoryItem } from "@/server/actions/inventory";

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
async function buildSkuToProductIdMap(organizationId: string): Promise<Map<string, string>> {
  const allProducts = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, organizationId));

  const map = new Map<string, string>();
  allProducts.forEach((product) => {
    map.set(product.sku, product.id);
  });

  return map;
}

/**
 * 판매 데이터 일괄 임포트
 * @param organizationId - 조직 ID
 * @param validatedData - 검증된 판매 데이터
 * @param options - 임포트 옵션
 */
export async function importSalesData(
  organizationId: string,
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
    const skuMap = await buildSkuToProductIdMap(organizationId);

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

      // 배치 내 제품 단가를 한 번에 조회 (N+1 제거)
      const batchProductIds = batch
        .map((row) => skuMap.get(row.sku))
        .filter((id): id is string => !!id);
      const uniqueProductIds = [...new Set(batchProductIds)];

      const productPriceMap = new Map<string, number>();
      if (uniqueProductIds.length > 0) {
        const priceRows = await db
          .select({ id: products.id, unitPrice: products.unitPrice })
          .from(products)
          .where(inArray(products.id, uniqueProductIds));
        for (const p of priceRows) {
          productPriceMap.set(p.id, p.unitPrice ?? 0);
        }
      }

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

        const unitPrice = row.unitPrice ?? productPriceMap.get(productId) ?? 0;
        const totalAmount = unitPrice * row.quantity;

        batchRecords.push({
          organizationId: organizationId,
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

        // 재고 차감 배치 처리 (N+1 → 배치)
        if (deductInventory && batchRecords.length > 0) {
          const batchItems: BatchInventoryItem[] = batchRecords.map(record => ({
            productId: record.productId,
            changeType: "OUTBOUND_SALE" as const,
            quantity: record.quantity,
            notes: `판매 임포트: ${record.date}`,
          }));
          try {
            await processBatchInventoryTransactions(batchItems, { skipRevalidate: true, skipActivityLog: true });
          } catch (error) {
            console.warn("재고 차감 배치 처리 실패:", error instanceof Error ? error.message : error);
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
  organizationId: string,
  productId: string,
  date: string,
  quantity: number
): Promise<boolean> {
  const existing = await db
    .select({ id: salesRecords.id })
    .from(salesRecords)
    .where(
      and(
        eq(salesRecords.organizationId, organizationId),
        eq(salesRecords.productId, productId),
        eq(salesRecords.date, date),
        eq(salesRecords.quantity, quantity)
      )
    )
    .limit(1);

  return existing.length > 0;
}
