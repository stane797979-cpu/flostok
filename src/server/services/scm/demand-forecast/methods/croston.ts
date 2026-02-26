/**
 * 크로스턴법 (Croston's Method)
 *
 * 간헐적 수요(intermittent demand) 전용 예측 방법.
 *
 * 알고리즘:
 * 1. 시계열을 두 하위 시계열로 분해:
 *    - 수요 크기(demand size): 0이 아닌 수요 값들
 *    - 수요 간격(inter-demand interval): 연속 비영수요 사이의 기간 수
 * 2. 각 하위 시계열에 SES(단순지수평활) 적용
 * 3. 예측값 = smoothedDemandSize / smoothedInterval
 *
 * 특징:
 * - 0값이 많은 간헐적 수요에 특화
 * - 수요 크기와 발생 빈도를 분리하여 예측
 * - 기존 SMA/SES보다 간헐적 패턴에서 정확도 높음
 *
 * 적합:
 * - Z등급 (불규칙 수요)
 * - 0값 비율 > 30%인 품목
 * - 부품, 틈새 제품 등
 */

import { ForecastResult, ForecastMethodType } from "../types";

/** Croston 표준 초기 평활 계수 */
const DEFAULT_CROSTON_ALPHA = 0.15;

/** 최소 알파값 */
const MIN_ALPHA = 0.05;

/** 최대 알파값 */
const MAX_ALPHA = 0.5;

/**
 * 크로스턴법 예측 계산
 *
 * @param history 판매 이력 (수치 배열)
 * @param periods 예측 기간 수
 * @param alpha 평활 계수 (기본: 0.15)
 * @returns 예측 결과
 */
export function crostonForecast(
  history: number[],
  periods: number,
  alpha: number = DEFAULT_CROSTON_ALPHA
): ForecastResult {
  if (history.length === 0) {
    return {
      method: "Croston" as ForecastMethodType,
      parameters: { alpha, zeroProportion: 1 },
      forecast: Array(periods).fill(0),
    };
  }

  // 알파값 범위 검증
  const validAlpha = Math.max(MIN_ALPHA, Math.min(MAX_ALPHA, alpha));

  // 0값 비율 계산 (참고 통계)
  const zeroCount = history.filter((v) => v === 0).length;
  const zeroProportion = zeroCount / history.length;

  // 비영수요(non-zero demand) 시점과 크기 추출
  const nonZeroDemands: number[] = [];
  const interDemandIntervals: number[] = [];

  let periodsSinceLastDemand = 0;
  let foundFirstNonZero = false;

  for (let i = 0; i < history.length; i++) {
    periodsSinceLastDemand++;

    if (history[i] > 0) {
      nonZeroDemands.push(history[i]);

      if (foundFirstNonZero) {
        // 첫 비영수요 이후부터 간격 기록
        interDemandIntervals.push(periodsSinceLastDemand);
      }

      periodsSinceLastDemand = 0;
      foundFirstNonZero = true;
    }
  }

  // 비영수요가 2개 미만이면 예측 불가 -> 평균으로 대체
  if (nonZeroDemands.length < 2 || interDemandIntervals.length === 0) {
    const average = history.reduce((sum, v) => sum + v, 0) / history.length;
    return {
      method: "Croston" as ForecastMethodType,
      parameters: { alpha: validAlpha, zeroProportion },
      forecast: Array(periods).fill(Math.max(0, Math.round(average * 100) / 100)),
      confidence: "low",
    };
  }

  // 수요 크기에 SES 적용
  let smoothedSize = nonZeroDemands[0];
  for (let i = 1; i < nonZeroDemands.length; i++) {
    smoothedSize = validAlpha * nonZeroDemands[i] + (1 - validAlpha) * smoothedSize;
  }

  // 수요 간격에 SES 적용
  let smoothedInterval = interDemandIntervals[0];
  for (let i = 1; i < interDemandIntervals.length; i++) {
    smoothedInterval =
      validAlpha * interDemandIntervals[i] + (1 - validAlpha) * smoothedInterval;
  }

  // 0 나눗셈 방지
  if (smoothedInterval <= 0) {
    smoothedInterval = 1;
  }

  // 예측값 = 평활된 수요 크기 / 평활된 수요 간격
  const forecastValue = smoothedSize / smoothedInterval;

  // 음수 방지 + 소수점 2자리 반올림
  const safeForecast = Math.max(0, Math.round(forecastValue * 100) / 100);

  return {
    method: "Croston" as ForecastMethodType,
    parameters: {
      alpha: validAlpha,
      zeroProportion,
      smoothedDemandSize: Math.round(smoothedSize * 100) / 100,
      smoothedInterval: Math.round(smoothedInterval * 100) / 100,
    },
    forecast: Array(periods).fill(safeForecast),
  };
}

/**
 * 크로스턴법 방법 객체 (통일된 ForecastMethod 인터페이스)
 */
export const crostonMethod = {
  name: "Croston" as ForecastMethodType,
  minDataPoints: 4, // 최소 4개 데이터 필요 (비영수요 2개 이상 확보)
  forecast: (history: number[], periods: number) => {
    return crostonForecast(history, periods, DEFAULT_CROSTON_ALPHA);
  },
};
