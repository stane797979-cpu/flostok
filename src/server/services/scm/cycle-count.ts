/**
 * 재고실사(Cycle Count) 서비스
 * 순환실사 계획 생성, 분산 계산, 정확도 분석
 *
 * 재고실사는 시스템 재고와 실제 재고의 차이를 파악하여
 * 재고 정확도를 유지하는 핵심 프로세스입니다.
 *
 * @see SCM 도메인 규칙 - 10.1 KPI: 재고 정확도 >= 98%
 */

import { safeDivide, safeNumber } from "@/lib/utils/safe-math";
import type { ABCGrade } from "./abc-xyz-analysis";

// ─── 상수 ───────────────────────────────────────────────────
/** 분산율 조사 임계치 (%) — 이 비율 초과 시 원인 조사 필요 */
const VARIANCE_INVESTIGATION_THRESHOLD = 5;

/** ABC 등급별 실사 우선순위 — 낮을수록 먼저 실사 */
const ABC_PRIORITY_ORDER: Record<ABCGrade, number> = {
  A: 1,
  B: 2,
  C: 3,
};

/** ABC 등급별 권장 실사 주기 (회/년) */
const ABC_COUNT_FREQUENCY: Record<ABCGrade, number> = {
  A: 12, // 월 1회
  B: 4,  // 분기 1회
  C: 1,  // 연 1회
};

// ─── 타입 정의 ──────────────────────────────────────────────

/** 실사 세션 상태 */
export type CycleCountSessionStatus =
  | "planned"      // 계획됨
  | "in_progress"  // 진행 중
  | "completed"    // 완료
  | "cancelled";   // 취소

/** 실사 항목 상태 */
export type CycleCountItemStatus =
  | "pending"   // 대기
  | "counted"   // 실사 완료
  | "adjusted"; // 조정 완료

/** 재고실사 세션 */
export interface CycleCountSession {
  /** 세션 ID */
  id: string;
  /** 조직 ID (멀티테넌시) */
  organizationId: string;
  /** 창고 ID */
  warehouseId: string;
  /** 세션 상태 */
  status: CycleCountSessionStatus;
  /** 실사 시작일 */
  startDate: string;
  /** 실사 종료일 (예정 또는 실제) */
  endDate: string;
  /** 생성자 ID */
  createdBy: string;
}

/** 재고실사 항목 */
export interface CycleCountItem {
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
  /** 시스템 재고 수량 */
  systemStock: number;
  /** 실사 수량 (실제 카운트) */
  countedStock: number;
  /** 차이 수량 (실사 - 시스템) */
  variance: number;
  /** 차이율 (%) */
  variancePercent: number;
  /** 항목 상태 */
  status: CycleCountItemStatus;
}

/** 분산 계산 결과 */
export interface VarianceResult {
  /** 차이 수량 (양수: 실제 > 시스템, 음수: 실제 < 시스템) */
  variance: number;
  /** 차이율 (%, 절대값 기준) */
  variancePercent: number;
  /** 조사 필요 여부 (|차이율| > 5%) */
  needsInvestigation: boolean;
}

/** 실사 요약 결과 */
export interface CycleCountSummary {
  /** 총 항목 수 */
  totalItems: number;
  /** 실사 완료 항목 수 */
  countedItems: number;
  /** 재고 정확도 (%, 차이 없는 항목 비율) */
  accuracyRate: number;
  /** 총 분산 금액 (원) — 절대값 합산 */
  totalVarianceValue: number;
  /** 조사 필요 항목 수 */
  itemsNeedingInvestigation: number;
}

/** 실사 계획 생성용 제품 입력 */
export interface CycleCountPlanProduct {
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
  /** ABC 등급 */
  abcGrade: ABCGrade;
  /** 현재 시스템 재고 */
  currentStock: number;
  /** 단가 (원) — 분산 금액 산출용 */
  unitPrice?: number;
}

/** 실사 계획 방법 */
export type CycleCountMethod = "full" | "abc_priority";

/** 실사 계획 항목 (생성된 순서 포함) */
export interface CycleCountPlanItem {
  /** 실사 순서 (1부터 시작) */
  order: number;
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
  /** ABC 등급 */
  abcGrade: ABCGrade;
  /** 시스템 재고 */
  systemStock: number;
  /** 권장 실사 주기 (회/년) */
  recommendedFrequency: number;
}

// ─── 핵심 함수 ──────────────────────────────────────────────

/**
 * 시스템 재고와 실사 수량의 분산을 계산합니다.
 *
 * @param systemStock - 시스템상 재고 수량
 * @param countedStock - 실사로 확인된 실제 수량
 * @returns 분산 수량, 분산율(%), 조사 필요 여부
 *
 * @example
 * ```ts
 * const result = calculateVariance(100, 95);
 * // { variance: -5, variancePercent: 5.0, needsInvestigation: false }
 *
 * const result2 = calculateVariance(100, 88);
 * // { variance: -12, variancePercent: 12.0, needsInvestigation: true }
 * ```
 */
export function calculateVariance(
  systemStock: number,
  countedStock: number
): VarianceResult {
  const safeSystem = safeNumber(systemStock, 0);
  const safeCounted = safeNumber(countedStock, 0);

  const variance = safeCounted - safeSystem;

  // 분산율: |차이| / 시스템재고 * 100, 시스템재고 0이면 차이 있으면 100% 처리
  const variancePercent =
    safeSystem === 0 && safeCounted === 0
      ? 0
      : safeSystem === 0
        ? 100
        : Math.round(safeDivide(Math.abs(variance), safeSystem, 0) * 1000) / 10;

  const needsInvestigation = variancePercent > VARIANCE_INVESTIGATION_THRESHOLD;

  return {
    variance,
    variancePercent,
    needsInvestigation,
  };
}

/**
 * 실사 항목 목록을 요약합니다.
 *
 * 재고 정확도는 분산율이 허용 범위(5%) 이내인 항목의 비율로 산출합니다.
 * KPI 목표: 재고 정확도 >= 98%
 *
 * @param items - 실사 완료된 항목 목록
 * @param unitPrices - 제품별 단가 맵 (productId -> 단가, 원) (선택)
 * @returns 실사 요약 결과
 *
 * @example
 * ```ts
 * const summary = summarizeCycleCount(items);
 * // { totalItems: 50, countedItems: 48, accuracyRate: 96.0, ... }
 * ```
 */
export function summarizeCycleCount(
  items: CycleCountItem[],
  unitPrices?: Map<string, number>
): CycleCountSummary {
  const totalItems = items.length;

  // 실사 완료 항목 (counted 또는 adjusted)
  const countedItems = items.filter(
    (item) => item.status === "counted" || item.status === "adjusted"
  );
  const countedCount = countedItems.length;

  // 정확 항목: 분산율이 임계치 이내
  const accurateItems = countedItems.filter(
    (item) => Math.abs(item.variancePercent) <= VARIANCE_INVESTIGATION_THRESHOLD
  );

  const accuracyRate =
    Math.round(safeDivide(accurateItems.length, countedCount, 0) * 1000) / 10;

  // 조사 필요 항목
  const investigationItems = countedItems.filter(
    (item) => Math.abs(item.variancePercent) > VARIANCE_INVESTIGATION_THRESHOLD
  );

  // 총 분산 금액 (단가 정보가 있는 경우)
  let totalVarianceValue = 0;
  for (const item of countedItems) {
    const price = unitPrices?.get(item.productId) ?? 0;
    totalVarianceValue += Math.abs(item.variance) * price;
  }

  return {
    totalItems,
    countedItems: countedCount,
    accuracyRate,
    totalVarianceValue: Math.round(totalVarianceValue),
    itemsNeedingInvestigation: investigationItems.length,
  };
}

/**
 * 재고실사 계획을 생성합니다.
 *
 * - `full` 방식: 전 품목 실사 (재고가 있는 품목 우선)
 * - `abc_priority` 방식: A등급 -> B등급 -> C등급 순서로 정렬
 *   - 동일 등급 내에서는 재고 금액(현재고 x 단가) 높은 순
 *
 * @param products - 실사 대상 제품 목록
 * @param method - 실사 방법 ('full' | 'abc_priority')
 * @returns 정렬된 실사 계획 항목 목록
 *
 * @example
 * ```ts
 * const plan = generateCycleCountPlan(products, 'abc_priority');
 * // A등급 제품들이 먼저, 그 다음 B등급, C등급 순으로 정렬
 * ```
 */
export function generateCycleCountPlan(
  products: CycleCountPlanProduct[],
  method: CycleCountMethod
): CycleCountPlanItem[] {
  const sorted = [...products];

  if (method === "abc_priority") {
    // ABC 등급 우선순위 정렬 → 동일 등급 내 재고금액(현재고 x 단가) 내림차순
    sorted.sort((a, b) => {
      const priorityDiff = ABC_PRIORITY_ORDER[a.abcGrade] - ABC_PRIORITY_ORDER[b.abcGrade];
      if (priorityDiff !== 0) return priorityDiff;

      // 동일 등급: 재고 금액 높은 순 (고가 품목 먼저 실사)
      const valueA = a.currentStock * (a.unitPrice ?? 0);
      const valueB = b.currentStock * (b.unitPrice ?? 0);
      return valueB - valueA;
    });
  } else {
    // full: 재고 있는 품목 먼저, 재고 많은 순
    sorted.sort((a, b) => {
      // 재고 있는 품목 우선
      if (a.currentStock > 0 && b.currentStock === 0) return -1;
      if (a.currentStock === 0 && b.currentStock > 0) return 1;
      // 재고 많은 순
      return b.currentStock - a.currentStock;
    });
  }

  return sorted.map((product, index) => ({
    order: index + 1,
    productId: product.productId,
    productName: product.productName,
    abcGrade: product.abcGrade,
    systemStock: product.currentStock,
    recommendedFrequency: ABC_COUNT_FREQUENCY[product.abcGrade],
  }));
}

/**
 * 분산 원인 분류를 위한 참고 정보를 반환합니다.
 *
 * @param variance - 분산 수량 (양수: 실제 > 시스템, 음수: 실제 < 시스템)
 * @returns 한국어 예상 원인 목록
 */
export function getSuggestedVarianceCauses(variance: number): string[] {
  if (variance === 0) {
    return ["분산 없음 — 정상"];
  }

  if (variance > 0) {
    // 실제 재고가 시스템보다 많은 경우
    return [
      "출고 미등록 취소 건 존재 가능",
      "반품 입고 미반영",
      "타 로케이션 재고 혼입",
      "시스템 출고 중복 차감",
    ];
  }

  // 실제 재고가 시스템보다 적은 경우
  return [
    "출고 누락 (미등록 출하)",
    "파손/분실",
    "도난",
    "입고 검수 시 과잉 등록",
    "유통기한 만료 폐기 미반영",
  ];
}
