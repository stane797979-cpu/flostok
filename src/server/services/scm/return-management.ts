/**
 * 반품 관리(Return Management) 서비스
 * 반품 사유 분류, 심각도 판정, 반품률 계산, 조치 권장
 *
 * 한국 제조업/유통업 특수사항:
 * - 제조업은 반품이 제한적 (품질 불량 위주)
 * - 유통업은 반품률 관리가 중요 (과잉입고, 오배송 빈번)
 *
 * @see SCM 도메인 규칙 - 10.1 KPI: 불량률 <= 1%
 */

import { safeDivide, safeNumber } from "@/lib/utils/safe-math";

// ─── 상수 ───────────────────────────────────────────────────

/** 반품률 경고 임계치 (%) */
const RETURN_RATE_WARNING_THRESHOLD = 3;

/** 반품률 위험 임계치 (%) */
const RETURN_RATE_CRITICAL_THRESHOLD = 5;

/** 고가 제품 심각도 상향 기준 금액 (원) */
const HIGH_VALUE_THRESHOLD = 500_000;

/** 대량 반품 심각도 상향 기준 수량 (개) */
const HIGH_QUANTITY_THRESHOLD = 50;

// ─── 타입 정의 ──────────────────────────────────────────────

/** 반품 사유 */
export type ReturnReason =
  | "defective"        // 불량/결함
  | "wrong_delivery"   // 오배송
  | "excess"           // 과잉 입고
  | "other";           // 기타

/** 반품 처리 상태 */
export type ReturnStatus =
  | "inspecting"              // 검수 중
  | "restored"                // 복원/재입고
  | "disposed"                // 폐기
  | "returned_to_supplier";   // 공급자 반품

/** 반품 심각도 */
export type ReturnSeverity = "low" | "medium" | "high";

/** 반품 기록 */
export interface ReturnRecord {
  /** 반품 기록 ID */
  id: string;
  /** 제품 ID */
  productId: string;
  /** 반품 수량 */
  quantity: number;
  /** 반품 사유 */
  reason: ReturnReason;
  /** 처리 상태 */
  status: ReturnStatus;
  /** 검수 메모 */
  inspectionNotes: string;
  /** 원 입고 기록 ID (추적용) */
  originalInboundId: string;
}

/** 반품률 분석 결과 */
export interface ReturnRateResult {
  /** 반품률 (%) */
  returnRate: number;
  /** 상태 ('정상' | '주의' | '위험') */
  level: "normal" | "warning" | "critical";
  /** 한국어 상태 설명 */
  description: string;
}

/** 반품 사유별 통계 */
export interface ReturnReasonStats {
  /** 사유 */
  reason: ReturnReason;
  /** 사유 한국어명 */
  reasonLabel: string;
  /** 건수 */
  count: number;
  /** 수량 합계 */
  totalQuantity: number;
  /** 비율 (%) */
  percentage: number;
}

/** 반품 요약 */
export interface ReturnSummary {
  /** 총 반품 건수 */
  totalReturns: number;
  /** 총 반품 수량 */
  totalQuantity: number;
  /** 사유별 통계 */
  byReason: ReturnReasonStats[];
  /** 상태별 건수 */
  byStatus: Record<ReturnStatus, number>;
  /** 전체 반품률 (%) */
  overallReturnRate: number;
}

// ─── 한국어 매핑 ────────────────────────────────────────────

/** 반품 사유 한국어 라벨 */
const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  defective: "불량/결함",
  wrong_delivery: "오배송",
  excess: "과잉 입고",
  other: "기타",
};

/** 반품 상태 한국어 라벨 */
const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  inspecting: "검수 중",
  restored: "복원/재입고",
  disposed: "폐기",
  returned_to_supplier: "공급자 반품",
};

// ─── 핵심 함수 ──────────────────────────────────────────────

/**
 * 반품률을 계산합니다.
 *
 * 반품률 = (반품 수량 / 총 입고 수량) x 100
 *
 * @param totalInbound - 기간 내 총 입고 수량
 * @param totalReturns - 기간 내 총 반품 수량
 * @returns 반품률(%)과 상태 판정
 *
 * @example
 * ```ts
 * const result = calculateReturnRate(1000, 25);
 * // { returnRate: 2.5, level: 'normal', description: '정상 범위' }
 * ```
 */
export function calculateReturnRate(
  totalInbound: number,
  totalReturns: number
): ReturnRateResult {
  const safeInbound = safeNumber(totalInbound, 0);
  const safeReturns = safeNumber(totalReturns, 0);

  const returnRate =
    Math.round(safeDivide(safeReturns, safeInbound, 0) * 1000) / 10;

  let level: ReturnRateResult["level"];
  let description: string;

  if (returnRate >= RETURN_RATE_CRITICAL_THRESHOLD) {
    level = "critical";
    description = `반품률 ${returnRate}% — 위험 수준. 공급자 품질 점검 및 입고 검수 강화 필요`;
  } else if (returnRate >= RETURN_RATE_WARNING_THRESHOLD) {
    level = "warning";
    description = `반품률 ${returnRate}% — 주의 수준. 반품 사유 분석 및 개선 조치 권장`;
  } else {
    level = "normal";
    description = `반품률 ${returnRate}% — 정상 범위`;
  }

  return { returnRate, level, description };
}

/**
 * 반품 심각도를 판정합니다.
 *
 * 판정 기준:
 * - high: 불량 사유 + (고가 제품 또는 대량 반품)
 * - medium: 불량 사유 또는 대량 반품
 * - low: 소량 과잉/오배송/기타
 *
 * @param reason - 반품 사유
 * @param quantity - 반품 수량 (개)
 * @param productValue - 제품 단가 (원)
 * @returns 심각도 등급
 *
 * @example
 * ```ts
 * classifyReturnSeverity('defective', 100, 50000);
 * // 'high' (불량 + 대량)
 *
 * classifyReturnSeverity('excess', 5, 10000);
 * // 'low' (과잉 + 소량)
 * ```
 */
export function classifyReturnSeverity(
  reason: ReturnReason,
  quantity: number,
  productValue: number
): ReturnSeverity {
  const safeQty = safeNumber(quantity, 0);
  const safeValue = safeNumber(productValue, 0);

  const isDefective = reason === "defective";
  const isHighValue = safeValue >= HIGH_VALUE_THRESHOLD;
  const isHighQuantity = safeQty >= HIGH_QUANTITY_THRESHOLD;
  const totalAmount = safeQty * safeValue;
  const isHighTotalAmount = totalAmount >= HIGH_VALUE_THRESHOLD * 10; // 500만원 이상

  // 불량 + (고가 또는 대량 또는 고총액) → high
  if (isDefective && (isHighValue || isHighQuantity || isHighTotalAmount)) {
    return "high";
  }

  // 불량 사유이거나 대량 반품 → medium
  if (isDefective || isHighQuantity || isHighTotalAmount) {
    return "medium";
  }

  // 그 외 → low
  return "low";
}

/**
 * 반품 사유와 현재 상태에 따른 다음 처리 단계를 권장합니다.
 *
 * @param reason - 반품 사유
 * @param status - 현재 처리 상태
 * @returns 한국어 조치 권장사항
 *
 * @example
 * ```ts
 * getReturnActionRecommendation('defective', 'inspecting');
 * // '불량 원인 분석 후 공급자 클레임 접수. 대체품 입고 요청 검토.'
 * ```
 */
export function getReturnActionRecommendation(
  reason: ReturnReason,
  status: ReturnStatus
): string {
  // 검수 중 상태
  if (status === "inspecting") {
    switch (reason) {
      case "defective":
        return "불량 원인 분석 후 공급자 클레임 접수. 대체품 입고 요청 검토.";
      case "wrong_delivery":
        return "정확한 품목 확인 후 교환 발주 진행. 공급자에게 오배송 통보.";
      case "excess":
        return "실제 발주 수량과 대조 후 초과분 반품 처리. 공급자 협의 진행.";
      case "other":
        return "반품 사유 상세 기록 후 처리 방법 결정 (복원/폐기/반품).";
    }
  }

  // 복원/재입고 상태
  if (status === "restored") {
    switch (reason) {
      case "defective":
        return "복원 품질 재검수 완료. 재고에 정상 반영 후 모니터링.";
      case "wrong_delivery":
        return "정품 확인 완료. 재고 수량 조정 반영.";
      case "excess":
        return "재입고 완료. 재고 수량 정상 반영.";
      case "other":
        return "복원 처리 완료. 이력 기록 보관.";
    }
  }

  // 폐기 상태
  if (status === "disposed") {
    return "폐기 처리 완료. 폐기 비용 정산 및 공급자 클레임 여부 확인.";
  }

  // 공급자 반품 상태
  if (status === "returned_to_supplier") {
    switch (reason) {
      case "defective":
        return "공급자 반품 완료. 대체품 입고 일정 확인 및 크레딧 메모 수령.";
      case "wrong_delivery":
        return "오배송 반품 완료. 정품 재발송 일정 확인.";
      case "excess":
        return "초과분 반품 완료. 세금계산서 수정 발행 확인.";
      case "other":
        return "반품 완료. 공급자 확인서 수령 및 정산 진행.";
    }
  }

  return "처리 상태를 확인해 주세요.";
}

/**
 * 반품 기록 목록을 사유별로 통계 분석합니다.
 *
 * @param records - 반품 기록 목록
 * @param totalInbound - 기간 내 총 입고 수량 (반품률 계산용)
 * @returns 반품 요약
 */
export function summarizeReturns(
  records: ReturnRecord[],
  totalInbound: number
): ReturnSummary {
  const totalReturns = records.length;
  const totalQuantity = records.reduce((sum, r) => sum + safeNumber(r.quantity, 0), 0);

  // 사유별 통계
  const reasonMap = new Map<ReturnReason, { count: number; quantity: number }>();
  const allReasons: ReturnReason[] = ["defective", "wrong_delivery", "excess", "other"];

  for (const reason of allReasons) {
    reasonMap.set(reason, { count: 0, quantity: 0 });
  }

  for (const record of records) {
    const entry = reasonMap.get(record.reason);
    if (entry) {
      entry.count += 1;
      entry.quantity += safeNumber(record.quantity, 0);
    }
  }

  const byReason: ReturnReasonStats[] = allReasons.map((reason) => {
    const entry = reasonMap.get(reason)!;
    return {
      reason,
      reasonLabel: RETURN_REASON_LABELS[reason],
      count: entry.count,
      totalQuantity: entry.quantity,
      percentage:
        Math.round(safeDivide(entry.count, totalReturns, 0) * 1000) / 10,
    };
  });

  // 상태별 건수
  const byStatus: Record<ReturnStatus, number> = {
    inspecting: 0,
    restored: 0,
    disposed: 0,
    returned_to_supplier: 0,
  };

  for (const record of records) {
    if (record.status in byStatus) {
      byStatus[record.status] += 1;
    }
  }

  // 전체 반품률
  const { returnRate } = calculateReturnRate(totalInbound, totalQuantity);

  return {
    totalReturns,
    totalQuantity,
    byReason,
    byStatus,
    overallReturnRate: returnRate,
  };
}

/**
 * 반품 사유의 한국어 라벨을 반환합니다.
 *
 * @param reason - 반품 사유 코드
 * @returns 한국어 라벨
 */
export function getReturnReasonLabel(reason: ReturnReason): string {
  return RETURN_REASON_LABELS[reason];
}

/**
 * 반품 상태의 한국어 라벨을 반환합니다.
 *
 * @param status - 반품 상태 코드
 * @returns 한국어 라벨
 */
export function getReturnStatusLabel(status: ReturnStatus): string {
  return RETURN_STATUS_LABELS[status];
}
