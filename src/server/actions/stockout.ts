"use server";

import { db } from "@/server/db";
import { stockoutRecords, products, inventory } from "@/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import { revalidatePath } from "next/cache";

export interface StockoutRecordItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  referenceDate: string;
  baseStock: number;
  outboundQty: number;
  closingStock: number;
  isStockout: boolean;
  stockoutStartDate: string | null;
  stockoutEndDate: string | null;
  durationDays: number | null;
  cause: string | null;
  actionStatus: string | null;
  notes: string | null;
}

export interface StockoutSummary {
  records: StockoutRecordItem[];
  totalProducts: number;
  stockoutCount: number;
  stockoutRate: number;
  avgDurationDays: number;
  causeDistribution: { cause: string; count: number }[];
}

/**
 * 결품 기록 조회 + 현재 품절 상태 제품 자동 감지
 */
export async function getStockoutData(): Promise<StockoutSummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

  // 1. 기존 결품 기록 조회
  const existingRecords = await db
    .select({
      id: stockoutRecords.id,
      productId: stockoutRecords.productId,
      productName: products.name,
      productSku: products.sku,
      referenceDate: stockoutRecords.referenceDate,
      baseStock: stockoutRecords.baseStock,
      outboundQty: stockoutRecords.outboundQty,
      closingStock: stockoutRecords.closingStock,
      isStockout: stockoutRecords.isStockout,
      stockoutStartDate: stockoutRecords.stockoutStartDate,
      stockoutEndDate: stockoutRecords.stockoutEndDate,
      durationDays: stockoutRecords.durationDays,
      cause: stockoutRecords.cause,
      actionStatus: stockoutRecords.actionStatus,
      notes: stockoutRecords.notes,
    })
    .from(stockoutRecords)
    .innerJoin(products, eq(stockoutRecords.productId, products.id))
    .where(eq(stockoutRecords.organizationId, orgId))
    .orderBy(desc(stockoutRecords.referenceDate))
    .limit(200);

  // 2. 현재 품절 상태 제품 자동 감지 (기록에 없는 것들)
  const currentStockout = await db
    .select({
      productId: inventory.productId,
      productName: products.name,
      productSku: products.sku,
      currentStock: inventory.currentStock,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .where(
      and(
        eq(inventory.organizationId, orgId),
        eq(inventory.currentStock, 0)
      )
    );

  // 기존 기록의 productId Set
  const recordedProductIds = new Set(
    existingRecords.filter((r) => r.isStockout && !r.stockoutEndDate).map((r) => r.productId)
  );

  // 아직 기록되지 않은 품절 제품을 가상 기록으로 추가
  const today = new Date().toISOString().split("T")[0];
  const autoDetected: StockoutRecordItem[] = currentStockout
    .filter((item) => !recordedProductIds.has(item.productId))
    .map((item) => ({
      id: `auto-${item.productId}`,
      productId: item.productId,
      productName: item.productName ?? "알 수 없음",
      productSku: item.productSku ?? "-",
      referenceDate: today,
      baseStock: 0,
      outboundQty: 0,
      closingStock: 0,
      isStockout: true,
      stockoutStartDate: today,
      stockoutEndDate: null,
      durationDays: null,
      cause: null,
      actionStatus: "no_action",
      notes: null,
    }));

  const allRecords: StockoutRecordItem[] = [
    ...autoDetected,
    ...existingRecords.map((r) => ({
      ...r,
      productName: r.productName ?? "알 수 없음",
      productSku: r.productSku ?? "-",
      baseStock: r.baseStock ?? 0,
      outboundQty: r.outboundQty ?? 0,
      closingStock: r.closingStock ?? 0,
    })),
  ];

  // 3. 총 제품 수
  const [{ count: totalProducts }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.organizationId, orgId));

  // 4. 결품 통계
  const activeStockouts = allRecords.filter((r) => r.isStockout && !r.stockoutEndDate);
  const stockoutCount = activeStockouts.length;
  const stockoutRate = totalProducts > 0 ? (stockoutCount / totalProducts) * 100 : 0;

  const durationsWithValues = allRecords
    .map((r) => r.durationDays)
    .filter((d): d is number => d !== null && d > 0);
  const avgDurationDays =
    durationsWithValues.length > 0
      ? durationsWithValues.reduce((a, b) => a + b, 0) / durationsWithValues.length
      : 0;

  // 5. 원인 분포
  const causeMap = new Map<string, number>();
  for (const r of allRecords) {
    if (r.cause) {
      causeMap.set(r.cause, (causeMap.get(r.cause) || 0) + 1);
    }
  }
  const causeDistribution = Array.from(causeMap.entries())
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count);

  return {
    records: allRecords,
    totalProducts,
    stockoutCount,
    stockoutRate,
    avgDurationDays,
    causeDistribution,
  };
}

/**
 * 결품 기록의 원인/조치 업데이트
 */
export async function updateStockoutRecord(
  recordId: string,
  data: {
    cause?: string;
    actionStatus?: string;
    notes?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    // auto-detected 기록은 먼저 DB에 INSERT
    if (recordId.startsWith("auto-")) {
      const productId = recordId.replace("auto-", "");
      const user = await getCurrentUser();
      const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";
      const today = new Date().toISOString().split("T")[0];

      const [inserted] = await db
        .insert(stockoutRecords)
        .values({
          organizationId: orgId,
          productId,
          referenceDate: today,
          isStockout: true,
          stockoutStartDate: today,
          cause: (data.cause as "delivery_delay" | "demand_surge" | "supply_shortage" | "forecast_error" | "quality_issue" | "other") ?? null,
          actionStatus: (data.actionStatus as "normalized" | "inbound_waiting" | "order_in_progress" | "no_action") ?? "no_action",
          notes: data.notes ?? null,
        })
        .returning({ id: stockoutRecords.id });

      revalidatePath("/dashboard/stockout");
      return { success: true, message: "결품 기록이 등록되었습니다" };
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.cause !== undefined)
      updateData.cause = data.cause as "delivery_delay" | "demand_surge" | "supply_shortage" | "forecast_error" | "quality_issue" | "other";
    if (data.actionStatus !== undefined)
      updateData.actionStatus = data.actionStatus as "normalized" | "inbound_waiting" | "order_in_progress" | "no_action";
    if (data.notes !== undefined) updateData.notes = data.notes;

    await db
      .update(stockoutRecords)
      .set(updateData)
      .where(eq(stockoutRecords.id, recordId));

    revalidatePath("/dashboard/stockout");
    return { success: true, message: "업데이트되었습니다" };
  } catch (error) {
    console.error("결품 기록 업데이트 실패:", error);
    return { success: false, message: "업데이트 중 오류가 발생했습니다" };
  }
}
