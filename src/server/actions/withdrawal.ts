'use server'

/**
 * 회원 탈퇴 및 환불 Server Actions
 *
 * 이용약관 제13조 (계약 해지) 및 제7조 (환불 정책) 기반:
 * - 회원은 언제든지 탈퇴 가능
 * - 탈퇴 시 유료 구독이 있으면 환불 정책에 따라 처리
 * - 탈퇴 후 90일간 데이터 보관, 이후 삭제
 * - 탈퇴 후 30일 이내 데이터 내보내기 요청 가능
 */

import { db } from '@/server/db'
import { users, organizations, subscriptions, paymentHistory } from '@/server/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { requireAuth } from './auth-helpers'
import { cancelPayment, savePaymentHistory } from '@/server/services/payment/portone'

type ActionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

/** 탈퇴 사유 목록 */
export const WITHDRAWAL_REASONS = [
  '서비스를 더 이상 사용하지 않음',
  '다른 서비스로 전환',
  '비용이 부담됨',
  '기능이 부족함',
  '사용하기 어려움',
  '기타',
] as const

export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number]

/** 탈퇴 전 사전 확인 정보 */
export interface WithdrawalPreCheck {
  hasActiveSubscription: boolean
  subscription: {
    plan: string
    status: string
    billingCycle: string
    currentPeriodEnd: Date
  } | null
  refundInfo: {
    eligible: boolean
    estimatedAmount: number
    usedDays: number
    totalDays: number
    refundRate: number
  } | null
  organizationUserCount: number
  isLastAdmin: boolean
}

/**
 * 환불 금액 계산
 *
 * 이용약관 제7조 환불 정책:
 * - 월간: 사용 7일 이내 100%, 이후 미사용 일수 비례 환불
 * - 연간: 사용 30일 이내 100%, 이후 미사용 월수 비례 환불
 */
function calculateRefundAmount(
  subscription: {
    plan: string
    billingCycle: string
    currentPeriodStart: Date
    currentPeriodEnd: Date
  },
  lastPaymentAmount: number
): {
  eligible: boolean
  estimatedAmount: number
  usedDays: number
  totalDays: number
  refundRate: number
} {
  const now = new Date()
  const start = new Date(subscription.currentPeriodStart)
  const end = new Date(subscription.currentPeriodEnd)

  const totalMs = end.getTime() - start.getTime()
  const usedMs = now.getTime() - start.getTime()
  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24))
  const usedDays = Math.ceil(usedMs / (1000 * 60 * 60 * 24))

  if (subscription.plan === 'free') {
    return { eligible: false, estimatedAmount: 0, usedDays, totalDays, refundRate: 0 }
  }

  if (lastPaymentAmount <= 0) {
    return { eligible: false, estimatedAmount: 0, usedDays, totalDays, refundRate: 0 }
  }

  let refundRate: number

  if (subscription.billingCycle === 'monthly') {
    if (usedDays <= 7) {
      refundRate = 1.0 // 100% 환불
    } else {
      const remainingDays = Math.max(totalDays - usedDays, 0)
      refundRate = remainingDays / totalDays
    }
  } else {
    // yearly
    if (usedDays <= 30) {
      refundRate = 1.0 // 100% 환불
    } else {
      const usedMonths = Math.ceil(usedDays / 30)
      const totalMonths = 12
      const remainingMonths = Math.max(totalMonths - usedMonths, 0)
      refundRate = remainingMonths / totalMonths
    }
  }

  const estimatedAmount = Math.floor(lastPaymentAmount * refundRate)

  return {
    eligible: estimatedAmount > 0,
    estimatedAmount,
    usedDays,
    totalDays,
    refundRate,
  }
}

/**
 * 탈퇴 전 사전 확인 — 현재 구독, 환불 예상액, 조직 상태 등 확인
 */
export async function getWithdrawalPreCheck(): Promise<ActionResponse<WithdrawalPreCheck>> {
  try {
    const user = await requireAuth()

    // 1. 활성 구독 조회
    const [activeSubscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, user.organizationId),
          eq(subscriptions.status, 'active')
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    // 2. 환불 정보 계산
    let refundInfo: WithdrawalPreCheck['refundInfo'] = null
    if (activeSubscription && activeSubscription.plan !== 'free') {
      // 최근 성공한 결제 조회
      const [lastPayment] = await db
        .select()
        .from(paymentHistory)
        .where(
          and(
            eq(paymentHistory.organizationId, user.organizationId),
            eq(paymentHistory.status, 'success')
          )
        )
        .orderBy(desc(paymentHistory.createdAt))
        .limit(1)

      const paymentAmount = lastPayment?.amount ?? 0
      refundInfo = calculateRefundAmount(activeSubscription, paymentAmount)
    }

    // 3. 조직 내 사용자 수 확인
    const orgUsers = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, user.organizationId))

    const adminCount = orgUsers.filter((u) => u.role === 'admin' && !u.deletedAt).length
    const isLastAdmin = user.role === 'admin' && adminCount <= 1

    return {
      success: true,
      data: {
        hasActiveSubscription: !!activeSubscription && activeSubscription.plan !== 'free',
        subscription: activeSubscription
          ? {
              plan: activeSubscription.plan,
              status: activeSubscription.status,
              billingCycle: activeSubscription.billingCycle,
              currentPeriodEnd: activeSubscription.currentPeriodEnd,
            }
          : null,
        refundInfo,
        organizationUserCount: orgUsers.filter((u) => !u.deletedAt).length,
        isLastAdmin,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '탈퇴 사전 확인에 실패했습니다',
    }
  }
}

/**
 * 회원 탈퇴 실행
 *
 * 처리 절차:
 * 1. 유료 구독 확인 → 즉시 취소 + 환불 처리
 * 2. users 테이블에 deletedAt, withdrawalReason 설정 (소프트 삭제)
 * 3. Supabase Auth 계정 비활성화 (실제 삭제는 90일 후)
 * 4. 마지막 관리자인 경우 → 조직 전체 비활성화
 */
export async function withdrawAccountAction(params: {
  reason: string
  customReason?: string
  requestRefund: boolean
}): Promise<ActionResponse<{ refundedAmount: number }>> {
  try {
    const user = await requireAuth()
    const now = new Date()

    // 1. 유료 구독이 있으면 취소 + 환불 처리
    let refundedAmount = 0

    const [activeSubscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, user.organizationId),
          eq(subscriptions.status, 'active')
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    if (activeSubscription && activeSubscription.plan !== 'free') {
      // 구독 즉시 취소
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: now,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, activeSubscription.id))

      // 환불 요청 시 처리
      if (params.requestRefund) {
        const [lastPayment] = await db
          .select()
          .from(paymentHistory)
          .where(
            and(
              eq(paymentHistory.organizationId, user.organizationId),
              eq(paymentHistory.status, 'success')
            )
          )
          .orderBy(desc(paymentHistory.createdAt))
          .limit(1)

        if (lastPayment && lastPayment.transactionId) {
          const refundCalc = calculateRefundAmount(activeSubscription, lastPayment.amount)

          if (refundCalc.eligible && refundCalc.estimatedAmount > 0) {
            try {
              const cancelResult = await cancelPayment(
                lastPayment.transactionId,
                `회원 탈퇴에 따른 환불 (사유: ${params.reason})`
              )

              if (cancelResult.success) {
                refundedAmount = cancelResult.cancelledAmount

                // 환불 내역 기록
                await savePaymentHistory({
                  organizationId: user.organizationId,
                  subscriptionId: activeSubscription.id,
                  amount: -refundedAmount,
                  method: 'card',
                  status: 'refunded',
                  transactionId: lastPayment.transactionId,
                })
              }
            } catch (refundError) {
              console.error('[Withdrawal] 환불 처리 실패:', refundError)
              // 환불 실패해도 탈퇴는 계속 진행 (고객센터에서 수동 처리)
            }
          }
        }
      }
    }

    // 2. 사용자 소프트 삭제
    const withdrawalReason =
      params.reason === '기타' && params.customReason
        ? `기타: ${params.customReason}`
        : params.reason

    await db
      .update(users)
      .set({
        deletedAt: now,
        withdrawalReason,
        updatedAt: now,
      })
      .where(eq(users.id, user.id))

    // 3. 마지막 관리자이고 조직에 다른 활성 사용자가 없으면 조직도 비활성화
    const remainingActiveUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.organizationId, user.organizationId),
        )
      )

    const hasActiveMembers = remainingActiveUsers.some(
      (u) => u.id !== user.id && !u.deletedAt
    )

    if (!hasActiveMembers) {
      // 조직의 플랜을 free로 변경 (데이터는 90일간 보관)
      await db
        .update(organizations)
        .set({
          plan: 'free',
          updatedAt: now,
        })
        .where(eq(organizations.id, user.organizationId))
    }

    return {
      success: true,
      data: { refundedAmount },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '회원 탈퇴 처리에 실패했습니다',
    }
  }
}

/**
 * 구독 취소 (탈퇴 없이 구독만 취소)
 */
export async function cancelSubscriptionAction(params: {
  immediate: boolean
  reason?: string
}): Promise<ActionResponse<{ refundedAmount: number }>> {
  try {
    const user = await requireAuth()
    const now = new Date()

    const [activeSubscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, user.organizationId),
          eq(subscriptions.status, 'active')
        )
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    if (!activeSubscription) {
      return { success: false, error: '활성 구독이 없습니다' }
    }

    if (activeSubscription.plan === 'free') {
      return { success: false, error: '무료 플랜은 취소할 필요가 없습니다' }
    }

    let refundedAmount = 0

    if (params.immediate) {
      // 즉시 취소 + 환불
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: now,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, activeSubscription.id))

      // 환불 처리
      const [lastPayment] = await db
        .select()
        .from(paymentHistory)
        .where(
          and(
            eq(paymentHistory.organizationId, user.organizationId),
            eq(paymentHistory.status, 'success')
          )
        )
        .orderBy(desc(paymentHistory.createdAt))
        .limit(1)

      if (lastPayment?.transactionId) {
        const refundCalc = calculateRefundAmount(activeSubscription, lastPayment.amount)

        if (refundCalc.eligible && refundCalc.estimatedAmount > 0) {
          try {
            const cancelResult = await cancelPayment(
              lastPayment.transactionId,
              params.reason || '구독 취소에 따른 환불'
            )

            if (cancelResult.success) {
              refundedAmount = cancelResult.cancelledAmount

              await savePaymentHistory({
                organizationId: user.organizationId,
                subscriptionId: activeSubscription.id,
                amount: -refundedAmount,
                method: 'card',
                status: 'refunded',
                transactionId: lastPayment.transactionId,
              })
            }
          } catch (refundError) {
            console.error('[CancelSubscription] 환불 처리 실패:', refundError)
          }
        }
      }

      // 조직 플랜을 free로 변경
      await db
        .update(organizations)
        .set({ plan: 'free', updatedAt: now })
        .where(eq(organizations.id, user.organizationId))
    } else {
      // 기간 종료 시 취소 (현재 기간까지 사용 가능)
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, activeSubscription.id))
    }

    return {
      success: true,
      data: { refundedAmount },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '구독 취소에 실패했습니다',
    }
  }
}

/**
 * 현재 구독 정보 조회
 */
export async function getSubscriptionInfo(): Promise<
  ActionResponse<{
    subscription: {
      id: string
      plan: string
      status: string
      billingCycle: string
      currentPeriodStart: Date
      currentPeriodEnd: Date
      cancelAtPeriodEnd: boolean
    } | null
    refundInfo: WithdrawalPreCheck['refundInfo']
  }>
> {
  try {
    const user = await requireAuth()

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, user.organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    let refundInfo: WithdrawalPreCheck['refundInfo'] = null

    if (sub && sub.plan !== 'free' && sub.status === 'active') {
      const [lastPayment] = await db
        .select()
        .from(paymentHistory)
        .where(
          and(
            eq(paymentHistory.organizationId, user.organizationId),
            eq(paymentHistory.status, 'success')
          )
        )
        .orderBy(desc(paymentHistory.createdAt))
        .limit(1)

      if (lastPayment) {
        refundInfo = calculateRefundAmount(sub, lastPayment.amount)
      }
    }

    return {
      success: true,
      data: {
        subscription: sub
          ? {
              id: sub.id,
              plan: sub.plan,
              status: sub.status,
              billingCycle: sub.billingCycle,
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }
          : null,
        refundInfo,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '구독 정보 조회에 실패했습니다',
    }
  }
}
