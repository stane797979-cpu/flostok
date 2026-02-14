/**
 * 회원 탈퇴 관련 공유 타입 및 상수
 *
 * 'use server' 모듈에서 비함수 값을 export하면 클라이언트에서 undefined가 되므로
 * 클라이언트/서버 공용 타입과 상수는 이 파일에서 관리합니다.
 */

/** 탈퇴 사유 목록 */
export const WITHDRAWAL_REASONS = [
  '서비스를 더 이상 사용하지 않음',
  '다른 서비스로 전환',
  '비용이 부담됨',
  '기능이 부족함',
  '사용하기 어려움',
  '기타',
] as const

export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number]

/** 탈퇴 전 사전 확인 정보 */
export interface WithdrawalPreCheck {
  hasActiveSubscription: boolean
  subscription: {
    plan: string
    status: string
    billingCycle: string
    currentPeriodEnd: Date
  } | null
  refundInfo: {
    eligible: boolean
    estimatedAmount: number
    usedDays: number
    totalDays: number
    refundRate: number
  } | null
  organizationUserCount: number
  isLastAdmin: boolean
}
