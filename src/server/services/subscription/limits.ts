/**
 * 구독 플랜별 제한 확인 서비스
 *
 * - 제품 등록 제한
 * - 발주 건수 제한
 * - 사용자 수 제한
 * - 기능 접근 제한
 */

import { db } from "@/server/db";
import { products, purchaseOrders, users } from "@/server/db/schema";
import { eq, and, gte } from "drizzle-orm";
import {
  getActiveSubscription,
  getPlanInfo,
  SUBSCRIPTION_PLANS,
} from "./index";

/**
 * 제품 등록 제한 확인
 *
 * @param organizationId - 조직 ID
 * @returns 제한 확인 결과
 */
export async function checkProductLimit(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
}> {
  const subscription = await getActiveSubscription(organizationId);
  const plan = subscription
    ? getPlanInfo(subscription.plan)
    : SUBSCRIPTION_PLANS.FREE;

  const currentCount = await db
    .select({ count: products.id })
    .from(products)
    .where(eq(products.organizationId, organizationId))
    .then((rows) => rows.length);

  return {
    allowed: currentCount < plan.features.maxProducts,
    current: currentCount,
    limit: plan.features.maxProducts,
    plan: plan.name,
  };
}

/**
 * 발주 건수 제한 확인 (월간)
 *
 * @param organizationId - 조직 ID
 * @returns 제한 확인 결과
 */
export async function checkOrderLimit(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
}> {
  const subscription = await getActiveSubscription(organizationId);
  const plan = subscription
    ? getPlanInfo(subscription.plan)
    : SUBSCRIPTION_PLANS.FREE;

  // 이번 달 시작일
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const currentCount = await db
    .select({ count: purchaseOrders.id })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.organizationId, organizationId),
        gte(purchaseOrders.createdAt, monthStart)
      )
    )
    .then((rows) => rows.length);

  return {
    allowed:
      plan.features.maxOrders === Infinity ||
      currentCount < plan.features.maxOrders,
    current: currentCount,
    limit: plan.features.maxOrders,
    plan: plan.name,
  };
}

/**
 * 사용자 수 제한 확인
 *
 * @param organizationId - 조직 ID
 * @returns 제한 확인 결과
 */
export async function checkUserLimit(organizationId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
}> {
  const subscription = await getActiveSubscription(organizationId);
  const plan = subscription
    ? getPlanInfo(subscription.plan)
    : SUBSCRIPTION_PLANS.FREE;

  const currentCount = await db
    .select({ count: users.id })
    .from(users)
    .where(eq(users.organizationId, organizationId))
    .then((rows) => rows.length);

  return {
    allowed:
      plan.features.maxUsers === Infinity || currentCount < plan.features.maxUsers,
    current: currentCount,
    limit: plan.features.maxUsers,
    plan: plan.name,
  };
}

/**
 * 기능 접근 제한 확인
 *
 * @param organizationId - 조직 ID
 * @param feature - 기능명 ('aiChat' | 'advancedAnalytics' | 'apiAccess')
 * @returns 접근 가능 여부
 */
export async function checkFeatureAccess(
  organizationId: string,
  feature: "aiChat" | "advancedAnalytics" | "apiAccess"
): Promise<{
  allowed: boolean;
  plan: string;
  requiredPlan: string;
}> {
  const subscription = await getActiveSubscription(organizationId);
  const plan = subscription
    ? getPlanInfo(subscription.plan)
    : SUBSCRIPTION_PLANS.FREE;

  let featureEnabled = false;
  let requiredPlan = "";

  if (feature === "aiChat") {
    featureEnabled = plan.features.aiChatEnabled;
    requiredPlan = "스타터";
  } else if (feature === "advancedAnalytics") {
    featureEnabled = plan.features.advancedAnalytics;
    requiredPlan = "프로";
  } else if (feature === "apiAccess") {
    featureEnabled = plan.features.apiAccess;
    requiredPlan = "프로";
  }

  return {
    allowed: featureEnabled,
    plan: plan.name,
    requiredPlan,
  };
}

/**
 * 전체 제한 확인 (대시보드용)
 *
 * @param organizationId - 조직 ID
 * @returns 모든 제한 확인 결과
 */
export async function checkAllLimits(organizationId: string) {
  const [productLimit, orderLimit, userLimit] = await Promise.all([
    checkProductLimit(organizationId),
    checkOrderLimit(organizationId),
    checkUserLimit(organizationId),
  ]);

  const subscription = await getActiveSubscription(organizationId);
  const plan = subscription
    ? getPlanInfo(subscription.plan)
    : SUBSCRIPTION_PLANS.FREE;

  return {
    plan: plan.name,
    subscription,
    limits: {
      products: productLimit,
      orders: orderLimit,
      users: userLimit,
    },
    features: {
      aiChatEnabled: plan.features.aiChatEnabled,
      advancedAnalytics: plan.features.advancedAnalytics,
      apiAccess: plan.features.apiAccess,
    },
  };
}

/**
 * 제한 초과 에러 생성 헬퍼
 *
 * @param limitType - 제한 유형
 * @param limit - 제한 정보
 * @returns Error 객체
 */
export function createLimitError(
  limitType: "product" | "order" | "user",
  limit: { current: number; limit: number; plan: string }
) {
  const messages = {
    product: `제품 등록 한도를 초과했습니다. 현재 플랜(${limit.plan})에서는 최대 ${limit.limit}개의 제품을 등록할 수 있습니다. (현재: ${limit.current}개)`,
    order: `월간 발주 한도를 초과했습니다. 현재 플랜(${limit.plan})에서는 월 ${limit.limit}건의 발주를 생성할 수 있습니다. (현재: ${limit.current}건)`,
    user: `사용자 한도를 초과했습니다. 현재 플랜(${limit.plan})에서는 최대 ${limit.limit}명의 사용자를 추가할 수 있습니다. (현재: ${limit.current}명)`,
  };

  return new Error(messages[limitType]);
}
