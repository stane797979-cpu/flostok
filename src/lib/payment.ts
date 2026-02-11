/**
 * PortOne + 토스페이먼츠 결제 클라이언트
 *
 * Mock 모드: NEXT_PUBLIC_PAYMENT_MOCK=true 환경변수 설정 시 실제 결제 없이 시뮬레이션
 */

import * as PortOne from "@portone/browser-sdk/v2";
import type {
  PaymentRequest,
  PaymentResult,
  SubscriptionPlan,
  PaymentMethod,
} from "@/types/subscription";

/**
 * PortOne 스토어 ID (환경변수)
 */
const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || "";

/**
 * Mock 모드 활성화 여부
 */
const IS_MOCK_MODE = process.env.NEXT_PUBLIC_PAYMENT_MOCK === "true";

/**
 * 결제 채널 매핑 (PortOne V2)
 */
const PAYMENT_CHANNEL_MAP: Record<PaymentMethod, string> = {
  card: "tosspayments", // 토스페이먼츠 카드 결제
  tosspay: "tosspay", // 토스페이
  kakaopay: "kakaopay", // 카카오페이
  naverpay: "naverpay", // 네이버페이
};

/**
 * 결제 수단 매핑 (PortOne SDK는 대문자 요구)
 */
const PAYMENT_METHOD_MAP: Record<PaymentMethod, string> = {
  card: "CARD",
  tosspay: "EASY_PAY",
  kakaopay: "EASY_PAY",
  naverpay: "EASY_PAY",
};

/**
 * 결제 요청 ID 생성
 */
function generatePaymentId(): string {
  return `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 플랜별 금액 조회
 */
function getPlanAmount(
  plan: SubscriptionPlan,
  billingCycle: "monthly" | "yearly",
): number {
  const planPrices: Record<SubscriptionPlan, { monthly: number; yearly: number }> = {
    free: { monthly: 0, yearly: 0 },
    starter: { monthly: 29000, yearly: 290000 },
    pro: { monthly: 79000, yearly: 790000 },
    enterprise: { monthly: 0, yearly: 0 }, // 별도 문의
  };

  const price = planPrices[plan];
  return billingCycle === "yearly" ? price.yearly : price.monthly;
}

/**
 * PortOne 결제 요청
 */
export async function requestPayment(
  request: PaymentRequest,
): Promise<PaymentResult> {
  try {
    // Mock 모드: 실제 결제 없이 시뮬레이션
    if (IS_MOCK_MODE) {
      console.log("[Mock] 결제 요청:", request);

      // 2초 딜레이로 결제 시뮬레이션
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 80% 성공, 20% 실패
      const isSuccess = Math.random() > 0.2;

      if (isSuccess) {
        return {
          success: true,
          transactionId: `mock_${generatePaymentId()}`,
          subscriptionId: `sub_mock_${Date.now()}`,
        };
      } else {
        return {
          success: false,
          error: "결제가 취소되었습니다 (Mock)",
        };
      }
    }

    // 실제 PortOne 결제
    const paymentId = generatePaymentId();
    const amount = getPlanAmount(request.plan, request.billingCycle);

    if (amount === 0) {
      return {
        success: false,
        error: "무료 플랜 또는 엔터프라이즈 플랜은 결제가 필요하지 않습니다",
      };
    }

    const response = await PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      paymentId: paymentId,
      orderName: `FloStok ${request.plan.toUpperCase()} - ${request.billingCycle === "yearly" ? "연간" : "월간"} 구독`,
      totalAmount: amount,
      currency: "KRW",
      channelKey: PAYMENT_CHANNEL_MAP[request.paymentMethod],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payMethod: PAYMENT_METHOD_MAP[request.paymentMethod] as any,
      customer: {
        customerId: request.organizationId,
      },
      // 결제 정보
      customData: {
        organizationId: request.organizationId,
        plan: request.plan,
        billingCycle: request.billingCycle,
      },
    });

    // 결제 성공 여부 확인
    if (response && response.code === undefined) {
      // 백엔드에서 결제 검증 필요
      return {
        success: true,
        transactionId: response.paymentId,
      };
    } else {
      return {
        success: false,
        error: response?.message || "결제에 실패했습니다",
      };
    }
  } catch (error) {
    console.error("[Payment] 결제 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "결제 중 오류가 발생했습니다",
    };
  }
}

/**
 * 결제 검증 (서버사이드)
 */
export async function verifyPayment(paymentId: string): Promise<boolean> {
  try {
    // Mock 모드
    if (IS_MOCK_MODE) {
      console.log("[Mock] 결제 검증:", paymentId);
      return paymentId.startsWith("mock_");
    }

    // 실제 검증은 백엔드 API에서 PortOne API를 호출해야 함
    const response = await fetch("/api/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });

    const result = await response.json();
    return result.verified === true;
  } catch (error) {
    console.error("[Payment] 검증 오류:", error);
    return false;
  }
}

/**
 * 구독 취소
 */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  try {
    // Mock 모드
    if (IS_MOCK_MODE) {
      console.log("[Mock] 구독 취소:", subscriptionId);
      return true;
    }

    const response = await fetch("/api/payment/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Payment] 취소 오류:", error);
    return false;
  }
}

/**
 * 결제 방법 변경
 */
export async function updatePaymentMethod(
  subscriptionId: string,
  newMethod: PaymentMethod,
): Promise<boolean> {
  try {
    // Mock 모드
    if (IS_MOCK_MODE) {
      console.log("[Mock] 결제 방법 변경:", { subscriptionId, newMethod });
      return true;
    }

    const response = await fetch("/api/payment/update-method", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, method: newMethod }),
    });

    return response.ok;
  } catch (error) {
    console.error("[Payment] 결제 방법 변경 오류:", error);
    return false;
  }
}

/**
 * 플랜 변경 (업그레이드/다운그레이드)
 */
export async function changePlan(
  subscriptionId: string,
  newPlan: SubscriptionPlan,
): Promise<PaymentResult> {
  try {
    // Mock 모드
    if (IS_MOCK_MODE) {
      console.log("[Mock] 플랜 변경:", { subscriptionId, newPlan });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, subscriptionId };
    }

    const response = await fetch("/api/payment/change-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId, newPlan }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("[Payment] 플랜 변경 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "플랜 변경에 실패했습니다",
    };
  }
}
