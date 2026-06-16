import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { subscriptions, paymentHistory } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/**
 * POST /api/payment/webhook
 * PortOne 웹훅 처리
 *
 * PortOne 대시보드에서 웹훅 URL 설정:
 * https://yourdomain.com/api/payment/webhook
 *
 * 웹훅 이벤트:
 * - PaymentStatusChanged: 결제 상태 변경
 * - PaymentRefunded: 환불
 * - SubscriptionRenewed: 구독 갱신
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // PortOne 웹훅 서명 검증
    const signature = request.headers.get("x-portone-signature");
    const isValid = await verifyWebhookSignature(body, signature);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { type, data } = body;

    switch (type) {
      case "PaymentStatusChanged":
        await handlePaymentStatusChanged(data);
        break;

      case "PaymentRefunded":
        await handlePaymentRefunded(data);
        break;

      case "SubscriptionRenewed":
        await handleSubscriptionRenewed(data);
        break;

      default:
        console.log("[Webhook] 미처리 이벤트:", type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] 처리 오류:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

/**
 * 웹훅 서명 검증
 */
async function verifyWebhookSignature(
  body: unknown,
  signature: string | null,
): Promise<boolean> {
  // Mock 모드: 검증 스킵
  if (process.env.NEXT_PUBLIC_PAYMENT_MOCK === "true") {
    return true;
  }

  if (!signature) {
    console.error("[Webhook] 서명이 제공되지 않았습니다");
    return false;
  }

  const secret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Webhook] PORTONE_WEBHOOK_SECRET 환경 변수가 설정되지 않았습니다");
    return false;
  }

  try {
    // 페이로드를 JSON 문자열로 변환
    const payload = JSON.stringify(body);

    // HMAC-SHA256으로 서명 생성
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex");

    // 타이밍 공격 방지를 위한 안전한 비교
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch (error) {
    console.error("[Webhook] 서명 검증 오류:", error);
    return false;
  }
}

/**
 * 결제 상태 변경 처리
 */
async function handlePaymentStatusChanged(data: {
  paymentId: string;
  status: string;
  customData?: { organizationId?: string; subscriptionId?: string };
}) {
  const { paymentId, status, customData } = data;

  if (!customData?.subscriptionId) return;

  const now = new Date();

  if (status === "PAID") {
    // 결제 성공
    await db
      .update(subscriptions)
      .set({ status: "active", updatedAt: now })
      .where(eq(subscriptions.id, customData.subscriptionId));
  } else if (status === "FAILED") {
    // 결제 실패
    await db
      .update(subscriptions)
      .set({ status: "failed", updatedAt: now })
      .where(eq(subscriptions.id, customData.subscriptionId));

    // 결제 실패 기록
    if (customData.organizationId) {
      await db.insert(paymentHistory).values({
        organizationId: customData.organizationId,
        subscriptionId: customData.subscriptionId,
        amount: 0,
        method: "card",
        status: "failed",
        transactionId: paymentId,
        errorMessage: "결제 실패",
      });
    }
  }
}

/**
 * 환불 처리
 */
async function handlePaymentRefunded(data: {
  paymentId: string;
  refundAmount: number;
  customData?: { organizationId?: string; subscriptionId?: string };
}) {
  const { paymentId, refundAmount, customData } = data;

  if (!customData?.organizationId) return;

  await db.insert(paymentHistory).values({
    organizationId: customData.organizationId,
    subscriptionId: customData.subscriptionId || null,
    amount: -refundAmount, // 음수로 기록
    method: "card",
    status: "refunded",
    transactionId: paymentId,
  });
}

/**
 * 구독 갱신 처리
 */
async function handleSubscriptionRenewed(data: {
  subscriptionId: string;
  nextPeriodStart: string;
  nextPeriodEnd: string;
}) {
  const { subscriptionId, nextPeriodStart, nextPeriodEnd } = data;

  const now = new Date();

  await db
    .update(subscriptions)
    .set({
      status: "active",
      currentPeriodStart: new Date(nextPeriodStart),
      currentPeriodEnd: new Date(nextPeriodEnd),
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscriptionId));
}
