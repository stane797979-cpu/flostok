/**
 * SCM 진단키트 엔진
 * 설문 응답 + DB 지표를 결합하여 카테고리별 점수/등급/개선 전략을 산출하는 순수 함수 모음.
 *
 * 점수 구조:
 *   - 재고(inventory): DB 60점 + 설문 40점 (DB 없으면 설문 100점 환산)
 *   - 물류(logistics): 설문 100점 (DB 물류비 데이터 없음)
 *   - 발주(order):    DB 60점 + 설문 40점 (DB 없으면 설문 100점 환산)
 */

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export type DiagnosticCategory = "inventory" | "logistics" | "order";
export type DiagnosticGrade = "S" | "A" | "B" | "C" | "D";

export interface InventoryAnswers {
  /** Q1: 품절/재고부족 발생 빈도 */
  stockoutFrequency: "rarely" | "monthly" | "weekly" | "always";
  /** Q2: 과잉재고(안 팔리는 제품) 비율 */
  excessRatio: "under10" | "10to30" | "30to50" | "over50";
  /** Q3: 재고 실사 주기 */
  auditFrequency: "monthly" | "quarterly" | "biannual" | "rarely";
  /** Q4: 안전재고 설정 방법 */
  safetyStockMethod: "data" | "experience" | "none";
}

export interface LogisticsAnswers {
  /** Q1: 매출 대비 물류비 비율 */
  logisticsRatio: "under5" | "5to10" | "10to15" | "over15" | "unknown";
  /** Q2: 반품·교환 발생 비율 */
  returnRate: "under2" | "2to5" | "5to10" | "over10";
  /** Q3: 약속 배송 기한 준수율 */
  deliveryOnTime: "over95" | "80to95" | "50to80" | "under50" | "unknown";
  /** Q4: 주문 처리 오류 빈도 */
  orderErrorFreq: "rarely" | "monthly" | "weekly" | "daily";
  /** Q5: 운용 중인 공급업체 수 */
  supplierCount: "one" | "two_three" | "four_five" | "over_six";
}

export interface OrderAnswers {
  /** Q1: 공급업체 납기 준수율 */
  leadTimeCompliance: "over95" | "80to95" | "50to80" | "often_late";
  /** Q2: 긴급발주 발생 빈도 */
  urgentOrderFreq: "rarely" | "monthly" | "weekly" | "always";
  /** Q3: 공급업체별 리드타임 인지도 */
  leadTimeAwareness: "exact" | "approximate" | "unknown";
  /** Q4: 발주 시점 파악 방법 */
  orderTrigger: "system" | "manual" | "reactive";
}

export interface DiagnosticAnswers {
  selectedCategories: DiagnosticCategory[];
  inventory?: InventoryAnswers;
  logistics?: LogisticsAnswers;
  order?: OrderAnswers;
}

export interface DiagnosticMetricItem {
  key: string;
  label: string;
  value: number | string;
  unit: string;
  benchmark: string;
  status: "good" | "warning" | "danger";
}

export interface CategoryDiagnosticResult {
  category: DiagnosticCategory;
  categoryLabel: string;
  score: number;
  grade: DiagnosticGrade;
  gradeLabel: string;
  dbMetrics: DiagnosticMetricItem[];
  strengths: string[];
  weaknesses: string[];
  topAction: string;
}

export interface OptimizationStrategy {
  title: string;
  description: string;
  expectedEffect: string;
  timeframe: string;
  priority: "urgent" | "high" | "medium";
  relatedCategories: DiagnosticCategory[];
}

export interface ProcessImprovement {
  step: number;
  title: string;
  description: string;
  owner: string;
  deadline: string;
}

export interface DiagnosticResult {
  categories: CategoryDiagnosticResult[];
  overallScore: number;
  overallGrade: DiagnosticGrade;
  overallGradeLabel: string;
  optimizationStrategies: OptimizationStrategy[];
  processImprovements: ProcessImprovement[];
  summaryMessage: string;
  diagnosedAt: string;
}

// ─────────────────────────────────────────────
// DB 지표 입력 타입 (actions에서 전달)
// ─────────────────────────────────────────────

export interface InventoryDbMetrics {
  /** 재고회전율 (회/년) */
  inventoryTurnoverRate: number;
  /** 품절률 (%) */
  stockoutRate: number;
  /** 과잉재고 비율: (excess + overstock 수) / 전체 재고 수 × 100 (%) */
  excessStockRatio: number;
}

export interface OrderDbMetrics {
  /** 적시발주율 (%) */
  onTimeOrderRate: number;
  /** 발주충족률 (%) */
  orderFulfillmentRate: number;
  /** 평균 리드타임 (일) */
  averageLeadTime: number;
}

// ─────────────────────────────────────────────
// 물류 업계 벤치마크 상수
// ─────────────────────────────────────────────

export const LOGISTICS_BENCHMARKS = {
  logisticsRatio: "매출의 5~8%",
  returnRate: "2% 미만",
  deliveryOnTime: "95% 이상",
  orderErrorFreq: "월 1회 미만",
  supplierCount: "2~3개 (이중화)",
} as const;

// ─────────────────────────────────────────────
// 점수 → 등급 변환
// ─────────────────────────────────────────────

/**
 * 점수를 등급과 등급 라벨로 변환합니다.
 * S(90~100) / A(75~89) / B(55~74) / C(35~54) / D(0~34)
 */
export function scoreToGrade(score: number): {
  grade: DiagnosticGrade;
  label: string;
} {
  if (score >= 90) return { grade: "S", label: "업계 최우수" };
  if (score >= 75) return { grade: "A", label: "우수" };
  if (score >= 55) return { grade: "B", label: "양호" };
  if (score >= 35) return { grade: "C", label: "보통" };
  return { grade: "D", label: "개선 필요" };
}

// ─────────────────────────────────────────────
// 재고 진단
// ─────────────────────────────────────────────

/**
 * 재고 카테고리 진단 점수를 산출합니다.
 *
 * DB 지표(60점) + 설문(40점) 구조.
 * DB 데이터가 전부 0인 경우 설문 점수만으로 100점 환산.
 */
export function scoreInventoryDiagnosis(
  dbMetrics: InventoryDbMetrics,
  answers: InventoryAnswers
): CategoryDiagnosticResult {
  // ── DB 점수 산출 (60점 만점) ──────────────────

  // 재고회전율 (20점)
  let turnoverScore = 0;
  const turnover = dbMetrics.inventoryTurnoverRate;
  if (turnover >= 12) turnoverScore = 20;
  else if (turnover >= 8) turnoverScore = 16;
  else if (turnover >= 4) turnoverScore = 10;
  else if (turnover > 0) turnoverScore = 4;

  // 품절률 (20점): 값이 낮을수록 좋음
  let stockoutScore = 0;
  const stockout = dbMetrics.stockoutRate;
  if (stockout <= 1) stockoutScore = 20;
  else if (stockout <= 3) stockoutScore = 14;
  else if (stockout <= 7) stockoutScore = 8;
  else stockoutScore = 2;

  // 과잉재고비율 (20점): 값이 낮을수록 좋음
  let excessScore = 0;
  const excess = dbMetrics.excessStockRatio;
  if (excess <= 5) excessScore = 20;
  else if (excess <= 15) excessScore = 14;
  else if (excess <= 30) excessScore = 8;
  else excessScore = 4;

  const dbTotalScore = turnoverScore + stockoutScore + excessScore; // 최대 60점

  // DB 데이터 존재 여부 확인 (모든 값이 0이면 데이터 없음으로 판단)
  const hasDbData =
    dbMetrics.inventoryTurnoverRate > 0 ||
    dbMetrics.stockoutRate > 0 ||
    dbMetrics.excessStockRatio > 0;

  // ── 설문 점수 산출 (40점 만점) ────────────────

  // Q1: 품절 발생 빈도 (10점)
  const stockoutFreqScore: Record<InventoryAnswers["stockoutFrequency"], number> =
    { rarely: 10, monthly: 7, weekly: 3, always: 0 };

  // Q2: 과잉재고 인식 비율 (10점)
  const excessRatioScore: Record<InventoryAnswers["excessRatio"], number> =
    { under10: 10, "10to30": 6, "30to50": 3, over50: 0 };

  // Q3: 실사 주기 (10점)
  const auditFreqScore: Record<InventoryAnswers["auditFrequency"], number> =
    { monthly: 10, quarterly: 7, biannual: 4, rarely: 1 };

  // Q4: 안전재고 산출 방식 (10점)
  const safetyStockScore: Record<InventoryAnswers["safetyStockMethod"], number> =
    { data: 10, experience: 5, none: 0 };

  const surveyTotalScore =
    stockoutFreqScore[answers.stockoutFrequency] +
    excessRatioScore[answers.excessRatio] +
    auditFreqScore[answers.auditFrequency] +
    safetyStockScore[answers.safetyStockMethod]; // 최대 40점

  // ── 최종 점수 합산 ────────────────────────────
  let finalScore: number;
  if (hasDbData) {
    // DB + 설문 혼합: 100점 만점
    finalScore = Math.round(dbTotalScore + surveyTotalScore);
  } else {
    // DB 데이터 없음: 설문 40점을 100점 환산
    finalScore = Math.round((surveyTotalScore / 40) * 100);
  }

  const { grade, label: gradeLabel } = scoreToGrade(finalScore);

  // ── DB 지표 항목 구성 (데이터 있을 때만) ──────

  const dbMetricItems: DiagnosticMetricItem[] = hasDbData
    ? [
        {
          key: "inventoryTurnoverRate",
          label: "재고회전율",
          value: turnover,
          unit: "회/년",
          benchmark: "8회 이상",
          status: turnover >= 8 ? "good" : turnover >= 4 ? "warning" : "danger",
        },
        {
          key: "stockoutRate",
          label: "품절률",
          value: stockout,
          unit: "%",
          benchmark: "3% 미만",
          status: stockout <= 1 ? "good" : stockout <= 3 ? "warning" : "danger",
        },
        {
          key: "excessStockRatio",
          label: "과잉재고 비율",
          value: excess,
          unit: "%",
          benchmark: "15% 미만",
          status: excess <= 5 ? "good" : excess <= 15 ? "warning" : "danger",
        },
      ]
    : [];

  // ── 강점 / 약점 / 핵심 액션 ───────────────────

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // DB 기반 평가
  if (hasDbData) {
    if (turnoverScore >= 16)
      strengths.push("재고회전율이 업계 기준 이상으로 우수합니다");
    else
      weaknesses.push("재고회전율이 낮아 재고 체류 비용이 증가하고 있습니다");

    if (stockoutScore >= 14)
      strengths.push("품절 발생률이 낮아 안정적인 재고 수준을 유지하고 있습니다");
    else
      weaknesses.push("잦은 품절로 판매 기회를 놓치고 있습니다");

    if (excessScore >= 14)
      strengths.push("과잉재고 비율이 낮아 재고 효율성이 높습니다");
    else
      weaknesses.push("과잉재고 비율이 높아 보관 비용과 폐기 리스크가 존재합니다");
  }

  // 설문 기반 평가
  if (auditFreqScore[answers.auditFrequency] >= 7)
    strengths.push("정기적인 재고 실사로 재고 정확도를 관리하고 있습니다");
  else
    weaknesses.push("실사 주기가 길어 재고 정확도 오차가 누적될 수 있습니다");

  if (safetyStockScore[answers.safetyStockMethod] >= 5)
    strengths.push("데이터 기반 안전재고 설정으로 과학적 재고 관리를 하고 있습니다");
  else
    weaknesses.push("안전재고가 감에 의존하거나 미설정 상태로 리스크에 노출되어 있습니다");

  // 핵심 액션 결정 (가장 낮은 점수 항목 기준)
  let topAction: string;
  if (weaknesses.length === 0) {
    topAction = "현재 수준을 유지하면서 ABC-XYZ 차등 관리로 효율을 더 높이세요";
  } else if (
    hasDbData &&
    excessScore < stockoutScore &&
    excessScore < turnoverScore
  ) {
    topAction = "과잉재고 SKU를 식별하여 할인 판매 또는 반품 처리로 재고를 신속히 축소하세요";
  } else if (answers.safetyStockMethod === "none") {
    topAction = "서비스레벨 95% 기준 안전재고 공식을 즉시 도입하여 품절과 과잉을 동시에 방지하세요";
  } else {
    topAction = "월 1회 순환 실사를 도입하여 재고 정확도를 98% 이상으로 끌어올리세요";
  }

  return {
    category: "inventory",
    categoryLabel: "재고 관리",
    score: finalScore,
    grade,
    gradeLabel,
    dbMetrics: dbMetricItems,
    strengths,
    weaknesses,
    topAction,
  };
}

// ─────────────────────────────────────────────
// 물류 진단
// ─────────────────────────────────────────────

/**
 * 물류 카테고리 진단 점수를 산출합니다.
 *
 * 순수 설문 100점 구조 (DB 물류비 데이터 없음).
 * Q1(25) + Q2(25) + Q3(20) + Q4(20) + Q5(10)
 */
export function scoreLogisticsDiagnosis(
  answers: LogisticsAnswers
): CategoryDiagnosticResult {
  // Q1: 물류비 비율 (25점)
  const logisticsRatioScore: Record<LogisticsAnswers["logisticsRatio"], number> =
    { under5: 25, "5to10": 18, "10to15": 10, over15: 3, unknown: 5 };

  // Q2: 반품율 (25점)
  const returnRateScore: Record<LogisticsAnswers["returnRate"], number> =
    { under2: 25, "2to5": 17, "5to10": 8, over10: 2 };

  // Q3: 배송 정시율 (20점)
  const deliveryOnTimeScore: Record<LogisticsAnswers["deliveryOnTime"], number> =
    { over95: 20, "80to95": 13, "50to80": 6, under50: 1, unknown: 5 };

  // Q4: 주문 오류 빈도 (20점)
  const orderErrorScore: Record<LogisticsAnswers["orderErrorFreq"], number> =
    { rarely: 20, monthly: 13, weekly: 5, daily: 0 };

  // Q5: 공급자 다변화 (10점) — 집중 리스크 최소화 관점
  const supplierCountScore: Record<LogisticsAnswers["supplierCount"], number> =
    { one: 2, two_three: 10, four_five: 7, over_six: 5 };

  const finalScore = Math.round(
    logisticsRatioScore[answers.logisticsRatio] +
      returnRateScore[answers.returnRate] +
      deliveryOnTimeScore[answers.deliveryOnTime] +
      orderErrorScore[answers.orderErrorFreq] +
      supplierCountScore[answers.supplierCount]
  );

  const { grade, label: gradeLabel } = scoreToGrade(finalScore);

  // ── 강점 / 약점 / 핵심 액션 ───────────────────

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (logisticsRatioScore[answers.logisticsRatio] >= 18)
    strengths.push("물류비 비율이 업계 기준(5~8%) 이내로 효율적으로 관리되고 있습니다");
  else if (answers.logisticsRatio !== "unknown")
    weaknesses.push("물류비 비율이 높아 원가 경쟁력을 저하시키고 있습니다");

  if (returnRateScore[answers.returnRate] >= 17)
    strengths.push("반품율이 낮아 출고 품질이 우수합니다");
  else
    weaknesses.push("반품율이 높아 재작업 비용과 고객 불만이 증가하고 있습니다");

  if (deliveryOnTimeScore[answers.deliveryOnTime] >= 13)
    strengths.push("배송 정시율이 높아 고객 신뢰도가 확보되어 있습니다");
  else if (answers.deliveryOnTime !== "unknown")
    weaknesses.push("배송 정시율이 낮아 고객 이탈 위험이 있습니다");

  if (orderErrorScore[answers.orderErrorFreq] >= 13)
    strengths.push("주문 처리 오류가 거의 없어 운영 신뢰성이 높습니다");
  else
    weaknesses.push("주문 오류가 잦아 재처리 비용과 고객 불만이 발생하고 있습니다");

  if (supplierCountScore[answers.supplierCount] >= 7)
    strengths.push("공급자가 적절히 다변화되어 공급 리스크가 분산되어 있습니다");
  else if (answers.supplierCount === "one")
    weaknesses.push("공급자가 1개사에 집중되어 공급 중단 리스크가 매우 높습니다");

  // 핵심 액션
  let topAction: string;
  if (weaknesses.length === 0) {
    topAction = "현재 물류 운영 수준을 유지하면서 자동화 도입으로 추가 비용 절감을 추구하세요";
  } else if (returnRateScore[answers.returnRate] < 8) {
    topAction = "반품 원인을 유형별로 분류하고, 출고 전 검수 프로세스를 즉시 강화하세요";
  } else if (orderErrorScore[answers.orderErrorFreq] < 5) {
    topAction = "바코드 스캔 또는 피킹 리스트 자동화를 도입하여 주문 오류를 즉시 줄이세요";
  } else if (answers.logisticsRatio === "over15") {
    topAction = "운송비·보관비·처리비 비중을 분석하여 가장 큰 항목부터 집중 절감하세요";
  } else {
    topAction = "공급자를 2~3개사로 이중화하여 공급 리스크를 분산하세요";
  }

  return {
    category: "logistics",
    categoryLabel: "물류 운영",
    score: finalScore,
    grade,
    gradeLabel,
    dbMetrics: [], // DB 물류비 데이터 없음
    strengths,
    weaknesses,
    topAction,
  };
}

// ─────────────────────────────────────────────
// 발주 진단
// ─────────────────────────────────────────────

/**
 * 발주 카테고리 진단 점수를 산출합니다.
 *
 * DB 지표(60점) + 설문(40점) 구조.
 * DB 데이터가 전부 0인 경우 설문 점수만으로 100점 환산.
 */
export function scoreOrderDiagnosis(
  dbMetrics: OrderDbMetrics,
  answers: OrderAnswers
): CategoryDiagnosticResult {
  // ── DB 점수 산출 (60점 만점) ──────────────────

  // 납기준수율 (25점)
  let onTimeScore = 0;
  const onTimeRate = dbMetrics.onTimeOrderRate;
  if (onTimeRate >= 95) onTimeScore = 25;
  else if (onTimeRate >= 85) onTimeScore = 18;
  else if (onTimeRate >= 70) onTimeScore = 10;
  else if (onTimeRate > 0) onTimeScore = 3;

  // 발주충족률 (20점)
  let fulfillmentScore = 0;
  const fulfillmentRate = dbMetrics.orderFulfillmentRate;
  if (fulfillmentRate >= 98) fulfillmentScore = 20;
  else if (fulfillmentRate >= 90) fulfillmentScore = 14;
  else if (fulfillmentRate >= 80) fulfillmentScore = 8;
  else if (fulfillmentRate > 0) fulfillmentScore = 2;

  // 평균 리드타임 (15점): 값이 낮을수록 좋음
  let leadTimeScore = 0;
  const leadTime = dbMetrics.averageLeadTime;
  if (leadTime > 0 && leadTime <= 5) leadTimeScore = 15;
  else if (leadTime <= 10) leadTimeScore = 10;
  else if (leadTime <= 14) leadTimeScore = 6;
  else if (leadTime > 14) leadTimeScore = 2;

  const dbTotalScore = onTimeScore + fulfillmentScore + leadTimeScore; // 최대 60점

  // DB 데이터 존재 여부 확인
  const hasDbData =
    dbMetrics.onTimeOrderRate > 0 ||
    dbMetrics.orderFulfillmentRate > 0 ||
    dbMetrics.averageLeadTime > 0;

  // ── 설문 점수 산출 (40점 만점) ────────────────

  // Q1: 납기 준수율 인식 (10점)
  const leadTimeComplianceScore: Record<OrderAnswers["leadTimeCompliance"], number> =
    { over95: 10, "80to95": 7, "50to80": 3, often_late: 0 };

  // Q2: 긴급 발주 빈도 (10점)
  const urgentOrderScore: Record<OrderAnswers["urgentOrderFreq"], number> =
    { rarely: 10, monthly: 7, weekly: 3, always: 0 };

  // Q3: 리드타임 인지도 (10점)
  const leadTimeAwarenessScore: Record<OrderAnswers["leadTimeAwareness"], number> =
    { exact: 10, approximate: 5, unknown: 0 };

  // Q4: 발주 트리거 방식 (10점)
  const orderTriggerScore: Record<OrderAnswers["orderTrigger"], number> =
    { system: 10, manual: 5, reactive: 0 };

  const surveyTotalScore =
    leadTimeComplianceScore[answers.leadTimeCompliance] +
    urgentOrderScore[answers.urgentOrderFreq] +
    leadTimeAwarenessScore[answers.leadTimeAwareness] +
    orderTriggerScore[answers.orderTrigger]; // 최대 40점

  // ── 최종 점수 합산 ────────────────────────────
  let finalScore: number;
  if (hasDbData) {
    finalScore = Math.round(dbTotalScore + surveyTotalScore);
  } else {
    // DB 없음: 설문 40점을 100점 환산
    finalScore = Math.round((surveyTotalScore / 40) * 100);
  }

  const { grade, label: gradeLabel } = scoreToGrade(finalScore);

  // ── DB 지표 항목 구성 (데이터 있을 때만) ──────

  const dbMetricItems: DiagnosticMetricItem[] = hasDbData
    ? [
        {
          key: "onTimeOrderRate",
          label: "납기준수율",
          value: onTimeRate,
          unit: "%",
          benchmark: "95% 이상",
          status:
            onTimeRate >= 95 ? "good" : onTimeRate >= 85 ? "warning" : "danger",
        },
        {
          key: "orderFulfillmentRate",
          label: "발주충족률",
          value: fulfillmentRate,
          unit: "%",
          benchmark: "98% 이상",
          status:
            fulfillmentRate >= 98
              ? "good"
              : fulfillmentRate >= 90
              ? "warning"
              : "danger",
        },
        {
          key: "averageLeadTime",
          label: "평균 리드타임",
          value: leadTime,
          unit: "일",
          benchmark: "5일 이하",
          status:
            leadTime <= 5 ? "good" : leadTime <= 10 ? "warning" : "danger",
        },
      ]
    : [];

  // ── 강점 / 약점 / 핵심 액션 ───────────────────

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (hasDbData) {
    if (onTimeScore >= 18)
      strengths.push("납기준수율이 높아 공급 신뢰성이 우수합니다");
    else
      weaknesses.push("납기 지연이 빈번하여 생산·판매 계획에 차질이 발생하고 있습니다");

    if (fulfillmentScore >= 14)
      strengths.push("발주충족률이 높아 재고 목표량 달성이 안정적입니다");
    else
      weaknesses.push("발주충족률이 낮아 품절 위험이 지속적으로 존재합니다");

    if (leadTimeScore >= 10)
      strengths.push("평균 리드타임이 짧아 시장 변화에 빠르게 대응할 수 있습니다");
    else
      weaknesses.push("리드타임이 길어 선행 발주 의존도가 높고 재고 부담이 큽니다");
  }

  if (urgentOrderScore[answers.urgentOrderFreq] >= 7)
    strengths.push("긴급 발주 빈도가 낮아 계획적 발주가 잘 이루어지고 있습니다");
  else
    weaknesses.push("긴급 발주가 잦아 추가 물류비와 공급자 관계 악화를 초래하고 있습니다");

  if (orderTriggerScore[answers.orderTrigger] >= 5)
    strengths.push("체계적인 발주 기준이 있어 일관된 발주 관리가 가능합니다");
  else
    weaknesses.push("재고 소진 후 반응형 발주로 운영되어 품절 리스크가 상시 존재합니다");

  // 핵심 액션
  let topAction: string;
  if (weaknesses.length === 0) {
    topAction = "현재 발주 체계를 유지하면서 EOQ 기반 발주량 최적화로 비용을 추가 절감하세요";
  } else if (answers.orderTrigger === "reactive") {
    topAction = "발주점(ROP) 기준을 즉시 설정하고, 시스템이 자동으로 발주 시점을 알리도록 구성하세요";
  } else if (urgentOrderScore[answers.urgentOrderFreq] < 3) {
    topAction = "긴급 발주 원인을 분석하고 발주 리드타임 여유분을 안전재고에 반영하세요";
  } else if (hasDbData && onTimeScore < 10) {
    topAction = "공급자별 납기준수율을 측정하고, 미달 공급자에 대한 페널티 조항을 계약에 추가하세요";
  } else {
    topAction = "공급자별 실측 리드타임 DB를 구축하여 정확한 발주점 계산에 활용하세요";
  }

  return {
    category: "order",
    categoryLabel: "발주 관리",
    score: finalScore,
    grade,
    gradeLabel,
    dbMetrics: dbMetricItems,
    strengths,
    weaknesses,
    topAction,
  };
}

// ─────────────────────────────────────────────
// 전략 풀 (카테고리별)
// ─────────────────────────────────────────────

/** 재고 관련 전략 풀 */
const INVENTORY_STRATEGIES: OptimizationStrategy[] = [
  {
    title: "과잉재고 처분 계획 수립",
    description:
      "장기 체류·저회전 SKU를 식별하여 할인 판매 또는 공급자 반품으로 재고를 신속히 처분합니다.",
    expectedEffect: "재고 보관 비용 15~25% 절감, 현금 흐름 개선",
    timeframe: "1~2개월",
    priority: "urgent",
    relatedCategories: ["inventory"],
  },
  {
    title: "ABC-XYZ 차등 재고 관리",
    description:
      "ABC(금액 기여도)와 XYZ(수요 변동성)를 교차 분류하여 A급·X급 품목은 고빈도 보충, C급 품목은 재고 수준을 축소합니다.",
    expectedEffect: "재고회전율 20~30% 향상, 품절률 감소",
    timeframe: "2~3개월",
    priority: "high",
    relatedCategories: ["inventory"],
  },
  {
    title: "안전재고 과학적 재설정",
    description:
      "서비스레벨 95% 기준 Z-score 공식(SS = Z × σ_d × √LT)을 적용하여 안전재고를 데이터 기반으로 재산정합니다.",
    expectedEffect: "품절률 50% 감소, 과잉재고 20% 축소",
    timeframe: "3~4주",
    priority: "high",
    relatedCategories: ["inventory"],
  },
  {
    title: "순환 실사 주기 강화",
    description:
      "월 1회 전수 실사 대신 ABC 등급별 순환 실사를 도입하여 재고 정확도를 98% 이상으로 유지합니다.",
    expectedEffect: "재고 정확도 98%+, 재고 차이로 인한 손실 최소화",
    timeframe: "즉시 적용 가능",
    priority: "medium",
    relatedCategories: ["inventory"],
  },
];

/** 물류 관련 전략 풀 */
const LOGISTICS_STRATEGIES: OptimizationStrategy[] = [
  {
    title: "물류비 구조 분석 및 집중 절감",
    description:
      "운송비·보관비·처리비 비중을 항목별로 분해하고, 가장 큰 비중의 항목에 집중하여 협상·자동화·경로 최적화로 절감합니다.",
    expectedEffect: "물류비 10~20% 절감, 매출 이익률 개선",
    timeframe: "2~3개월",
    priority: "urgent",
    relatedCategories: ["logistics"],
  },
  {
    title: "반품 프로세스 개선 및 예방",
    description:
      "반품 원인을 품질 불량·배송 오류·단순 변심으로 분류하고, 출고 전 2중 검수 프로세스를 도입합니다.",
    expectedEffect: "반품율 30~50% 감소, 재작업 비용 절감",
    timeframe: "1~2개월",
    priority: "high",
    relatedCategories: ["logistics"],
  },
  {
    title: "배송 정시율 개선 체계 구축",
    description:
      "공급자별 납기 준수율을 월별로 모니터링하고, 정시율 하위 20% 공급자에 대한 대체 공급선을 즉시 확보합니다.",
    expectedEffect: "배송 정시율 95% 이상 달성, 고객 만족도 향상",
    timeframe: "2~4개월",
    priority: "high",
    relatedCategories: ["logistics"],
  },
  {
    title: "주문처리 자동화 도입",
    description:
      "수기 입력 방식을 바코드 스캔·QR·자동화 시스템으로 전환하여 주문 처리 오류를 원천 차단합니다.",
    expectedEffect: "주문 오류율 70~90% 감소, 처리 속도 2배 향상",
    timeframe: "2~3개월",
    priority: "medium",
    relatedCategories: ["logistics"],
  },
];

/** 발주 관련 전략 풀 */
const ORDER_STRATEGIES: OptimizationStrategy[] = [
  {
    title: "정기 발주 체계 구축",
    description:
      "긴급 발주를 최소화하고 발주점(ROP) 기반 계획 발주 비율 80% 이상을 목표로 발주 프로세스를 표준화합니다.",
    expectedEffect: "긴급 발주 비용 30% 절감, 공급자 관계 안정화",
    timeframe: "1~2개월",
    priority: "urgent",
    relatedCategories: ["order"],
  },
  {
    title: "공급자 성과 평가 제도 도입",
    description:
      "납기준수율·품질 합격률·발주충족률을 기준으로 공급자를 A/B/C 등급으로 분류하고 인센티브·패널티를 차등 적용합니다.",
    expectedEffect: "납기준수율 85% → 95%+, 공급 품질 향상",
    timeframe: "2~3개월",
    priority: "high",
    relatedCategories: ["order"],
  },
  {
    title: "리드타임 데이터베이스 구축",
    description:
      "공급자별·품목별 실측 리드타임을 수집하여 데이터베이스로 관리하고, 이를 발주점 계산에 자동 반영합니다.",
    expectedEffect: "발주점 정확도 향상, 과잉 선행발주 20% 감소",
    timeframe: "3~4주",
    priority: "high",
    relatedCategories: ["order"],
  },
  {
    title: "EOQ 기반 발주량 최적화",
    description:
      "발주비용과 재고 유지비용의 균형점(EOQ)을 품목별로 산출하여 최적 발주량을 설정하고 총 재고 비용을 최소화합니다.",
    expectedEffect: "재고 유지 비용 15~20% 절감, 발주 횟수 최적화",
    timeframe: "2~4주",
    priority: "medium",
    relatedCategories: ["order"],
  },
];

/** 시너지 전략 (복수 카테고리 조합) */
const SYNERGY_STRATEGIES: OptimizationStrategy[] = [
  {
    title: "재고-발주 통합 최적화",
    description:
      "발주점·안전재고·EOQ를 하나의 통합 모델로 연결하여 재고 부족과 과잉을 동시에 방지하는 풀 자동화 발주 시스템을 구축합니다.",
    expectedEffect: "품절률 60% 감소, 재고 유지 비용 25% 절감",
    timeframe: "3~6개월",
    priority: "high",
    relatedCategories: ["inventory", "order"],
  },
  {
    title: "물류-발주 공급망 가시성 확보",
    description:
      "공급자 납기 데이터와 물류 배송 데이터를 통합하여 실시간 공급망 현황을 파악하고 선제적으로 리스크에 대응합니다.",
    expectedEffect: "공급망 리스크 조기 감지, 긴급 물류 비용 절감",
    timeframe: "2~4개월",
    priority: "high",
    relatedCategories: ["logistics", "order"],
  },
  {
    title: "전사 SCM 통합 대시보드 구축",
    description:
      "재고·물류·발주 KPI를 단일 대시보드에서 실시간 모니터링하여 경영진의 의사결정 속도를 높이고 부서 간 사일로를 해소합니다.",
    expectedEffect: "의사결정 시간 50% 단축, 기회 손실 최소화",
    timeframe: "4~6개월",
    priority: "medium",
    relatedCategories: ["inventory", "logistics", "order"],
  },
];

// ─────────────────────────────────────────────
// 종합 진단 결과 생성
// ─────────────────────────────────────────────

/**
 * 카테고리별 결과를 종합하여 최종 DiagnosticResult를 생성합니다.
 *
 * - overallScore = 카테고리 점수 단순 평균
 * - optimizationStrategies: 최저 점수 카테고리 우선, 3~5개 선정
 * - processImprovements: 6개 액션플랜
 */
export function generateDiagnosticResult(
  categoryResults: CategoryDiagnosticResult[],
  selectedCategories: DiagnosticCategory[]
): DiagnosticResult {
  // ── 종합 점수 ─────────────────────────────────
  const overallScore =
    categoryResults.length > 0
      ? Math.round(
          categoryResults.reduce((sum, r) => sum + r.score, 0) /
            categoryResults.length
        )
      : 0;

  const { grade: overallGrade, label: overallGradeLabel } =
    scoreToGrade(overallScore);

  // ── 점수 낮은 순 정렬 (전략 우선순위 결정용) ──
  const sortedResults = [...categoryResults].sort((a, b) => a.score - b.score);

  // ── 최적화 전략 선정 ──────────────────────────
  const strategies: OptimizationStrategy[] = [];

  // 1) 각 카테고리별 약점 기반 전략 풀에서 1~2개 선정
  for (const result of sortedResults) {
    const pool =
      result.category === "inventory"
        ? INVENTORY_STRATEGIES
        : result.category === "logistics"
        ? LOGISTICS_STRATEGIES
        : ORDER_STRATEGIES;

    if (result.score < 55) {
      // B등급 미만: 2개 전략 추가 (우선순위 높은 순)
      strategies.push(...pool.slice(0, 2));
    } else if (result.score < 75) {
      // A등급 미만: 1개 전략 추가
      strategies.push(pool[0]);
    }
    // A·S 등급: 전략 추가 생략
  }

  // 2) 시너지 전략 추가 (복수 카테고리 선택 시)
  if (selectedCategories.length >= 2) {
    const hasInventory = selectedCategories.includes("inventory");
    const hasLogistics = selectedCategories.includes("logistics");
    const hasOrder = selectedCategories.includes("order");

    if (hasInventory && hasOrder && !hasLogistics) {
      strategies.push(SYNERGY_STRATEGIES[0]); // 재고-발주 통합
    } else if (hasLogistics && hasOrder && !hasInventory) {
      strategies.push(SYNERGY_STRATEGIES[1]); // 물류-발주 가시성
    } else if (hasInventory && hasLogistics && hasOrder) {
      strategies.push(SYNERGY_STRATEGIES[2]); // 전사 통합
    }
  }

  // 3) 중복 제거 후 최대 5개로 제한
  const uniqueStrategies = Array.from(
    new Map(strategies.map((s) => [s.title, s])).values()
  ).slice(0, 5);

  // 최소 3개 보장 (전략이 부족하면 우선순위 높은 것 추가)
  if (uniqueStrategies.length < 3 && sortedResults.length > 0) {
    const fallbackPools = sortedResults.flatMap((r) =>
      r.category === "inventory"
        ? INVENTORY_STRATEGIES
        : r.category === "logistics"
        ? LOGISTICS_STRATEGIES
        : ORDER_STRATEGIES
    );
    for (const strategy of fallbackPools) {
      if (uniqueStrategies.length >= 3) break;
      if (!uniqueStrategies.find((s) => s.title === strategy.title)) {
        uniqueStrategies.push(strategy);
      }
    }
  }

  // ── 프로세스 개선 6개 액션플랜 ───────────────
  const processImprovements = buildProcessImprovements(sortedResults);

  // ── 한줄 요약 메시지 ──────────────────────────
  const summaryMessage = buildSummaryMessage(
    categoryResults,
    overallGrade,
    sortedResults
  );

  return {
    categories: categoryResults,
    overallScore,
    overallGrade,
    overallGradeLabel,
    optimizationStrategies: uniqueStrategies,
    processImprovements,
    summaryMessage,
    diagnosedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// 내부 헬퍼: 액션플랜 생성
// ─────────────────────────────────────────────

function buildProcessImprovements(
  sortedResults: CategoryDiagnosticResult[]
): ProcessImprovement[] {
  const improvements: ProcessImprovement[] = [];
  let step = 1;

  // 약점 카테고리 우선 처리 (최대 4개 카테고리 기반 액션)
  for (const result of sortedResults) {
    if (step > 4) break;

    if (result.category === "inventory") {
      improvements.push({
        step: step++,
        title: "재고 현황 전수 조사",
        description:
          "전 품목의 현재고·안전재고·발주점을 점검하고, 과잉·부족 품목 목록을 즉시 작성합니다.",
        owner: "재고 담당자",
        deadline: "진단 후 1주 이내",
      });
      if (result.score < 55 && step <= 4) {
        improvements.push({
          step: step++,
          title: "안전재고 재설정 및 발주점 갱신",
          description:
            "서비스레벨 95% 기준 안전재고 공식을 적용하여 전 품목의 발주점을 재산출하고 시스템에 반영합니다.",
          owner: "SCM 팀장",
          deadline: "진단 후 3주 이내",
        });
      }
    } else if (result.category === "logistics") {
      improvements.push({
        step: step++,
        title: "물류비 구조 분석 보고서 작성",
        description:
          "운송비·보관비·처리비·반품비를 항목별로 집계하고, 전월 대비 증감 원인을 분석합니다.",
        owner: "물류 담당자",
        deadline: "진단 후 2주 이내",
      });
      if (result.score < 55 && step <= 4) {
        improvements.push({
          step: step++,
          title: "주요 공급자 배송 성과 평가",
          description:
            "공급자별 배송 정시율·오류율을 집계하고, 하위 20% 공급자와 개선 미팅을 실시합니다.",
          owner: "구매 팀장",
          deadline: "진단 후 4주 이내",
        });
      }
    } else if (result.category === "order") {
      improvements.push({
        step: step++,
        title: "긴급 발주 원인 분석 및 재발방지 대책 수립",
        description:
          "최근 3개월 긴급 발주 건을 유형별로 분류하고, 각 원인에 대한 재발방지 조치를 문서화합니다.",
        owner: "발주 담당자",
        deadline: "진단 후 2주 이내",
      });
      if (result.score < 55 && step <= 4) {
        improvements.push({
          step: step++,
          title: "공급자별 납기준수율 집계 및 등급 부여",
          description:
            "최근 6개월 발주 이력을 기준으로 공급자별 납기준수율을 산출하고 A/B/C 등급을 부여합니다.",
          owner: "구매 팀장",
          deadline: "진단 후 3주 이내",
        });
      }
    }
  }

  // 공통 보조 액션 (부족한 슬롯 채우기)
  const commonActions = [
    {
      title: "SCM KPI 월간 리뷰 회의 정례화",
      description:
        "재고회전율·품절률·납기준수율 등 핵심 KPI를 매월 정해진 날짜에 경영진과 리뷰하는 정례 회의를 수립합니다.",
      owner: "SCM 팀장",
      deadline: "다음 달부터 시작",
    },
    {
      title: "공급자 이중화 대상 품목 선정",
      description:
        "단일 공급자 의존도가 높은 A급 품목을 식별하고, 대체 공급자 후보 리스트를 작성하여 견적 요청합니다.",
      owner: "구매 담당자",
      deadline: "진단 후 6주 이내",
    },
  ];

  let commonIdx = 0;
  while (improvements.length < 5 && commonIdx < commonActions.length) {
    const action = commonActions[commonIdx++];
    improvements.push({
      step: step++,
      title: action.title,
      description: action.description,
      owner: action.owner,
      deadline: action.deadline,
    });
  }

  // 마지막 6번째 액션: 재진단 스케줄링 (항상 포함)
  const reCheckStep: ProcessImprovement = {
    step: 6,
    title: "3개월 후 SCM 진단 재수행",
    description:
      "위 개선 조치 실행 후 3개월 뒤 동일 진단키트로 재진단하여 점수 변화를 측정하고, 추가 개선 과제를 발굴합니다.",
    owner: "SCM 팀장",
    deadline: "진단 후 3개월",
  };

  if (improvements.length < 6) {
    improvements.push(reCheckStep);
  } else {
    improvements[5] = reCheckStep;
  }

  return improvements.slice(0, 6);
}

// ─────────────────────────────────────────────
// 내부 헬퍼: 한줄 요약 메시지 생성
// ─────────────────────────────────────────────

function buildSummaryMessage(
  categoryResults: CategoryDiagnosticResult[],
  overallGrade: DiagnosticGrade,
  sortedResults: CategoryDiagnosticResult[]
): string {
  if (categoryResults.length === 0) return "진단 결과를 생성할 수 없습니다.";

  const weakest = sortedResults[0]; // 가장 낮은 점수 카테고리
  const strongest = sortedResults[sortedResults.length - 1]; // 가장 높은 점수 카테고리

  // 전체 우수
  if (overallGrade === "S" || overallGrade === "A") {
    return `전반적으로 ${overallGrade === "S" ? "업계 최우수" : "우수한"} SCM 수준을 유지하고 있으며, ${weakest.categoryLabel} 영역의 지속적인 관리로 경쟁 우위를 더욱 강화할 수 있습니다`;
  }

  // 단일 카테고리
  if (categoryResults.length === 1) {
    const r = categoryResults[0];
    if (r.grade === "D" || r.grade === "C") {
      return `${r.categoryLabel} 수준이 ${r.gradeLabel} 단계로 즉각적인 개선이 필요하며, 아래 핵심 전략을 우선 실행하세요`;
    }
    return `${r.categoryLabel} 수준이 ${r.gradeLabel} 단계로 양호하나, 지속적인 모니터링과 점진적 개선으로 우수 등급 달성을 목표하세요`;
  }

  // 복수 카테고리
  if (weakest.grade === "D" || weakest.grade === "C") {
    return `${strongest.categoryLabel}은 ${strongest.gradeLabel} 수준이나, ${weakest.categoryLabel} 분야가 ${weakest.gradeLabel} 등급으로 전체 SCM 경쟁력을 저하시키고 있어 즉각적인 개선이 시급합니다`;
  }

  return `${strongest.categoryLabel}이 강점이나 ${weakest.categoryLabel} 영역 개선을 통해 SCM 전반의 균형 잡힌 성과를 달성할 수 있습니다`;
}
