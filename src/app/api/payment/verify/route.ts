import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { subscriptions, paymentHistory, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const verifySchema = z.object({
  paymentId: z.string(),
  organizationId: z.string().uuid(),
  plan: z.enum(["starter", "pro"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  amount: z.number(),
  method: z.enum(["card", "tosspay", "kakaopay", "naverpay"]),
});

/**
 * POST /api/payment/verify
 * 결제 검증 및 구독 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = verifySchema.parse(body);

    const { paymentId, organizationId, plan, billingCycle, amount, method } =
      validated;

    // Mock 모드: 간단 검증
    const isMockMode = process.env.NEXT_PUBLIC_PAYMENT_MOCK === "true";

    if (isMockMode) {
      // Mock 결제는 항상 성공으로 처리
      console.log("[Mock] 결제 검증:", validated);
    } else {
      // 실제 환경: PortOne API로 결제 검증
      const portoneApiSecret = process.env.PORTONE_API_SECRET;

      if (!portoneApiSecret) {
        throw new Error("PORTONE_API_SECRET 환경변수가 설정되지 않았습니다");
      }

      const response = await fetch(
        `https://api.portone.io/payments/${paymentId}`,
        {
          headers: {
            Authorization: `PortOne ${portoneApiSecret}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("결제 검증에 실패했습니다");
      }

      const paymentData = await response.json();

      // 결제 상태 확인
      if (paymentData.status !== "PAID") {
        throw new Error("결제가 완료되지 않았습니다");
      }

      // 금액 확인
      if (paymentData.amount.total !== amount) {
        throw new Error("결제 금액이 일치하지 않습니다");
      }
    }

    // 구독 기간 계산
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "yearly") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // 기존 구독 확인
    const existingSubscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, organizationId),
    });

    let subscription;

    if (existingSubscription) {
      // 구독 업데이트
      [subscription] = await db
        .update(subscriptions)
        .set({
          plan,
          status: "active",
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existingSubscription.id))
        .returning();
    } else {
      // 신규 구독 생성
      [subscription] = await db
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
    }

    // 조직 플랜 업데이트
    await db
      .update(organizations)
      .set({ plan, updatedAt: now })
      .where(eq(organizations.id, organizationId));

    // 결제 내역 기록
    await db.insert(paymentHistory).values({
      organizationId,
      subscriptionId: subscription.id,
      amount,
      method,
      status: "success",
      transactionId: paymentId,
    });

    return NextResponse.json({
      verified: true,
      subscriptionId: subscription.id,
      plan,
      currentPeriodEnd: periodEnd.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 올바르지 않습니다", details: error.issues },
        { status: 400 },
      );
    }
    console.error("[Payment] 검증 오류:", error);
    return NextResponse.json(
      {
        verified: false,
        error: error instanceof Error ? error.message : "결제 검증에 실패했습니다",
      },
      { status: 500 },
    );
  }
}
