"use server";

import { db } from "@/server/db";
import { products, inventory, salesRecords, inboundRecords, demandForecasts, psiPlans } from "@/server/db/schema";
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
  const [productRows, inventoryRows, salesRows, inboundRows, forecastRows, planRows] = await Promise.all([
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

    // PSI 계획 데이터 (S&OP + 입고계획)
    db
      .select({
        productId: psiPlans.productId,
        month: sql<string>`to_char(${psiPlans.period}::date, 'YYYY-MM')`.as("month"),
        sopQuantity: psiPlans.sopQuantity,
        inboundPlanQuantity: psiPlans.inboundPlanQuantity,
      })
      .from(psiPlans)
      .where(
        and(
          eq(psiPlans.organizationId, orgId),
          gte(psiPlans.period, startDate),
          lte(psiPlans.period, endDate)
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

  const sopByMonth = new Map<string, Map<string, number>>();
  const inboundPlanByMonth = new Map<string, Map<string, number>>();
  for (const row of planRows) {
    if (row.sopQuantity > 0) {
      if (!sopByMonth.has(row.productId)) sopByMonth.set(row.productId, new Map());
      sopByMonth.get(row.productId)!.set(row.month, row.sopQuantity);
    }
    if (row.inboundPlanQuantity > 0) {
      if (!inboundPlanByMonth.has(row.productId)) inboundPlanByMonth.set(row.productId, new Map());
      inboundPlanByMonth.get(row.productId)!.set(row.month, row.inboundPlanQuantity);
    }
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
    sopByMonth,
    inboundPlanByMonth,
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

    // 월별 S&OP/입고계획 컬럼 파싱
    const planColumns: Array<{ header: string; period: string; type: "sop" | "inbound_plan" }> = [];
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

      // "2025-08 입고계획" 또는 "2025.8 입고계획" 형태
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
        message: "계획 컬럼을 찾을 수 없습니다. 형식: 'YYYY-MM S&OP', 'YYYY-MM 입고계획'",
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
          else updateData.inboundPlanQuantity = value;

          await db.update(psiPlans).set(updateData).where(eq(psiPlans.id, existing[0].id));
        } else {
          await db.insert(psiPlans).values({
            organizationId: orgId,
            productId,
            period: periodDate,
            sopQuantity: col.type === "sop" ? value : 0,
            inboundPlanQuantity: col.type === "inbound_plan" ? value : 0,
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
