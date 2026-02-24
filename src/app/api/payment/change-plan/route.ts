import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { subscriptions, organizations, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

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

    // 구독의 organizationId가 인증된 사용자의 조직과 일치하는지 검증
    if (subscription.organizationId !== dbUser.organizationId) {
      return NextResponse.json(
        { error: "해당 구독에 대한 권한이 없습니다" },
        { status: 403 },
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
