/**
 * 단순지수평활 (Simple Exponential Smoothing, SES)
 *
 * 공식: F(t+1) = α × D(t) + (1-α) × F(t)
 *
 * 특징:
 * - 최근 데이터에 더 높은 가중치
 * - α (평활 계수) 자동 최적화
 * - 지수적으로 감소하는 가중치
 *
 * 적합:
 * - 안정~중간 변동 수요 (X, Y등급)
 * - 추세 없는 데이터
 */

import { ForecastResult, ForecastMethodType } from "../types";
import { calculateMAPE } from "../accuracy/metrics";

/**
 * 단순지수평활 계산
 *
 * @param history 판매 이력
 * @param periods 예측 기간 수
 * @param alpha 평활 계수 (0 < α < 1)
 * @returns 예측 결과
 */
export function simpleExponentialSmoothing(
  history: number[],
  periods: number,
  alpha: number = 0.3
): ForecastResult {
  if (history.length === 0) {
    return {
      method: "SES" as ForecastMethodType,
      parameters: { alpha },
      forecast: Array(periods).fill(0),
    };
  }

  // α 범위 검증 (0 < α < 1)
  const validAlpha = Math.max(0.1, Math.min(0.9, alpha));

  // 초기값: 첫 번째 실제값
  let smoothed = history[0];

  // 평활화 진행 (전체 이력에 대해)
  for (let i = 1; i < history.length; i++) {
    smoothed = validAlpha * history[i] + (1 - validAlpha) * smoothed;
  }

  // 예측: SES는 상수 예측 (마지막 평활값 반복)
  const forecast = Array(periods).fill(Math.round(smoothed * 100) / 100);

  return {
    method: "SES" as ForecastMethodType,
    parameters: {
      alpha: validAlpha,
      lastSmoothed: smoothed,
    },
    forecast,
  };
}

/**
 * CV(변동계수) 기반 α 기본값 결정
 * CV = σ/평균 (MAD 기반 σ = 1.25 × MAD)
 *
 * CV < 0.2  → 안정적 수요 → α 높게 (0.6) : 최근값 빠르게 반영
 * CV 0.2~0.5 → 보통 수요  → α 중간 (0.4)
 * CV > 0.5  → 불규칙 수요 → α 낮게 (0.2) : 노이즈 흡수, 안정 유지
 */
export function getAlphaByCV(history: number[]): number {
  if (history.length < 2) return 0.3;
  const mean = history.reduce((s, v) => s + v, 0) / history.length;
  if (mean === 0) return 0.3;
  const mad = history.reduce((s, v) => s + Math.abs(v - mean), 0) / history.length;
  const cv = (1.25 * mad) / mean;
  if (cv < 0.2) return 0.6;
  if (cv <= 0.5) return 0.4;
  return 0.2;
}

/**
 * Alpha 자동 최적화
 * Grid Search로 MAPE 최소화하는 α 값 탐색
 *
 * @param history 판매 이력
 * @param testSize 테스트 셋 크기 (기본: 3)
 * @returns 최적 alpha 값
 */
export function optimizeAlpha(history: number[], testSize: number = 3): number {
  if (history.length < testSize + 3) {
    // 데이터 부족 시 CV 기반 동적 기본값
    return getAlphaByCV(history);
  }

  const alphaRange = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  let bestAlpha = 0.3;
  let bestMAPE = Infinity;

  // 훈련/테스트 분할
  const trainData = history.slice(0, -testSize);
  const testData = history.slice(-testSize);

  for (const alpha of alphaRange) {
    // 훈련 데이터로 평활화
    let smoothed = trainData[0];
    for (let i = 1; i < trainData.length; i++) {
      smoothed = alpha * trainData[i] + (1 - alpha) * smoothed;
    }

    // 테스트 데이터에 대한 예측 (상수)
    const predictions = Array(testSize).fill(smoothed);

    // MAPE 계산
    const mape = calculateMAPE(testData, predictions);

    if (isFinite(mape) && mape < bestMAPE) {
      bestMAPE = mape;
      bestAlpha = alpha;
    }
  }

  return bestAlpha;
}

/**
 * XYZ 등급에 따른 기본 Alpha 값 추천
 *
 * @param xyzGrade XYZ 등급
 * @returns 권장 alpha 값
 */
export function getDefaultAlpha(xyzGrade?: "X" | "Y" | "Z", history?: number[]): number {
  // XYZ 등급 있으면 등급 우선 (CV 기반과 동일 방향)
  switch (xyzGrade) {
    case "X": // 안정 수요 (CV<0.2) → α 높게
      return 0.6;
    case "Y": // 보통 수요 (CV 0.2~0.5) → α 중간
      return 0.4;
    case "Z": // 불규칙 수요 (CV>0.5) → α 낮게
      return 0.2;
    default:
      // 등급 없으면 실제 데이터로 CV 계산
      return history ? getAlphaByCV(history) : 0.4;
  }
}

/**
 * SES 방법 객체 (자동 최적화)
 */
export const sesMethod = {
  name: "SES" as ForecastMethodType,
  minDataPoints: 3, // 최소 3개 데이터 필요
  forecast: (history: number[], periods: number) => {
    // Alpha 자동 최적화
    const alpha = optimizeAlpha(history);
    return simpleExponentialSmoothing(history, periods, alpha);
  },
};

/**
 * SES 방법 객체 (XYZ 등급 기반)
 */
export function sesMethodWithGrade(xyzGrade?: "X" | "Y" | "Z") {
  return {
    name: "SES" as ForecastMethodType,
    minDataPoints: 3,
    forecast: (history: number[], periods: number) => {
      const alpha = getDefaultAlpha(xyzGrade);
      return simpleExponentialSmoothing(history, periods, alpha);
    },
  };
}
