/**
 * 비용 관련 KPI 계산 서비스
 * 재고보유비용, GMROI, 기회비용(품절 손실매출)
 */

import { db } from "@/server/db";
import { inventory, salesRecords, products, inventoryHistory } from "@/server/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";

export interface CostKPIResult {
  /** 연간 재고보유비용 (₩) = 평균재고금액 × 보유비율(25%) */
  holdingCost: number;
  /** GMROI = 매출총이익 ÷ 평균재고원가 (배수) — 데이터 부족 시 null */
  gmroi: number | null;
  /** 품절 기회비용 (₩) = 품절일수 × 일평균매출 */
  stockoutOpportunityCost: number;
}

/** 재고 보유 비율 (업계 표준 25%) */
const HOLDING_COST_RATE = 0.25;

/**
 * 비용 관련 KPI 계산
 * @param organizationId 조직 ID
 */
export async function calculateCostKPIs(organizationId: string): Promise<CostKPIResult> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

  const [inventoryData, salesData, stockoutData] = await Promise.all([
    // 1) 현재 총 재고금액 (평균재고금액으로 사용)
    db
      .select({
        totalInventoryValue: sql<number>`COALESCE(SUM(${inventory.inventoryValue}), 0)`,
      })
      .from(inventory)
      .where(eq(inventory.organizationId, organizationId))
      .catch(() => [{ totalInventoryValue: 0 }]),

    // 2) 연간 매출 및 COGS
    db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${salesRecords.totalPrice}), 0)`,
        totalCOGS: sql<number>`COALESCE(SUM(${salesRecords.quantity} * COALESCE(${products.costPrice}, 0)), 0)`,
      })
      .from(salesRecords)
      .leftJoin(products, eq(salesRecords.productId, products.id))
      .where(and(
        eq(salesRecords.organizationId, organizationId),
        gte(salesRecords.date, oneYearAgoStr),
      ))
      .catch(() => [{ totalRevenue: 0, totalCOGS: 0 }]),

    // 3) 품절(stockAfter=0) 발생 일수 집계
    db
      .select({
        stockoutDays: sql<number>`COUNT(DISTINCT ${inventoryHistory.date})`,
      })
      .from(inventoryHistory)
      .where(and(
        eq(inventoryHistory.organizationId, organizationId),
        gte(inventoryHistory.date, oneYearAgoStr),
        sql`${inventoryHistory.stockAfter} = 0`,
      ))
      .catch(() => [{ stockoutDays: 0 }]),
  ]);

  const totalInventoryValue = Number(inventoryData[0]?.totalInventoryValue) || 0;
  const totalRevenue = Number(salesData[0]?.totalRevenue) || 0;
  const totalCOGS = Number(salesData[0]?.totalCOGS) || 0;
  const stockoutDays = Number(stockoutData[0]?.stockoutDays) || 0;

  // 연간 재고보유비용 = 총재고금액 × 보유비율
  const holdingCost = Math.round(totalInventoryValue * HOLDING_COST_RATE);

  // GMROI = 매출총이익 ÷ 평균재고원가
  const grossProfit = totalRevenue - totalCOGS;
  const gmroi =
    totalInventoryValue > 0 && grossProfit > 0
      ? Math.round((grossProfit / totalInventoryValue) * 100) / 100
      : null;

  // 품절 기회비용 = 품절 발생일수 × 일평균매출
  const dailyRevenue = totalRevenue / 365;
  const stockoutOpportunityCost = Math.round(stockoutDays * dailyRevenue);

  return {
    holdingCost,
    gmroi,
    stockoutOpportunityCost,
  };
}
