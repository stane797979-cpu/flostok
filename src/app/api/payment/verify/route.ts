import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { subscriptions, paymentHistory, organizations, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

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
    // 인증 확인
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 },
      );
    }

    // DB에서 사용자의 organizationId 조회
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authId, user.id),
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "사용자 정보를 찾을 수 없습니다" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validated = verifySchema.parse(body);

    const { paymentId, organizationId, plan, billingCycle, amount, method } =
      validated;

    // 요청된 organizationId가 인증된 사용자의 조직과 일치하는지 검증
    if (organizationId !== dbUser.organizationId) {
      return NextResponse.json(
        { error: "해당 조직에 대한 권한이 없습니다" },
        { status: 403 },
      );
    }

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
