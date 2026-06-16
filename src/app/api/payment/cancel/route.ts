import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const cancelSchema = z.object({
  subscriptionId: z.string().uuid(),
  immediate: z.boolean().optional(), // true: 즉시 취소, false: 기간 종료 시 취소
});

/**
 * POST /api/payment/cancel
 * 구독 취소
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = cancelSchema.parse(body);

    const { subscriptionId, immediate = false } = validated;

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
      // 즉시 취소 (환불 처리 필요)
      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: now,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscriptionId));

      // TODO: 실제 환불 로직 구현 (PortOne API 호출)
    } else {
      // 기간 종료 시 취소
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, subscriptionId));
    }

    return NextResponse.json({
      success: true,
      subscriptionId,
      canceledAt: now.toISOString(),
      immediate,
    });
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
