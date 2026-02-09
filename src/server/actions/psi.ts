"use server";

import { db } from "@/server/db";
import { products, inventory, salesRecords, inboundRecords, demandForecasts } from "@/server/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import {
  aggregatePSI,
  generatePeriods,
  type PSIResult,
} from "@/server/services/scm/psi-aggregation";

/**
 * PSI 데이터 조회 (13개월: 과거6 + 현재 + 미래6)
 */
export async function getPSIData(): Promise<PSIResult> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

  const periods = generatePeriods(6, 6);
  const firstPeriod = periods[0]; // YYYY-MM
  const lastPeriod = periods[periods.length - 1];
  const startDate = `${firstPeriod}-01`;
  const endDate = `${lastPeriod}-31`;

  // 병렬 데이터 로드
  const [productRows, inventoryRows, salesRows, inboundRows, forecastRows] = await Promise.all([
    // 제품 목록
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        category: products.category,
        abcGrade: products.abcGrade,
        xyzGrade: products.xyzGrade,
        safetyStock: products.safetyStock,
      })
      .from(products)
      .where(eq(products.organizationId, orgId)),

    // 현재 재고
    db
      .select({
        productId: inventory.productId,
        currentStock: inventory.currentStock,
      })
      .from(inventory)
      .where(eq(inventory.organizationId, orgId)),

    // 판매 기록 (월별 집계)
    db
      .select({
        productId: salesRecords.productId,
        month: sql<string>`to_char(${salesRecords.date}::date, 'YYYY-MM')`.as("month"),
        totalQty: sql<number>`sum(${salesRecords.quantity})::int`.as("total_qty"),
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          gte(salesRecords.date, startDate),
          lte(salesRecords.date, endDate)
        )
      )
      .groupBy(salesRecords.productId, sql`to_char(${salesRecords.date}::date, 'YYYY-MM')`),

    // 입고 기록 (월별 집계)
    db
      .select({
        productId: inboundRecords.productId,
        month: sql<string>`to_char(${inboundRecords.date}::date, 'YYYY-MM')`.as("month"),
        totalQty: sql<number>`sum(${inboundRecords.receivedQuantity})::int`.as("total_qty"),
      })
      .from(inboundRecords)
      .where(
        and(
          eq(inboundRecords.organizationId, orgId),
          gte(inboundRecords.date, startDate),
          lte(inboundRecords.date, endDate)
        )
      )
      .groupBy(inboundRecords.productId, sql`to_char(${inboundRecords.date}::date, 'YYYY-MM')`),

    // 수요 예측 (월별)
    db
      .select({
        productId: demandForecasts.productId,
        month: sql<string>`to_char(${demandForecasts.period}::date, 'YYYY-MM')`.as("month"),
        method: demandForecasts.method,
        forecastQty: demandForecasts.forecastQuantity,
      })
      .from(demandForecasts)
      .where(
        and(
          eq(demandForecasts.organizationId, orgId),
          gte(demandForecasts.period, startDate),
          lte(demandForecasts.period, endDate)
        )
      ),
  ]);

  // Map 형태로 변환
  const inventoryMap = new Map(inventoryRows.map((r) => [r.productId, r.currentStock]));

  const salesByMonth = new Map<string, Map<string, number>>();
  for (const row of salesRows) {
    if (!salesByMonth.has(row.productId)) salesByMonth.set(row.productId, new Map());
    salesByMonth.get(row.productId)!.set(row.month, row.totalQty);
  }

  const inboundByMonth = new Map<string, Map<string, number>>();
  for (const row of inboundRows) {
    if (!inboundByMonth.has(row.productId)) inboundByMonth.set(row.productId, new Map());
    inboundByMonth.get(row.productId)!.set(row.month, row.totalQty);
  }

  const forecastByMonth = new Map<string, Map<string, number>>();
  const manualForecastByMonth = new Map<string, Map<string, number>>();
  for (const row of forecastRows) {
    const targetMap = row.method === "manual" ? manualForecastByMonth : forecastByMonth;
    if (!targetMap.has(row.productId)) targetMap.set(row.productId, new Map());
    targetMap.get(row.productId)!.set(row.month, row.forecastQty);
  }

  // 집계 수행
  return aggregatePSI({
    products: productRows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      abcGrade: p.abcGrade,
      xyzGrade: p.xyzGrade,
      currentStock: inventoryMap.get(p.id) ?? 0,
      safetyStock: p.safetyStock ?? 0,
    })),
    salesByMonth,
    inboundByMonth,
    forecastByMonth,
    manualForecastByMonth,
    periods,
  });
}
