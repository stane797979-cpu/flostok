/**
 * 수요예측 서비스 - 메인 진입점
 *
 * 주요 기능:
 * 1. 단일 제품 수요예측
 * 2. 자동 방법 선택
 * 3. 정확도 측정
 */

import { ForecastInput, ForecastResult, ForecastMethodType, TimeSeriesDataPoint } from "./types";
import { selectBestMethod } from "./selector";
import { simpleMovingAverage } from "./methods/simple-moving-average";
import { simpleExponentialSmoothing } from "./methods/exponential-smoothing";
import { holtsMethod } from "./methods/holts-method";
import { calculateAllMetrics } from "./accuracy/metrics";
import type { XYZGrade } from "../abc-xyz-analysis";

/**
 * 수요예측 실행 (자동 방법 선택)
 *
 * @param input 예측 입력 데이터
 * @returns 예측 결과
 */
export function forecastDemand(input: ForecastInput): ForecastResult {
  // 자동 방법 선택 및 예측
  return selectBestMethod(input);
}

/**
 * 수요예측 실행 (수동 방법 지정)
 *
 * @param history 판매 이력
 * @param periods 예측 기간
 * @param method 예측 방법
 * @param params 방법별 파라미터
 * @returns 예측 결과
 */
export function forecastDemandWithMethod(
  history: number[],
  periods: number,
  method: ForecastMethodType,
  params?: Record<string, number>
): ForecastResult {
  switch (method) {
    case "SMA":
      return simpleMovingAverage(history, periods, params?.windowSize || undefined);

    case "SES":
      return simpleExponentialSmoothing(history, periods, params?.alpha || undefined);

    case "Holts":
      return holtsMethod(history, periods, params?.alpha || undefined, params?.beta || undefined);

    default:
      // 기본: SMA
      return simpleMovingAverage(history, periods);
  }
}

/**
 * 판매 이력 데이터 전처리
 * 월별 집계 및 정렬
 *
 * @param salesHistory 판매 이력 (날짜, 수량)
 * @returns 월별 집계된 데이터
 */
export function preprocessSalesHistory(salesHistory: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
  if (salesHistory.length === 0) return [];

  // 날짜순 정렬
  const sorted = [...salesHistory].sort((a, b) => a.date.getTime() - b.date.getTime());

  // 월별 그룹핑
  const monthlyMap = new Map<string, number>();

  for (const point of sorted) {
    const monthKey = `${point.date.getFullYear()}-${String(point.date.getMonth() + 1).padStart(2, "0")}`;

    const current = monthlyMap.get(monthKey) || 0;
    monthlyMap.set(monthKey, current + point.value);
  }

  // 시간순으로 변환
  const monthlyData: TimeSeriesDataPoint[] = [];
  const sortedKeys = Array.from(monthlyMap.keys()).sort();

  for (const key of sortedKeys) {
    const [year, month] = key.split("-").map(Number);
    monthlyData.push({
      date: new Date(year, month - 1, 1),
      value: monthlyMap.get(key) || 0,
    });
  }

  return monthlyData;
}

/**
 * 수요예측 정확도 백테스팅
 * 과거 데이터로 예측 성능 평가
 *
 * @param history 전체 판매 이력
 * @param forecastPeriods 예측 기간
 * @param method 예측 방법 (선택)
 * @returns 정확도 메트릭
 */
export function backtestForecast(
  history: number[],
  forecastPeriods: number = 3,
  method?: ForecastMethodType
): {
  mape: number;
  mae: number;
  rmse: number;
  confidence: "high" | "medium" | "low";
} {
  if (history.length < forecastPeriods + 3) {
    return { mape: 999, mae: 999, rmse: 999, confidence: "low" };
  }

  // 훈련/테스트 분할
  const trainData = history.slice(0, -forecastPeriods);
  const testData = history.slice(-forecastPeriods);

  // 예측 실행
  let result: ForecastResult;
  if (method) {
    result = forecastDemandWithMethod(trainData, forecastPeriods, method);
  } else {
    result = forecastDemand({
      history: trainData.map((value, i) => ({
        date: new Date(2024, i, 1), // 더미 날짜
        value,
      })),
      periods: forecastPeriods,
    });
  }

  // 정확도 계산
  return calculateAllMetrics(testData, result.forecast);
}

/**
 * 간편 API: 숫자 배열로 예측
 *
 * @param history 판매 이력 (숫자 배열)
 * @param periods 예측 기간
 * @param xyzGrade XYZ 등급 (선택)
 * @returns 예측값 배열
 */
export function simpleForecast(
  history: number[],
  periods: number = 3,
  xyzGrade?: XYZGrade
): number[] {
  const result = forecastDemand({
    history: history.map((value, i) => ({
      date: new Date(2024, i, 1), // 더미 날짜
      value,
    })),
    periods,
    xyzGrade,
  });

  return result.forecast;
}

// Export 타입 및 서브 모듈
export * from "./types";
export * from "./accuracy/metrics";
export { simpleMovingAverage, selectOptimalWindowSize } from "./methods/simple-moving-average";
export {
  simpleExponentialSmoothing,
  optimizeAlpha,
  getDefaultAlpha,
} from "./methods/exponential-smoothing";
export { holtsMethod, optimizeHoltsParameters, detectTrend } from "./methods/holts-method";
export { selectBestMethod, selectMethodByRules } from "./selector";
