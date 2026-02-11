import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { SubscriptionPlan } from "@/types/subscription";

const checkoutSchema = z.object({
  organizationId: z.string().uuid(),
  plan: z.enum(["free", "starter", "pro", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  paymentMethod: z.enum(["card", "tosspay", "kakaopay", "naverpay"]),
});

/**
 * POST /api/payment/checkout
 * 결제 체크아웃 요청
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = checkoutSchema.parse(body);

    const { organizationId, plan, billingCycle, paymentMethod } = validated;

    // 무료 플랜은 결제 불필요
    if (plan === "free") {
      return NextResponse.json(
        { error: "무료 플랜은 결제가 필요하지 않습니다" },
        { status: 400 },
      );
    }

    // 엔터프라이즈는 별도 문의
    if (plan === "enterprise") {
      return NextResponse.json(
        { error: "엔터프라이즈 플랜은 영업팀에 문의해주세요" },
        { status: 400 },
      );
    }

    // 금액 계산
    const prices: Record<
      SubscriptionPlan,
      { monthly: number; yearly: number }
    > = {
      free: { monthly: 0, yearly: 0 },
      starter: { monthly: 29000, yearly: 290000 },
      pro: { monthly: 79000, yearly: 790000 },
      enterprise: { monthly: 0, yearly: 0 },
    };

    const amount = billingCycle === "yearly" ? prices[plan].yearly : prices[plan].monthly;

    // 결제 정보 반환 (프론트엔드에서 PortOne 호출)
    return NextResponse.json({
      organizationId,
      plan,
      billingCycle,
      paymentMethod,
      amount,
      paymentId: `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 올바르지 않습니다", details: error.issues },
        { status: 400 },
      );
    }
    console.error("[Payment] 체크아웃 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 },
    );
  }
}
