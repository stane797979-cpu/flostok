/**
 * 결제 요청 API
 *
 * POST /api/payment/request
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlanInfo } from "@/server/services/subscription";

const requestSchema = z.object({
  organizationId: z.string().uuid(),
  plan: z.enum(["starter", "pro", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  customer: z.object({
    fullName: z.string(),
    email: z.string().email(),
    phoneNumber: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = requestSchema.parse(body);

    // 플랜 정보 가져오기
    const planInfo = getPlanInfo(validated.plan);

    if (planInfo.price === 0) {
      return NextResponse.json(
        { error: "무료 플랜은 결제가 필요하지 않습니다" },
        { status: 400 }
      );
    }

    // 결제 금액 계산 (연간 결제 시 10% 할인)
    const basePrice: number = planInfo.price;
    let totalAmount: number = basePrice;
    if (validated.billingCycle === "yearly") {
      totalAmount = Math.floor(basePrice * 12 * 0.9);
    }

    // 결제 ID 생성 (merchant_uid)
    const paymentId = `order_${validated.organizationId}_${Date.now()}`;

    // 주문명 생성
    const orderName = `${planInfo.name} 플랜 구독 (${validated.billingCycle === "monthly" ? "월간" : "연간"})`;

    // 결제 요청 정보 반환 (클라이언트에서 PortOne SDK 호출)
    return NextResponse.json({
      paymentId,
      orderName,
      totalAmount,
      customer: validated.customer,
      plan: validated.plan,
      billingCycle: validated.billingCycle,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 올바르지 않습니다", details: error.issues },
        { status: 400 }
      );
    }

    console.error("[Payment Request] 오류:", error);
    return NextResponse.json(
      { error: "결제 요청 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
