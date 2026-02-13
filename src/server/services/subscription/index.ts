/**
 * 구독 관리 서비스
 *
 * - 구독 생성/취소
 * - 구독 상태 조회
 * - 구독 갱신
 * - 플랜 변경
 */

import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { eq, and, sql, lte } from "drizzle-orm";

/**
 * 구독 플랜 정의
 */
export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: "free",
    name: "무료",
    price: 0,
    features: {
      maxProducts: Infinity,
      maxOrders: Infinity, // 무제한
      maxUsers: Infinity,
      aiChatEnabled: true,
      advancedAnalytics: true,
      apiAccess: true,
    },
  },
  STARTER: {
    id: "starter",
    name: "스타터",
    price: 29000,
    features: {
      maxProducts: 100,
      maxOrders: 50, // 월간
      maxUsers: 3,
      aiChatEnabled: true,
      advancedAnalytics: false,
      apiAccess: false,
    },
  },
  PRO: {
    id: "pro",
    name: "프로",
    price: 79000,
    features: {
      maxProducts: 500,
      maxOrders: Infinity, // 무제한
      maxUsers: 10,
      aiChatEnabled: true,
      advancedAnalytics: true,
      apiAccess: true,
    },
  },
  ENTERPRISE: {
    id: "enterprise",
    name: "엔터프라이즈",
    price: 0, // 커스텀 가격
    features: {
      maxProducts: Infinity,
      maxOrders: Infinity,
      maxUsers: Infinity,
      aiChatEnabled: true,
      advancedAnalytics: true,
      apiAccess: true,
    },
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

/**
 * 구독 생성
 *
 * @param organizationId - 조직 ID
 * @param plan - 구독 플랜
 * @param billingCycle - 결제 주기
 * @returns 생성된 구독 정보
 */
export async function createSubscription(
  organizationId: string,
  plan: SubscriptionPlanId,
  billingCycle: "monthly" | "yearly"
) {
  const now = new Date();
  const periodEnd = new Date(now);

  if (billingCycle === "monthly") {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  const [subscription] = await db
    .insert(subscriptions)
    .values({
      organizationId,
      plan,
      status: "active",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    })
    .returning();

  return subscription;
}

/**
 * 활성 구독 조회
 *
 * @param organizationId - 조직 ID
 * @returns 활성 구독 정보 (없으면 null)
 */
export async function getActiveSubscription(organizationId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.status, "active")
      )
    )
    .limit(1);

  return subscription || null;
}

/**
 * 구독 취소 (기간 종료 시 취소)
 *
 * @param subscriptionId - 구독 ID
 * @returns 업데이트된 구독 정보
 */
export async function cancelSubscription(subscriptionId: string) {
  const [subscription] = await db
    .update(subscriptions)
    .set({
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return subscription;
}

/**
 * 구독 즉시 취소 (환불 시)
 *
 * @param subscriptionId - 구독 ID
 * @returns 업데이트된 구독 정보
 */
export async function cancelSubscriptionImmediately(subscriptionId: string) {
  const [subscription] = await db
    .update(subscriptions)
    .set({
      status: "canceled",
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return subscription;
}

/**
 * 구독 갱신
 *
 * @param subscriptionId - 구독 ID
 * @returns 업데이트된 구독 정보
 */
export async function renewSubscription(subscriptionId: string) {
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!subscription) {
    throw new Error("구독을 찾을 수 없습니다");
  }

  const newPeriodStart = subscription.currentPeriodEnd;
  const newPeriodEnd = new Date(newPeriodStart);

  if (subscription.billingCycle === "monthly") {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  } else {
    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
  }

  const [renewed] = await db
    .update(subscriptions)
    .set({
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
      status: "active",
      cancelAtPeriodEnd: false,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return renewed;
}

/**
 * 플랜 변경
 *
 * @param subscriptionId - 구독 ID
 * @param newPlan - 새 플랜
 * @returns 업데이트된 구독 정보
 */
export async function changePlan(
  subscriptionId: string,
  newPlan: SubscriptionPlanId
) {
  const [subscription] = await db
    .update(subscriptions)
    .set({
      plan: newPlan,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();

  return subscription;
}

/**
 * 만료된 구독 처리 (배치 작업용)
 *
 * 현재 시각 기준으로 만료된 구독을 찾아 상태를 업데이트합니다.
 */
export async function processExpiredSubscriptions() {
  const now = new Date();

  // 만료 조건을 DB 쿼리에서 직접 필터링 + 배치 UPDATE
  const result = await db
    .update(subscriptions)
    .set({
      status: "expired",
      updatedAt: now,
    })
    .where(
      and(
        eq(subscriptions.status, "active"),
        eq(subscriptions.cancelAtPeriodEnd, true),
        lte(subscriptions.currentPeriodEnd, now)
      )
    )
    .returning({ id: subscriptions.id });

  return result.length;
}

/**
 * 플랜 정보 가져오기
 *
 * @param planId - 플랜 ID
 * @returns 플랜 정보
 */
export function getPlanInfo(planId: string) {
  const plan = SUBSCRIPTION_PLANS[planId.toUpperCase() as SubscriptionPlanId];
  if (!plan) {
    throw new Error(`유효하지 않은 플랜: ${planId}`);
  }
  return plan;
}

/**
 * 구독 상태 확인
 *
 * @param organizationId - 조직 ID
 * @returns 구독 상태 정보
 */
export async function checkSubscriptionStatus(organizationId: string) {
  const subscription = await getActiveSubscription(organizationId);

  if (!subscription) {
    return {
      isActive: false,
      plan: SUBSCRIPTION_PLANS.FREE,
      daysRemaining: 0,
    };
  }

  const now = new Date();
  const periodEnd = new Date(subscription.currentPeriodEnd);
  const daysRemaining = Math.ceil(
    (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    isActive: true,
    subscription,
    plan: getPlanInfo(subscription.plan),
    daysRemaining,
  };
}
