/**
 * 조직 설정 타입 정의
 * organizations.settings jsonb 필드 구조
 */

/**
 * ABC-XYZ 공급물량 보정계수
 * ABC(매출기여도) × XYZ(수요변동성) 조합별 적정재고 보정 비율
 * 값 범위: 0.5 ~ 1.5 (1.0 = 보정 없음)
 */
export interface SupplyAdjustmentCoefficients {
  AX: number;
  AY: number;
  AZ: number;
  BX: number;
  BY: number;
  BZ: number;
  CX: number;
  CY: number;
  CZ: number;
}

/**
 * 발주 정책 설정
 */
export interface OrderPolicySettings {
  /** 서비스 레벨 (%) - 안전재고 계산에 사용 */
  serviceLevel: number;
  /** 안전재고 배수 - 간단 계산 시 사용 (리드타임 수요의 X배) */
  safetyStockMultiplier: number;
  /** 자동 발주 임계값 (%) - 발주점 대비 현재고 비율 */
  autoReorderThreshold: number;
  /** 목표 재고일수 (일) - 발주량 계산 시 사용 */
  targetDaysOfInventory: number;
  /** 기본 리드타임 (일) - 제품별 설정이 없을 때 사용 */
  defaultLeadTimeDays: number;
  /** ABC-XYZ 공급물량 보정계수 */
  supplyCoefficients?: SupplyAdjustmentCoefficients;
}

/**
 * 조직 전체 설정
 */
export interface OrganizationSettings {
  /** 발주 정책 */
  orderPolicy?: OrderPolicySettings;
  /** 알림 설정 */
  notifications?: {
    email?: boolean;
    sms?: boolean;
  };
  /** 기타 설정 */
  [key: string]: unknown;
}

/**
 * 공급물량 보정계수 기본값
 * AX(핵심+안정) = 1.0 (보정 없음)
 * CZ(저가+불안정) = 0.65 (35% 축소)
 */
export const DEFAULT_SUPPLY_COEFFICIENTS: SupplyAdjustmentCoefficients = {
  AX: 1.0,  // 매출 高 + 안정 → 그대로
  AY: 0.95, // 매출 高 + 보통 → 소폭 축소
  AZ: 0.85, // 매출 高 + 불안정 → 축소
  BX: 0.95, // 매출 中 + 안정 → 소폭 축소
  BY: 0.85, // 매출 中 + 보통 → 축소
  BZ: 0.75, // 매출 中 + 불안정 → 큰 축소
  CX: 0.85, // 매출 低 + 안정 → 축소
  CY: 0.75, // 매출 低 + 보통 → 큰 축소
  CZ: 0.65, // 매출 低 + 불안정 → 최대 축소
};

/**
 * 발주 정책 기본값
 */
export const DEFAULT_ORDER_POLICY: OrderPolicySettings = {
  serviceLevel: 95, // 95%
  safetyStockMultiplier: 0.5, // 리드타임 수요의 50%
  autoReorderThreshold: 100, // 발주점 100% (발주점 도달 시 자동 발주)
  targetDaysOfInventory: 30, // 30일
  defaultLeadTimeDays: 7, // 7일
  supplyCoefficients: DEFAULT_SUPPLY_COEFFICIENTS,
};

/**
 * 보정계수 조회 헬퍼
 * ABC/XYZ 등급 조합에 맞는 보정계수 반환 (미지정 시 1.0)
 */
export function getSupplyCoefficient(
  coefficients: SupplyAdjustmentCoefficients | undefined,
  abcGrade?: "A" | "B" | "C",
  xyzGrade?: "X" | "Y" | "Z"
): number {
  if (!coefficients || !abcGrade || !xyzGrade) return 1.0;
  const key = `${abcGrade}${xyzGrade}` as keyof SupplyAdjustmentCoefficients;
  return coefficients[key] ?? 1.0;
}
