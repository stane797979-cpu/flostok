/**
 * ABC-XYZ-FMR 분석 서비스
 * 재고 분류 및 관리 전략 수립의 핵심 도구
 */

export type ABCGrade = "A" | "B" | "C";
export type XYZGrade = "X" | "Y" | "Z";
export type FMRGrade = "F" | "M" | "R";

export interface ABCAnalysisItem {
  id: string;
  name: string;
  /** 매출액 또는 사용량 (금액 기준 권장) */
  value: number;
}

export interface ABCAnalysisResult {
  id: string;
  name: string;
  value: number;
  /** 누적 비율 (0-1) */
  cumulativePercentage: number;
  /** ABC 등급 */
  grade: ABCGrade;
  /** 전체 내 순위 */
  rank: number;
}

/**
 * ABC 분석 수행
 *
 * 기준 (매출액/사용량 기준 누적 비율):
 * - A등급: 상위 ~80% (핵심 품목)
 * - B등급: 80~95% (중요 품목)
 * - C등급: 95~100% (일반 품목)
 *
 * @param items 분석 대상 품목 목록
 * @param thresholds 등급 경계값 { a: 0.8, b: 0.95 }
 */
export function performABCAnalysis(
  items: ABCAnalysisItem[],
  thresholds: { a: number; b: number } = { a: 0.8, b: 0.95 }
): ABCAnalysisResult[] {
  if (items.length === 0) return [];

  // 금액 기준 내림차순 정렬
  const sorted = [...items].sort((a, b) => b.value - a.value);

  // 전체 합계
  const total = sorted.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    // 모든 값이 0인 경우 균등 분배
    return sorted.map((item, index) => ({
      ...item,
      cumulativePercentage: (index + 1) / sorted.length,
      grade: "C" as ABCGrade,
      rank: index + 1,
    }));
  }

  // 누적 비율 계산 및 등급 부여
  let cumulative = 0;
  return sorted.map((item, index) => {
    cumulative += item.value;
    const cumulativePercentage = cumulative / total;

    let grade: ABCGrade;
    if (cumulativePercentage <= thresholds.a) {
      grade = "A";
    } else if (cumulativePercentage <= thresholds.b) {
      grade = "B";
    } else {
      grade = "C";
    }

    return {
      ...item,
      cumulativePercentage,
      grade,
      rank: index + 1,
    };
  });
}

export interface XYZAnalysisItem {
  id: string;
  name: string;
  /** 기간별 수요량 배열 (예: 월별 판매량) */
  demandHistory: number[];
}

export interface XYZAnalysisResult {
  id: string;
  name: string;
  /** 평균 수요 */
  averageDemand: number;
  /** 수요 표준편차 */
  stdDev: number;
  /** 변동계수 (CV = σ / μ) */
  coefficientOfVariation: number;
  /** XYZ 등급 */
  grade: XYZGrade;
}

/**
 * 평균 계산
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * 표준편차 계산 (모표준편차)
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * XYZ 분석 수행
 *
 * 기준 (변동계수 CV = 표준편차 / 평균):
 * - X등급: CV < 0.5 (수요 안정)
 * - Y등급: 0.5 ≤ CV < 1.0 (수요 변동)
 * - Z등급: CV ≥ 1.0 (수요 불안정)
 *
 * @param items 분석 대상 품목 목록
 * @param thresholds 등급 경계값 { x: 0.5, y: 1.0 }
 */
export function performXYZAnalysis(
  items: XYZAnalysisItem[],
  thresholds: { x: number; y: number } = { x: 0.5, y: 1.0 }
): XYZAnalysisResult[] {
  return items.map((item) => {
    const mean = calculateMean(item.demandHistory);
    const stdDev = calculateStdDev(item.demandHistory, mean);

    // 평균이 0인 경우 (수요 없음) → Z등급
    const cv = mean > 0 ? stdDev / mean : Infinity;

    let grade: XYZGrade;
    if (cv < thresholds.x) {
      grade = "X";
    } else if (cv < thresholds.y) {
      grade = "Y";
    } else {
      grade = "Z";
    }

    return {
      id: item.id,
      name: item.name,
      averageDemand: mean,
      stdDev,
      coefficientOfVariation: cv === Infinity ? 999 : Math.round(cv * 100) / 100,
      grade,
    };
  });
}

export interface ABCXYZMatrixItem {
  id: string;
  name: string;
  abcGrade: ABCGrade;
  xyzGrade: XYZGrade;
  /** 복합 등급 (예: "AX", "BY", "CZ") */
  combinedGrade: string;
  /** 관리 우선순위 (1-9, 1이 최고) */
  priority: number;
  /** 권장 관리 전략 */
  strategy: string;
}

/**
 * ABC-XYZ 매트릭스 기반 관리 전략
 */
const MANAGEMENT_STRATEGIES: Record<string, { priority: number; strategy: string }> = {
  AX: { priority: 1, strategy: "JIT 공급, 자동 발주, 높은 서비스레벨 유지" },
  AY: { priority: 2, strategy: "정기 발주, 수요예측 정교화, 안전재고 확보" },
  AZ: { priority: 3, strategy: "수요예측 개선, 공급자 협력, 높은 안전재고" },
  BX: { priority: 4, strategy: "정기 발주, 적정 재고 유지" },
  BY: { priority: 5, strategy: "주기적 검토, 표준 안전재고" },
  BZ: { priority: 6, strategy: "수요패턴 분석, 발주 주기 조정" },
  CX: { priority: 7, strategy: "대량 발주, 낮은 발주빈도" },
  CY: { priority: 8, strategy: "간헐적 검토, 최소 재고 유지" },
  CZ: { priority: 9, strategy: "주문생산 검토, 재고 최소화 또는 폐기" },
};

/**
 * ABC-XYZ 복합 분석 수행
 *
 * @param abcResults ABC 분석 결과
 * @param xyzResults XYZ 분석 결과
 */
export function combineABCXYZ(
  abcResults: ABCAnalysisResult[],
  xyzResults: XYZAnalysisResult[]
): ABCXYZMatrixItem[] {
  const xyzMap = new Map(xyzResults.map((r) => [r.id, r]));

  return abcResults
    .map((abc) => {
      const xyz = xyzMap.get(abc.id);
      if (!xyz) return null;

      const combinedGrade = `${abc.grade}${xyz.grade}`;
      const strategyInfo = MANAGEMENT_STRATEGIES[combinedGrade] || {
        priority: 9,
        strategy: "관리 전략 미정의",
      };

      return {
        id: abc.id,
        name: abc.name,
        abcGrade: abc.grade,
        xyzGrade: xyz.grade,
        combinedGrade,
        priority: strategyInfo.priority,
        strategy: strategyInfo.strategy,
      };
    })
    .filter((item): item is ABCXYZMatrixItem => item !== null);
}

/**
 * 품목별 ABC-XYZ 등급 간편 조회
 */
export function getABCXYZGrade(
  value: number,
  totalValue: number,
  cumulativeValueBefore: number,
  demandHistory: number[],
  thresholds?: {
    abc?: { a: number; b: number };
    xyz?: { x: number; y: number };
  }
): { abc: ABCGrade; xyz: XYZGrade; combined: string } {
  const abcThresholds = thresholds?.abc || { a: 0.8, b: 0.95 };
  const xyzThresholds = thresholds?.xyz || { x: 0.5, y: 1.0 };

  // ABC 등급
  const cumulativePercentage = (cumulativeValueBefore + value) / totalValue;
  let abc: ABCGrade;
  if (cumulativePercentage <= abcThresholds.a) {
    abc = "A";
  } else if (cumulativePercentage <= abcThresholds.b) {
    abc = "B";
  } else {
    abc = "C";
  }

  // XYZ 등급
  const mean = calculateMean(demandHistory);
  const stdDev = calculateStdDev(demandHistory, mean);
  const cv = mean > 0 ? stdDev / mean : Infinity;

  let xyz: XYZGrade;
  if (cv < xyzThresholds.x) {
    xyz = "X";
  } else if (cv < xyzThresholds.y) {
    xyz = "Y";
  } else {
    xyz = "Z";
  }

  return { abc, xyz, combined: `${abc}${xyz}` };
}

// ── FMR 분석 (이동빈도 기반) ────────────────────────────────

export interface FMRAnalysisItem {
  id: string;
  name: string;
  /** 월별 출고 횟수 배열 (건수, 금액 아님) */
  monthlyOutboundCounts: number[];
}

export interface FMRAnalysisResult {
  id: string;
  name: string;
  /** 월평균 출고 횟수 */
  avgMonthlyOutboundCount: number;
  /** FMR 등급 */
  grade: FMRGrade;
}

/**
 * FMR 분석 수행
 *
 * 기준 (월평균 출고 횟수):
 * - F (Fast Moving): 월 10회 이상 출고
 * - M (Medium Moving): 월 4~9회 출고
 * - R (Rare Moving): 월 3회 이하 출고
 *
 * @param items 분석 대상 품목 목록 (월별 출고 횟수)
 * @param thresholds 등급 경계값 { f: 10, m: 4 }
 */
export function performFMRAnalysis(
  items: FMRAnalysisItem[],
  thresholds: { f: number; m: number } = { f: 10, m: 4 }
): FMRAnalysisResult[] {
  return items.map((item) => {
    const avg = calculateMean(item.monthlyOutboundCounts);

    let grade: FMRGrade;
    if (avg >= thresholds.f) {
      grade = "F";
    } else if (avg >= thresholds.m) {
      grade = "M";
    } else {
      grade = "R";
    }

    return {
      id: item.id,
      name: item.name,
      avgMonthlyOutboundCount: Math.round(avg * 10) / 10,
      grade,
    };
  });
}
