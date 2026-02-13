"use server";

import { db } from "@/server/db";
import { kpiMonthlySnapshots } from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import type { KPITrend } from "@/server/services/scm/kpi-measurement";

export interface KpiSnapshot {
  id: string;
  period: string;
  turnoverRate: number | null;
  stockoutRate: number | null;
  onTimeDeliveryRate: number | null;
  fulfillmentRate: number | null;
  actualShipmentRate: number | null;
  comment: string | null;
}

/**
 * 월별 KPI 스냅샷 조회 (최근 12개월)
 */
export async function getKpiSnapshots(): Promise<KpiSnapshot[]> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

  const rows = await db
    .select()
    .from(kpiMonthlySnapshots)
    .where(eq(kpiMonthlySnapshots.organizationId, orgId))
    .orderBy(desc(kpiMonthlySnapshots.period))
    .limit(12);

  return rows.map((r) => ({
    id: r.id,
    period: r.period,
    turnoverRate: r.turnoverRate ? parseFloat(r.turnoverRate) : null,
    stockoutRate: r.stockoutRate ? parseFloat(r.stockoutRate) : null,
    onTimeDeliveryRate: r.onTimeDeliveryRate ? parseFloat(r.onTimeDeliveryRate) : null,
    fulfillmentRate: r.fulfillmentRate ? parseFloat(r.fulfillmentRate) : null,
    actualShipmentRate: r.actualShipmentRate ? parseFloat(r.actualShipmentRate) : null,
    comment: r.comment,
  })).reverse(); // 시간순 정렬
}

/**
 * KPI 스냅샷 저장 (upsert)
 */
export async function saveKpiSnapshot(
  period: string,
  data: {
    turnoverRate?: number;
    stockoutRate?: number;
    onTimeDeliveryRate?: number;
    fulfillmentRate?: number;
    actualShipmentRate?: number;
    comment?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    // 기존 데이터 확인
    const [existing] = await db
      .select()
      .from(kpiMonthlySnapshots)
      .where(
        and(
          eq(kpiMonthlySnapshots.organizationId, orgId),
          eq(kpiMonthlySnapshots.period, period)
        )
      )
      .limit(1);

    if (existing) {
      // 업데이트
      await db
        .update(kpiMonthlySnapshots)
        .set({
          turnoverRate: data.turnoverRate?.toString() ?? existing.turnoverRate,
          stockoutRate: data.stockoutRate?.toString() ?? existing.stockoutRate,
          onTimeDeliveryRate: data.onTimeDeliveryRate?.toString() ?? existing.onTimeDeliveryRate,
          fulfillmentRate: data.fulfillmentRate?.toString() ?? existing.fulfillmentRate,
          actualShipmentRate: data.actualShipmentRate?.toString() ?? existing.actualShipmentRate,
          comment: data.comment !== undefined ? data.comment : existing.comment,
          updatedAt: new Date(),
        })
        .where(eq(kpiMonthlySnapshots.id, existing.id));
    } else {
      // 신규
      await db.insert(kpiMonthlySnapshots).values({
        organizationId: orgId,
        period,
        turnoverRate: data.turnoverRate?.toString(),
        stockoutRate: data.stockoutRate?.toString(),
        onTimeDeliveryRate: data.onTimeDeliveryRate?.toString(),
        fulfillmentRate: data.fulfillmentRate?.toString(),
        actualShipmentRate: data.actualShipmentRate?.toString(),
        comment: data.comment,
      });
    }

    revalidatePath("/dashboard/kpi");
    return { success: true, message: "KPI 스냅샷이 저장되었습니다" };
  } catch (error) {
    console.error("KPI 스냅샷 저장 실패:", error);
    return { success: false, message: "저장 중 오류가 발생했습니다" };
  }
}

/**
 * KPI 코멘트만 업데이트
 */
export async function updateKpiComment(
  snapshotId: string,
  comment: string
): Promise<{ success: boolean; message: string }> {
  try {
    await db
      .update(kpiMonthlySnapshots)
      .set({ comment, updatedAt: new Date() })
      .where(eq(kpiMonthlySnapshots.id, snapshotId));

    revalidatePath("/dashboard/kpi");
    return { success: true, message: "코멘트가 저장되었습니다" };
  } catch (error) {
    console.error("코멘트 저장 실패:", error);
    return { success: false, message: "저장 중 오류가 발생했습니다" };
  }
}

/**
 * KPI 트렌드 데이터로 스냅샷 자동 생성 (upsert)
 * 페이지 로드 시 호출하여 빈 스냅샷을 채움
 */
export async function ensureKpiSnapshots(trends: KPITrend[]): Promise<void> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    // 배치 처리: 순차 SELECT+INSERT 루프 → 1회 조회 + 1회 배치 INSERT (24→2 쿼리)
    const periods = trends.map(t => t.month);
    const existingSnapshots = await db
      .select({ period: kpiMonthlySnapshots.period })
      .from(kpiMonthlySnapshots)
      .where(
        and(
          eq(kpiMonthlySnapshots.organizationId, orgId),
          inArray(kpiMonthlySnapshots.period, periods)
        )
      );
    const existingPeriods = new Set(existingSnapshots.map(s => s.period));

    const newValues = trends
      .filter(trend => !existingPeriods.has(trend.month))
      .map(trend => ({
        organizationId: orgId,
        period: trend.month,
        turnoverRate: trend.inventoryTurnoverRate.toFixed(1),
        stockoutRate: trend.stockoutRate.toFixed(1),
        onTimeDeliveryRate: trend.onTimeOrderRate.toFixed(1),
        fulfillmentRate: trend.orderFulfillmentRate.toFixed(1),
        actualShipmentRate: null,
      }));

    if (newValues.length > 0) {
      await db.insert(kpiMonthlySnapshots).values(newValues);
    }
  } catch (error) {
    console.error("KPI 스냅샷 자동 생성 실패:", error);
  }
}
