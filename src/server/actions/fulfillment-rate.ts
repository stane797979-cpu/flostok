"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { demandForecasts, products, salesRecords } from "@/server/db/schema";
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
}

function buildSummary(items: FulfillmentRateItem[], periodsSet: Set<string>): FulfillmentRateSummary {
  const rates = items.filter((i) => i.forecastQty > 0).map((i) => i.fulfillmentRate);
  const avgRate = rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
  return {
    items,
    avgFulfillmentRate: Math.round(avgRate * 10) / 10,
    overForecastCount: items.filter((i) => i.fulfillmentRate > 110).length,
    underForecastCount: items.filter((i) => i.fulfillmentRate < 90).length,
    periods: Array.from(periodsSet).sort(),
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

  // 예측 데이터 없으면 판매 기반 — 판매+제품을 병렬 조회
  if (forecasts.length === 0) {
    const [monthlySales, productList] = await Promise.all([
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
        .select({ id: products.id, sku: products.sku, name: products.name })
        .from(products)
        .where(and(eq(products.organizationId, orgId), isNotNull(products.isActive))),
    ]);

    if (monthlySales.length === 0) {
      return { items: [], avgFulfillmentRate: 0, overForecastCount: 0, underForecastCount: 0, periods: [] };
    }

    const productMap = new Map(productList.map((p) => [p.id, p]));
    const productMonthly = new Map<string, Map<string, number>>();
    for (const row of monthlySales) {
      if (!productMonthly.has(row.productId)) productMonthly.set(row.productId, new Map());
      productMonthly.get(row.productId)!.set(row.month as string, Number(row.totalQty));
    }

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

  // 예측 있는 경우 — 제품+판매량 병렬 조회 (N+1 제거)
  const productIds = [...new Set(forecasts.map((f) => f.productId))];
  const [productList, monthlySalesAll] = await Promise.all([
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
  ]);

  const productMap = new Map(productList.map((p) => [p.id, p]));
  const salesLookup = new Map<string, number>();
  for (const row of monthlySalesAll) {
    salesLookup.set(`${row.productId}|${row.period}`, Number(row.total));
  }

  const items: FulfillmentRateItem[] = [];
  const periodsSet = new Set<string>();
  for (const f of forecasts) {
    const product = productMap.get(f.productId);
    if (!product || !f.forecastQty) continue;
    periodsSet.add(f.period);
    const actualQty = f.actualQty || salesLookup.get(`${f.productId}|${f.period}`) || 0;
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
    return { items: [], avgFulfillmentRate: 0, overForecastCount: 0, underForecastCount: 0, periods: [] };
  }

  return unstable_cache(
    () => _getFulfillmentRateInternal(orgId),
    [`fulfillment-rate-${orgId}`],
    { revalidate: 60, tags: [`analytics-${orgId}`] }
  )();
}
