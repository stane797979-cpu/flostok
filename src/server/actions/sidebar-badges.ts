"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { inventory, purchaseOrders, alerts } from "@/server/db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/server/actions/auth-helpers";

/**
 * 사이드바 배지 데이터 조회 내부 로직 (캐싱 대상)
 * - 인증은 호출 측에서 이미 완료된 상태
 */
async function _getSidebarBadgesInternal(
  orgId: string
): Promise<Record<string, number>> {
  const [inventoryCount, orderCount, alertCount] = await Promise.all([
    // 발주 필요 품목 수 (품절 + 위험 + 부족)
    db
      .select({ count: sql<number>`count(*)` })
      .from(inventory)
      .where(
        and(
          eq(inventory.organizationId, orgId),
          sql`${inventory.status} IN ('out_of_stock', 'critical', 'shortage')`
        )
      )
      .then((r) => Number(r[0]?.count || 0))
      .catch(() => 0),

    // 진행중 발주 건수 (발주완료 + 승인됨, 삭제되지 않은 건)
    db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          sql`${purchaseOrders.status} IN ('ordered', 'approved')`,
          isNull(purchaseOrders.deletedAt)
        )
      )
      .then((r) => Number(r[0]?.count || 0))
      .catch(() => 0),

    // 읽지 않은 알림 수
    db
      .select({ count: sql<number>`count(*)` })
      .from(alerts)
      .where(and(eq(alerts.organizationId, orgId), eq(alerts.isRead, false)))
      .then((r) => Number(r[0]?.count || 0))
      .catch(() => 0),
  ]);

  const badges: Record<string, number> = {};
  if (inventoryCount > 0) badges["/dashboard/inventory"] = inventoryCount;
  if (orderCount > 0) badges["/dashboard/orders"] = orderCount;
  if (alertCount > 0) badges["/dashboard/alerts"] = alertCount;
  return badges;
}

/**
 * 사이드바 배지 데이터 조회
 * - /dashboard/inventory: 발주 필요 품목 수 (품절 + 위험 + 부족)
 * - /dashboard/orders: 진행 중인 발주 건수 (발주완료 + 승인됨)
 * - /dashboard/alerts: 읽지 않은 알림 수
 * unstable_cache로 30초간 캐싱 (인증은 캐시 밖에서 매번 검증)
 */
export async function getSidebarBadges(): Promise<Record<string, number>> {
  const user = await getCurrentUser();
  if (!user?.organizationId) return {};

  const orgId = user.organizationId;

  return unstable_cache(
    () => _getSidebarBadgesInternal(orgId),
    [`sidebar-badges-${orgId}`],
    { revalidate: 30, tags: [`sidebar-badges-${orgId}`] }
  )();
}
