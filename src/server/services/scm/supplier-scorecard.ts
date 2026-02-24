/**
 * 공급자 성과 평가(Supplier Scorecard) 서비스
 * 납기 준수율, 품질(불량률), 리드타임, 가격 경쟁력을 종합 평가
 *
 * 평가 가중치 (100점 만점):
 * - 납기 준수율: 40점 (가장 중요 — 생산/판매 일정 직결)
 * - 품질(불량률): 30점 (불량 시 반품/재작업 비용 발생)
 * - 리드타임: 20점 (안전재고 수준에 영향)
 * - 가격 경쟁력: 10점 (원가 절감 기여)
 *
 * @see SCM 도메인 규칙 - 5.1 공급자 평가 지표
 */

import { safeNumber } from "@/lib/utils/safe-math";

// ─── 상수 ───────────────────────────────────────────────────

/** 평가 가중치 (합계 100) */
const WEIGHTS = {
  ON_TIME_DELIVERY: 40,
  QUALITY: 30,
  LEAD_TIME: 20,
  PRICE: 10,
} as const;

/** 등급 기준 점수 */
const GRADE_THRESHOLDS = {
  A: 90, // 우수
  B: 75, // 양호
  C: 60, // 보통
  // D: 60 미만 (미달)
} as const;

/** 리드타임 정규화 기준 최대값 (일) */
const MAX_LEAD_TIME_DAYS = 60;

/** 가격 인덱스 최적 범위 — 1.0이 시장 평균, 낮을수록 좋음 */
const PRICE_INDEX_BEST = 0.8;  // 시장가의 80%
const PRICE_INDEX_WORST = 1.3; // 시장가의 130%

// ─── 타입 정의 ──────────────────────────────────────────────

/** 공급자 등급 */
export type SupplierGrade = "A" | "B" | "C" | "D";

/** 공급자 성과 평가표 */
export interface SupplierScorecard {
  /** 공급자 ID */
  supplierId: string;
  /** 공급자명 */
  supplierName: string;
  /** 납기 준수율 (%, 0-100) */
  onTimeDeliveryRate: number;
  /** 불량률 (%, 0-100) */
  defectRate: number;
  /** 평균 리드타임 (일) */
  averageLeadTime: number;
  /** 가격 경쟁력 지수 (1.0 = 시장 평균, 낮을수록 좋음) */
  priceCompetitiveness: number;
  /** 종합 점수 (0-100) */
  overallScore: number;
  /** 등급 */
  grade: SupplierGrade;
}

/** 공급자 평가 입력 지표 */
export interface SupplierMetrics {
  /** 납기 준수율 (%, 0-100) */
  onTimeRate: number;
  /** 불량률 (%, 0-100) */
  defectRate: number;
  /** 평균 리드타임 (일) */
  avgLeadTime: number;
  /** 가격 인덱스 (1.0 = 시장 평균) */
  priceIndex: number;
}

/** 세부 점수 내역 */
export interface ScoreBreakdown {
  /** 납기 준수 점수 (0-40) */
  onTimeScore: number;
  /** 품질 점수 (0-30) */
  qualityScore: number;
  /** 리드타임 점수 (0-20) */
  leadTimeScore: number;
  /** 가격 점수 (0-10) */
  priceScore: number;
  /** 종합 점수 (0-100) */
  totalScore: number;
}

/** 공급자 보고서 */
export interface SupplierReport {
  /** 한국어 요약 문자열 */
  summary: string;
  /** 개선 제안 목록 */
  improvements: string[];
  /** 강점 목록 */
  strengths: string[];
  /** 세부 점수 */
  breakdown: ScoreBreakdown;
}

// ─── 핵심 함수 ──────────────────────────────────────────────

/**
 * 공급자 종합 점수를 계산합니다.
 *
 * 각 지표를 0-1로 정규화한 뒤 가중합을 구합니다.
 *
 * | 지표       | 가중치 | 정규화 방법                              |
 * |-----------|--------|------------------------------------------|
 * | 납기준수율 | 40%    | onTimeRate / 100                         |
 * | 품질       | 30%    | (100 - defectRate) / 100                 |
 * | 리드타임   | 20%    | 1 - (avgLeadTime / MAX_LEAD_TIME)        |
 * | 가격       | 10%    | (WORST - priceIndex) / (WORST - BEST)    |
 *
 * @param metrics - 평가 지표 입력
 * @returns 세부 점수 내역
 *
 * @example
 * ```ts
 * const score = calculateSupplierScore({
 *   onTimeRate: 95,     // 95% 정시 납품
 *   defectRate: 1.5,    // 1.5% 불량
 *   avgLeadTime: 7,     // 평균 7일
 *   priceIndex: 0.95,   // 시장가의 95%
 * });
 * // totalScore: 약 88점
 * ```
 */
export function calculateSupplierScore(metrics: SupplierMetrics): ScoreBreakdown {
  const onTimeRate = Math.max(0, Math.min(100, safeNumber(metrics.onTimeRate, 0)));
  const defectRate = Math.max(0, Math.min(100, safeNumber(metrics.defectRate, 0)));
  const avgLeadTime = Math.max(0, safeNumber(metrics.avgLeadTime, 0));
  const priceIndex = Math.max(0, safeNumber(metrics.priceIndex, 1));

  // 납기 준수 점수: 비율 그대로 정규화 (100% → 40점)
  const onTimeNormalized = onTimeRate / 100;
  const onTimeScore =
    Math.round(onTimeNormalized * WEIGHTS.ON_TIME_DELIVERY * 10) / 10;

  // 품질 점수: 불량률이 낮을수록 높은 점수 (0% → 30점)
  const qualityNormalized = (100 - defectRate) / 100;
  const qualityScore =
    Math.round(qualityNormalized * WEIGHTS.QUALITY * 10) / 10;

  // 리드타임 점수: 짧을수록 높은 점수 (0일 → 20점)
  const ltClamped = Math.min(avgLeadTime, MAX_LEAD_TIME_DAYS);
  const ltNormalized = 1 - ltClamped / MAX_LEAD_TIME_DAYS;
  const leadTimeScore =
    Math.round(ltNormalized * WEIGHTS.LEAD_TIME * 10) / 10;

  // 가격 점수: 시장가 대비 저렴할수록 높은 점수
  const priceRange = PRICE_INDEX_WORST - PRICE_INDEX_BEST;
  const priceClamped = Math.max(PRICE_INDEX_BEST, Math.min(PRICE_INDEX_WORST, priceIndex));
  const priceNormalized = (PRICE_INDEX_WORST - priceClamped) / priceRange;
  const priceScore =
    Math.round(priceNormalized * WEIGHTS.PRICE * 10) / 10;

  const totalScore = Math.round((onTimeScore + qualityScore + leadTimeScore + priceScore) * 10) / 10;

  return {
    onTimeScore,
    qualityScore,
    leadTimeScore,
    priceScore,
    totalScore: Math.min(100, totalScore),
  };
}

/**
 * 종합 점수에 따른 등급을 부여합니다.
 *
 * | 등급 | 점수 범위 | 의미   |
 * |------|----------|--------|
 * | A    | 90-100   | 우수   |
 * | B    | 75-89    | 양호   |
 * | C    | 60-74    | 보통   |
 * | D    | 0-59     | 미달   |
 *
 * @param score - 종합 점수 (0-100)
 * @returns 등급
 */
export function gradeSupplier(score: number): SupplierGrade {
  const safeScore = safeNumber(score, 0);

  if (safeScore >= GRADE_THRESHOLDS.A) return "A";
  if (safeScore >= GRADE_THRESHOLDS.B) return "B";
  if (safeScore >= GRADE_THRESHOLDS.C) return "C";
  return "D";
}

/**
 * 공급자 성과 보고서를 생성합니다.
 *
 * 종합 점수, 등급, 강점, 개선 제안을 한국어로 작성합니다.
 *
 * @param scorecard - 공급자 성과 평가표
 * @returns 한국어 보고서 (요약 + 강점 + 개선제안 + 세부점수)
 *
 * @example
 * ```ts
 * const report = generateSupplierReport(scorecard);
 * // report.summary: "[A등급] 한국물류(주) — 종합 92.5점. 우수 협력사."
 * // report.strengths: ["납기 준수율 98.0% — 매우 우수"]
 * // report.improvements: ["평균 리드타임 14일 — 10일 이내 단축 목표 협의 권장"]
 * ```
 */
export function generateSupplierReport(scorecard: SupplierScorecard): SupplierReport {
  const breakdown = calculateSupplierScore({
    onTimeRate: scorecard.onTimeDeliveryRate,
    defectRate: scorecard.defectRate,
    avgLeadTime: scorecard.averageLeadTime,
    priceIndex: scorecard.priceCompetitiveness,
  });

  const gradeLabels: Record<SupplierGrade, string> = {
    A: "우수 협력사",
    B: "양호 협력사",
    C: "보통 협력사",
    D: "개선 필요 협력사",
  };

  const summary = `[${scorecard.grade}등급] ${scorecard.supplierName} — 종합 ${scorecard.overallScore}점. ${gradeLabels[scorecard.grade]}.`;

  const strengths: string[] = [];
  const improvements: string[] = [];

  // 납기 분석
  if (scorecard.onTimeDeliveryRate >= 95) {
    strengths.push(
      `납기 준수율 ${scorecard.onTimeDeliveryRate.toFixed(1)}% — 매우 우수`
    );
  } else if (scorecard.onTimeDeliveryRate >= 80) {
    improvements.push(
      `납기 준수율 ${scorecard.onTimeDeliveryRate.toFixed(1)}% — 95% 이상 달성 목표 필요`
    );
  } else {
    improvements.push(
      `납기 준수율 ${scorecard.onTimeDeliveryRate.toFixed(1)}% — 심각. 납기 관리 체계 점검 및 대체 공급자 확보 권장`
    );
  }

  // 품질 분석
  if (scorecard.defectRate <= 1) {
    strengths.push(
      `불량률 ${scorecard.defectRate.toFixed(1)}% — 우수 품질`
    );
  } else if (scorecard.defectRate <= 3) {
    improvements.push(
      `불량률 ${scorecard.defectRate.toFixed(1)}% — 1% 이하 달성 목표 설정 권장`
    );
  } else {
    improvements.push(
      `불량률 ${scorecard.defectRate.toFixed(1)}% — 품질 개선 시급. 입고 검수 강화 및 품질 회의 요청`
    );
  }

  // 리드타임 분석
  if (scorecard.averageLeadTime <= 7) {
    strengths.push(
      `평균 리드타임 ${scorecard.averageLeadTime}일 — 신속 납품`
    );
  } else if (scorecard.averageLeadTime <= 14) {
    // 보통 범위 — 특별히 언급하지 않음
  } else {
    improvements.push(
      `평균 리드타임 ${scorecard.averageLeadTime}일 — 10일 이내 단축 목표 협의 권장`
    );
  }

  // 가격 분석
  if (scorecard.priceCompetitiveness <= 0.9) {
    strengths.push(
      `가격 경쟁력 지수 ${scorecard.priceCompetitiveness.toFixed(2)} — 시장가 대비 우수`
    );
  } else if (scorecard.priceCompetitiveness >= 1.1) {
    improvements.push(
      `가격 경쟁력 지수 ${scorecard.priceCompetitiveness.toFixed(2)} — 시장가 대비 고가. 단가 재협상 검토`
    );
  }

  // 개선 제안이 없으면 유지 메시지
  if (improvements.length === 0) {
    improvements.push("현재 수준 유지. 장기 파트너십 강화 검토.");
  }

  return {
    summary,
    improvements,
    strengths,
    breakdown,
  };
}

/**
 * 여러 공급자를 종합 점수순으로 정렬하여 랭킹을 매깁니다.
 *
 * @param scorecards - 공급자 성과 평가표 목록
 * @returns 점수 내림차순 정렬된 목록 (높은 점수 = 1위)
 */
export function rankSuppliers(
  scorecards: SupplierScorecard[]
): (SupplierScorecard & { rank: number })[] {
  const sorted = [...scorecards].sort((a, b) => b.overallScore - a.overallScore);

  return sorted.map((card, index) => ({
    ...card,
    rank: index + 1,
  }));
}

/**
 * 평가 지표로부터 완전한 SupplierScorecard를 생성합니다.
 *
 * @param supplierId - 공급자 ID
 * @param supplierName - 공급자명
 * @param metrics - 평가 지표
 * @returns 종합 점수와 등급이 포함된 성과 평가표
 */
export function buildScorecard(
  supplierId: string,
  supplierName: string,
  metrics: SupplierMetrics
): SupplierScorecard {
  const breakdown = calculateSupplierScore(metrics);
  const grade = gradeSupplier(breakdown.totalScore);

  return {
    supplierId,
    supplierName,
    onTimeDeliveryRate: safeNumber(metrics.onTimeRate, 0),
    defectRate: safeNumber(metrics.defectRate, 0),
    averageLeadTime: safeNumber(metrics.avgLeadTime, 0),
    priceCompetitiveness: safeNumber(metrics.priceIndex, 1),
    overallScore: breakdown.totalScore,
    grade,
  };
}
