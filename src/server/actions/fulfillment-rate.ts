"use server";

import { db } from "@/server/db";
import { demandForecasts, products, salesRecords } from "@/server/db/schema";
import { eq, and, sql, gte, lte, isNotNull } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";

export interface FulfillmentRateItem {
  productId: string;
  sku: string;
  name: string;
  period: string;
  forecastQty: number;
  actualQty: number;
  fulfillmentRate: number; // 실출고율 (%)
}

export interface FulfillmentRateSummary {
  items: FulfillmentRateItem[];
  avgFulfillmentRate: number;
  overForecastCount: number; // 예측 초과 품목
  underForecastCount: number; // 예측 미달 품목
  periods: string[];
}

/**
 * 실출고율 데이터 조회
 * 실출고율 = (실제출고량 / 예측수량) × 100
 */
export async function getFulfillmentRateData(): Promise<FulfillmentRateSummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

  // 최근 6개월 범위
  const now = new Date();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(now.getMonth() - 6);
  const startDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  // 1) 예측 데이터 조회
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

  // 예측 데이터가 없으면 판매 데이터 기반으로 월별 집계
  if (forecasts.length === 0) {
    // 판매 기록에서 월별 집계
    const monthlySales = await db
      .select({
        productId: salesRecords.productId,
        month: sql<string>`to_char(${salesRecords.date}::date, 'YYYY-MM-01')`,
        totalQty: sql<number>`sum(${salesRecords.quantity})`,
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          gte(salesRecords.date, startDate.substring(0, 10)),
        )
      )
      .groupBy(salesRecords.productId, sql`to_char(${salesRecords.date}::date, 'YYYY-MM-01')`);

    if (monthlySales.length === 0) {
      return { items: [], avgFulfillmentRate: 0, overForecastCount: 0, underForecastCount: 0, periods: [] };
    }

    // 제품 정보
    const productList = await db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(and(eq(products.organizationId, orgId), isNotNull(products.isActive)));
    const productMap = new Map(productList.map((p) => [p.id, p]));

    // 제품별 월평균 출고량으로 단순 예측값 추정
    const productMonthly = new Map<string, Map<string, number>>();
    for (const row of monthlySales) {
      const month = row.month as string;
      if (!productMonthly.has(row.productId)) {
        productMonthly.set(row.productId, new Map());
      }
      productMonthly.get(row.productId)!.set(month, Number(row.totalQty));
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
          productId,
          sku: product.sku,
          name: product.name,
          period,
          forecastQty: avgForecast,
          actualQty,
          fulfillmentRate: Math.round(rate * 10) / 10,
        });
      }
    }

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

  // 예측 데이터가 있는 경우
  const productIds = [...new Set(forecasts.map((f) => f.productId))];
  const productList = await db
    .select({ id: products.id, sku: products.sku, name: products.name })
    .from(products)
    .where(and(eq(products.organizationId, orgId), sql`${products.id} IN ${productIds}`));
  const productMap = new Map(productList.map((p) => [p.id, p]));

  const items: FulfillmentRateItem[] = [];
  const periodsSet = new Set<string>();

  for (const f of forecasts) {
    const product = productMap.get(f.productId);
    if (!product || !f.forecastQty) continue;

    const period = f.period;
    periodsSet.add(period);

    // actualQuantity가 있으면 사용, 없으면 판매기록에서 조회
    let actualQty = f.actualQty || 0;
    if (!f.actualQty) {
      const periodEnd = new Date(period);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const periodEndStr = periodEnd.toISOString().split("T")[0];

      const [salesResult] = await db
        .select({ total: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)` })
        .from(salesRecords)
        .where(
          and(
            eq(salesRecords.organizationId, orgId),
            eq(salesRecords.productId, f.productId),
            gte(salesRecords.date, period),
            lte(salesRecords.date, periodEndStr)
          )
        );
      actualQty = Number(salesResult?.total || 0);
    }

    const rate = f.forecastQty > 0 ? (actualQty / f.forecastQty) * 100 : 0;

    items.push({
      productId: f.productId,
      sku: product.sku,
      name: product.name,
      period,
      forecastQty: f.forecastQty,
      actualQty,
      fulfillmentRate: Math.round(rate * 10) / 10,
    });
  }

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
