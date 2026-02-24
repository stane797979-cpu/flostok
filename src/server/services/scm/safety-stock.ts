/**
 * 안전재고 계산 서비스
 * 수요 및 리드타임 불확실성을 고려한 버퍼 재고 산정
 */

import { safeSqrt, safeNumber, ensurePositive } from "@/lib/utils/safe-math";

export interface SafetyStockInput {
  /** 일평균 판매량 */
  averageDailyDemand: number;
  /** 일평균 판매량의 표준편차 */
  demandStdDev: number;
  /** 평균 리드타임 (일) */
  leadTimeDays: number;
  /** 리드타임 표준편차 (일, 선택) */
  leadTimeStdDev?: number;
  /** 서비스 레벨 (0-1, 기본 0.95 = 95%) */
  serviceLevel?: number;
}

export interface SafetyStockResult {
  /** 안전재고 수량 */
  safetyStock: number;
  /** 사용된 서비스 레벨 */
  serviceLevel: number;
  /** 사용된 Z값 */
  zScore: number;
  /** 계산 방식 */
  method: "simplified" | "full";
}

/**
 * 서비스 레벨에 대응하는 Z값 (표준정규분포)
 */
const SERVICE_LEVEL_Z_SCORES: Record<number, number> = {
  0.9: 1.28,
  0.91: 1.34,
  0.92: 1.41,
  0.93: 1.48,
  0.94: 1.55,
  0.95: 1.65, // 가장 일반적
  0.96: 1.75,
  0.97: 1.88,
  0.98: 2.05,
  0.99: 2.33,
  0.995: 2.58,
  0.999: 3.09,
};

/**
 * 서비스 레벨에 해당하는 Z값 반환
 * 정확히 일치하는 값이 없으면 가장 가까운 값 반환
 */
export function getZScore(serviceLevel: number): number {
  // 범위 제한
  if (serviceLevel < 0.9) return 1.28;
  if (serviceLevel >= 0.999) return 3.09;

  // 정확히 일치하는 값 찾기
  const roundedLevel = Math.round(serviceLevel * 1000) / 1000;
  if (SERVICE_LEVEL_Z_SCORES[roundedLevel]) {
    return SERVICE_LEVEL_Z_SCORES[roundedLevel];
  }

  // 가장 가까운 값 찾기
  const levels = Object.keys(SERVICE_LEVEL_Z_SCORES).map(Number).sort();
  for (let i = 0; i < levels.length - 1; i++) {
    if (serviceLevel >= levels[i] && serviceLevel < levels[i + 1]) {
      // 선형 보간
      const ratio = (serviceLevel - levels[i]) / (levels[i + 1] - levels[i]);
      const z1 = SERVICE_LEVEL_Z_SCORES[levels[i]];
      const z2 = SERVICE_LEVEL_Z_SCORES[levels[i + 1]];
      return z1 + ratio * (z2 - z1);
    }
  }

  return 1.65; // 기본값 (95%)
}

/**
 * 안전재고 계산
 *
 * 공식 (전체):
 * SS = Z × sqrt(LT × σd² + d̄² × σLT²)
 *
 * 공식 (단순화, 리드타임 변동 무시):
 * SS = Z × σd × sqrt(LT)
 *
 * - Z: 서비스 레벨에 대응하는 표준정규분포 Z값
 * - LT: 평균 리드타임 (일)
 * - σd: 일별 수요 표준편차
 * - d̄: 일평균 수요
 * - σLT: 리드타임 표준편차 (일)
 */
export function calculateSafetyStock(input: SafetyStockInput): SafetyStockResult {
  // 입력 검증 — NaN/음수 방어
  const avgDemand = ensurePositive(input.averageDailyDemand, 0);
  const demandStd = safeNumber(input.demandStdDev, 0);
  const leadTime = ensurePositive(input.leadTimeDays, 1);
  const leadTimeStd = safeNumber(input.leadTimeStdDev ?? 0, 0);
  const serviceLevel = input.serviceLevel ?? 0.95;

  // 데이터 부족 시 안전재고 0 반환 (신규 제품 등)
  if (avgDemand === 0) {
    return { safetyStock: 0, serviceLevel, zScore: 0, method: "simplified" };
  }

  const zScore = getZScore(serviceLevel);

  let safetyStock: number;
  let method: "simplified" | "full";

  if (leadTimeStd > 0) {
    // 전체 공식 (King's formula): SS = Z × √(LT × σd² + d̄² × σLT²)
    const demandVariance = leadTime * demandStd * demandStd;
    const leadTimeVariance = avgDemand * avgDemand * leadTimeStd * leadTimeStd;
    safetyStock = zScore * safeSqrt(demandVariance + leadTimeVariance);
    method = "full";
  } else {
    // 단순화 공식: SS = Z × σd × √LT
    safetyStock = zScore * demandStd * safeSqrt(leadTime);
    method = "simplified";
  }

  return {
    safetyStock: Math.ceil(safetyStock), // 올림 처리
    serviceLevel,
    zScore,
    method,
  };
}

/**
 * 기본 안전재고 계산 (간단 버전)
 * 리드타임 중 평균 수요의 특정 배수로 설정
 */
export function calculateSimpleSafetyStock(
  averageDailyDemand: number,
  leadTimeDays: number,
  safetyFactor: number = 0.5 // 리드타임 수요의 50%
): number {
  const demand = ensurePositive(averageDailyDemand, 0);
  const lt = ensurePositive(leadTimeDays, 0);
  const factor = safeNumber(safetyFactor, 0.5);

  if (demand === 0 || lt === 0) return 0;

  return Math.ceil(demand * lt * factor);
}
