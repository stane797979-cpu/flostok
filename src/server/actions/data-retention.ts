"use server";

/**
 * 데이터 보관 정책 관리 Server Actions
 *
 * - 보관 정책 조회/저장
 * - 기간 만료 데이터 정리 실행
 * - 정리 전 미리보기 (삭제 대상 건수 조회)
 */

import { db } from "@/server/db";
import {
  organizations,
  purchaseOrders,
  inboundRecords,
  inventoryHistory,
  salesRecords,
  alerts,
  demandForecasts,
  activityLogs,
} from "@/server/db/schema";
import { eq, and, lt, sql, isNotNull } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, getCurrentUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import type {
  RetentionPolicySettings,
  OrganizationSettings,
} from "@/types/organization-settings";
import { DEFAULT_RETENTION_POLICY } from "@/types/organization-settings";

/**
 * 보관 정책 조회
 */
export async function getRetentionPolicy(): Promise<RetentionPolicySettings> {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) return DEFAULT_RETENTION_POLICY;

    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    if (!org) return DEFAULT_RETENTION_POLICY;

    const settings = org.settings as OrganizationSettings | null;
    return settings?.retentionPolicy || DEFAULT_RETENTION_POLICY;
  } catch (error) {
    console.error("보관 정책 조회 실패:", error);
    return DEFAULT_RETENTION_POLICY;
  }
}

/**
 * 보관 정책 저장 (admin 전용)
 */
export async function saveRetentionPolicy(
  policy: RetentionPolicySettings
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await requireAdmin();
    const orgId = user.organizationId;

    // 유효성 검증: 각 값이 0(영구보관) 또는 1~120(개월) 범위
    for (const [key, value] of Object.entries(policy)) {
      if (typeof value !== "number" || value < 0 || value > 120) {
        return {
          success: false,
          message: `${key}: 0(영구보관) ~ 120개월 사이의 값을 입력해주세요.`,
        };
      }
    }

    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return { success: false, message: "조직을 찾을 수 없습니다" };

    const currentSettings = (org.settings as OrganizationSettings) || {};
    const updatedSettings: OrganizationSettings = {
      ...currentSettings,
      retentionPolicy: policy,
    };

    await db
      .update(organizations)
      .set({ settings: updatedSettings, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));

    logActivity({
      user,
      action: "UPDATE",
      entityType: "organization_settings",
      description: "데이터 보관 정책 변경",
      metadata: policy,
    }).catch(() => {});

    revalidatePath("/dashboard/settings");

    return { success: true, message: "보관 정책이 저장되었습니다." };
  } catch (error) {
    console.error("보관 정책 저장 실패:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "저장에 실패했습니다.",
    };
  }
}

// 개월 수 → cutoff Date 계산
function getCutoffDate(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

/**
 * 정리 대상 건수 미리보기 (admin 전용)
 * 실제 삭제 없이 각 카테고리별 삭제 대상 건수만 반환
 */
export async function previewDataCleanup(): Promise<{
  success: boolean;
  counts?: Record<string, number>;
  error?: string;
}> {
  try {
    const user = await requireAdmin();
    const orgId = user.organizationId;

    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const settings = org?.settings as OrganizationSettings | null;
    const policy = settings?.retentionPolicy || DEFAULT_RETENTION_POLICY;

    const counts: Record<string, number> = {};

    // 병렬로 각 카테고리별 카운트 조회
    const queries: Array<{ name: string; promise: Promise<number> }> = [];

    if (policy.purchaseOrdersMonths > 0) {
      const cutoff = getCutoffDate(policy.purchaseOrdersMonths);
      queries.push({
        name: "발주서 (취소/완료)",
        promise: db
          .select({ count: sql<number>`count(*)` })
          .from(purchaseOrders)
          .where(
            and(
              eq(purchaseOrders.organizationId, orgId),
              lt(purchaseOrders.createdAt, cutoff),
              sql`${purchaseOrders.status} IN ('cancelled', 'completed', 'received')`,
              isNotNull(purchaseOrders.deletedAt).not()
            )
          )
          .then((r) => Number(r[0]?.count || 0))
          .catch(() => 0),
      });
    }

    if (policy.inboundRecordsMonths > 0) {
      const cutoff = getCutoffDate(policy.inboundRecordsMonths);
      queries.push({
        name: "입고 기록",
        promise: db
          .select({ count: sql<number>`count(*)` })
          .from(inboundRecords)
          .where(
            and(
              eq(inboundRecords.organizationId, orgId),
              lt(inboundRecords.createdAt, cutoff)
            )
          )
          .then((r) => Number(r[0]?.count || 0))
          .catch(() => 0),
      });
    }

    if (policy.inventoryHistoryMonths > 0) {
      const cutoff = getCutoffDate(policy.inventoryHistoryMonths);
      queries.push({
        name: "재고 변동 이력",
        promise: db
          .select({ count: sql<number>`count(*)` })
          .from(inventoryHistory)
          .where(
            and(
              eq(inventoryHistory.organizationId, orgId),
              lt(inventoryHistory.createdAt, cutoff)
            )
          )
          .then((r) => Number(r[0]?.count || 0))
          .catch(() => 0),
      });
    }

    if (policy.salesRecordsMonths > 0) {
      const cutoff = getCutoffDate(policy.salesRecordsMonths);
      queries.push({
        name: "판매 기록",
        promise: db
          .select({ count: sql<number>`count(*)` })
          .from(salesRecords)
          .where(
            and(
              eq(salesRecords.organizationId, orgId),
              lt(salesRecords.date, cutoff)
            )
          )
          .then((r) => Number(r[0]?.count || 0))
          .catch(() => 0),
      });
    }

    if (policy.alertsMonths > 0) {
      const cutoff = getCutoffDate(policy.alertsMonths);
      queries.push({
        name: "읽은 알림",
        promise: db
          .select({ count: sql<number>`count(*)` })
          .from(alerts)
          .where(
            and(
              eq(alerts.organizationId, orgId),
              lt(alerts.createdAt, cutoff),
              eq(alerts.isRead, true)
            )
          )
          .then((r) => Number(r[0]?.count || 0))
          .catch(() => 0),
      });
    }

    if (policy.activityLogMonths > 0) {
      const cutoff = getCutoffDate(policy.activityLogMonths);
      queries.push({
        name: "활동 로그",
        promise: db
          .select({ count: sql<number>`count(*)` })
          .from(activityLogs)
          .where(
            and(
              eq(activityLogs.organizationId, orgId),
              lt(activityLogs.createdAt, cutoff)
            )
          )
          .then((r) => Number(r[0]?.count || 0))
          .catch(() => 0),
      });
    }

    if (policy.demandForecastsMonths > 0) {
      const cutoff = getCutoffDate(policy.demandForecastsMonths);
      queries.push({
        name: "수요 예측",
        promise: db
          .select({ count: sql<number>`count(*)` })
          .from(demandForecasts)
          .where(
            and(
              eq(demandForecasts.organizationId, orgId),
              lt(demandForecasts.createdAt, cutoff)
            )
          )
          .then((r) => Number(r[0]?.count || 0))
          .catch(() => 0),
      });
    }

    const results = await Promise.all(queries.map((q) => q.promise));
    queries.forEach((q, i) => {
      counts[q.name] = results[i];
    });

    return { success: true, counts };
  } catch (error) {
    console.error("정리 미리보기 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "미리보기 실패",
    };
  }
}

/**
 * 데이터 정리 실행 (admin 전용)
 * 보관 정책에 따라 기간 만료 데이터를 실제 삭제
 */
export async function executeDataCleanup(): Promise<{
  success: boolean;
  deletedCounts?: Record<string, number>;
  error?: string;
}> {
  try {
    const user = await requireAdmin();
    const orgId = user.organizationId;

    const [org] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    const settings = org?.settings as OrganizationSettings | null;
    const policy = settings?.retentionPolicy || DEFAULT_RETENTION_POLICY;

    const deletedCounts: Record<string, number> = {};

    // 순차 삭제 (FK 의존성 고려)
    // 1. 입고 기록 (발주서 참조)
    if (policy.inboundRecordsMonths > 0) {
      const cutoff = getCutoffDate(policy.inboundRecordsMonths);
      const result = await db
        .delete(inboundRecords)
        .where(
          and(
            eq(inboundRecords.organizationId, orgId),
            lt(inboundRecords.createdAt, cutoff)
          )
        );
      deletedCounts["입고 기록"] = Number(result.rowCount ?? 0);
    }

    // 2. 재고 변동 이력
    if (policy.inventoryHistoryMonths > 0) {
      const cutoff = getCutoffDate(policy.inventoryHistoryMonths);
      const result = await db
        .delete(inventoryHistory)
        .where(
          and(
            eq(inventoryHistory.organizationId, orgId),
            lt(inventoryHistory.createdAt, cutoff)
          )
        );
      deletedCounts["재고 변동 이력"] = Number(result.rowCount ?? 0);
    }

    // 3. 판매 기록
    if (policy.salesRecordsMonths > 0) {
      const cutoff = getCutoffDate(policy.salesRecordsMonths);
      const result = await db
        .delete(salesRecords)
        .where(
          and(
            eq(salesRecords.organizationId, orgId),
            lt(salesRecords.date, cutoff)
          )
        );
      deletedCounts["판매 기록"] = Number(result.rowCount ?? 0);
    }

    // 4. 읽은 알림만 삭제 (안 읽은 알림은 유지)
    if (policy.alertsMonths > 0) {
      const cutoff = getCutoffDate(policy.alertsMonths);
      const result = await db
        .delete(alerts)
        .where(
          and(
            eq(alerts.organizationId, orgId),
            lt(alerts.createdAt, cutoff),
            eq(alerts.isRead, true)
          )
        );
      deletedCounts["읽은 알림"] = Number(result.rowCount ?? 0);
    }

    // 5. 수요 예측
    if (policy.demandForecastsMonths > 0) {
      const cutoff = getCutoffDate(policy.demandForecastsMonths);
      const result = await db
        .delete(demandForecasts)
        .where(
          and(
            eq(demandForecasts.organizationId, orgId),
            lt(demandForecasts.createdAt, cutoff)
          )
        );
      deletedCounts["수요 예측"] = Number(result.rowCount ?? 0);
    }

    // 6. 취소/완료 발주서 (soft delete 처리: deletedAt 설정)
    if (policy.purchaseOrdersMonths > 0) {
      const cutoff = getCutoffDate(policy.purchaseOrdersMonths);
      const result = await db
        .update(purchaseOrders)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            lt(purchaseOrders.createdAt, cutoff),
            sql`${purchaseOrders.status} IN ('cancelled', 'completed', 'received')`,
            sql`${purchaseOrders.deletedAt} IS NULL`
          )
        );
      deletedCounts["발주서 (취소/완료)"] = Number(result.rowCount ?? 0);
    }

    // 7. 활동 로그
    if (policy.activityLogMonths > 0) {
      const cutoff = getCutoffDate(policy.activityLogMonths);
      const result = await db
        .delete(activityLogs)
        .where(
          and(
            eq(activityLogs.organizationId, orgId),
            lt(activityLogs.createdAt, cutoff)
          )
        );
      deletedCounts["활동 로그"] = Number(result.rowCount ?? 0);
    }

    // 활동 로그 기록
    logActivity({
      user,
      action: "DELETE",
      entityType: "organization_settings",
      entityId: orgId,
      description: "데이터 정리 실행",
      metadata: { deletedCounts, policy },
    }).catch(() => {});

    // 캐시 무효화
    revalidateTag(`inventory-${orgId}`);
    revalidateTag(`kpi-${orgId}`);
    revalidateTag(`analytics-${orgId}`);
    revalidatePath("/dashboard", "layout");

    return { success: true, deletedCounts };
  } catch (error) {
    console.error("데이터 정리 실행 실패:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "정리 실행 실패",
    };
  }
}
