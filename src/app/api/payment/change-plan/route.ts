import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { subscriptions, organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const changePlanSchema = z.object({
  subscriptionId: z.string().uuid(),
  newPlan: z.enum(["free", "starter", "pro", "enterprise"]),
});

/**
 * POST /api/payment/change-plan
 * 플랜 변경 (업그레이드/다운그레이드)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = changePlanSchema.parse(body);

    const { subscriptionId, newPlan } = validated;

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

    // 무료 플랜으로 다운그레이드
    if (newPlan === "free") {
      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          cancelAtPeriodEnd: true,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscriptionId));

      await db
        .update(organizations)
        .set({ plan: "free", updatedAt: now })
        .where(eq(organizations.id, subscription.organizationId));

      return NextResponse.json({
        success: true,
        subscriptionId,
        newPlan: "free",
        message: "무료 플랜으로 다운그레이드됩니다. 현재 구독 기간이 종료되면 적용됩니다.",
      });
    }

    // 플랜 변경
    await db
      .update(subscriptions)
      .set({
        plan: newPlan,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, subscriptionId));

    await db
      .update(organizations)
      .set({ plan: newPlan, updatedAt: now })
      .where(eq(organizations.id, subscription.organizationId));

    // TODO: 실제 환경에서는 차액 정산 필요 (업그레이드: 추가 결제, 다운그레이드: 환불/크레딧)

    return NextResponse.json({
      success: true,
      subscriptionId,
      newPlan,
      message:
        newPlan > subscription.plan
          ? "플랜이 업그레이드되었습니다"
          : "플랜이 변경되었습니다",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 올바르지 않습니다", details: error.issues },
        { status: 400 },
      );
    }
    console.error("[Payment] 플랜 변경 오류:", error);
    return NextResponse.json(
      { error: "플랜 변경에 실패했습니다" },
      { status: 500 },
    );
  }
}
