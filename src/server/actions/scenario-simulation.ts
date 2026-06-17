"use server";

import { db } from "@/server/db";
import { products, salesRecords, inventory } from "@/server/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import { runBulkSimulation, type SimulationInput, type SimulationResult } from "@/server/services/scm/scenario-simulation";

export interface ScenarioSimulationData {
  products: Array<{ id: string; sku: string; name: string }>;
  simulations: SimulationResult[];
}

export async function getScenarioSimulationData(): Promise<ScenarioSimulationData | null> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId;
    if (!orgId) return null;

    // 최근 90일 판매 데이터 기준
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - 90);
    const startDate = startDateObj.toISOString().split("T")[0];

    // 제품별 일평균 판매량 + 표준편차 (90일)
    const salesStats = await db
      .select({
        productId: salesRecords.productId,
        totalQty: sql<number>`SUM(${salesRecords.quantity})::float`,
        dayCount: sql<number>`COUNT(DISTINCT ${salesRecords.date})::float`,
        stdDev: sql<number>`STDDEV(${salesRecords.quantity}::float)`,
      })
      .from(salesRecords)
      .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
      .groupBy(salesRecords.productId);

    if (salesStats.length === 0) return null;

    const productIds = salesStats.map((s) => s.productId);

    // 제품 정보 + 재고 + 리드타임
    const [productRows, inventoryRows] = await Promise.all([
      db
        .select({ id: products.id, sku: products.sku, name: products.name, safetyStock: products.safetyStock, reorderPoint: products.reorderPoint, avgLeadTime: sql<number>`7` })
        .from(products)
        .where(eq(products.organizationId, orgId)),
      db
        .select({ productId: inventory.productId, currentStock: inventory.currentStock })
        .from(inventory)
        .where(eq(inventory.organizationId, orgId)),
    ]);

    const productMap = new Map(productRows.map((p) => [p.id, p]));
    const inventoryMap = new Map(inventoryRows.map((i) => [i.productId, i.currentStock ?? 0]));

    // SimulationInput 생성
    const inputs: SimulationInput[] = [];
    const productList: ScenarioSimulationData["products"] = [];

    for (const stat of salesStats) {
      const product = productMap.get(stat.productId);
      if (!product) continue;

      const dayCount = Math.max(stat.dayCount || 1, 1);
      const avgDailyDemand = (stat.totalQty || 0) / 90; // 90일 기준 일평균
      const demandStdDev = Math.max(stat.stdDev || 0, avgDailyDemand * 0.1);

      inputs.push({
        productId: stat.productId,
        productName: product.name,
        currentStock: inventoryMap.get(stat.productId) ?? 0,
        averageDailyDemand: Math.max(avgDailyDemand, 0.01),
        demandStdDev,
        leadTimeDays: 7,
        leadTimeStdDev: 1,
        safetyStock: product.safetyStock ?? 0,
        reorderPoint: product.reorderPoint ?? 0,
        serviceLevel: 0.95,
      });

      productList.push({ id: stat.productId, sku: product.sku, name: product.name });
    }

    if (inputs.length === 0) return null;

    const simulations = runBulkSimulation(inputs);

    return { products: productList, simulations };
  } catch (error) {
    console.error("시나리오 시뮬레이션 데이터 조회 실패:", error);
    return null;
  }
}
