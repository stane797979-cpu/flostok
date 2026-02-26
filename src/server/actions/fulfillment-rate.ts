"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { demandForecasts, products, salesRecords, inventoryHistory } from "@/server/db/schema";
import { eq, and, sql, gte, lte, isNotNull, inArray } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";

export interface FulfillmentRateItem {
  productId: string;
  sku: string;
  name: string;
  period: string;
  forecastQty: number;
  actualQty: number;
  fulfillmentRate: number;
}

export interface FulfillmentRateSummary {
  items: FulfillmentRateItem[];
  avgFulfillmentRate: number;
  overForecastCount: number;
  underForecastCount: number;
  periods: string[];
  periodLabel: string;
}

function buildSummary(items: FulfillmentRateItem[], periodsSet: Set<string>, periodLabel?: string): FulfillmentRateSummary {
  const rates = items.filter((i) => i.forecastQty > 0).map((i) => i.fulfillmentRate);
  const avgRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
  const sortedPeriods = Array.from(periodsSet).sort();
  return {
    items,
    avgFulfillmentRate: Math.round(avgRate * 10) / 10,
    overForecastCount: items.filter((i) => i.fulfillmentRate > 110).length,
    underForecastCount: items.filter((i) => i.fulfillmentRate < 90).length,
    periods: sortedPeriods,
    periodLabel: periodLabel || (sortedPeriods.length > 0
      ? `${sortedPeriods[0]} ~ ${sortedPeriods[sortedPeriods.length - 1]} (최근 6개월)`
      : "데이터 없음"),
  };
}

async function _getFulfillmentRateInternal(orgId: string): Promise<FulfillmentRateSummary> {
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const forecasts = await db
    .select({
      productId: demandForecasts.productId,
      period: demandForecasts.period,
      forecastQty: demandForecasts.forecastQuantity,
      actualQty: demandForecasts.actualQuantity,
    })
    .from(demandForecasts)
    .where(
      and(
        eq(demandForecasts.organizationId, orgId),
        gte(demandForecasts.period, startDate),
        lte(demandForecasts.period, endDate)
      )
    );

  // 예측 데이터 없으면 판매 기반 — 판매+출고이력+제품을 병렬 조회
  if (forecasts.length === 0) {
    const [monthlySales, monthlyOutbound, productList] = await Promise.all([
      db
        .select({
          productId: salesRecords.productId,
          month: sql<string>`to_char(${salesRecords.date}::date, 'YYYY-MM-01')`,
          totalQty: sql<number>`sum(${salesRecords.quantity})`,
        })
        .from(salesRecords)
        .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate.substring(0, 10))))
        .groupBy(salesRecords.productId, sql`to_char(${salesRecords.date}::date, 'YYYY-MM-01')`),
      db
        .select({
          productId: inventoryHistory.productId,
          month: sql<string>`to_char(${inventoryHistory.date}::date, 'YYYY-MM-01')`,
          totalQty: sql<number>`coalesce(sum(abs(${inventoryHistory.changeAmount})), 0)`,
        })
        .from(inventoryHistory)
        .where(
          and(
            eq(inventoryHistory.organizationId, orgId),
            gte(inventoryHistory.date, startDate.substring(0, 10)),
            sql`${inventoryHistory.changeAmount} < 0`
          )
        )
        .groupBy(inventoryHistory.productId, sql`to_char(${inventoryHistory.date}::date, 'YYYY-MM-01')`),
      db
        .select({ id: products.id, sku: products.sku, name: products.name })
        .from(products)
        .where(and(eq(products.organizationId, orgId), isNotNull(products.isActive))),
    ]);

    // salesRecords에 데이터가 있는 제품 ID 집합
    const salesProductIds = new Set(monthlySales.map((r) => r.productId));

    // salesRecords 우선 집계 후, 없는 제품은 inventoryHistory로 보충
    const productMonthly = new Map<string, Map<string, number>>();
    for (const row of monthlySales) {
      if (!productMonthly.has(row.productId)) productMonthly.set(row.productId, new Map());
      productMonthly.get(row.productId)!.set(row.month as string, Number(row.totalQty));
    }
    for (const row of monthlyOutbound) {
      if (salesProductIds.has(row.productId)) continue; // salesRecords 우선
      if (!productMonthly.has(row.productId)) productMonthly.set(row.productId, new Map());
      productMonthly.get(row.productId)!.set(row.month as string, Number(row.totalQty));
    }

    if (productMonthly.size === 0) {
      return { items: [], avgFulfillmentRate: 0, overForecastCount: 0, underForecastCount: 0, periods: [], periodLabel: "데이터 없음" };
    }

    const productMap = new Map(productList.map((p) => [p.id, p]));
    const items: FulfillmentRateItem[] = [];
    const periodsSet = new Set<string>();
    for (const [productId, months] of productMonthly) {
      const product = productMap.get(productId);
      if (!product) continue;
      const monthValues = Array.from(months.values());
      const avgForecast = Math.round(monthValues.reduce((s, v) => s + v, 0) / monthValues.length);
      for (const [period, actualQty] of months) {
        periodsSet.add(period);
        const rate = avgForecast > 0 ? (actualQty / avgForecast) * 100 : 0;
        items.push({
          productId, sku: product.sku, name: product.name, period,
          forecastQty: avgForecast, actualQty,
          fulfillmentRate: Math.round(rate * 10) / 10,
        });
      }
    }
    return buildSummary(items, periodsSet);
  }

  // 예측 있는 경우 — 제품+판매량+출고이력 병렬 조회 (N+1 제거)
  const productIds = [...new Set(forecasts.map((f) => f.productId))];
  const [productList, monthlySalesAll, monthlyOutboundAll] = await Promise.all([
    db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(and(eq(products.organizationId, orgId), inArray(products.id, productIds))),
    db
      .select({
        productId: salesRecords.productId,
        period: sql<string>`to_char(${salesRecords.date}::date, 'YYYY-MM-01')`,
        total: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          inArray(salesRecords.productId, productIds),
          gte(salesRecords.date, startDate.substring(0, 10)),
        )
      )
      .groupBy(salesRecords.productId, sql`to_char(${salesRecords.date}::date, 'YYYY-MM-01')`),
    db
      .select({
        productId: inventoryHistory.productId,
        period: sql<string>`to_char(${inventoryHistory.date}::date, 'YYYY-MM-01')`,
        total: sql<number>`coalesce(sum(abs(${inventoryHistory.changeAmount})), 0)`,
      })
      .from(inventoryHistory)
      .where(
        and(
          eq(inventoryHistory.organizationId, orgId),
          inArray(inventoryHistory.productId, productIds),
          gte(inventoryHistory.date, startDate.substring(0, 10)),
          sql`${inventoryHistory.changeAmount} < 0`
        )
      )
      .groupBy(inventoryHistory.productId, sql`to_char(${inventoryHistory.date}::date, 'YYYY-MM-01')`),
  ]);

  const productMap = new Map(productList.map((p) => [p.id, p]));

  // salesRecords 우선 룩업
  const salesLookup = new Map<string, number>();
  for (const row of monthlySalesAll) {
    salesLookup.set(`${row.productId}|${row.period}`, Number(row.total));
  }

  // inventoryHistory 출고 룩업 (salesRecords 보충용)
  const outboundLookup = new Map<string, number>();
  for (const row of monthlyOutboundAll) {
    outboundLookup.set(`${row.productId}|${row.period}`, Number(row.total));
  }

  const items: FulfillmentRateItem[] = [];
  const periodsSet = new Set<string>();
  for (const f of forecasts) {
    const product = productMap.get(f.productId);
    if (!product || !f.forecastQty) continue;
    periodsSet.add(f.period);
    const key = `${f.productId}|${f.period}`;
    const salesQty = salesLookup.get(key);
    // salesRecords에 값이 있으면 우선 사용, 없으면 inventoryHistory 출고로 보충
    const actualQty = f.actualQty
      ?? (salesQty !== undefined ? salesQty : (outboundLookup.get(key) ?? 0));
    const rate = f.forecastQty > 0 ? (actualQty / f.forecastQty) * 100 : 0;
    items.push({
      productId: f.productId, sku: product.sku, name: product.name, period: f.period,
      forecastQty: f.forecastQty, actualQty,
      fulfillmentRate: Math.round(rate * 10) / 10,
    });
  }
  return buildSummary(items, periodsSet);
}

/**
 * 실출고율 데이터 조회 (60초 캐시)
 */
export async function getFulfillmentRateData(): Promise<FulfillmentRateSummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) {
    return { items: [], avgFulfillmentRate: 0, overForecastCount: 0, underForecastCount: 0, periods: [], periodLabel: "데이터 없음" };
  }

  return unstable_cache(
    () => _getFulfillmentRateInternal(orgId),
    [`fulfillment-rate-${orgId}`],
    { revalidate: 60, tags: [`analytics-${orgId}`] }
  )();
}
