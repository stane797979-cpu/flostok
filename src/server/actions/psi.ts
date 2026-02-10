"use server";

import { db } from "@/server/db";
import { products, inventory, inboundRecords, demandForecasts, psiPlans, purchaseOrders, purchaseOrderItems, inventoryHistory } from "@/server/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import {
  aggregatePSI,
  generatePeriods,
  type PSIResult,
} from "@/server/services/scm/psi-aggregation";
import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";

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
  const [productRows, inventoryRows, outboundRows, inboundRows, forecastRows, planRows, poInboundPlanRows] = await Promise.all([
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

    // 출고 실적 (월별 집계 — inventory_history에서 changeAmount < 0)
    db
      .select({
        productId: inventoryHistory.productId,
        month: sql<string>`to_char(${inventoryHistory.date}::date, 'YYYY-MM')`.as("month"),
        totalQty: sql<number>`sum(abs(${inventoryHistory.changeAmount}))::int`.as("total_qty"),
      })
      .from(inventoryHistory)
      .where(
        and(
          eq(inventoryHistory.organizationId, orgId),
          sql`${inventoryHistory.changeAmount} < 0`,
          gte(inventoryHistory.date, startDate),
          lte(inventoryHistory.date, endDate)
        )
      )
      .groupBy(inventoryHistory.productId, sql`to_char(${inventoryHistory.date}::date, 'YYYY-MM')`),

    // 입고 실적 (월별 집계)
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

    // 수요 예측 (참고용)
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

    // PSI 계획 데이터 (S&OP + 출고계획)
    db
      .select({
        productId: psiPlans.productId,
        month: sql<string>`to_char(${psiPlans.period}::date, 'YYYY-MM')`.as("month"),
        sopQuantity: psiPlans.sopQuantity,
        inboundPlanQuantity: psiPlans.inboundPlanQuantity,
        outboundPlanQuantity: psiPlans.outboundPlanQuantity,
      })
      .from(psiPlans)
      .where(
        and(
          eq(psiPlans.organizationId, orgId),
          gte(psiPlans.period, startDate),
          lte(psiPlans.period, endDate)
        )
      ),

    // 입고 계획 (발주서 expectedDate 기준 월별 발주수량 합산)
    db
      .select({
        productId: purchaseOrderItems.productId,
        month: sql<string>`to_char(${purchaseOrders.expectedDate}::date, 'YYYY-MM')`.as("month"),
        totalQty: sql<number>`sum(${purchaseOrderItems.quantity})::int`.as("total_qty"),
      })
      .from(purchaseOrders)
      .innerJoin(
        purchaseOrderItems,
        eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id)
      )
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          sql`${purchaseOrders.expectedDate} IS NOT NULL`,
          sql`${purchaseOrders.status} != 'cancelled'`,
          gte(purchaseOrders.expectedDate, startDate),
          lte(purchaseOrders.expectedDate, endDate)
        )
      )
      .groupBy(purchaseOrderItems.productId, sql`to_char(${purchaseOrders.expectedDate}::date, 'YYYY-MM')`),
  ]);

  // Map 형태로 변환
  const inventoryMap = new Map(inventoryRows.map((r) => [r.productId, r.currentStock]));

  // 출고실적 (inventory_history 기반)
  const outboundByMonth = new Map<string, Map<string, number>>();
  for (const row of outboundRows) {
    if (!outboundByMonth.has(row.productId)) outboundByMonth.set(row.productId, new Map());
    outboundByMonth.get(row.productId)!.set(row.month, row.totalQty);
  }

  // 입고실적
  const inboundByMonth = new Map<string, Map<string, number>>();
  for (const row of inboundRows) {
    if (!inboundByMonth.has(row.productId)) inboundByMonth.set(row.productId, new Map());
    inboundByMonth.get(row.productId)!.set(row.month, row.totalQty);
  }

  // 수요예측 (참고용)
  const forecastByMonth = new Map<string, Map<string, number>>();
  const manualForecastByMonth = new Map<string, Map<string, number>>();
  for (const row of forecastRows) {
    const targetMap = row.method === "manual" ? manualForecastByMonth : forecastByMonth;
    if (!targetMap.has(row.productId)) targetMap.set(row.productId, new Map());
    targetMap.get(row.productId)!.set(row.month, row.forecastQty);
  }

  // S&OP + 출고계획 (psi_plans 기반)
  const sopByMonth = new Map<string, Map<string, number>>();
  const outboundPlanByMonth = new Map<string, Map<string, number>>();
  for (const row of planRows) {
    if (row.sopQuantity > 0) {
      if (!sopByMonth.has(row.productId)) sopByMonth.set(row.productId, new Map());
      sopByMonth.get(row.productId)!.set(row.month, row.sopQuantity);
    }
    if (row.outboundPlanQuantity > 0) {
      if (!outboundPlanByMonth.has(row.productId)) outboundPlanByMonth.set(row.productId, new Map());
      outboundPlanByMonth.get(row.productId)!.set(row.month, row.outboundPlanQuantity);
    }
  }

  // 입고계획 (발주 시스템 기반)
  const inboundPlanByMonth = new Map<string, Map<string, number>>();
  for (const row of poInboundPlanRows) {
    if (!inboundPlanByMonth.has(row.productId)) inboundPlanByMonth.set(row.productId, new Map());
    inboundPlanByMonth.get(row.productId)!.set(row.month, row.totalQty);
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
    outboundByMonth,
    inboundByMonth,
    forecastByMonth,
    manualForecastByMonth,
    sopByMonth,
    inboundPlanByMonth,
    outboundPlanByMonth,
    periods,
  });
}

/**
 * S&OP 물량 + 입고계획 엑셀 업로드
 * 엑셀 형식: SKU | 2025-08 S&OP | 2025-08 입고계획 | 2025-09 S&OP | ...
 */
export async function uploadPSIPlanExcel(
  formData: FormData
): Promise<{ success: boolean; message: string; importedCount: number }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    const file = formData.get("file") as File;
    if (!file) return { success: false, message: "파일이 없습니다", importedCount: 0 };

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) return { success: false, message: "데이터가 없습니다", importedCount: 0 };

    // SKU → productId 매핑
    const productList = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(eq(products.organizationId, orgId));
    const skuMap = new Map(productList.map((p) => [p.sku, p.id]));

    // 컬럼 헤더 파싱: "2025-08 S&OP", "2025-08 입고계획" 형태
    const headers = Object.keys(rows[0]);
    const skuCol = headers.find((h) =>
      ["sku", "SKU", "품번", "제품코드"].includes(h.trim())
    );
    if (!skuCol) return { success: false, message: "SKU 컬럼을 찾을 수 없습니다 (SKU, 품번, 제품코드 중 하나 필요)", importedCount: 0 };

    // 월별 S&OP/출고계획 컬럼 파싱
    const planColumns: Array<{ header: string; period: string; type: "sop" | "inbound_plan" | "outbound_plan" }> = [];
    for (const h of headers) {
      if (h === skuCol) continue;
      const trimmed = h.trim();

      // "2025-08 S&OP" 또는 "2025.8 S&OP" 형태
      const sopMatch = trimmed.match(/^(\d{4})[.-](\d{1,2})\s*(S&OP|SOP|공급계획|sop)/i);
      if (sopMatch) {
        const period = `${sopMatch[1]}-${sopMatch[2].padStart(2, "0")}`;
        planColumns.push({ header: h, period, type: "sop" });
        continue;
      }

      // "2025-08 출고계획" 또는 "2025.8 출고" 형태
      const outMatch = trimmed.match(/^(\d{4})[.-](\d{1,2})\s*(출고계획|출고|outbound|OBP)/i);
      if (outMatch) {
        const period = `${outMatch[1]}-${outMatch[2].padStart(2, "0")}`;
        planColumns.push({ header: h, period, type: "outbound_plan" });
        continue;
      }

      // "2025-08 입고계획" 또는 "2025.8 입고계획" 형태 (하위 호환)
      const inbMatch = trimmed.match(/^(\d{4})[.-](\d{1,2})\s*(입고계획|입고|inbound|IBP)/i);
      if (inbMatch) {
        const period = `${inbMatch[1]}-${inbMatch[2].padStart(2, "0")}`;
        planColumns.push({ header: h, period, type: "inbound_plan" });
        continue;
      }
    }

    if (planColumns.length === 0) {
      return {
        success: false,
        message: "계획 컬럼을 찾을 수 없습니다. 형식: 'YYYY-MM S&OP', 'YYYY-MM 출고계획'",
        importedCount: 0,
      };
    }

    // Upsert 실행
    let importedCount = 0;
    for (const row of rows) {
      const sku = String(row[skuCol] || "").trim();
      if (!sku) continue;

      const productId = skuMap.get(sku);
      if (!productId) continue;

      for (const col of planColumns) {
        const value = Number(row[col.header]) || 0;
        if (value === 0) continue;

        const periodDate = `${col.period}-01`;

        // upsert: 기존 데이터가 있으면 update, 없으면 insert
        const existing = await db
          .select({ id: psiPlans.id })
          .from(psiPlans)
          .where(
            and(
              eq(psiPlans.organizationId, orgId),
              eq(psiPlans.productId, productId),
              eq(psiPlans.period, periodDate)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          const updateData: Record<string, unknown> = { updatedAt: new Date() };
          if (col.type === "sop") updateData.sopQuantity = value;
          else if (col.type === "outbound_plan") updateData.outboundPlanQuantity = value;
          else updateData.inboundPlanQuantity = value;

          await db.update(psiPlans).set(updateData).where(eq(psiPlans.id, existing[0].id));
        } else {
          await db.insert(psiPlans).values({
            organizationId: orgId,
            productId,
            period: periodDate,
            sopQuantity: col.type === "sop" ? value : 0,
            inboundPlanQuantity: col.type === "inbound_plan" ? value : 0,
            outboundPlanQuantity: col.type === "outbound_plan" ? value : 0,
          });
        }
        importedCount++;
      }
    }

    revalidatePath("/dashboard/psi");
    return {
      success: true,
      message: `${importedCount}건의 계획 데이터가 업로드되었습니다`,
      importedCount,
    };
  } catch (error) {
    console.error("PSI 계획 엑셀 업로드 실패:", error);
    return { success: false, message: "업로드 중 오류가 발생했습니다", importedCount: 0 };
  }
}

export type SOPMethod = "match_outbound" | "safety_stock" | "target_days" | "forecast";

/**
 * S&OP 수량 자동 산출
 * 출고계획(outboundPlan) 기반으로 S&OP(공급계획) 수량을 산출하여 psi_plans에 저장
 */
export async function generateSOPQuantities(
  method: SOPMethod,
  targetDays?: number
): Promise<{ success: boolean; message: string; updatedCount: number }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    // 미래 6개월 기간 생성
    const now = new Date();
    const futurePeriods: string[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      futurePeriods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const startDate = `${futurePeriods[0]}-01`;
    const endDate = `${futurePeriods[futurePeriods.length - 1]}-31`;

    // 병렬 데이터 로드
    const [productRows, inventoryRows, planRows, forecastRows] = await Promise.all([
      // 제품 목록 (안전재고 포함)
      db
        .select({ id: products.id, safetyStock: products.safetyStock })
        .from(products)
        .where(eq(products.organizationId, orgId)),

      // 현재 재고
      db
        .select({ productId: inventory.productId, currentStock: inventory.currentStock })
        .from(inventory)
        .where(eq(inventory.organizationId, orgId)),

      // 출고계획 (psi_plans)
      db
        .select({
          id: psiPlans.id,
          productId: psiPlans.productId,
          month: sql<string>`to_char(${psiPlans.period}::date, 'YYYY-MM')`.as("month"),
          period: psiPlans.period,
          outboundPlanQuantity: psiPlans.outboundPlanQuantity,
        })
        .from(psiPlans)
        .where(
          and(
            eq(psiPlans.organizationId, orgId),
            gte(psiPlans.period, startDate),
            lte(psiPlans.period, endDate)
          )
        ),

      // 수요예측 (forecast 방식용)
      db
        .select({
          productId: demandForecasts.productId,
          month: sql<string>`to_char(${demandForecasts.period}::date, 'YYYY-MM')`.as("month"),
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

    const inventoryMap = new Map(inventoryRows.map((r) => [r.productId, r.currentStock]));
    const safetyStockMap = new Map(productRows.map((p) => [p.id, p.safetyStock ?? 0]));

    // 출고계획 Map: productId -> { month -> qty }
    const outPlanMap = new Map<string, Map<string, number>>();
    for (const row of planRows) {
      if (!outPlanMap.has(row.productId)) outPlanMap.set(row.productId, new Map());
      outPlanMap.get(row.productId)!.set(row.month, row.outboundPlanQuantity);
    }

    // 수요예측 Map: productId -> { month -> qty }
    const forecastMap = new Map<string, Map<string, number>>();
    for (const row of forecastRows) {
      if (!forecastMap.has(row.productId)) forecastMap.set(row.productId, new Map());
      forecastMap.get(row.productId)!.set(row.month, row.forecastQty);
    }

    let updatedCount = 0;

    for (const product of productRows) {
      const currentStock = inventoryMap.get(product.id) ?? 0;
      const safetyStock = safetyStockMap.get(product.id) ?? 0;
      let runningStock = currentStock;

      for (const period of futurePeriods) {
        const outPlan = outPlanMap.get(product.id)?.get(period) || 0;
        let sopQty = 0;

        switch (method) {
          case "match_outbound":
            // S&OP = 출고P (1:1 매칭)
            sopQty = outPlan;
            break;

          case "safety_stock":
            // S&OP = max(0, 출고P + 안전재고 - 기초재고)
            sopQty = Math.max(0, outPlan + safetyStock - runningStock);
            break;

          case "target_days": {
            // S&OP = max(0, 출고P + max(일평균출고P × 목표일수, 안전재고) - 기초재고)
            const days = targetDays || 30;
            const dailyOutbound = outPlan / 30; // 월간 → 일평균
            const targetStock = Math.max(dailyOutbound * days, safetyStock);
            sopQty = Math.max(0, outPlan + targetStock - runningStock);
            break;
          }

          case "forecast":
            // S&OP = 수요예측값
            sopQty = forecastMap.get(product.id)?.get(period) || outPlan;
            break;
        }

        sopQty = Math.round(sopQty);

        if (sopQty > 0) {
          const periodDate = `${period}-01`;

          // upsert
          const existing = await db
            .select({ id: psiPlans.id })
            .from(psiPlans)
            .where(
              and(
                eq(psiPlans.organizationId, orgId),
                eq(psiPlans.productId, product.id),
                eq(psiPlans.period, periodDate)
              )
            )
            .limit(1);

          if (existing.length > 0) {
            await db.update(psiPlans)
              .set({ sopQuantity: sopQty, updatedAt: new Date() })
              .where(eq(psiPlans.id, existing[0].id));
          } else {
            await db.insert(psiPlans).values({
              organizationId: orgId,
              productId: product.id,
              period: periodDate,
              sopQuantity: sopQty,
            });
          }
          updatedCount++;
        }

        // 다음 달 기초재고 = 현재 기초재고 + S&OP(공급) - 출고P
        runningStock = Math.max(0, runningStock + sopQty - outPlan);
      }
    }

    revalidatePath("/dashboard/psi");

    const methodLabels: Record<SOPMethod, string> = {
      match_outbound: "출고계획 동일",
      safety_stock: "안전재고 보충",
      target_days: `목표재고일수(${targetDays || 30}일)`,
      forecast: "수요예측 연동",
    };

    return {
      success: true,
      message: `${methodLabels[method]} 방식으로 ${updatedCount}건의 S&OP 수량이 산출되었습니다`,
      updatedCount,
    };
  } catch (error) {
    console.error("S&OP 자동 산출 실패:", error);
    return { success: false, message: "S&OP 산출 중 오류가 발생했습니다", updatedCount: 0 };
  }
}
