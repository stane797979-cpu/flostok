/**
 * 가중이동평균 (Weighted Moving Average, WMA)
 *
 * 공식: WMA(t) = Σ(w_i × D(t-i)) / Σ(w_i)
 * 가중치: 최근 기간일수록 높은 가중치 (선형: n, n-1, ..., 1)
 *
 * 특징:
 * - 최근 데이터에 더 큰 비중 부여
 * - SMA 대비 추세 반응성 향상
 * - 추세/계절성 미반영이지만 최근 변화 반영
 *
 * 적합:
 * - 안정적 수요이나 최근 변화 반영 필요 시 (X/Y등급)
 * - 데이터 부족 시 (< 6개월) SES 대안
 */

import { ForecastResult, ForecastMethodType } from "../types";

/**
 * 가중이동평균 계산
 *
 * @param history 판매 이력 (수치 배열)
 * @param periods 예측 기간 수
 * @param windowSize 이동평균 윈도우 크기 (기본: 3)
 * @returns 예측 결과
 */
export function weightedMovingAverage(
  history: number[],
  periods: number,
  windowSize: number = 3
): ForecastResult {
  if (history.length === 0) {
    return {
      method: "WMA" as ForecastMethodType,
      parameters: { windowSize },
      forecast: Array(periods).fill(0),
    };
  }

  const adjustedWindowSize = Math.min(windowSize, history.length);
  const recentData = history.slice(-adjustedWindowSize);

  // 선형 가중치: 가장 오래된 데이터 = 1, 가장 최근 데이터 = n
  const weights = Array.from({ length: adjustedWindowSize }, (_, i) => i + 1);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  const wma =
    recentData.reduce((sum, value, i) => sum + value * weights[i], 0) / weightSum;

  const forecast = Array(periods).fill(Math.round(wma * 100) / 100);

  return {
    method: "WMA" as ForecastMethodType,
    parameters: {
      windowSize: adjustedWindowSize,
      wma,
    },
    forecast,
  };
}

/**
 * 데이터 기간에 따른 최적 윈도우 크기 자동 선택
 */
export function selectOptimalWindowSize(dataMonths: number): number {
  if (dataMonths < 3) return dataMonths;
  if (dataMonths < 6) return 3;
  if (dataMonths < 12) return 6;
  return 12;
}

/**
 * WMA 방법 객체 (통일된 인터페이스)
 */
export const wmaMethod = {
  name: "WMA" as ForecastMethodType,
  minDataPoints: 1,
  forecast: (history: number[], periods: number) => {
    const windowSize = selectOptimalWindowSize(history.length);
    return weightedMovingAverage(history, periods, windowSize);
  },
};
