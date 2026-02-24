/**
 * 발주 시뮬레이션 서비스
 *
 * 몬테카를로 시뮬레이션을 통해 발주 의사결정의 영향을 사전 평가합니다.
 * 수요를 정규분포로 샘플링하여 확률적 재고 추이, 품절 확률, 비용 영향을 산출합니다.
 *
 * 주요 기능:
 * 1. 단일 발주 시뮬레이션 (30일 재고 추이)
 * 2. 다중 시나리오 비교 (기준 vs 대안)
 *
 * @module order-simulation
 */

import {
  safeDivide,
  safeNumber,
  ensurePositive,
} from "@/lib/utils/safe-math";

// ─── 상수 정의 ─────────────────────────────────────────────

/** 몬테카를로 시뮬레이션 반복 횟수 */
const MONTE_CARLO_ITERATIONS = 100;
/** 시뮬레이션 대상 기간 (일) */
const SIMULATION_DAYS = 30;
/** 기본 연간 재고유지비율 (25%) */
const DEFAULT_HOLDING_COST_RATE = 0.25;
/** 일수 → 연간 변환 계수 */
const DAYS_PER_YEAR = 365;

// ─── 타입 정의 ─────────────────────────────────────────────

/** 발주 시뮬레이션 입력 */
export interface OrderSimulationInput {
  /** 현재 재고 수량 */
  currentStock: number;
  /** 발주 수량 (0이면 미발주 시나리오) */
  orderQuantity: number;
  /** 일평균 수요 (개/일) */
  dailyDemand: number;
  /** 일별 수요 표준편차 */
  demandStdDev: number;
  /** 리드타임 (일) - 발주 후 입고까지 소요일 */
  leadTimeDays: number;
  /** 단가 (원) */
  unitCost: number;
  /** 연간 재고유지비율 (기본 0.25 = 25%) */
  holdingCostRate?: number;
  /** 1회 발주비용 (원) */
  orderingCost: number;
}

/** 발주 시뮬레이션 결과 */
export interface OrderSimulationResult {
  /** 일별 예상 재고 추이 (30일, 중앙값 기준) */
  projectedStock: number[];
  /** 보유비용 변화 (원, 발주 시 vs 미발주 시 차이) */
  holdingCostChange: number;
  /** 품절 확률 (%, 30일 내 재고 0 이하 도달 확률) */
  stockoutProbability: number;
  /** 현금흐름 영향 (원, 발주금액 + 추가 보유비용) */
  cashFlowImpact: number;
  /** 품절까지 남은 일수 (발주 안 할 경우, 평균 수요 기준) */
  daysUntilStockout: number;
  /** 재고 커버 일수 (발주 시, 평균 수요 기준) */
  daysOfStockCovered: number;
  /** 시뮬레이션 통계 */
  statistics: {
    /** 시뮬레이션 반복 횟수 */
    iterations: number;
    /** 기간 (일) */
    days: number;
    /** 일평균 수요 사용값 */
    dailyDemand: number;
    /** 수요 표준편차 사용값 */
    demandStdDev: number;
  };
}

/** 시나리오 비교 결과 */
export interface ScenarioComparisonResult {
  /** 기준 시나리오 결과 */
  baseline: OrderSimulationResult & { label: string };
  /** 대안 시나리오별 결과 */
  scenarios: (OrderSimulationResult & {
    label: string;
    /** 기준 대비 품절 확률 변화 (%p) */
    stockoutDelta: number;
    /** 기준 대비 보유비용 변화 (원) */
    holdingCostDelta: number;
    /** 기준 대비 현금흐름 변화 (원) */
    cashFlowDelta: number;
  })[];
}

// ─── 내부 유틸리티 ─────────────────────────────────────────

/**
 * Box-Muller 변환으로 표준정규분포 난수 생성
 *
 * Math.random()의 균일분포를 정규분포로 변환합니다.
 *
 * @returns 표준정규분포 난수 (평균 0, 표준편차 1)
 */
function boxMullerRandom(): number {
  let u1 = 0;
  let u2 = 0;
  // 0이 아닌 값을 보장
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();

  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * 정규분포에서 수요 샘플링
 * 수요는 음수가 될 수 없으므로 0 하한 적용
 *
 * @param mean - 평균 수요
 * @param stdDev - 수요 표준편차
 * @returns 샘플링된 일일 수요 (>= 0)
 */
function sampleDemand(mean: number, stdDev: number): number {
  if (stdDev <= 0) return Math.max(0, mean);
  const sample = mean + stdDev * boxMullerRandom();
  return Math.max(0, sample);
}

/**
 * 단일 몬테카를로 시행 실행
 *
 * 30일간 일별 수요를 확률적으로 샘플링하여 재고 추이를 시뮬레이션합니다.
 * 리드타임 경과 후 발주 수량이 입고됩니다.
 *
 * @param input - 시뮬레이션 입력
 * @returns 일별 재고 추이 배열 (SIMULATION_DAYS 길이)
 */
function runSingleTrial(input: OrderSimulationInput): number[] {
  const stocks: number[] = new Array(SIMULATION_DAYS).fill(0);
  let stock = safeNumber(input.currentStock);
  const leadTime = Math.round(ensurePositive(input.leadTimeDays, 0));
  const orderQty = safeNumber(input.orderQuantity);
  const demand = ensurePositive(input.dailyDemand, 0);
  const stdDev = safeNumber(input.demandStdDev);

  for (let day = 0; day < SIMULATION_DAYS; day++) {
    // 리드타임 경과 후 입고
    if (orderQty > 0 && day === leadTime) {
      stock += orderQty;
    }

    // 수요 차감 (확률적)
    const dailyDemand = sampleDemand(demand, stdDev);
    stock -= dailyDemand;

    // 재고는 음수 가능 (미충족 수요 = 품절 표시)
    stocks[day] = stock;
  }

  return stocks;
}

// ─── 핵심 함수 ─────────────────────────────────────────────

/**
 * 발주 시뮬레이션 실행
 *
 * 몬테카를로 시뮬레이션(100회)을 통해 발주 의사결정의 영향을 평가합니다.
 * 수요를 정규분포로 샘플링하여 확률적 재고 추이를 산출합니다.
 *
 * 시뮬레이션 로직:
 * 1. 100회 반복, 각 회차마다 30일간 일별 수요를 정규분포에서 샘플링
 * 2. 리드타임 경과 후 발주 수량 입고
 * 3. 일별 재고의 중앙값으로 대표 추이 산출
 * 4. 100회 중 품절(재고 <= 0) 발생 비율로 품절 확률 계산
 *
 * @param input - 시뮬레이션 입력 (현재고, 발주량, 수요, 리드타임, 비용)
 * @returns OrderSimulationResult (재고 추이, 비용 영향, 품절 확률 등)
 *
 * @example
 * ```ts
 * const result = simulateOrder({
 *   currentStock: 500,
 *   orderQuantity: 300,
 *   dailyDemand: 20,
 *   demandStdDev: 5,
 *   leadTimeDays: 7,
 *   unitCost: 10000,
 *   orderingCost: 50000,
 * });
 * console.log(`품절 확률: ${result.stockoutProbability}%`);
 * console.log(`현금흐름 영향: ${result.cashFlowImpact}원`);
 * ```
 */
export function simulateOrder(
  input: OrderSimulationInput
): OrderSimulationResult {
  // 입력값 정규화
  const dailyDemand = ensurePositive(input.dailyDemand, 0);
  const demandStdDev = safeNumber(input.demandStdDev);
  const currentStock = safeNumber(input.currentStock);
  const orderQuantity = safeNumber(input.orderQuantity);
  const unitCost = ensurePositive(input.unitCost, 0);
  const holdingCostRate = safeNumber(
    input.holdingCostRate,
    DEFAULT_HOLDING_COST_RATE
  );
  const orderingCost = safeNumber(input.orderingCost);

  // 몬테카를로 시뮬레이션 (MONTE_CARLO_ITERATIONS회)
  const allTrials: number[][] = [];
  let stockoutCount = 0;

  for (let iter = 0; iter < MONTE_CARLO_ITERATIONS; iter++) {
    const trial = runSingleTrial(input);
    allTrials.push(trial);

    // 30일 내 품절 발생 여부 (재고 <= 0인 날이 하나라도 있으면)
    const hasStockout = trial.some((stock) => stock <= 0);
    if (hasStockout) {
      stockoutCount++;
    }
  }

  // 일별 재고 중앙값 계산 (대표 추이)
  const projectedStock: number[] = new Array(SIMULATION_DAYS).fill(0);
  for (let day = 0; day < SIMULATION_DAYS; day++) {
    const dayValues = allTrials.map((trial) => trial[day]).sort((a, b) => a - b);
    const mid = Math.floor(dayValues.length / 2);
    // 중앙값
    const median =
      dayValues.length % 2 === 0
        ? (dayValues[mid - 1] + dayValues[mid]) / 2
        : dayValues[mid];
    projectedStock[day] = Math.round(median);
  }

  // 품절 확률 (%)
  const stockoutProbability = Math.round(
    safeDivide(stockoutCount, MONTE_CARLO_ITERATIONS) * 100 * 10
  ) / 10;

  // 보유비용 변화 (원)
  // 미발주 시 평균 재고: currentStock - dailyDemand * days/2 (근사)
  const avgStockWithoutOrder = Math.max(
    0,
    currentStock - dailyDemand * (SIMULATION_DAYS / 2)
  );
  // 발주 시 평균 재고: 시뮬레이션 결과의 평균
  const avgStockWithOrder = safeDivide(
    projectedStock.reduce((sum, s) => sum + Math.max(0, s), 0),
    SIMULATION_DAYS
  );
  const dailyHoldingCostRate = safeDivide(holdingCostRate, DAYS_PER_YEAR);
  const holdingCostWithoutOrder = Math.round(
    avgStockWithoutOrder * unitCost * dailyHoldingCostRate * SIMULATION_DAYS
  );
  const holdingCostWithOrder = Math.round(
    avgStockWithOrder * unitCost * dailyHoldingCostRate * SIMULATION_DAYS
  );
  const holdingCostChange = holdingCostWithOrder - holdingCostWithoutOrder;

  // 현금흐름 영향 (원) = 발주금액 + 발주비 + 추가 보유비용
  const purchaseAmount = orderQuantity * unitCost;
  const cashFlowImpact = Math.round(
    purchaseAmount + orderingCost + holdingCostChange
  );

  // 품절까지 남은 일수 (발주 안 할 경우, 평균 수요 기준)
  const daysUntilStockout =
    dailyDemand > 0
      ? Math.max(0, Math.floor(safeDivide(currentStock, dailyDemand)))
      : Infinity;

  // 재고 커버 일수 (발주 시, 평균 수요 기준)
  const totalStockAfterOrder = currentStock + orderQuantity;
  const daysOfStockCovered =
    dailyDemand > 0
      ? Math.max(0, Math.floor(safeDivide(totalStockAfterOrder, dailyDemand)))
      : Infinity;

  return {
    projectedStock,
    holdingCostChange,
    stockoutProbability,
    cashFlowImpact,
    daysUntilStockout: Number.isFinite(daysUntilStockout)
      ? daysUntilStockout
      : -1,
    daysOfStockCovered: Number.isFinite(daysOfStockCovered)
      ? daysOfStockCovered
      : -1,
    statistics: {
      iterations: MONTE_CARLO_ITERATIONS,
      days: SIMULATION_DAYS,
      dailyDemand,
      demandStdDev,
    },
  };
}

/**
 * 다중 시나리오 비교
 *
 * 기준 시나리오(baseline)와 여러 대안 시나리오를 동시에 시뮬레이션하고,
 * 각 대안의 기준 대비 차이(delta)를 계산합니다.
 *
 * 용도: 발주량을 EOQ, MOQ, 사용자 지정 등 다양한 값으로 설정하여
 *       어떤 옵션이 최적인지 비교 의사결정에 활용합니다.
 *
 * @param baseline - 기준 시나리오 입력 (미발주 또는 현재 계획)
 * @param scenarios - 대안 시나리오 입력 배열
 * @returns ScenarioComparisonResult (기준 + 각 대안 결과 및 delta)
 *
 * @example
 * ```ts
 * const base = { currentStock: 500, orderQuantity: 0, ... };
 * const alt1 = { ...base, orderQuantity: 200 };
 * const alt2 = { ...base, orderQuantity: 500 };
 * const comparison = compareScenarios(base, [alt1, alt2]);
 * comparison.scenarios.forEach(s => {
 *   console.log(`${s.label}: 품절 ${s.stockoutProbability}%, 비용 ${s.cashFlowImpact}원`);
 * });
 * ```
 */
export function compareScenarios(
  baseline: OrderSimulationInput,
  scenarios: OrderSimulationInput[]
): ScenarioComparisonResult {
  // 기준 시나리오 실행
  const baselineResult = simulateOrder(baseline);
  const baselineLabeled = {
    ...baselineResult,
    label: baseline.orderQuantity === 0
      ? "미발주 (현상 유지)"
      : `기준 (${baseline.orderQuantity.toLocaleString()}개 발주)`,
  };

  // 대안 시나리오 실행 및 delta 계산
  const scenarioResults = scenarios.map((scenario, index) => {
    const result = simulateOrder(scenario);
    return {
      ...result,
      label: `시나리오 ${index + 1} (${scenario.orderQuantity.toLocaleString()}개 발주)`,
      stockoutDelta: Math.round(
        (result.stockoutProbability - baselineResult.stockoutProbability) * 10
      ) / 10,
      holdingCostDelta: result.holdingCostChange - baselineResult.holdingCostChange,
      cashFlowDelta: result.cashFlowImpact - baselineResult.cashFlowImpact,
    };
  });

  return {
    baseline: baselineLabeled,
    scenarios: scenarioResults,
  };
}
