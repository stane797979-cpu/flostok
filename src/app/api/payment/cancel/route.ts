import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { subscriptions, organizations, paymentHistory } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { cancelPayment, savePaymentHistory } from "@/server/services/payment/portone";

const cancelSchema = z.object({
  subscriptionId: z.string().uuid(),
  immediate: z.boolean().optional(), // true: 즉시 취소 + 환불, false: 기간 종료 시 취소
  reason: z.string().optional(),
});

/**
 * 환불 금액 계산 (이용약관 제7조 기반)
 *
 * - 월간: 사용 7일 이내 100%, 이후 미사용 일수 비례
 * - 연간: 사용 30일 이내 100%, 이후 미사용 월수 비례
 */
function calculateRefundAmount(
  subscription: {
    billingCycle: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  },
  paidAmount: number
): number {
  const now = new Date();
  const start = new Date(subscription.currentPeriodStart);
  const end = new Date(subscription.currentPeriodEnd);

  const totalMs = end.getTime() - start.getTime();
  const usedMs = now.getTime() - start.getTime();
  const totalDays = Math.ceil(totalMs / (1000 * 60 * 60 * 24));
  const usedDays = Math.ceil(usedMs / (1000 * 60 * 60 * 24));

  if (paidAmount <= 0) return 0;

  let refundRate: number;

  if (subscription.billingCycle === "monthly") {
    if (usedDays <= 7) {
      refundRate = 1.0;
    } else {
      const remainingDays = Math.max(totalDays - usedDays, 0);
      refundRate = remainingDays / totalDays;
    }
  } else {
    // yearly
    if (usedDays <= 30) {
      refundRate = 1.0;
    } else {
      const usedMonths = Math.ceil(usedDays / 30);
      const remainingMonths = Math.max(12 - usedMonths, 0);
      refundRate = remainingMonths / 12;
    }
  }

  return Math.floor(paidAmount * refundRate);
}

/**
 * POST /api/payment/cancel
 * 구독 취소 (환불 포함)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = cancelSchema.parse(body);

    const { subscriptionId, immediate = false, reason } = validated;

    // 구독 조회
    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, subscriptionId),
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "구독을 찾을 수 없습니다" },
        { status: 404 },
      );
    }

    const now = new Date();

    if (immediate) {
      // 즉시 취소 + 환불 처리
      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: now,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscriptionId));

      // 환불 처리: 최근 결제 내역 조회 후 PortOne 환불 API 호출
      let refundedAmount = 0;

      if (subscription.plan !== "free") {
        const [lastPayment] = await db
          .select()
          .from(paymentHistory)
          .where(
            and(
              eq(paymentHistory.organizationId, subscription.organizationId),
              eq(paymentHistory.status, "success")
            )
          )
          .orderBy(desc(paymentHistory.createdAt))
          .limit(1);

        if (lastPayment?.transactionId) {
          const estimatedRefund = calculateRefundAmount(subscription, lastPayment.amount);

          if (estimatedRefund > 0) {
            try {
              const cancelResult = await cancelPayment(
                lastPayment.transactionId,
                reason || "구독 즉시 취소에 따른 환불"
              );

              if (cancelResult.success) {
                refundedAmount = cancelResult.cancelledAmount;

                await savePaymentHistory({
                  organizationId: subscription.organizationId,
                  subscriptionId: subscription.id,
                  amount: -refundedAmount,
                  method: "card",
                  status: "refunded",
                  transactionId: lastPayment.transactionId,
                });
              }
            } catch (refundError) {
              console.error("[Payment] 환불 처리 실패:", refundError);
              // 환불 실패 시에도 구독은 이미 취소됨 — 고객센터에서 수동 처리
            }
          }
        }

        // 조직 플랜을 free로 변경
        await db
          .update(organizations)
          .set({ plan: "free", updatedAt: now })
          .where(eq(organizations.id, subscription.organizationId));
      }

      return NextResponse.json({
        success: true,
        subscriptionId,
        canceledAt: now.toISOString(),
        immediate: true,
        refundedAmount,
      });
    } else {
      // 기간 종료 시 취소 (현재 기간까지 사용 가능)
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscriptionId));

      return NextResponse.json({
        success: true,
        subscriptionId,
        canceledAt: now.toISOString(),
        immediate: false,
        cancelAtPeriodEnd: new Date(subscription.currentPeriodEnd).toISOString(),
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 올바르지 않습니다", details: error.issues },
        { status: 400 },
      );
    }
    console.error("[Payment] 취소 오류:", error);
    return NextResponse.json(
      { error: "구독 취소에 실패했습니다" },
      { status: 500 },
    );
  }
}
