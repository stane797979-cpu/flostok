"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { warehouses, inventory, products } from "@/server/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";

// ─── 인터페이스 ────────────────────────────────────────────────────────────────

export interface WarehouseStatusDistribution {
  outOfStock: number;  // 품절
  critical: number;    // 위험
  shortage: number;    // 부족
  caution: number;     // 주의
  optimal: number;     // 적정
  excess: number;      // 과다
  overstock: number;   // 과잉
}

export interface WarehouseMetrics {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseType: string;
  totalSKUs: number;           // 보유 SKU 수
  totalStock: number;          // 총 재고 수량
  totalValue: number;          // 총 재고 금액 (inventoryValue 기준)
  outOfStockCount: number;     // 품절 제품 수
  criticalCount: number;       // 위험 제품 수
  shortageCount: number;       // 부족 제품 수
  cautionCount: number;        // 주의 제품 수
  optimalCount: number;        // 적정 제품 수
  excessCount: number;         // 과다 제품 수
  overstockCount: number;      // 과잉 제품 수
  healthScore: number;         // 건전성 점수 (0-100): 적정 비율 기반
  statusDistribution: WarehouseStatusDistribution;
}

export interface WarehouseComparisonSummary {
  warehouses: WarehouseMetrics[];
  bestWarehouse: string;            // 건전성 최고 창고명
  worstWarehouse: string;           // 건전성 최저 창고명
  totalOrganizationValue: number;   // 조직 전체 재고 금액
  periodLabel: string;
}

// ─── 메인 함수 ─────────────────────────────────────────────────────────────────

/**
 * 창고별 재고 건전성 비교 데이터 조회
 * - 활성 창고 목록과 inventory를 JOIN하여 상태 분포, 재고금액 집계
 * - healthScore = (적정 SKU 수 / 전체 보유 SKU 수) × 100
 * - 60초 캐시
 */
export async function getWarehouseComparisonData(): Promise<WarehouseComparisonSummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;

  if (!orgId) {
    return {
      warehouses: [],
      bestWarehouse: "-",
      worstWarehouse: "-",
      totalOrganizationValue: 0,
      periodLabel: "-",
    };
  }

  return unstable_cache(
    async () => {
      const today = new Date().toISOString().split("T")[0];

      // 1. 조직의 활성 창고 목록 조회
      const activeWarehouses = await db
        .select({
          id: warehouses.id,
          name: warehouses.name,
          code: warehouses.code,
          type: warehouses.type,
        })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.organizationId, orgId),
            eq(warehouses.isActive, true)
          )
        );

      if (activeWarehouses.length === 0) {
        return {
          warehouses: [],
          bestWarehouse: "-",
          worstWarehouse: "-",
          totalOrganizationValue: 0,
          periodLabel: today,
        };
      }

      // 2. 창고별 재고 상태 집계 (단일 쿼리로 모든 창고 한 번에)
      const inventoryRows = await db
        .select({
          warehouseId: inventory.warehouseId,
          status: inventory.status,
          skuCount: sql<number>`count(*)`.as("sku_count"),
          totalStock: sql<number>`coalesce(sum(${inventory.currentStock}), 0)`.as("total_stock"),
          totalValue: sql<number>`coalesce(sum(${inventory.inventoryValue}), 0)`.as("total_value"),
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(
          and(
            eq(inventory.organizationId, orgId),
            isNull(products.deletedAt)
          )
        )
        .groupBy(inventory.warehouseId, inventory.status);

      // 3. 창고별로 집계 맵 구성
      type WarehouseAgg = {
        totalSKUs: number;
        totalStock: number;
        totalValue: number;
        statusCounts: Record<string, number>;
      };

      const aggMap = new Map<string, WarehouseAgg>();

      for (const row of inventoryRows) {
        const wid = row.warehouseId;
        if (!aggMap.has(wid)) {
          aggMap.set(wid, {
            totalSKUs: 0,
            totalStock: 0,
            totalValue: 0,
            statusCounts: {
              out_of_stock: 0,
              critical: 0,
              shortage: 0,
              caution: 0,
              optimal: 0,
              excess: 0,
              overstock: 0,
            },
          });
        }

        const agg = aggMap.get(wid)!;
        const cnt = Number(row.skuCount) || 0;
        agg.totalSKUs += cnt;
        agg.totalStock += Number(row.totalStock) || 0;
        agg.totalValue += Number(row.totalValue) || 0;

        const statusKey = row.status ?? "optimal";
        if (statusKey in agg.statusCounts) {
          agg.statusCounts[statusKey] += cnt;
        }
      }

      // 4. WarehouseMetrics 배열 구성
      const warehouseMetrics: WarehouseMetrics[] = activeWarehouses.map((w) => {
        const agg = aggMap.get(w.id);

        if (!agg || agg.totalSKUs === 0) {
          return {
            warehouseId: w.id,
            warehouseName: w.name,
            warehouseCode: w.code,
            warehouseType: w.type,
            totalSKUs: 0,
            totalStock: 0,
            totalValue: 0,
            outOfStockCount: 0,
            criticalCount: 0,
            shortageCount: 0,
            cautionCount: 0,
            optimalCount: 0,
            excessCount: 0,
            overstockCount: 0,
            healthScore: 0,
            statusDistribution: {
              outOfStock: 0,
              critical: 0,
              shortage: 0,
              caution: 0,
              optimal: 0,
              excess: 0,
              overstock: 0,
            },
          };
        }

        const sc = agg.statusCounts;
        const optimalCount = sc.optimal ?? 0;
        // 건전성: 적정 비율 × 100
        const healthScore = agg.totalSKUs > 0
          ? Math.round((optimalCount / agg.totalSKUs) * 100)
          : 0;

        return {
          warehouseId: w.id,
          warehouseName: w.name,
          warehouseCode: w.code,
          warehouseType: w.type,
          totalSKUs: agg.totalSKUs,
          totalStock: agg.totalStock,
          totalValue: agg.totalValue,
          outOfStockCount: sc.out_of_stock ?? 0,
          criticalCount: sc.critical ?? 0,
          shortageCount: sc.shortage ?? 0,
          cautionCount: sc.caution ?? 0,
          optimalCount,
          excessCount: sc.excess ?? 0,
          overstockCount: sc.overstock ?? 0,
          healthScore,
          statusDistribution: {
            outOfStock: sc.out_of_stock ?? 0,
            critical: sc.critical ?? 0,
            shortage: sc.shortage ?? 0,
            caution: sc.caution ?? 0,
            optimal: optimalCount,
            excess: sc.excess ?? 0,
            overstock: sc.overstock ?? 0,
          },
        };
      });

      // 5. 요약 계산
      const totalOrganizationValue = warehouseMetrics.reduce(
        (s, w) => s + w.totalValue,
        0
      );

      const withData = warehouseMetrics.filter((w) => w.totalSKUs > 0);
      const sorted = [...withData].sort((a, b) => b.healthScore - a.healthScore);
      const bestWarehouse = sorted[0]?.warehouseName ?? "-";
      const worstWarehouse = sorted[sorted.length - 1]?.warehouseName ?? "-";

      return {
        warehouses: warehouseMetrics,
        bestWarehouse,
        worstWarehouse,
        totalOrganizationValue,
        periodLabel: `기준일: ${today}`,
      };
    },
    [`warehouse-comparison-${orgId}`],
    { revalidate: 60, tags: [`warehouse-comparison-${orgId}`] }
  )();
}
