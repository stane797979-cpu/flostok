"use server";

import { db } from "@/server/db";
import { kpiMonthlySnapshots } from "@/server/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getCurrentUser, requireAuth } from "./auth-helpers";
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
  const orgId = user?.organizationId;
  if (!orgId) return [];

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
    const orgId = user?.organizationId;
    if (!orgId) return { success: false, message: "조직 정보를 찾을 수 없습니다" };

    // SELECT+UPDATE/INSERT → onConflictDoUpdate upsert 단일 쿼리로 처리
    await db
      .insert(kpiMonthlySnapshots)
      .values({
        organizationId: orgId,
        period,
        turnoverRate: data.turnoverRate?.toString(),
        stockoutRate: data.stockoutRate?.toString(),
        onTimeDeliveryRate: data.onTimeDeliveryRate?.toString(),
        fulfillmentRate: data.fulfillmentRate?.toString(),
        actualShipmentRate: data.actualShipmentRate?.toString(),
        comment: data.comment,
      })
      .onConflictDoUpdate({
        target: [kpiMonthlySnapshots.organizationId, kpiMonthlySnapshots.period],
        set: {
          ...(data.turnoverRate !== undefined && { turnoverRate: data.turnoverRate.toString() }),
          ...(data.stockoutRate !== undefined && { stockoutRate: data.stockoutRate.toString() }),
          ...(data.onTimeDeliveryRate !== undefined && { onTimeDeliveryRate: data.onTimeDeliveryRate.toString() }),
          ...(data.fulfillmentRate !== undefined && { fulfillmentRate: data.fulfillmentRate.toString() }),
          ...(data.actualShipmentRate !== undefined && { actualShipmentRate: data.actualShipmentRate.toString() }),
          ...(data.comment !== undefined && { comment: data.comment }),
          updatedAt: new Date(),
        },
      });

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
    // 인증 확인
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, message: "인증이 필요합니다" };
    }

    // 해당 스냅샷이 인증된 사용자의 조직 소속인지 검증
    const [snapshot] = await db
      .select({ organizationId: kpiMonthlySnapshots.organizationId })
      .from(kpiMonthlySnapshots)
      .where(eq(kpiMonthlySnapshots.id, snapshotId))
      .limit(1);

    if (!snapshot) {
      return { success: false, message: "KPI 스냅샷을 찾을 수 없습니다" };
    }

    if (snapshot.organizationId !== user.organizationId) {
      return { success: false, message: "권한이 없습니다" };
    }

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
    const orgId = user?.organizationId;
    if (!orgId) return;

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
