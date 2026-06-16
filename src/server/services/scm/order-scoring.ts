/**
 * 발주 우선순위 스코어링 서비스
 * 재고상태, ABC등급, 판매추세, 리드타임을 종합하여 발주 우선순위 점수 계산
 */

import type { ABCGrade } from "./abc-xyz-analysis";
import { classifyInventoryStatus, type InventoryStatusInput } from "./inventory-status";

export interface OrderScoringInput {
  /** 현재 재고 */
  currentStock: number;
  /** 안전재고 */
  safetyStock: number;
  /** 발주점 */
  reorderPoint: number;
  /** ABC 등급 */
  abcGrade: ABCGrade;
  /** 리드타임 (일) */
  leadTimeDays: number;
  /** 최근 4주 평균 판매량 */
  recentSales?: number;
  /** 이전 4주 평균 판매량 */
  previousSales?: number;
}

export interface OrderScoringResult {
  /** 총점 (0-100) */
  totalScore: number;
  /** 세부 점수 */
  breakdown: {
    /** 재고 긴급도 점수 (0-40) */
    inventoryUrgency: number;
    /** ABC 등급 점수 (0-30) */
    abcScore: number;
    /** 판매 추세 점수 (0-20) */
    salesTrend: number;
    /** 리드타임 리스크 점수 (0-10) */
    leadTimeRisk: number;
  };
  /** 우선순위 등급 */
  priorityLevel: "urgent" | "high" | "normal" | "low";
  /** 권장 조치 */
  recommendation: string;
}

/**
 * 재고 긴급도 점수 계산 (0-40점)
 *
 * 기준:
 * - 품절 (현재고 = 0): 40점
 * - 위험 (< 안전재고 × 0.5): 35점
 * - 부족 (< 안전재고): 30점
 * - 주의 (< 발주점): 20점
 * - 적정: 10점
 * - 과다/과잉: 0점
 */
function calculateInventoryUrgencyScore(input: InventoryStatusInput): number {
  const status = classifyInventoryStatus(input);

  const scoreMap: Record<string, number> = {
    out_of_stock: 40,
    critical: 35,
    shortage: 30,
    caution: 20,
    optimal: 10,
    excess: 0,
    overstock: 0,
  };

  return scoreMap[status.key] || 0;
}

/**
 * ABC 등급 점수 계산 (0-30점)
 *
 * 기준:
 * - A등급: 30점 (핵심 품목, 최우선 관리)
 * - B등급: 20점 (중요 품목)
 * - C등급: 10점 (일반 품목)
 */
function calculateABCScore(abcGrade: ABCGrade): number {
  const scoreMap: Record<ABCGrade, number> = {
    A: 30,
    B: 20,
    C: 10,
  };

  return scoreMap[abcGrade];
}

/**
 * 판매 추세 점수 계산 (0-20점)
 *
 * 기준:
 * - 증가율 = (최근 4주 평균 - 이전 4주 평균) / 이전 4주 평균
 * - 증가율이 높을수록 높은 점수
 * - 최대 +100% 증가 시 20점, 0% 시 10점, -50% 이하 시 0점
 */
function calculateSalesTrendScore(recentSales: number, previousSales: number): number {
  if (previousSales <= 0) {
    // 이전 판매 없음 → 최근 판매 있으면 중간 점수
    return recentSales > 0 ? 10 : 0;
  }

  const growthRate = (recentSales - previousSales) / previousSales;

  // 증가율을 점수로 변환 (-0.5 → 0점, 0 → 10점, 1.0 → 20점)
  const normalizedGrowth = Math.max(-0.5, Math.min(1.0, growthRate));
  const score = 10 + (normalizedGrowth * 20) / 1.5;

  return Math.round(Math.max(0, Math.min(20, score)));
}

/**
 * 리드타임 리스크 점수 계산 (0-10점)
 *
 * 기준:
 * - 리드타임이 길수록 발주 지연 시 리스크가 크므로 높은 점수
 * - 최대 30일 기준 정규화
 * - 1일: 0.3점, 7일: 2.3점, 14일: 4.7점, 30일: 10점
 */
function calculateLeadTimeRiskScore(leadTimeDays: number): number {
  const maxLeadTime = 30; // 최대 리드타임 기준
  const normalizedLeadTime = Math.min(leadTimeDays, maxLeadTime);
  const score = (normalizedLeadTime / maxLeadTime) * 10;

  return Math.round(score * 10) / 10; // 소수점 1자리
}

/**
 * 발주 우선순위 점수 계산
 *
 * 총점 범위: 0-100점
 * - 재고 긴급도: 40점
 * - ABC 등급: 30점
 * - 판매 추세: 20점
 * - 리드타임 리스크: 10점
 *
 * 우선순위 등급:
 * - urgent (긴급): 80-100점 → 즉시 발주 (금일)
 * - high (높음): 60-79점 → 우선 발주 (1-2일 내)
 * - normal (보통): 40-59점 → 정상 발주 (다음 발주일)
 * - low (낮음): 0-39점 → 보류 가능
 */
export function calculateOrderScore(input: OrderScoringInput): OrderScoringResult {
  const {
    currentStock,
    safetyStock,
    reorderPoint,
    abcGrade,
    leadTimeDays,
    recentSales = 0,
    previousSales = 0,
  } = input;

  // 세부 점수 계산
  const inventoryUrgency = calculateInventoryUrgencyScore({
    currentStock,
    safetyStock,
    reorderPoint,
  });

  const abcScore = calculateABCScore(abcGrade);

  const salesTrend = calculateSalesTrendScore(recentSales, previousSales);

  const leadTimeRisk = calculateLeadTimeRiskScore(leadTimeDays);

  // 총점
  const totalScore = inventoryUrgency + abcScore + salesTrend + leadTimeRisk;

  // 우선순위 등급 결정
  let priorityLevel: OrderScoringResult["priorityLevel"];
  let recommendation: string;

  if (totalScore >= 80) {
    priorityLevel = "urgent";
    recommendation = "즉시 발주 필요 (금일 처리)";
  } else if (totalScore >= 60) {
    priorityLevel = "high";
    recommendation = "우선 발주 권장 (1-2일 내 처리)";
  } else if (totalScore >= 40) {
    priorityLevel = "normal";
    recommendation = "정상 발주 진행 (다음 발주일)";
  } else {
    priorityLevel = "low";
    recommendation = "발주 보류 가능 (재고 충분)";
  }

  return {
    totalScore: Math.round(totalScore),
    breakdown: {
      inventoryUrgency,
      abcScore,
      salesTrend,
      leadTimeRisk,
    },
    priorityLevel,
    recommendation,
  };
}

/**
 * 여러 제품의 발주 점수를 계산하고 우선순위순으로 정렬
 */
export interface OrderScoringListItem extends OrderScoringInput {
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
}

export interface OrderScoringListResult extends OrderScoringListItem {
  /** 점수 결과 */
  scoring: OrderScoringResult;
  /** 정렬 순위 (1부터 시작) */
  rank: number;
}

/**
 * 여러 제품의 발주 우선순위 계산 및 정렬
 *
 * @param items 제품 목록
 * @returns 점수순 정렬된 목록 (높은 점수 → 낮은 점수)
 */
export function calculateOrderScoreList(
  items: OrderScoringListItem[]
): OrderScoringListResult[] {
  // 각 제품 점수 계산
  const scoredItems = items.map((item) => ({
    ...item,
    scoring: calculateOrderScore(item),
  }));

  // 총점 기준 내림차순 정렬
  const sorted = scoredItems.sort((a, b) => b.scoring.totalScore - a.scoring.totalScore);

  // 순위 부여
  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

/**
 * 우선순위 등급별 필터링
 */
export function filterByPriority(
  items: OrderScoringListResult[],
  levels: OrderScoringResult["priorityLevel"][]
): OrderScoringListResult[] {
  return items.filter((item) => levels.includes(item.scoring.priorityLevel));
}

/**
 * 긴급/우선 발주 목록만 추출
 */
export function getUrgentOrders(items: OrderScoringListResult[]): OrderScoringListResult[] {
  return filterByPriority(items, ["urgent", "high"]);
}
