/**
 * KPI 실측 서비스
 * 조직의 실제 DB 데이터를 기반으로 7개 KPI를 계산합니다.
 *
 * 성능 최적화:
 * - measureKPIMetrics: 5개 KPI를 병렬 단일 쿼리로 계산 (5 DB 호출)
 * - getKPITrendData: 4개 GROUP BY month 쿼리로 6개월 트렌드 일괄 계산 (4 DB 호출)
 * - 이전: 6개월 루프 × 4 KPI × 1~2 쿼리 = 24~48 DB 호출 → 현재: 4 DB 호출
 */

import { db } from "@/server/db";
import {
  inventory,
  purchaseOrders,
  purchaseOrderItems,
  salesRecords,
  products,
} from "@/server/db/schema";
import { eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import type { KPIMetrics } from "./kpi-improvement";

/**
 * 월별 KPI 트렌드 데이터
 */
export interface KPITrend {
  month: string; // "2026-01"
  inventoryTurnoverRate: number;
  stockoutRate: number;
  onTimeOrderRate: number;
  orderFulfillmentRate: number;
}

/**
 * 조직의 실제 KPI 측정 (5개 병렬 쿼리)
 */
export async function measureKPIMetrics(organizationId: string): Promise<KPIMetrics> {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

    // 5개 쿼리 병렬 실행
    const [salesData, inventoryData, stockoutData, orderData, fulfillmentData] = await Promise.all([
      // 1) 연간 COGS
      db
        .select({
          totalCOGS: sql<number>`COALESCE(SUM(${salesRecords.quantity} * COALESCE(${products.costPrice}, 0)), 0)`,
        })
        .from(salesRecords)
        .leftJoin(products, eq(salesRecords.productId, products.id))
        .where(and(eq(salesRecords.organizationId, organizationId), gte(salesRecords.date, oneYearAgoStr))),

      // 2) 평균 재고금액
      db
        .select({
          avgValue: sql<number>`COALESCE(AVG(${inventory.inventoryValue}), 0)`,
        })
        .from(inventory)
        .where(eq(inventory.organizationId, organizationId)),

      // 3) 품절률 (단일 쿼리로 총수 + 품절수)
      db
        .select({
          totalCount: sql<number>`COUNT(*)`,
          stockoutCount: sql<number>`COUNT(*) FILTER (WHERE ${inventory.status} = 'out_of_stock')`,
        })
        .from(inventory)
        .where(eq(inventory.organizationId, organizationId)),

      // 4) 적시발주율 + 평균 리드타임 (완료 발주 한번에)
      db
        .select({
          totalCount: sql<number>`COUNT(*)`,
          onTimeCount: sql<number>`COUNT(*) FILTER (WHERE ${purchaseOrders.actualDate} IS NOT NULL AND ${purchaseOrders.expectedDate} IS NOT NULL AND ${purchaseOrders.actualDate} <= ${purchaseOrders.expectedDate})`,
          avgLeadTime: sql<number>`COALESCE(AVG(CASE WHEN ${purchaseOrders.actualDate} IS NOT NULL THEN ${purchaseOrders.actualDate}::date - ${purchaseOrders.orderDate}::date END), 0)`,
        })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, organizationId),
            inArray(purchaseOrders.status, ["received", "completed"])
          )
        ),

      // 5) 발주충족률 (JOIN으로 단일 쿼리)
      db
        .select({
          totalOrdered: sql<number>`COALESCE(SUM(${purchaseOrderItems.quantity}), 0)`,
          totalReceived: sql<number>`COALESCE(SUM(${purchaseOrderItems.receivedQuantity}), 0)`,
        })
        .from(purchaseOrderItems)
        .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
        .where(
          and(
            eq(purchaseOrders.organizationId, organizationId),
            inArray(purchaseOrders.status, ["received", "completed"])
          )
        ),
    ]);

    // 재고회전율
    const annualCOGS = Number(salesData[0]?.totalCOGS) || 0;
    const avgInventoryValue = Number(inventoryData[0]?.avgValue) || 0;
    const inventoryTurnoverRate =
      avgInventoryValue > 0 && annualCOGS > 0
        ? Math.round((annualCOGS / avgInventoryValue) * 100) / 100
        : 0;

    // 품절률
    const totalItems = Number(stockoutData[0]?.totalCount) || 0;
    const stockoutItems = Number(stockoutData[0]?.stockoutCount) || 0;
    const stockoutRate = totalItems > 0 ? Math.round((stockoutItems / totalItems) * 10000) / 100 : 0;

    // 적시발주율 + 리드타임
    const orderTotal = Number(orderData[0]?.totalCount) || 0;
    const onTimeCount = Number(orderData[0]?.onTimeCount) || 0;
    const onTimeOrderRate = orderTotal > 0 ? Math.round((onTimeCount / orderTotal) * 10000) / 100 : 0;
    const averageLeadTime = Math.round(Number(orderData[0]?.avgLeadTime) || 0);

    // 발주충족률
    const totalOrdered = Number(fulfillmentData[0]?.totalOrdered) || 0;
    const totalReceived = Number(fulfillmentData[0]?.totalReceived) || 0;
    const orderFulfillmentRate =
      totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 10000) / 100 : 0;

    // 평균 재고일수
    const averageInventoryDays = inventoryTurnoverRate > 0 ? 365 / inventoryTurnoverRate : 999;

    return {
      inventoryTurnoverRate,
      averageInventoryDays,
      inventoryAccuracy: 95.0, // 실사 데이터 없으므로 고정값
      stockoutRate,
      onTimeOrderRate,
      averageLeadTime,
      orderFulfillmentRate,
    };
  } catch (error) {
    console.error("[measureKPIMetrics] Error:", error);
    return {
      inventoryTurnoverRate: 0,
      averageInventoryDays: 999,
      inventoryAccuracy: 95.0,
      stockoutRate: 0,
      onTimeOrderRate: 0,
      averageLeadTime: 0,
      orderFulfillmentRate: 0,
    };
  }
}

/**
 * 월별 KPI 트렌드 데이터 생성 (GROUP BY month — 4 DB 쿼리)
 *
 * 이전: for 루프 6회 × 4 KPI = 24+ DB 쿼리
 * 현재: 4개의 GROUP BY 쿼리로 6개월 한번에 계산
 */
export async function getKPITrendData(
  organizationId: string,
  months: number = 6
): Promise<KPITrend[]> {
  try {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const startDateStr = startMonth.toISOString().split("T")[0];
    const endDateStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // 월 목록 생성
    const monthList: string[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    // 현재 평균 재고금액 (월별 스냅샷이 없으므로 공통 사용)
    // 4개 GROUP BY 쿼리 + 1개 재고 쿼리 병렬 실행
    const [cogsData, orderRateData, fulfillmentData, avgInvData, stockoutData] = await Promise.all([
      // 1) 월별 COGS (재고회전율용)
      db
        .select({
          month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`.as("month"),
          totalCOGS: sql<number>`COALESCE(SUM(${salesRecords.quantity} * COALESCE(${products.costPrice}, 0)), 0)`.as("total_cogs"),
        })
        .from(salesRecords)
        .leftJoin(products, eq(salesRecords.productId, products.id))
        .where(
          and(
            eq(salesRecords.organizationId, organizationId),
            gte(salesRecords.date, startDateStr),
            lte(salesRecords.date, endDateStr)
          )
        )
        .groupBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
        .execute(),

      // 2) 월별 적시발주율 (actualDate 기준 GROUP BY)
      db
        .select({
          month: sql<string>`TO_CHAR(${purchaseOrders.actualDate}::date, 'YYYY-MM')`.as("month"),
          totalCount: sql<number>`COUNT(*)`.as("total_count"),
          onTimeCount: sql<number>`COUNT(*) FILTER (WHERE ${purchaseOrders.expectedDate} IS NOT NULL AND ${purchaseOrders.actualDate} <= ${purchaseOrders.expectedDate})`.as("on_time_count"),
        })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, organizationId),
            inArray(purchaseOrders.status, ["received", "completed"]),
            sql`${purchaseOrders.actualDate} IS NOT NULL`,
            gte(purchaseOrders.actualDate, startDateStr),
            lte(purchaseOrders.actualDate, endDateStr)
          )
        )
        .groupBy(sql`TO_CHAR(${purchaseOrders.actualDate}::date, 'YYYY-MM')`)
        .execute(),

      // 3) 월별 발주충족률 (JOIN + GROUP BY)
      db
        .select({
          month: sql<string>`TO_CHAR(${purchaseOrders.actualDate}::date, 'YYYY-MM')`.as("month"),
          totalOrdered: sql<number>`COALESCE(SUM(${purchaseOrderItems.quantity}), 0)`.as("total_ordered"),
          totalReceived: sql<number>`COALESCE(SUM(${purchaseOrderItems.receivedQuantity}), 0)`.as("total_received"),
        })
        .from(purchaseOrderItems)
        .innerJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
        .where(
          and(
            eq(purchaseOrders.organizationId, organizationId),
            inArray(purchaseOrders.status, ["received", "completed"]),
            sql`${purchaseOrders.actualDate} IS NOT NULL`,
            gte(purchaseOrders.actualDate, startDateStr),
            lte(purchaseOrders.actualDate, endDateStr)
          )
        )
        .groupBy(sql`TO_CHAR(${purchaseOrders.actualDate}::date, 'YYYY-MM')`)
        .execute(),

      // 4) 평균 재고금액 (현재 스냅샷 — 모든 월에 공통 사용)
      db
        .select({
          avgValue: sql<number>`COALESCE(AVG(${inventory.inventoryValue}), 0)`,
        })
        .from(inventory)
        .where(eq(inventory.organizationId, organizationId))
        .execute(),

      // 5) 현재 품절률 (스냅샷 — 모든 월에 동일)
      db
        .select({
          totalCount: sql<number>`COUNT(*)`,
          stockoutCount: sql<number>`COUNT(*) FILTER (WHERE ${inventory.status} = 'out_of_stock')`,
        })
        .from(inventory)
        .where(eq(inventory.organizationId, organizationId))
        .execute(),
    ]);

    // Map으로 변환
    const cogsMap = new Map(cogsData.map((r) => [r.month, Number(r.totalCOGS) || 0]));
    const orderRateMap = new Map(
      orderRateData.map((r) => [
        r.month,
        {
          total: Number(r.totalCount) || 0,
          onTime: Number(r.onTimeCount) || 0,
        },
      ])
    );
    const fulfillmentMap = new Map(
      fulfillmentData.map((r) => [
        r.month,
        {
          ordered: Number(r.totalOrdered) || 0,
          received: Number(r.totalReceived) || 0,
        },
      ])
    );

    const avgInvValue = Number(avgInvData[0]?.avgValue) || 0;
    const totalInvCount = Number(stockoutData[0]?.totalCount) || 0;
    const stockoutCount = Number(stockoutData[0]?.stockoutCount) || 0;
    const currentStockoutRate = totalInvCount > 0
      ? Math.round((stockoutCount / totalInvCount) * 10000) / 100
      : 0;

    // 월별 트렌드 조합
    return monthList.map((month) => {
      // 재고회전율 (월간 COGS × 12 / 평균재고)
      const monthlyCOGS = cogsMap.get(month) || 0;
      const turnover =
        avgInvValue > 0 && monthlyCOGS > 0
          ? Math.round(((monthlyCOGS / avgInvValue) * 12) * 100) / 100
          : 0;

      // 적시발주율
      const orderRate = orderRateMap.get(month);
      const onTimeRate =
        orderRate && orderRate.total > 0
          ? Math.round((orderRate.onTime / orderRate.total) * 10000) / 100
          : 0;

      // 발주충족률
      const fulfillment = fulfillmentMap.get(month);
      const fillRate =
        fulfillment && fulfillment.ordered > 0
          ? Math.round((fulfillment.received / fulfillment.ordered) * 10000) / 100
          : 0;

      return {
        month,
        inventoryTurnoverRate: turnover,
        stockoutRate: currentStockoutRate, // 현재 스냅샷 (과거 이력 없음)
        onTimeOrderRate: onTimeRate,
        orderFulfillmentRate: fillRate,
      };
    });
  } catch (error) {
    console.error("[getKPITrendData] Error:", error);
    return [];
  }
}
