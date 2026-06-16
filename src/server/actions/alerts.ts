"use server";

import { db } from "@/server/db";
import { alerts, products } from "@/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helpers";

export interface AlertListItem {
  id: string;
  type: string;
  severity: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  title: string;
  message: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * 알림 목록 조회
 */
export async function getAlerts(options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ alerts: AlertListItem[]; total: number; unreadCount: number }> {
  const user = await requireAuth();
  const { unreadOnly = false, limit = 50, offset = 0 } = options || {};

  const conditions = [eq(alerts.organizationId, user.organizationId)];
  if (unreadOnly) {
    conditions.push(eq(alerts.isRead, false));
  }

  const [rows, countResult, unreadResult] = await Promise.all([
    db
      .select({
        alert: alerts,
        product: {
          sku: products.sku,
          name: products.name,
        },
      })
      .from(alerts)
      .leftJoin(products, eq(alerts.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(alerts.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(and(...conditions)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(
        and(eq(alerts.organizationId, user.organizationId), eq(alerts.isRead, false))
      ),
  ]);

  return {
    alerts: rows.map((row) => ({
      id: row.alert.id,
      type: row.alert.type,
      severity: row.alert.severity,
      productId: row.alert.productId,
      productSku: row.product?.sku || null,
      productName: row.product?.name || null,
      title: row.alert.title,
      message: row.alert.message,
      actionUrl: row.alert.actionUrl,
      isRead: row.alert.isRead,
      createdAt: row.alert.createdAt,
    })),
    total: Number(countResult[0]?.count || 0),
    unreadCount: Number(unreadResult[0]?.count || 0),
  };
}

/**
 * 알림 읽음 처리
 */
export async function markAlertAsRead(alertId: string): Promise<{ success: boolean }> {
  const user = await requireAuth();

  await db
    .update(alerts)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(eq(alerts.id, alertId), eq(alerts.organizationId, user.organizationId))
    );

  revalidatePath("/dashboard/alerts");
  return { success: true };
}

/**
 * 전체 알림 읽음 처리
 */
export async function markAllAlertsAsRead(): Promise<{ success: boolean; count: number }> {
  const user = await requireAuth();

  const result = await db
    .update(alerts)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(alerts.organizationId, user.organizationId),
        eq(alerts.isRead, false)
      )
    )
    .returning({ id: alerts.id });

  revalidatePath("/dashboard/alerts");
  return { success: true, count: result.length };
}

/**
 * 알림 삭제
 */
export async function deleteAlert(alertId: string): Promise<{ success: boolean }> {
  const user = await requireAuth();

  await db
    .delete(alerts)
    .where(
      and(eq(alerts.id, alertId), eq(alerts.organizationId, user.organizationId))
    );

  revalidatePath("/dashboard/alerts");
  return { success: true };
}
