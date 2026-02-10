"use server";

import { db } from "@/server/db";
import { activityLogs } from "@/server/db/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "./auth-helpers";
import type { ActivityLog } from "@/server/db/schema";

export type { ActivityLog };

/**
 * 활동 로그 조회 (필터 + 페이지네이션)
 */
export async function getActivityLogs(options?: {
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: ActivityLog[]; total: number }> {
  const user = await requireAuth();
  const {
    action,
    entityType,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options || {};

  const conditions = [eq(activityLogs.organizationId, user.organizationId)];

  if (action) {
    conditions.push(eq(activityLogs.action, action));
  }
  if (entityType) {
    conditions.push(eq(activityLogs.entityType, entityType));
  }
  if (startDate) {
    conditions.push(gte(activityLogs.createdAt, new Date(startDate)));
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    conditions.push(lte(activityLogs.createdAt, end));
  }

  const [logs, countResult] = await Promise.all([
    db
      .select()
      .from(activityLogs)
      .where(and(...conditions))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(activityLogs)
      .where(and(...conditions)),
  ]);

  return {
    logs,
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 특정 엔티티의 변경 이력 조회
 */
export async function getEntityActivityLogs(
  entityId: string,
  limit: number = 20
): Promise<ActivityLog[]> {
  const user = await requireAuth();

  return db
    .select()
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.organizationId, user.organizationId),
        eq(activityLogs.entityId, entityId)
      )
    )
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

/**
 * 대시보드용 최근 활동 조회
 */
export async function getRecentActivities(
  limit: number = 10
): Promise<ActivityLog[]> {
  const user = await requireAuth();

  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.organizationId, user.organizationId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}
