/**
 * What-If 분석 서비스
 *
 * 재고관리 파라미터(서비스 수준, 리드타임, 안전재고 등)를 변경했을 때
 * 결과 지표(비용, 품절 확률, 발주점 등)가 어떻게 변하는지 사전 분석합니다.
 *
 * 주요 기능:
 * 1. 단일 파라미터 조합에 대한 재고 지표 산출
 * 2. 민감도 분석 - 특정 파라미터를 범위 변경하며 영향도 측정
 *
 * 사용되는 SCM 공식:
 * - 안전재고 = Z * sigma_d * sqrt(LT)
 * - 발주점 = dailyDemand * LT + safetyStock
 * - EOQ = sqrt(2 * D * S / H)
 * - 총재고비용 = 보유비용 + 발주비용
 *
 * @module what-if-analysis
 */

import { safeDivide, safeSqrt, safeNumber, ensurePositive } from "@/lib/utils/safe-math";
import { getZScore } from "./safety-stock";

// ─── 상수 정의 ─────────────────────────────────────────────

/** 기본 서비스 수준 (95%) */
const DEFAULT_SERVICE_LEVEL = 0.95;
/** 기본 연간 재고유지비율 (25%) */
const DEFAULT_HOLDING_COST_RATE = 0.25;
/** 기본 1회 발주비용 (원) */
const DEFAULT_ORDERING_COST = 50000;
/** 연간 일수 */
const DAYS_PER_YEAR = 365;
/** 민감도 분석 기본 스텝 수 */
const DEFAULT_SENSITIVITY_STEPS = 10;
/** 서비스 수준 최소값 */
const SERVICE_LEVEL_MIN = 0.9;
/** 서비스 수준 최대값 */
const SERVICE_LEVEL_MAX = 0.999;

// ─── 타입 정의 ─────────────────────────────────────────────

/** What-If 분석 입력 */
export interface WhatIfInput {
  /** 현재 안전재고 수량 */
  currentSafetyStock: number;
  /** 현재 서비스 수준 (0~1, 예: 0.95 = 95%) */
  currentServiceLevel: number;
  /** 현재 리드타임 (일) */
  currentLeadTimeDays: number;
  /** 일평균 수요 (개/일) */
  dailyDemand: number;
  /** 일별 수요 표준편차 */
  demandStdDev: number;
  /** 단가 (원) */
  unitCost: number;
  /** 연간 수요량 (개/년, 미입력 시 dailyDemand * 365) */
  annualDemand?: number;
  /** 연간 재고유지비율 (기본 0.25 = 25%) */
  holdingCostRate?: number;
  /** 1회 발주비용 (원, 기본 50,000원) */
  orderingCost?: number;
}

/** What-If 분석 결과 */
export interface WhatIfResult {
  /** 안전재고 수량 */
  safetyStock: number;
  /** 발주점 수량 */
  reorderPoint: number;
  /** 연간 보유비용 (원) */
  holdingCost: number;
  /** 품절 확률 (%) */
  stockoutProbability: number;
  /** 연간 총재고비용 (원, 보유비용 + 발주비용) */
  totalInventoryCost: number;
  /** 서비스 수준 (0~1) */
  serviceLevel: number;
  /** EOQ (경제적 발주량) */
  eoq: number;
  /** 연간 발주 횟수 */
  ordersPerYear: number;
  /** 연간 발주비용 (원) */
  annualOrderingCost: number;
}

/** 민감도 분석 대상 파라미터 */
export type SensitivityParameter =
  | "serviceLevel"
  | "leadTimeDays"
  | "safetyStock";

/** 민감도 분석 범위 */
export interface SensitivityRange {
  /** 최소값 */
  min: number;
  /** 최대값 */
  max: number;
  /** 스텝 수 (기본 10) */
  steps?: number;
}

/** 민감도 분석 결과 (각 스텝별 What-If 결과 + 변경된 파라미터 값) */
export interface SensitivityResult extends WhatIfResult {
  /** 해당 스텝에서의 파라미터 값 */
  parameterValue: number;
  /** 파라미터 이름 (한국어) */
  parameterLabel: string;
}

// ─── 내부 유틸리티 ─────────────────────────────────────────

/**
 * EOQ 계산 (내부용)
 *
 * @param annualDemand - 연간 수요량
 * @param orderingCost - 1회 발주비용
 * @param holdingCostPerUnit - 단위당 연간 유지비용
 * @returns EOQ (최소 1)
 */
function calculateEOQInternal(
  annualDemand: number,
  orderingCost: number,
  holdingCostPerUnit: number
): number {
  if (annualDemand <= 0 || orderingCost <= 0 || holdingCostPerUnit <= 0) {
    return 0;
  }
  const eoq = safeSqrt(
    safeDivide(2 * annualDemand * orderingCost, holdingCostPerUnit)
  );
  return Math.max(1, Math.ceil(eoq));
}

/**
 * 파라미터 이름을 한국어 레이블로 변환
 *
 * @param param - 파라미터 키
 * @returns 한국어 레이블
 */
function getParameterLabel(param: SensitivityParameter): string {
  const labels: Record<SensitivityParameter, string> = {
    serviceLevel: "서비스 수준",
    leadTimeDays: "리드타임 (일)",
    safetyStock: "안전재고 (개)",
  };
  return labels[param];
}

// ─── 핵심 함수 ─────────────────────────────────────────────

/**
 * What-If 분석 실행
 *
 * 주어진 파라미터 조합에 대해 안전재고, 발주점, 비용, 품절 확률 등
 * 핵심 재고관리 지표를 일괄 산출합니다.
 *
 * 계산 로직:
 * 1. 서비스 수준 -> Z값 변환
 * 2. 안전재고 = Z * sigma_d * sqrt(LT)
 * 3. 발주점 = d_avg * LT + 안전재고 (CLAUDE.md 통일 공식)
 * 4. EOQ = sqrt(2 * D * S / H)
 * 5. 보유비용 = 안전재고 * 단가 * 유지비율
 * 6. 발주비용 = (연간수요 / EOQ) * 1회 발주비
 * 7. 총비용 = 보유비용 + 발주비용
 * 8. 품절확률 = (1 - 서비스수준) * 100
 *
 * @param input - What-If 입력 (서비스 수준, 리드타임, 수요, 단가 등)
 * @returns WhatIfResult (안전재고, 발주점, 비용, 품절 확률 등)
 *
 * @example
 * ```ts
 * const result = calculateWhatIf({
 *   currentSafetyStock: 100,
 *   currentServiceLevel: 0.95,
 *   currentLeadTimeDays: 7,
 *   dailyDemand: 20,
 *   demandStdDev: 5,
 *   unitCost: 10000,
 * });
 * console.log(`안전재고: ${result.safetyStock}개`);
 * console.log(`발주점: ${result.reorderPoint}개`);
 * console.log(`연간 총비용: ${result.totalInventoryCost.toLocaleString()}원`);
 * ```
 */
export function calculateWhatIf(input: WhatIfInput): WhatIfResult {
  // 입력값 정규화
  const serviceLevel = Math.max(
    SERVICE_LEVEL_MIN,
    Math.min(SERVICE_LEVEL_MAX, safeNumber(input.currentServiceLevel, DEFAULT_SERVICE_LEVEL))
  );
  const leadTimeDays = ensurePositive(input.currentLeadTimeDays, 1);
  const dailyDemand = ensurePositive(input.dailyDemand, 0);
  const demandStdDev = safeNumber(input.demandStdDev, 0);
  const unitCost = ensurePositive(input.unitCost, 0);
  const holdingCostRate = safeNumber(
    input.holdingCostRate,
    DEFAULT_HOLDING_COST_RATE
  );
  const orderingCost = safeNumber(input.orderingCost, DEFAULT_ORDERING_COST);
  const annualDemand = ensurePositive(
    input.annualDemand,
    dailyDemand * DAYS_PER_YEAR
  );

  // 1. Z값 계산
  const zScore = getZScore(serviceLevel);

  // 2. 안전재고 계산: SS = Z * sigma_d * sqrt(LT)
  const safetyStock = Math.ceil(zScore * demandStdDev * safeSqrt(leadTimeDays));

  // 3. 발주점 계산 (CLAUDE.md 통일 공식): ROP = d_avg * LT + SS
  const reorderPoint = Math.ceil(dailyDemand * leadTimeDays + safetyStock);

  // 4. 단위당 연간 유지비용
  const holdingCostPerUnit = unitCost * holdingCostRate;

  // 5. EOQ 계산
  const eoq = calculateEOQInternal(annualDemand, orderingCost, holdingCostPerUnit);

  // 6. 연간 발주 횟수
  const ordersPerYear = eoq > 0 ? safeDivide(annualDemand, eoq) : 0;

  // 7. 비용 계산
  // 보유비용: 평균 재고 * 단위당 유지비용
  //   평균 재고 = EOQ/2 + 안전재고
  const averageInventory = (eoq > 0 ? eoq / 2 : 0) + safetyStock;
  const holdingCost = Math.round(averageInventory * holdingCostPerUnit);

  // 발주비용: 연간 발주 횟수 * 1회 발주비
  const annualOrderingCost = Math.round(ordersPerYear * orderingCost);

  // 총재고비용: 보유비용 + 발주비용
  const totalInventoryCost = holdingCost + annualOrderingCost;

  // 8. 품절 확률 (%): (1 - 서비스수준) * 100
  const stockoutProbability =
    Math.round((1 - serviceLevel) * 100 * 10) / 10;

  return {
    safetyStock,
    reorderPoint,
    holdingCost,
    stockoutProbability,
    totalInventoryCost,
    serviceLevel,
    eoq,
    ordersPerYear: Math.round(ordersPerYear * 100) / 100,
    annualOrderingCost,
  };
}

/**
 * 민감도 분석 실행
 *
 * 지정된 파라미터를 min~max 범위에서 steps개 구간으로 변경하면서
 * 각 값에 대한 What-If 결과를 배열로 반환합니다.
 *
 * 용도:
 * - "서비스 수준을 90%에서 99%로 올리면 비용이 얼마나 증가하나?"
 * - "리드타임이 3일에서 14일까지 변하면 안전재고는 어떻게 달라지나?"
 * - "안전재고를 50개에서 500개까지 조절하면 품절 확률은?"
 *
 * 주의사항:
 * - serviceLevel: 0.9 ~ 0.999 범위로 자동 클램핑
 * - leadTimeDays: 최소 1일 보장
 * - safetyStock: 최소 0 보장
 *
 * @param baseInput - 기준 입력값 (변경 대상 외 파라미터의 기본값)
 * @param parameter - 변경할 파라미터 (serviceLevel | leadTimeDays | safetyStock)
 * @param range - 변경 범위 { min, max, steps }
 * @returns SensitivityResult[] (각 스텝별 결과 + 파라미터 값)
 *
 * @example
 * ```ts
 * // 서비스 수준 90~99% 민감도 분석 (10단계)
 * const results = sensitivityAnalysis(
 *   baseInput,
 *   "serviceLevel",
 *   { min: 0.9, max: 0.99, steps: 10 }
 * );
 * results.forEach(r => {
 *   console.log(
 *     `서비스 ${(r.parameterValue * 100).toFixed(1)}% → ` +
 *     `안전재고 ${r.safetyStock}개, 비용 ${r.totalInventoryCost.toLocaleString()}원`
 *   );
 * });
 * ```
 */
export function sensitivityAnalysis(
  baseInput: WhatIfInput,
  parameter: SensitivityParameter,
  range: SensitivityRange
): SensitivityResult[] {
  const steps = ensurePositive(range.steps, DEFAULT_SENSITIVITY_STEPS);
  const min = safeNumber(range.min);
  const max = safeNumber(range.max);

  // min이 max보다 크면 빈 배열 반환
  if (min > max) return [];

  const stepSize = safeDivide(max - min, steps);
  const results: SensitivityResult[] = [];
  const label = getParameterLabel(parameter);

  for (let i = 0; i <= steps; i++) {
    const paramValue = min + stepSize * i;

    // 파라미터별로 입력값 복사 후 해당 파라미터만 변경
    const modifiedInput: WhatIfInput = { ...baseInput };

    switch (parameter) {
      case "serviceLevel": {
        // 서비스 수준 범위 클램핑
        const clampedLevel = Math.max(
          SERVICE_LEVEL_MIN,
          Math.min(SERVICE_LEVEL_MAX, paramValue)
        );
        modifiedInput.currentServiceLevel = clampedLevel;
        break;
      }
      case "leadTimeDays": {
        // 리드타임 최소 1일
        modifiedInput.currentLeadTimeDays = Math.max(1, Math.round(paramValue));
        break;
      }
      case "safetyStock": {
        // 안전재고를 직접 지정하는 경우
        // 서비스 수준을 역산하지 않고, 비용만 재계산
        const directSS = Math.max(0, Math.round(paramValue));
        const directResult = calculateWhatIfWithFixedSafetyStock(
          baseInput,
          directSS
        );
        results.push({
          ...directResult,
          parameterValue: directSS,
          parameterLabel: label,
        });
        continue; // switch 밖으로
      }
    }

    // serviceLevel, leadTimeDays 변경 시 일반 계산
    // (safetyStock은 위 switch에서 continue로 이미 처리됨)
    const result = calculateWhatIf(modifiedInput);
    results.push({
      ...result,
      parameterValue:
        parameter === "serviceLevel"
          ? modifiedInput.currentServiceLevel
          : modifiedInput.currentLeadTimeDays,
      parameterLabel: label,
    });
  }

  return results;
}

/**
 * 안전재고를 직접 지정했을 때의 비용/발주점 계산
 *
 * sensitivityAnalysis에서 safetyStock 파라미터 변경 시 사용.
 * Z값으로부터 역산하지 않고, 지정된 안전재고를 기반으로 다른 지표를 산출합니다.
 *
 * @param baseInput - 기준 입력값
 * @param fixedSafetyStock - 지정 안전재고 수량
 * @returns WhatIfResult
 */
function calculateWhatIfWithFixedSafetyStock(
  baseInput: WhatIfInput,
  fixedSafetyStock: number
): WhatIfResult {
  const dailyDemand = ensurePositive(baseInput.dailyDemand, 0);
  const demandStdDev = safeNumber(baseInput.demandStdDev, 0);
  const leadTimeDays = ensurePositive(baseInput.currentLeadTimeDays, 1);
  const unitCost = ensurePositive(baseInput.unitCost, 0);
  const holdingCostRate = safeNumber(
    baseInput.holdingCostRate,
    DEFAULT_HOLDING_COST_RATE
  );
  const orderingCost = safeNumber(
    baseInput.orderingCost,
    DEFAULT_ORDERING_COST
  );
  const annualDemand = ensurePositive(
    baseInput.annualDemand,
    dailyDemand * DAYS_PER_YEAR
  );
  const safetyStock = Math.max(0, Math.round(fixedSafetyStock));

  // 발주점: d_avg * LT + SS
  const reorderPoint = Math.ceil(dailyDemand * leadTimeDays + safetyStock);

  // 서비스 수준 역산: SS = Z * sigma_d * sqrt(LT) -> Z = SS / (sigma_d * sqrt(LT))
  const denominator = demandStdDev * safeSqrt(leadTimeDays);
  const impliedZ = denominator > 0 ? safeDivide(safetyStock, denominator) : 0;
  // Z값 -> 서비스 수준 (근사: 조회 테이블 역매핑)
  const serviceLevel = zScoreToServiceLevel(impliedZ);

  // EOQ
  const holdingCostPerUnit = unitCost * holdingCostRate;
  const eoq = calculateEOQInternal(annualDemand, orderingCost, holdingCostPerUnit);

  // 비용 계산
  const ordersPerYear = eoq > 0 ? safeDivide(annualDemand, eoq) : 0;
  const averageInventory = (eoq > 0 ? eoq / 2 : 0) + safetyStock;
  const holdingCost = Math.round(averageInventory * holdingCostPerUnit);
  const annualOrderingCost = Math.round(ordersPerYear * orderingCost);
  const totalInventoryCost = holdingCost + annualOrderingCost;

  const stockoutProbability =
    Math.round((1 - serviceLevel) * 100 * 10) / 10;

  return {
    safetyStock,
    reorderPoint,
    holdingCost,
    stockoutProbability,
    totalInventoryCost,
    serviceLevel,
    eoq,
    ordersPerYear: Math.round(ordersPerYear * 100) / 100,
    annualOrderingCost,
  };
}

/**
 * Z값에서 서비스 수준으로 역변환 (근사)
 *
 * getZScore()의 역함수. 조회 테이블 기반 선형 보간 사용.
 *
 * @param zScore - Z값
 * @returns 서비스 수준 (0.9 ~ 0.999)
 */
function zScoreToServiceLevel(zScore: number): number {
  // Z값 -> 서비스 수준 매핑 테이블
  const table: [number, number][] = [
    [1.28, 0.9],
    [1.34, 0.91],
    [1.41, 0.92],
    [1.48, 0.93],
    [1.55, 0.94],
    [1.65, 0.95],
    [1.75, 0.96],
    [1.88, 0.97],
    [2.05, 0.98],
    [2.33, 0.99],
    [2.58, 0.995],
    [3.09, 0.999],
  ];

  if (zScore <= table[0][0]) return table[0][1];
  if (zScore >= table[table.length - 1][0]) return table[table.length - 1][1];

  // 선형 보간
  for (let i = 0; i < table.length - 1; i++) {
    const [z1, sl1] = table[i];
    const [z2, sl2] = table[i + 1];
    if (zScore >= z1 && zScore <= z2) {
      const ratio = safeDivide(zScore - z1, z2 - z1);
      return Math.round((sl1 + ratio * (sl2 - sl1)) * 1000) / 1000;
    }
  }

  return DEFAULT_SERVICE_LEVEL;
}
