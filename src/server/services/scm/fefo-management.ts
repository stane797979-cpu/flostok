/**
 * FEFO(First Expired, First Out) 유통기한 관리 서비스
 * 유통기한 기반 출고 우선순위 관리, 만료 리스크 분석, 조치 권장
 *
 * FEFO 원칙: 유통기한이 가장 가까운 제품부터 먼저 출고
 * - 식품, 의약품, 화장품 등 유통기한 필수 품목에 적용
 * - FIFO(선입선출)보다 우선 적용
 *
 * @see SCM 도메인 규칙 - 8.2 출고 프로세스: FEFO 우선
 */

import { safeNumber } from "@/lib/utils/safe-math";

// ─── 상수 ───────────────────────────────────────────────────

/** 만료됨 — 유통기한 경과 */
const DAYS_EXPIRED = 0;

/** 긴급 경고 기준 (일) — 7일 이내 만료 */
const DAYS_CRITICAL = 7;

/** 주의 경고 기준 (일) — 30일 이내 만료 */
const DAYS_WARNING = 30;

/** 1일의 밀리초 */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ─── 타입 정의 ──────────────────────────────────────────────

/** 유통기한 경고 수준 */
export type ExpiryAlertLevel =
  | "expired"       // 만료됨
  | "critical_d7"   // 7일 이내 만료
  | "warning_d30"   // 30일 이내 만료
  | "normal";       // 정상

/** 유통기한 경고 항목 */
export interface ExpiryAlert {
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
  /** LOT 번호 */
  lotNumber: string;
  /** 유통기한 (YYYY-MM-DD) */
  expiryDate: string;
  /** 만료까지 남은 일수 (음수: 이미 만료) */
  daysUntilExpiry: number;
  /** 경고 수준 */
  alertLevel: ExpiryAlertLevel;
}

/** FEFO 정렬 대상 항목 */
export interface FEFOItem {
  /** LOT 번호 */
  lotNumber: string;
  /** 유통기한 (YYYY-MM-DD) */
  expiryDate: string;
  /** 수량 */
  quantity: number;
}

/** 유통기한 리스크 분석 결과 */
export interface ExpiryRiskResult {
  /** 만료된 항목 수 */
  expiredCount: number;
  /** 7일 이내 만료 항목 수 */
  criticalCount: number;
  /** 30일 이내 만료 항목 수 */
  warningCount: number;
  /** 정상 항목 수 */
  normalCount: number;
  /** 총 리스크 항목 수 (만료 + 긴급 + 주의) */
  totalAtRisk: number;
  /** 리스크 추정 금액 (원) — 리스크 항목의 수량 x 단가 합계 */
  riskValue: number;
}

/** 리스크 분석 입력 항목 */
export interface ExpiryRiskItem {
  /** 유통기한 (YYYY-MM-DD) */
  expiryDate: string;
  /** 수량 */
  quantity: number;
  /** 단가 (원) */
  unitPrice: number;
}

// ─── 핵심 함수 ──────────────────────────────────────────────

/**
 * 유통기한까지 남은 일수를 계산합니다.
 *
 * @param expiryDate - 유통기한 (YYYY-MM-DD 또는 Date)
 * @param referenceDate - 기준일 (기본: 오늘)
 * @returns 남은 일수 (음수: 이미 만료)
 *
 * @example
 * ```ts
 * // 2026-03-01 기준, 2026-03-10 만료
 * calculateDaysUntilExpiry('2026-03-10', new Date('2026-03-01'));
 * // 9
 * ```
 */
export function calculateDaysUntilExpiry(
  expiryDate: string | Date,
  referenceDate?: Date
): number {
  const expiry = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const reference = referenceDate ?? new Date();

  // 시간 부분 제거 (날짜만 비교)
  const expiryMidnight = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );
  const referenceMidnight = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );

  const diffMs = expiryMidnight.getTime() - referenceMidnight.getTime();
  return Math.floor(diffMs / MS_PER_DAY);
}

/**
 * 유통기한 경고 수준을 분류합니다.
 *
 * | 경고 수준     | 조건              |
 * |--------------|-------------------|
 * | expired      | 만료됨 (0일 이하) |
 * | critical_d7  | 7일 이내 만료     |
 * | warning_d30  | 30일 이내 만료    |
 * | normal       | 30일 초과         |
 *
 * @param expiryDate - 유통기한 (YYYY-MM-DD 또는 Date)
 * @param referenceDate - 기준일 (기본: 오늘)
 * @returns 경고 수준
 *
 * @example
 * ```ts
 * classifyExpiryStatus('2026-02-20'); // referenceDate가 2026-02-24면 'expired'
 * classifyExpiryStatus('2026-02-28'); // 4일 남음 → 'critical_d7'
 * classifyExpiryStatus('2026-03-20'); // 24일 남음 → 'warning_d30'
 * classifyExpiryStatus('2026-06-01'); // 97일 남음 → 'normal'
 * ```
 */
export function classifyExpiryStatus(
  expiryDate: string | Date,
  referenceDate?: Date
): ExpiryAlertLevel {
  const daysLeft = calculateDaysUntilExpiry(expiryDate, referenceDate);

  if (daysLeft <= DAYS_EXPIRED) return "expired";
  if (daysLeft <= DAYS_CRITICAL) return "critical_d7";
  if (daysLeft <= DAYS_WARNING) return "warning_d30";
  return "normal";
}

/**
 * 항목들을 FEFO 원칙에 따라 정렬합니다.
 *
 * 유통기한이 가까운 순서로 정렬하며,
 * 동일 유통기한일 경우 LOT 번호 오름차순으로 정렬합니다.
 *
 * @param items - 정렬 대상 항목 목록
 * @returns FEFO 순서로 정렬된 새 배열 (원본 불변)
 *
 * @example
 * ```ts
 * const sorted = sortByFEFO([
 *   { lotNumber: 'L002', expiryDate: '2026-06-01', quantity: 50 },
 *   { lotNumber: 'L001', expiryDate: '2026-03-15', quantity: 30 },
 * ]);
 * // L001(3/15) → L002(6/1) 순서
 * ```
 */
export function sortByFEFO(items: FEFOItem[]): FEFOItem[] {
  return [...items].sort((a, b) => {
    const dateA = new Date(a.expiryDate).getTime();
    const dateB = new Date(b.expiryDate).getTime();

    if (dateA !== dateB) return dateA - dateB; // 유통기한 가까운 순
    return a.lotNumber.localeCompare(b.lotNumber); // 동일 기한 시 LOT 번호순
  });
}

/**
 * 유통기한 리스크를 분석합니다.
 *
 * 만료/긴급/주의 항목의 수량과 추정 손실 금액을 계산합니다.
 *
 * @param items - 분석 대상 항목 목록
 * @param referenceDate - 기준일 (기본: 오늘)
 * @returns 리스크 분석 결과
 *
 * @example
 * ```ts
 * const risk = calculateExpiryRisk([
 *   { expiryDate: '2026-02-20', quantity: 100, unitPrice: 5000 },  // 만료
 *   { expiryDate: '2026-02-28', quantity: 50, unitPrice: 3000 },   // 긴급
 *   { expiryDate: '2026-06-01', quantity: 200, unitPrice: 2000 },  // 정상
 * ]);
 * // expiredCount: 1, criticalCount: 1, riskValue: 650000
 * ```
 */
export function calculateExpiryRisk(
  items: ExpiryRiskItem[],
  referenceDate?: Date
): ExpiryRiskResult {
  let expiredCount = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let normalCount = 0;
  let riskValue = 0;

  for (const item of items) {
    const alertLevel = classifyExpiryStatus(item.expiryDate, referenceDate);
    const qty = safeNumber(item.quantity, 0);
    const price = safeNumber(item.unitPrice, 0);
    const itemValue = qty * price;

    switch (alertLevel) {
      case "expired":
        expiredCount += 1;
        riskValue += itemValue; // 만료: 전액 손실
        break;
      case "critical_d7":
        criticalCount += 1;
        riskValue += itemValue; // 긴급: 전액 리스크 (할인 판매 가능성 있으나 보수적 추정)
        break;
      case "warning_d30":
        warningCount += 1;
        riskValue += Math.round(itemValue * 0.3); // 주의: 30% 리스크 (할인 판매 예상)
        break;
      case "normal":
        normalCount += 1;
        break;
    }
  }

  const totalAtRisk = expiredCount + criticalCount + warningCount;

  return {
    expiredCount,
    criticalCount,
    warningCount,
    normalCount,
    totalAtRisk,
    riskValue: Math.round(riskValue),
  };
}

/**
 * 유통기한 경고 수준에 따른 조치 권장사항을 반환합니다.
 *
 * @param alertLevel - 경고 수준
 * @param daysUntilExpiry - 만료까지 남은 일수
 * @returns 한국어 조치 권장사항
 *
 * @example
 * ```ts
 * getExpiryRecommendation('expired', -3);
 * // '유통기한 3일 경과. 즉시 판매 중지 및 격리 보관. 폐기 절차 진행.'
 *
 * getExpiryRecommendation('critical_d7', 3);
 * // '유통기한 3일 남음. 즉시 출고 우선순위 최상위 지정. ...'
 * ```
 */
export function getExpiryRecommendation(
  alertLevel: ExpiryAlertLevel,
  daysUntilExpiry: number
): string {
  const days = safeNumber(daysUntilExpiry, 0);

  switch (alertLevel) {
    case "expired":
      return `유통기한 ${Math.abs(days)}일 경과. 즉시 판매 중지 및 격리 보관. 폐기 절차 진행.`;

    case "critical_d7":
      return (
        `유통기한 ${days}일 남음. ` +
        "즉시 출고 우선순위 최상위 지정. " +
        "할인 판매 또는 임직원 판매 검토. " +
        "미출고 시 폐기 일정 사전 수립."
      );

    case "warning_d30":
      return (
        `유통기한 ${days}일 남음. ` +
        "FEFO 출고 순서 확인. " +
        "프로모션(묶음 판매, 할인) 검토. " +
        "재발주 시 수량 조정 권장."
      );

    case "normal":
      return `유통기한 ${days}일 남음. 정상 관리. FEFO 원칙에 따라 출고 순서 유지.`;
  }
}

/**
 * 경고 수준의 한국어 라벨을 반환합니다.
 *
 * @param alertLevel - 경고 수준
 * @returns 한국어 라벨
 */
export function getExpiryAlertLabel(alertLevel: ExpiryAlertLevel): string {
  const labels: Record<ExpiryAlertLevel, string> = {
    expired: "만료",
    critical_d7: "긴급 (7일 이내)",
    warning_d30: "주의 (30일 이내)",
    normal: "정상",
  };

  return labels[alertLevel];
}

/**
 * 제품별 ExpiryAlert 목록을 생성합니다.
 *
 * LOT 단위 재고 정보로부터 유통기한 경고 목록을 생성합니다.
 *
 * @param lots - LOT별 제품/수량/유통기한 정보
 * @param referenceDate - 기준일 (기본: 오늘)
 * @returns 경고 수준순(만료 > 긴급 > 주의 > 정상) 정렬된 경고 목록
 */
export function generateExpiryAlerts(
  lots: Array<{
    productId: string;
    productName: string;
    lotNumber: string;
    expiryDate: string;
  }>,
  referenceDate?: Date
): ExpiryAlert[] {
  const alertPriority: Record<ExpiryAlertLevel, number> = {
    expired: 0,
    critical_d7: 1,
    warning_d30: 2,
    normal: 3,
  };

  const alerts: ExpiryAlert[] = lots.map((lot) => {
    const daysUntilExpiry = calculateDaysUntilExpiry(lot.expiryDate, referenceDate);
    const alertLevel = classifyExpiryStatus(lot.expiryDate, referenceDate);

    return {
      productId: lot.productId,
      productName: lot.productName,
      lotNumber: lot.lotNumber,
      expiryDate: lot.expiryDate,
      daysUntilExpiry,
      alertLevel,
    };
  });

  // 경고 수준순 정렬 (만료 → 긴급 → 주의 → 정상), 동일 수준 시 남은 일수 오름차순
  return alerts.sort((a, b) => {
    const priorityDiff = alertPriority[a.alertLevel] - alertPriority[b.alertLevel];
    if (priorityDiff !== 0) return priorityDiff;
    return a.daysUntilExpiry - b.daysUntilExpiry;
  });
}
