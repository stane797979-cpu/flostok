/**
 * 구독 플랜 및 결제 관련 타입 정의
 */

export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";

export type SubscriptionStatus =
  | "active" // 활성
  | "canceled" // 취소됨
  | "expired" // 만료
  | "pending" // 결제 대기
  | "failed"; // 결제 실패

/**
 * 구독 플랜 상세 정보
 */
export interface PlanDetails {
  name: string;
  displayName: string;
  price: number; // 월 구독료 (원)
  yearlyPrice?: number; // 연간 구독료 (원, 할인 적용)
  features: string[]; // 기능 목록
  limits: PlanLimits;
  popular?: boolean; // 추천 플랜 표시
}

/**
 * 플랜별 기능 제한
 */
export interface PlanLimits {
  maxProducts: number; // 최대 제품 수
  maxUsers: number; // 최대 사용자 수
  maxOrders: number; // 월 최대 발주 건수
  aiChatLimit: number; // 월 AI 채팅 메시지 수
  aiToolCallLimit: number; // 월 AI 도구 호출 수
  dataRetentionDays: number; // 데이터 보관 기간 (일)
  hasABCXYZ: boolean; // ABC/XYZ 분석
  hasDemandForecast: boolean; // 수요 예측
  hasSimulation: boolean; // 시나리오 시뮬레이션
  hasAPIAccess: boolean; // API 접근
  hasAdvancedAnalytics: boolean; // 고급 분석
  hasEmailSupport: boolean; // 이메일 지원
  hasPrioritySupport: boolean; // 우선 지원
}

/**
 * 구독 플랜 정의
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, PlanDetails> = {
  free: {
    name: "free",
    displayName: "무료",
    price: 0,
    features: [
      "제품 최대 10개",
      "사용자 1명",
      "월 발주 10건",
      "AI 채팅 월 10회",
      "데이터 보관 30일",
      "기본 재고 관리",
    ],
    limits: {
      maxProducts: 10,
      maxUsers: 1,
      maxOrders: 10,
      aiChatLimit: 10,
      aiToolCallLimit: 50,
      dataRetentionDays: 30,
      hasABCXYZ: false,
      hasDemandForecast: false,
      hasSimulation: false,
      hasAPIAccess: false,
      hasAdvancedAnalytics: false,
      hasEmailSupport: true,
      hasPrioritySupport: false,
    },
  },
  starter: {
    name: "starter",
    displayName: "스타터",
    price: 29000,
    yearlyPrice: 290000, // 월 24,167원 (약 17% 할인)
    features: [
      "제품 최대 100개",
      "사용자 3명",
      "월 발주 무제한",
      "AI 채팅 월 100회",
      "데이터 보관 90일",
      "ABC/XYZ 분석",
      "수요 예측",
      "이메일 지원",
    ],
    limits: {
      maxProducts: 100,
      maxUsers: 3,
      maxOrders: 99999,
      aiChatLimit: 100,
      aiToolCallLimit: 500,
      dataRetentionDays: 90,
      hasABCXYZ: true,
      hasDemandForecast: true,
      hasSimulation: false,
      hasAPIAccess: false,
      hasAdvancedAnalytics: false,
      hasEmailSupport: true,
      hasPrioritySupport: false,
    },
    popular: true,
  },
  pro: {
    name: "pro",
    displayName: "프로",
    price: 79000,
    yearlyPrice: 790000, // 월 65,833원 (약 17% 할인)
    features: [
      "제품 무제한",
      "사용자 10명",
      "월 발주 무제한",
      "AI 채팅 월 500회",
      "데이터 보관 1년",
      "ABC/XYZ 분석",
      "수요 예측",
      "시나리오 시뮬레이션",
      "API 접근",
      "고급 분석",
      "우선 지원",
    ],
    limits: {
      maxProducts: 99999,
      maxUsers: 10,
      maxOrders: 99999,
      aiChatLimit: 500,
      aiToolCallLimit: 5000,
      dataRetentionDays: 365,
      hasABCXYZ: true,
      hasDemandForecast: true,
      hasSimulation: true,
      hasAPIAccess: true,
      hasAdvancedAnalytics: true,
      hasEmailSupport: true,
      hasPrioritySupport: true,
    },
  },
  enterprise: {
    name: "enterprise",
    displayName: "엔터프라이즈",
    price: 0, // 별도 문의
    features: [
      "모든 기능 무제한",
      "사용자 무제한",
      "전담 계정 매니저",
      "온프레미스 배포 지원",
      "맞춤형 통합",
      "24/7 전화 지원",
      "SLA 보장",
    ],
    limits: {
      maxProducts: 99999999,
      maxUsers: 99999999,
      maxOrders: 99999999,
      aiChatLimit: 99999999,
      aiToolCallLimit: 99999999,
      dataRetentionDays: 99999,
      hasABCXYZ: true,
      hasDemandForecast: true,
      hasSimulation: true,
      hasAPIAccess: true,
      hasAdvancedAnalytics: true,
      hasEmailSupport: true,
      hasPrioritySupport: true,
    },
  },
};

/**
 * 구독 정보
 */
export interface Subscription {
  id: string;
  organizationId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 결제 방법
 */
export type PaymentMethod = "card" | "tosspay" | "kakaopay" | "naverpay";

/**
 * 결제 요청 파라미터
 */
export interface PaymentRequest {
  organizationId: string;
  plan: SubscriptionPlan;
  billingCycle: "monthly" | "yearly";
  paymentMethod: PaymentMethod;
}

/**
 * 결제 결과
 */
export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  subscriptionId?: string;
  error?: string;
}

/**
 * 결제 내역
 */
export interface PaymentHistory {
  id: string;
  organizationId: string;
  subscriptionId: string;
  amount: number;
  method: PaymentMethod;
  status: "success" | "failed" | "pending" | "refunded";
  transactionId?: string;
  createdAt: Date;
}
