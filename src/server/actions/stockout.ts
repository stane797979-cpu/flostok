"use server";

import { db } from "@/server/db";
import { stockoutRecords, products, inventory } from "@/server/db/schema";
import { eq, and, desc, sql, isNull } from "drizzle-orm";
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
  currentStock: number;
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
 * 결품 기록 조회 + 현재 품절 자동 감지 + 정상화 자동 처리
 *
 * 동작 원리:
 * 1. DB에서 진행 중 결품(endDate 없음) 조회
 * 2. 해당 제품의 현재 재고 확인 → 재고 ≥ 1이면 자동 정상화 (endDate, durationDays 설정)
 * 3. 현재 재고=0인데 기록 없는 제품 → 자동 감지하여 가상 기록 추가
 * 4. 진행 중 결품은 durationDays = (오늘 - 시작일) 실시간 계산
 */
export async function getStockoutData(): Promise<StockoutSummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";
  const today = new Date().toISOString().split("T")[0];

  // 1. 현재 재고 맵 (전체 제품)
  const inventoryRows = await db
    .select({
      productId: inventory.productId,
      currentStock: inventory.currentStock,
    })
    .from(inventory)
    .where(eq(inventory.organizationId, orgId));
  const stockMap = new Map(inventoryRows.map((r) => [r.productId, r.currentStock]));

  // 2. 진행 중인 결품 기록 (endDate가 null) 중 재고가 1 이상인 것 → 자동 정상화
  const activeRecords = await db
    .select({
      id: stockoutRecords.id,
      productId: stockoutRecords.productId,
      stockoutStartDate: stockoutRecords.stockoutStartDate,
    })
    .from(stockoutRecords)
    .where(
      and(
        eq(stockoutRecords.organizationId, orgId),
        eq(stockoutRecords.isStockout, true),
        isNull(stockoutRecords.stockoutEndDate)
      )
    );

  for (const record of activeRecords) {
    const currentStock = stockMap.get(record.productId) ?? 0;
    if (currentStock >= 1) {
      // 재고 회복 → 자동 정상화
      const startDate = record.stockoutStartDate ? new Date(record.stockoutStartDate) : new Date();
      const endDate = new Date(today);
      const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      await db
        .update(stockoutRecords)
        .set({
          stockoutEndDate: today,
          durationDays: duration,
          closingStock: currentStock,
          actionStatus: "normalized",
          updatedAt: new Date(),
        })
        .where(eq(stockoutRecords.id, record.id));
    }
  }

  // 3. 전체 결품 기록 조회 (정상화 반영 후)
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

  // 4. 현재 재고=0인데 기록 없는 제품 → 자동 감지
  const recordedActiveProductIds = new Set(
    existingRecords.filter((r) => r.isStockout && !r.stockoutEndDate).map((r) => r.productId)
  );

  const zeroStockProducts = await db
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

  const autoDetected: StockoutRecordItem[] = zeroStockProducts
    .filter((item) => !recordedActiveProductIds.has(item.productId))
    .map((item) => ({
      id: `auto-${item.productId}`,
      productId: item.productId,
      productName: item.productName ?? "알 수 없음",
      productSku: item.productSku ?? "-",
      referenceDate: today,
      baseStock: 0,
      outboundQty: 0,
      closingStock: 0,
      currentStock: 0,
      isStockout: true,
      stockoutStartDate: today,
      stockoutEndDate: null,
      durationDays: null,
      cause: null,
      actionStatus: "no_action",
      notes: null,
    }));

  // 5. 전체 기록 통합 + 진행 중 결품 지속일 실시간 계산
  const allRecords: StockoutRecordItem[] = [
    ...autoDetected,
    ...existingRecords.map((r) => {
      const currentStock = stockMap.get(r.productId) ?? 0;
      let durationDays = r.durationDays;

      // 진행 중인 결품 → 지속일 실시간 계산
      if (r.isStockout && !r.stockoutEndDate && r.stockoutStartDate) {
        const start = new Date(r.stockoutStartDate);
        const now = new Date(today);
        durationDays = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }

      return {
        ...r,
        productName: r.productName ?? "알 수 없음",
        productSku: r.productSku ?? "-",
        baseStock: r.baseStock ?? 0,
        outboundQty: r.outboundQty ?? 0,
        closingStock: r.closingStock ?? 0,
        currentStock,
        durationDays,
      };
    }),
  ];

  // 6. 통계
  const [{ count: totalProducts }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.organizationId, orgId));

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

  // 7. 원인 분포
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
