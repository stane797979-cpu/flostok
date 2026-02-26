/**
 * 시나리오 시뮬레이션 Server Actions
 * - 조직의 제품 목록 + 현재 재고 + 안전재고 + 발주점 + 일평균판매량 조회
 * - runBulkSimulation() 호출 → 결과 반환
 * - 제품 많으면 TOP 20 (ABC A/B등급 우선, 재고 위험 제품 우선)
 */

"use server";

import { unstable_cache } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { db } from "@/server/db";
import {
  products,
  inventory,
  salesRecords,
  inventoryHistory,
} from "@/server/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  runBulkSimulation,
  type SimulationInput,
  type SimulationResult,
} from "@/server/services/scm/scenario-simulation";

/** 시나리오 시뮬레이션 조회 결과 */
export interface ScenarioSimulationData {
  products: Array<{
    id: string;
    sku: string;
    name: string;
    abcGrade: string | null;
  }>;
  simulations: SimulationResult[];
}

/**
 * 시뮬레이션용 제품 데이터 조회 및 시뮬레이션 실행 (내부 로직)
 */
async function _getScenarioSimulationDataInternal(
  orgId: string,
  productIds?: string[]
): Promise<ScenarioSimulationData> {
  // 최근 90일 기준
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const startDate = ninetyDaysAgo.toISOString().split("T")[0];

  // 제품 목록 + 재고 병렬 조회
  const [allProducts, inventoryRows] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        abcGrade: products.abcGrade,
        xyzGrade: products.xyzGrade,
        leadTime: products.leadTime,
        leadTimeStddev: products.leadTimeStddev,
        safetyStock: products.safetyStock,
        reorderPoint: products.reorderPoint,
      })
      .from(products)
      .where(
        and(
          eq(products.organizationId, orgId),
          sql`${products.deletedAt} IS NULL`
        )
      ),

    db
      .select({
        productId: inventory.productId,
        currentStock: inventory.currentStock,
        status: inventory.status,
      })
      .from(inventory)
      .where(eq(inventory.organizationId, orgId)),
  ]);

  if (allProducts.length === 0) {
    return { products: [], simulations: [] };
  }

  // 재고 Map 생성
  const inventoryMap = new Map(
    inventoryRows.map((r) => [
      r.productId,
      { currentStock: r.currentStock, status: r.status },
    ])
  );

  // 제품 필터링 (productIds 지정 시)
  let targetProducts = productIds
    ? allProducts.filter((p) => productIds.includes(p.id))
    : allProducts;

  // TOP 20 선택: ABC A/B등급 우선, 재고 위험 제품 우선
  if (!productIds && targetProducts.length > 20) {
    const gradeOrder = (grade: string | null) => {
      if (grade === "A") return 0;
      if (grade === "B") return 1;
      return 2;
    };
    const statusOrder = (status: string | null | undefined) => {
      if (status === "critical" || status === "out_of_stock") return 0;
      if (status === "shortage" || status === "caution") return 1;
      return 2;
    };

    targetProducts = targetProducts
      .sort((a, b) => {
        const invA = inventoryMap.get(a.id);
        const invB = inventoryMap.get(b.id);
        const gradeA = gradeOrder(a.abcGrade);
        const gradeB = gradeOrder(b.abcGrade);
        if (gradeA !== gradeB) return gradeA - gradeB;
        return (
          statusOrder(invA?.status) - statusOrder(invB?.status)
        );
      })
      .slice(0, 20);
  }

  const targetIds = targetProducts.map((p) => p.id);

  if (targetIds.length === 0) {
    return {
      products: allProducts.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        abcGrade: p.abcGrade,
      })),
      simulations: [],
    };
  }

  // 제품별 일별 판매량 조회 (salesRecords, 최근 90일)
  const [dailySalesRows, dailyHistoryRows] = await Promise.all([
    db
      .select({
        productId: salesRecords.productId,
        date: salesRecords.date,
        quantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          gte(salesRecords.date, startDate),
          sql`${salesRecords.productId} = ANY(ARRAY[${sql.join(
            targetIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )}])`
        )
      )
      .groupBy(salesRecords.productId, salesRecords.date),

    // inventoryHistory 출고 데이터 보충 (salesRecords 없는 제품용)
    db
      .select({
        productId: inventoryHistory.productId,
        date: inventoryHistory.date,
        quantity: sql<number>`COALESCE(SUM(ABS(${inventoryHistory.changeAmount})), 0)`,
      })
      .from(inventoryHistory)
      .where(
        and(
          eq(inventoryHistory.organizationId, orgId),
          gte(inventoryHistory.date, startDate),
          sql`${inventoryHistory.changeAmount} < 0`,
          sql`${inventoryHistory.productId} = ANY(ARRAY[${sql.join(
            targetIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )}])`
        )
      )
      .groupBy(inventoryHistory.productId, inventoryHistory.date),
  ]);

  // 제품별 일별 판매량 Map 구성 (salesRecords 우선)
  const salesByProduct = new Map<string, number[]>();
  for (const row of dailySalesRows) {
    const arr = salesByProduct.get(row.productId) || [];
    arr.push(Number(row.quantity));
    salesByProduct.set(row.productId, arr);
  }

  // salesRecords 없는 제품은 inventoryHistory로 보충
  const salesProductIds = new Set(dailySalesRows.map((r) => r.productId));
  for (const row of dailyHistoryRows) {
    if (!salesProductIds.has(row.productId)) {
      const arr = salesByProduct.get(row.productId) || [];
      arr.push(Number(row.quantity));
      salesByProduct.set(row.productId, arr);
    }
  }

  // SimulationInput 배열 구성
  const inputs: SimulationInput[] = [];
  for (const p of targetProducts) {
    const inv = inventoryMap.get(p.id);
    const currentStock = inv?.currentStock ?? 0;
    const dailySales = salesByProduct.get(p.id) || [];

    // 데이터 없으면 건너뜀 (시뮬레이션 의미 없음)
    if (dailySales.length === 0) continue;

    // 일평균 판매량
    const totalSales = dailySales.reduce((s, v) => s + v, 0);
    const averageDailyDemand = totalSales / dailySales.length;

    // 표준편차 계산
    const mean = averageDailyDemand;
    const variance =
      dailySales.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
      dailySales.length;
    const demandStdDev = Math.sqrt(variance);

    const leadTimeDays = p.leadTime ?? 7;
    const leadTimeStddev = p.leadTimeStddev ? Number(p.leadTimeStddev) : undefined;
    const safetyStock = p.safetyStock ?? 0;
    const reorderPoint = p.reorderPoint ?? 0;

    inputs.push({
      productId: p.id,
      productName: `${p.name} (${p.sku})`,
      currentStock,
      averageDailyDemand: Math.round(averageDailyDemand * 10) / 10,
      demandStdDev: Math.round(demandStdDev * 10) / 10,
      leadTimeDays,
      leadTimeStdDev: leadTimeStddev,
      safetyStock,
      reorderPoint,
      serviceLevel: 0.95,
    });
  }

  if (inputs.length === 0) {
    return {
      products: allProducts.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        abcGrade: p.abcGrade,
      })),
      simulations: [],
    };
  }

  // 시뮬레이션 실행
  const simulations = runBulkSimulation(inputs);

  return {
    products: allProducts.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      abcGrade: p.abcGrade,
    })),
    simulations,
  };
}

/**
 * 시나리오 시뮬레이션 데이터 조회 + 시뮬레이션 실행
 * - unstable_cache 60초 캐싱
 * - 에러 시 null 반환 (graceful fallback)
 */
export async function getScenarioSimulationData(
  productIds?: string[]
): Promise<ScenarioSimulationData | null> {
  try {
    const user = await requireAuth();
    const orgId = user.organizationId;

    const cacheKey = productIds
      ? `scenario-sim-${orgId}-${productIds.sort().join(",")}`
      : `scenario-sim-${orgId}`;

    return unstable_cache(
      () => _getScenarioSimulationDataInternal(orgId, productIds),
      [cacheKey],
      { revalidate: 60, tags: [`scenario-sim-${orgId}`] }
    )();
  } catch (error) {
    console.error("[시나리오 시뮬레이션] 데이터 조회 실패:", error);
    return null;
  }
}
