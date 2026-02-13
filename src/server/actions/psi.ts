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
import { calculateEOQ } from "@/server/services/scm/eoq";
import { revalidatePath, unstable_cache, revalidateTag } from "next/cache";

/**
 * PSI 데이터 조회 내부 로직 (캐싱 대상)
 */
async function _getPSIDataInternal(orgId: string): Promise<PSIResult> {
  const periods = generatePeriods(1, 6);
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
        orderMethod: products.orderMethod,
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
      orderMethod: p.orderMethod,
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
 * PSI 데이터 조회 (8개월: 전월1 + 현재 + 미래6)
 * unstable_cache로 60초간 캐싱
 */
export async function getPSIData(): Promise<PSIResult> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

  return unstable_cache(
    () => _getPSIDataInternal(orgId),
    [`psi-data-${orgId}`],
    { revalidate: 60, tags: [`psi-${orgId}`] }
  )();
}

/**
 * SCM/S&OP 물량 엑셀 업로드
 * 엑셀 형식: SKU | 2025-08 SCM | 2025-08 S&OP | 2025-09 SCM | ...
 * SCM = AI 가이드 공급수량, S&OP = 회의 합의 출고예상량
 */
export async function uploadPSIPlanExcel(
  formData: FormData
): Promise<{ success: boolean; message: string; importedCount: number }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    const file = formData.get("file") as File;
    if (!file) return { success: false, message: "파일이 없습니다", importedCount: 0 };

    const XLSX = await import("xlsx");
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

    // 컬럼 헤더 파싱: "2025-08 출고계획", "2025-08 SCM" 형태
    const headers = Object.keys(rows[0]);
    const skuCol = headers.find((h) =>
      ["sku", "SKU", "품번", "제품코드"].includes(h.trim())
    );
    if (!skuCol) return { success: false, message: "SKU 컬럼을 찾을 수 없습니다 (SKU, 품번, 제품코드 중 하나 필요)", importedCount: 0 };

    // 발주방식 컬럼 감지
    const orderMethodCol = headers.find((h) =>
      ["발주방식", "발주구분", "orderMethod", "order_method"].includes(h.trim())
    );

    // 월별 SCM/출고계획 컬럼 파싱
    const planColumns: Array<{ header: string; period: string; type: "sop" | "inbound_plan" | "outbound_plan" }> = [];
    for (const h of headers) {
      if (h === skuCol) continue;
      const trimmed = h.trim();

      // "2025-08 SCM" 또는 하위호환 "공급계획/SOP" 형태 → SCM 가이드 (sop_quantity)
      const scmMatch = trimmed.match(/^(\d{4})[.-](\d{1,2})\s*(SCM|공급계획|SOP|sop)$/i);
      if (scmMatch) {
        const period = `${scmMatch[1]}-${scmMatch[2].padStart(2, "0")}`;
        planColumns.push({ header: h, period, type: "sop" });
        continue;
      }

      // "2025-08 출고계획" 또는 하위호환 "S&OP/출고예상/출고" → 출고계획 수량 (outbound_plan)
      const sopMatch = trimmed.match(/^(\d{4})[.-](\d{1,2})\s*(S&OP|출고계획|출고예상|출고|outbound|OBP)/i);
      if (sopMatch) {
        const period = `${sopMatch[1]}-${sopMatch[2].padStart(2, "0")}`;
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
        message: "계획 컬럼을 찾을 수 없습니다. 형식: 'YYYY-MM SCM', 'YYYY-MM 출고계획'",
        importedCount: 0,
      };
    }

    // 배치 Upsert 실행 (ON CONFLICT DO UPDATE)
    let importedCount = 0;

    // 1) 발주방식 업데이트 모아서 배치 처리
    if (orderMethodCol) {
      const orderMethodUpdates = new Map<string, "fixed_quantity" | "fixed_period">();
      for (const row of rows) {
        const sku = String(row[skuCol] || "").trim();
        if (!sku) continue;
        const productId = skuMap.get(sku);
        if (!productId) continue;

        const methodValue = String(row[orderMethodCol] || "").trim();
        let dbValue: "fixed_quantity" | "fixed_period" | null = null;
        if (methodValue === "정량" || methodValue === "fixed_quantity" || methodValue === "Q") dbValue = "fixed_quantity";
        else if (methodValue === "정기" || methodValue === "fixed_period" || methodValue === "P") dbValue = "fixed_period";

        if (dbValue) orderMethodUpdates.set(productId, dbValue);
      }

      // 발주방식별 배치 UPDATE
      for (const [method, ids] of [
        ["fixed_quantity" as const, [...orderMethodUpdates.entries()].filter(([, v]) => v === "fixed_quantity").map(([k]) => k)],
        ["fixed_period" as const, [...orderMethodUpdates.entries()].filter(([, v]) => v === "fixed_period").map(([k]) => k)],
      ] as const) {
        if (ids.length > 0) {
          await db.update(products).set({ orderMethod: method, updatedAt: new Date() }).where(sql`${products.id} IN ${ids}`);
        }
      }
    }

    // 2) PSI 데이터 배치 upsert (ON CONFLICT)
    const upsertBatch: Array<{
      organizationId: string;
      productId: string;
      period: string;
      sopQuantity: number;
      inboundPlanQuantity: number;
      outboundPlanQuantity: number;
    }> = [];

    for (const row of rows) {
      const sku = String(row[skuCol] || "").trim();
      if (!sku) continue;
      const productId = skuMap.get(sku);
      if (!productId) continue;

      for (const col of planColumns) {
        const value = Number(row[col.header]) || 0;
        if (value === 0) continue;

        const periodDate = `${col.period}-01`;
        upsertBatch.push({
          organizationId: orgId,
          productId,
          period: periodDate,
          sopQuantity: col.type === "sop" ? value : 0,
          inboundPlanQuantity: col.type === "inbound_plan" ? value : 0,
          outboundPlanQuantity: col.type === "outbound_plan" ? value : 0,
        });
      }
    }

    // 500건씩 청크로 나눠서 배치 upsert
    const CHUNK_SIZE = 500;
    for (let i = 0; i < upsertBatch.length; i += CHUNK_SIZE) {
      const chunk = upsertBatch.slice(i, i + CHUNK_SIZE);
      await db
        .insert(psiPlans)
        .values(chunk)
        .onConflictDoUpdate({
          target: [psiPlans.organizationId, psiPlans.productId, psiPlans.period],
          set: {
            sopQuantity: sql`CASE WHEN excluded.sop_quantity > 0 THEN excluded.sop_quantity ELSE ${psiPlans.sopQuantity} END`,
            inboundPlanQuantity: sql`CASE WHEN excluded.inbound_plan_quantity > 0 THEN excluded.inbound_plan_quantity ELSE ${psiPlans.inboundPlanQuantity} END`,
            outboundPlanQuantity: sql`CASE WHEN excluded.outbound_plan_quantity > 0 THEN excluded.outbound_plan_quantity ELSE ${psiPlans.outboundPlanQuantity} END`,
            updatedAt: new Date(),
          },
        });
    }
    importedCount = upsertBatch.length;

    revalidatePath("/dashboard/psi");
    revalidateTag(`psi-${orgId}`);
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

export type SOPMethod = "match_outbound" | "safety_stock" | "target_days" | "forecast" | "by_order_method";

export interface ByOrderMethodOptions {
  fixedQuantityMethod: SOPMethod;
  fixedPeriodMethod: SOPMethod;
  targetDays?: number;
}

/**
 * SCM 가이드 수량 자동 산출
 * S&OP 합의 출고예상량 기반으로 SCM(공급 가이드) 수량을 산출하여 psi_plans에 저장
 */
export async function generateSOPQuantities(
  method: SOPMethod,
  targetDays?: number,
  byOrderMethodOptions?: ByOrderMethodOptions
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
      // 제품 목록 (안전재고, 발주방식, 단가, 목표재고, 발주점 포함)
      db
        .select({
          id: products.id,
          safetyStock: products.safetyStock,
          orderMethod: products.orderMethod,
          costPrice: products.costPrice,
          targetStock: products.targetStock,
          reorderPoint: products.reorderPoint
        })
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

    // 순차 계산 후 배치 upsert를 위해 결과를 수집
    const sopUpsertBatch: Array<{
      organizationId: string;
      productId: string;
      period: string;
      sopQuantity: number;
      inboundPlanQuantity: number;
      outboundPlanQuantity: number;
    }> = [];

    for (const product of productRows) {
      const currentStock = inventoryMap.get(product.id) ?? 0;
      const safetyStock = safetyStockMap.get(product.id) ?? 0;
      let runningStock = currentStock;

      // 산출 방식별 수량 계산 헬퍼
      const calcSopQty = (m: SOPMethod, outPlan: number, period: string, days?: number): number => {
        switch (m) {
          case "match_outbound":
            return outPlan;
          case "safety_stock":
            return Math.max(0, outPlan + safetyStock - runningStock);
          case "target_days": {
            const d = days || targetDays || 30;
            const dailyOutbound = outPlan / 30;
            const tgtStock = Math.max(dailyOutbound * d, safetyStock);
            return Math.max(0, outPlan + tgtStock - runningStock);
          }
          case "forecast":
            return forecastMap.get(product.id)?.get(period) || outPlan;
          default:
            return Math.max(0, outPlan + safetyStock - runningStock);
        }
      };

      for (const period of futurePeriods) {
        const outPlan = outPlanMap.get(product.id)?.get(period) || 0;
        let sopQty = 0;

        if (method === "by_order_method") {
          const om = product.orderMethod;
          const subMethod = om === "fixed_quantity"
            ? byOrderMethodOptions?.fixedQuantityMethod ?? "safety_stock"
            : om === "fixed_period"
            ? byOrderMethodOptions?.fixedPeriodMethod ?? "safety_stock"
            : "safety_stock";
          sopQty = calcSopQty(subMethod, outPlan, period, byOrderMethodOptions?.targetDays);
        } else {
          sopQty = calcSopQty(method, outPlan, period);
        }

        sopQty = Math.round(sopQty);

        if (sopQty > 0) {
          sopUpsertBatch.push({
            organizationId: orgId,
            productId: product.id,
            period: `${period}-01`,
            sopQuantity: sopQty,
            inboundPlanQuantity: 0,
            outboundPlanQuantity: 0,
          });
        }

        // 다음 달 기초재고 = 현재 기초재고 + S&OP(공급) - 출고P
        runningStock = Math.max(0, runningStock + sopQty - outPlan);
      }
    }

    // 배치 upsert (ON CONFLICT → sopQuantity만 갱신)
    const SOP_CHUNK = 500;
    for (let i = 0; i < sopUpsertBatch.length; i += SOP_CHUNK) {
      const chunk = sopUpsertBatch.slice(i, i + SOP_CHUNK);
      await db
        .insert(psiPlans)
        .values(chunk)
        .onConflictDoUpdate({
          target: [psiPlans.organizationId, psiPlans.productId, psiPlans.period],
          set: {
            sopQuantity: sql`excluded.sop_quantity`,
            updatedAt: new Date(),
          },
        });
    }
    const updatedCount = sopUpsertBatch.length;

    revalidatePath("/dashboard/psi");
    revalidateTag(`psi-${orgId}`);

    const methodLabels: Record<SOPMethod, string> = {
      match_outbound: "출고계획 동일",
      safety_stock: "안전재고 보충",
      target_days: `목표재고일수(${targetDays || 30}일)`,
      forecast: "수요예측 연동",
      by_order_method: "발주방식별 자동",
    };

    let methodDesc = methodLabels[method];
    if (method === "by_order_method" && byOrderMethodOptions) {
      const qLabel = methodLabels[byOrderMethodOptions.fixedQuantityMethod] || "안전재고 보충";
      const pLabel = methodLabels[byOrderMethodOptions.fixedPeriodMethod] || "안전재고 보충";
      methodDesc = `발주방식별 (정량: ${qLabel}, 정기: ${pLabel})`;
    }

    return {
      success: true,
      message: `${methodDesc} 방식으로 ${updatedCount}건의 S&OP 수량이 산출되었습니다`,
      updatedCount,
    };
  } catch (error) {
    console.error("S&OP 자동 산출 실패:", error);
    return { success: false, message: "S&OP 산출 중 오류가 발생했습니다", updatedCount: 0 };
  }
}
