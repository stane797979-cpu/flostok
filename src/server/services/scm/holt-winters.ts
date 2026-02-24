/**
 * 3중 지수평활법 (Holt-Winters, Triple Exponential Smoothing)
 *
 * 수준(Level) + 추세(Trend) + 계절성(Seasonality)을 동시에 반영하는
 * 시계열 예측 방법입니다. 최소 2년(24개월) 이상의 데이터가 필요합니다.
 *
 * 공식 (가법 모델):
 *   L(t) = alpha * (Y(t) - S(t-m)) + (1 - alpha) * (L(t-1) + T(t-1))
 *   T(t) = beta * (L(t) - L(t-1)) + (1 - beta) * T(t-1)
 *   S(t) = gamma * (Y(t) - L(t)) + (1 - gamma) * S(t-m)
 *   F(t+h) = L(t) + h * T(t) + S(t - m + (h mod m))
 *
 * m = seasonLength (계절 주기, 월별 데이터에서 보통 12)
 *
 * @module holt-winters
 */

import {
  safeSqrt,
  safeDivide,
  safeNumber,
  ensurePositive,
} from "@/lib/utils/safe-math";

// ─── 상수 정의 ─────────────────────────────────────────────

/** 그리드 서치 최소 파라미터 값 */
const PARAM_MIN = 0.1;
/** 그리드 서치 최대 파라미터 값 */
const PARAM_MAX = 0.9;
/** 그리드 서치 스텝 크기 */
const PARAM_STEP = 0.1;
/** 자기상관(ACF) 기반 계절성 감지에 필요한 최소 데이터 포인트 */
const MIN_DATA_FOR_SEASONALITY_DETECTION = 24;
/** Holt-Winters 적합에 필요한 최소 시즌 수 */
const MIN_SEASONS_FOR_FIT = 2;
/** ACF 유의성 판단 임계값 (2/sqrt(n) 기반 대비 배율) */
const ACF_SIGNIFICANCE_MULTIPLIER = 1.0;
/** 기본 계절 주기 (월별 데이터) */
const DEFAULT_SEASON_LENGTH = 12;
/** 탐색할 최대 계절 주기 */
const MAX_SEASON_LENGTH_RATIO = 0.4;

// ─── 타입 정의 ─────────────────────────────────────────────

/** Holt-Winters 파라미터 */
export interface HoltWintersParams {
  /** 수준(Level) 평활 계수 (0 < alpha < 1) */
  alpha: number;
  /** 추세(Trend) 평활 계수 (0 < beta < 1) */
  beta: number;
  /** 계절성(Seasonality) 평활 계수 (0 < gamma < 1) */
  gamma: number;
  /** 계절 주기 길이 (월별=12, 분기별=4 등) */
  seasonLength: number;
}

/** Holt-Winters 예측 결과 */
export interface HoltWintersResult {
  /** 예측값 배열 (forecastPeriods개) */
  forecast: number[];
  /** 수준(Level) 시계열 */
  level: number[];
  /** 추세(Trend) 시계열 */
  trend: number[];
  /** 계절 지수(Seasonal) 시계열 */
  seasonal: number[];
  /** 평균제곱오차 (MSE) */
  mse: number;
  /** 사용된 파라미터 */
  params: HoltWintersParams;
}

/** 계절성 감지 결과 */
export interface SeasonalityDetectionResult {
  /** 유의미한 계절성 존재 여부 */
  hasSeasonality: boolean;
  /** 감지된 계절 주기 길이 */
  seasonLength: number;
  /** 해당 주기의 자기상관 값 */
  acfValue: number;
  /** ACF 유의성 임계값 */
  threshold: number;
}

// ─── 내부 유틸리티 ─────────────────────────────────────────

/**
 * 파라미터 범위 생성 (그리드 서치용)
 * @returns PARAM_MIN부터 PARAM_MAX까지 PARAM_STEP 간격의 배열
 */
function generateParamRange(): number[] {
  const range: number[] = [];
  for (let v = PARAM_MIN; v <= PARAM_MAX + 1e-9; v += PARAM_STEP) {
    range.push(Math.round(v * 10) / 10);
  }
  return range;
}

/**
 * MSE(평균제곱오차) 계산
 *
 * @param actuals - 실제값 배열
 * @param fitted - 적합값 배열
 * @returns MSE 값 (유효 데이터 없으면 Infinity)
 */
function calculateMSE(actuals: number[], fitted: number[]): number {
  const len = Math.min(actuals.length, fitted.length);
  if (len === 0) return Infinity;

  let sumSquaredError = 0;
  let count = 0;

  for (let i = 0; i < len; i++) {
    const actual = safeNumber(actuals[i]);
    const fit = safeNumber(fitted[i]);
    if (Number.isFinite(actual) && Number.isFinite(fit)) {
      sumSquaredError += (actual - fit) * (actual - fit);
      count++;
    }
  }

  return safeDivide(sumSquaredError, count, Infinity);
}

/**
 * 초기 수준(Level) 계산
 * 첫 번째 시즌의 평균값 사용
 *
 * @param data - 시계열 데이터
 * @param seasonLength - 계절 주기
 * @returns 초기 수준 값
 */
function initializeLevel(data: number[], seasonLength: number): number {
  let sum = 0;
  for (let i = 0; i < seasonLength; i++) {
    sum += safeNumber(data[i]);
  }
  return safeDivide(sum, seasonLength);
}

/**
 * 초기 추세(Trend) 계산
 * 첫 두 시즌의 대응 값 차이 평균 사용
 *
 * @param data - 시계열 데이터
 * @param seasonLength - 계절 주기
 * @returns 초기 추세 값
 */
function initializeTrend(data: number[], seasonLength: number): number {
  if (data.length < seasonLength * 2) {
    // 2시즌 미만이면 첫 시즌 내 선형 추세 추정
    const firstHalf = data.slice(0, Math.floor(seasonLength / 2));
    const secondHalf = data.slice(
      Math.floor(seasonLength / 2),
      seasonLength
    );
    const avgFirst = safeDivide(
      firstHalf.reduce((a, b) => a + safeNumber(b), 0),
      firstHalf.length
    );
    const avgSecond = safeDivide(
      secondHalf.reduce((a, b) => a + safeNumber(b), 0),
      secondHalf.length
    );
    return safeDivide(avgSecond - avgFirst, Math.floor(seasonLength / 2));
  }

  let sum = 0;
  for (let i = 0; i < seasonLength; i++) {
    sum += safeDivide(
      safeNumber(data[i + seasonLength]) - safeNumber(data[i]),
      seasonLength
    );
  }
  return safeDivide(sum, seasonLength);
}

/**
 * 초기 계절 지수(Seasonal Indices) 계산
 * 각 시즌 내 값과 시즌 평균의 차이로 초기화 (가법 모델)
 *
 * @param data - 시계열 데이터
 * @param seasonLength - 계절 주기
 * @returns seasonLength 길이의 초기 계절 지수 배열
 */
function initializeSeasonalIndices(
  data: number[],
  seasonLength: number
): number[] {
  const numSeasons = Math.min(
    Math.floor(data.length / seasonLength),
    MIN_SEASONS_FOR_FIT
  );
  const indices: number[] = new Array(seasonLength).fill(0);

  for (let s = 0; s < numSeasons; s++) {
    // 해당 시즌의 평균
    let seasonSum = 0;
    for (let i = 0; i < seasonLength; i++) {
      seasonSum += safeNumber(data[s * seasonLength + i]);
    }
    const seasonAvg = safeDivide(seasonSum, seasonLength);

    // 평균과의 차이를 계절 지수로 할당
    for (let i = 0; i < seasonLength; i++) {
      indices[i] += safeDivide(
        safeNumber(data[s * seasonLength + i]) - seasonAvg,
        numSeasons
      );
    }
  }

  return indices;
}

// ─── 핵심 함수 ─────────────────────────────────────────────

/**
 * 고정 파라미터로 Holt-Winters 가법 모델 적합
 *
 * 가법 모델을 사용하는 이유:
 * - 계절 변동폭이 수준에 비례하지 않을 때 적합
 * - 수요가 0에 가까운 기간이 있어도 안정적으로 동작
 * - 승법 모델은 데이터에 0이 있으면 적용 불가
 *
 * @param data - 시계열 데이터
 * @param seasonLength - 계절 주기
 * @param alpha - 수준 평활 계수
 * @param beta - 추세 평활 계수
 * @param gamma - 계절 평활 계수
 * @param forecastPeriods - 예측 기간 수
 * @returns 적합 결과 (fitted values + forecast + MSE)
 */
function fitWithParams(
  data: number[],
  seasonLength: number,
  alpha: number,
  beta: number,
  gamma: number,
  forecastPeriods: number
): HoltWintersResult {
  const n = data.length;

  // 초기화
  const level: number[] = new Array(n).fill(0);
  const trend: number[] = new Array(n).fill(0);
  const seasonal: number[] = new Array(n + forecastPeriods).fill(0);
  const fitted: number[] = new Array(n).fill(0);

  // 초기값 설정
  level[0] = initializeLevel(data, seasonLength);
  trend[0] = initializeTrend(data, seasonLength);

  // 초기 계절 지수 복사
  const initSeasonal = initializeSeasonalIndices(data, seasonLength);
  for (let i = 0; i < seasonLength; i++) {
    seasonal[i] = initSeasonal[i];
  }

  // 첫 시즌의 fitted values
  fitted[0] = level[0] + trend[0] + seasonal[0];

  // 재귀적 업데이트 (t = 1 ~ n-1)
  for (let t = 1; t < n; t++) {
    const y = safeNumber(data[t]);

    // 이전 계절 지수 (1시즌 전)
    const prevSeasonal =
      t >= seasonLength ? seasonal[t - seasonLength] : seasonal[t % seasonLength];

    // 수준 업데이트: L(t) = alpha * (Y(t) - S(t-m)) + (1-alpha) * (L(t-1) + T(t-1))
    level[t] =
      alpha * (y - prevSeasonal) +
      (1 - alpha) * (level[t - 1] + trend[t - 1]);

    // 추세 업데이트: T(t) = beta * (L(t) - L(t-1)) + (1-beta) * T(t-1)
    trend[t] =
      beta * (level[t] - level[t - 1]) + (1 - beta) * trend[t - 1];

    // 계절 업데이트: S(t) = gamma * (Y(t) - L(t)) + (1-gamma) * S(t-m)
    seasonal[t] = gamma * (y - level[t]) + (1 - gamma) * prevSeasonal;

    // 적합값: F(t) = L(t-1) + T(t-1) + S(t-m)
    fitted[t] = level[t - 1] + trend[t - 1] + prevSeasonal;
  }

  // MSE 계산 (첫 시즌 이후부터, 초기화 기간 제외)
  const startIdx = seasonLength;
  const mse = calculateMSE(
    data.slice(startIdx),
    fitted.slice(startIdx)
  );

  // 예측값 생성
  const lastLevel = level[n - 1];
  const lastTrend = trend[n - 1];
  const forecast: number[] = [];

  for (let h = 1; h <= forecastPeriods; h++) {
    // 가장 최근 시즌의 대응되는 계절 지수 사용
    const seasonIdx = n - seasonLength + ((h - 1) % seasonLength);
    const seasonalComponent =
      seasonIdx >= 0 ? seasonal[seasonIdx] : 0;

    const prediction = lastLevel + h * lastTrend + seasonalComponent;
    // 수요 예측이므로 음수 방지
    forecast.push(Math.max(0, Math.round(prediction * 100) / 100));
  }

  return {
    forecast,
    level: level.map((v) => Math.round(safeNumber(v) * 100) / 100),
    trend: trend.map((v) => Math.round(safeNumber(v) * 100) / 100),
    seasonal: seasonal
      .slice(0, n)
      .map((v) => Math.round(safeNumber(v) * 100) / 100),
    mse: Number.isFinite(mse) ? Math.round(mse * 100) / 100 : Infinity,
    params: { alpha, beta, gamma, seasonLength },
  };
}

/**
 * Holt-Winters 3중 지수평활법 적합 및 예측
 *
 * alpha, beta, gamma를 0.1~0.9 그리드 서치로 MSE를 최소화하는
 * 최적 파라미터를 자동으로 탐색합니다.
 *
 * @param data - 시계열 데이터 (최소 seasonLength * 2 이상 필요)
 * @param seasonLength - 계절 주기 길이 (월별=12, 분기별=4)
 * @param forecastPeriods - 예측할 기간 수
 * @returns HoltWintersResult (예측값, 수준/추세/계절 시계열, MSE, 파라미터)
 *
 * @example
 * ```ts
 * // 24개월 월별 판매 데이터로 3개월 예측
 * const monthlySales = [100, 120, 150, ..., 180]; // 24개
 * const result = fitHoltWinters(monthlySales, 12, 3);
 * console.log(result.forecast); // [예측1, 예측2, 예측3]
 * console.log(result.params);   // { alpha, beta, gamma, seasonLength: 12 }
 * ```
 */
export function fitHoltWinters(
  data: number[],
  seasonLength: number,
  forecastPeriods: number
): HoltWintersResult {
  // 입력 검증
  const validSeasonLength = ensurePositive(seasonLength, DEFAULT_SEASON_LENGTH);
  const validForecastPeriods = ensurePositive(forecastPeriods, 1);

  // 최소 데이터 요건: 시즌 2개 이상
  const minRequired = validSeasonLength * MIN_SEASONS_FOR_FIT;
  if (data.length < minRequired) {
    return {
      forecast: new Array(validForecastPeriods).fill(0),
      level: [],
      trend: [],
      seasonal: [],
      mse: Infinity,
      params: {
        alpha: 0,
        beta: 0,
        gamma: 0,
        seasonLength: validSeasonLength,
      },
    };
  }

  // 그리드 서치로 최적 파라미터 탐색
  const paramRange = generateParamRange();
  let bestResult: HoltWintersResult | null = null;
  let bestMSE = Infinity;

  for (const alpha of paramRange) {
    for (const beta of paramRange) {
      for (const gamma of paramRange) {
        const result = fitWithParams(
          data,
          validSeasonLength,
          alpha,
          beta,
          gamma,
          validForecastPeriods
        );

        if (Number.isFinite(result.mse) && result.mse < bestMSE) {
          bestMSE = result.mse;
          bestResult = result;
        }
      }
    }
  }

  // 최적 결과가 없으면 기본 파라미터(0.3, 0.1, 0.1)로 적합
  if (bestResult === null) {
    bestResult = fitWithParams(
      data,
      validSeasonLength,
      0.3,
      0.1,
      0.1,
      validForecastPeriods
    );
  }

  return bestResult;
}

/**
 * ACF(자기상관함수) 기반 계절성 자동 감지
 *
 * 시계열 데이터의 자기상관 구조를 분석하여 주기적 패턴을 감지합니다.
 * lag 2부터 데이터 길이의 40%까지 탐색하여 유의미한 피크를 찾습니다.
 *
 * @param data - 시계열 데이터 (최소 24개 포인트 필요)
 * @returns SeasonalityDetectionResult (계절성 유무, 주기, ACF 값, 임계값)
 *
 * @example
 * ```ts
 * const monthlySales = [100, 120, 150, ..., 180]; // 36개월 데이터
 * const result = autoDetectSeasonality(monthlySales);
 * if (result.hasSeasonality) {
 *   console.log(`계절 주기: ${result.seasonLength}개월`);
 *   console.log(`ACF: ${result.acfValue}`);
 * }
 * ```
 */
export function autoDetectSeasonality(
  data: number[]
): SeasonalityDetectionResult {
  const noSeasonality: SeasonalityDetectionResult = {
    hasSeasonality: false,
    seasonLength: 0,
    acfValue: 0,
    threshold: 0,
  };

  // 최소 데이터 요건
  if (data.length < MIN_DATA_FOR_SEASONALITY_DETECTION) {
    return noSeasonality;
  }

  const n = data.length;

  // 평균 계산
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += safeNumber(data[i]);
  }
  const mean = safeDivide(sum, n);

  // 분산 계산 (lag 0 자기상관 = 분모)
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const diff = safeNumber(data[i]) - mean;
    variance += diff * diff;
  }

  if (variance === 0) {
    // 모든 값이 동일하면 계절성 없음
    return noSeasonality;
  }

  // 유의성 임계값: 2 / sqrt(n)
  const threshold =
    ACF_SIGNIFICANCE_MULTIPLIER * safeDivide(2, safeSqrt(n), 0.3);

  // 탐색할 최대 lag
  const maxLag = Math.floor(n * MAX_SEASON_LENGTH_RATIO);

  // ACF 계산 및 피크 탐색 (lag 2부터, lag 1은 자기상관이 높아 무의미)
  let bestLag = 0;
  let bestACF = 0;

  for (let lag = 2; lag <= maxLag; lag++) {
    let autocovariance = 0;
    for (let i = 0; i < n - lag; i++) {
      autocovariance +=
        (safeNumber(data[i]) - mean) * (safeNumber(data[i + lag]) - mean);
    }
    const acf = safeDivide(autocovariance, variance);

    // 유의미한 양의 자기상관 중 최대값 탐색
    if (acf > threshold && acf > bestACF) {
      bestACF = acf;
      bestLag = lag;
    }
  }

  if (bestLag === 0) {
    return {
      hasSeasonality: false,
      seasonLength: 0,
      acfValue: 0,
      threshold: Math.round(threshold * 1000) / 1000,
    };
  }

  return {
    hasSeasonality: true,
    seasonLength: bestLag,
    acfValue: Math.round(bestACF * 1000) / 1000,
    threshold: Math.round(threshold * 1000) / 1000,
  };
}
