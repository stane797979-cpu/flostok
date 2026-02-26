/**
 * 수요예측 타입 정의
 */

import { type ABCGrade, type XYZGrade } from "../abc-xyz-analysis";

export type { ABCGrade };

/**
 * 예측 방법 타입
 */
export type ForecastMethodType =
  | "SMA" // Simple Moving Average (단순이동평균)
  | "SES" // Simple Exponential Smoothing (단순지수평활)
  | "Holts" // Holt's Double Exponential Smoothing (이중지수평활)
  | "Croston"; // Croston's Method (크로스턴법 — 간헐적 수요 전용)

/**
 * 시계열 데이터 포인트
 */
export interface TimeSeriesDataPoint {
  date: Date;
  value: number;
}

/**
 * 예측 입력 데이터
 */
export interface ForecastInput {
  /** 판매 이력 (시간순 정렬) */
  history: TimeSeriesDataPoint[];
  /** 예측할 기간 수 */
  periods: number;
  /** XYZ 등급 (선택) */
  xyzGrade?: XYZGrade;
  /** ABC 등급 (선택) */
  abcGrade?: ABCGrade;
  /** 재고 회전율 (연간, 선택) */
  turnoverRate?: number;
  /** 전년 대비 매출 성장률 (%, 선택) */
  yoyGrowthRate?: number;
  /** 재고 과다 여부 (선택) */
  isOverstock?: boolean;
}

/**
 * 예측 결과
 */
export interface ForecastResult {
  /** 사용된 예측 방법 */
  method: ForecastMethodType;
  /** 방법별 파라미터 */
  parameters: Record<string, number>;
  /** 예측값 배열 */
  forecast: number[];
  /** 정확도 (MAPE) */
  mape?: number;
  /** 정확도 (MAE) */
  mae?: number;
  /** 신뢰도 등급 */
  confidence?: "high" | "medium" | "low";
  /** 선택 사유 (자동 선택 시 왜 이 방법인지 설명) */
  selectionReason?: string;
  /** 계절 조정 적용 여부 */
  seasonallyAdjusted?: boolean;
}

/**
 * 예측 방법 인터페이스
 */
export interface ForecastMethod {
  /** 방법 이름 */
  name: ForecastMethodType;
  /** 최소 필요 데이터 포인트 수 */
  minDataPoints: number;
  /** 예측 함수 */
  forecast: (history: number[], periods: number) => ForecastResult;
}

/**
 * 방법 선택 메타데이터
 */
export interface ForecastMetadata {
  /** 데이터 개수 (개월 수) */
  dataMonths: number;
  /** XYZ 등급 */
  xyzGrade?: XYZGrade;
  /** ABC 등급 */
  abcGrade?: ABCGrade;
  /** 추세 존재 여부 */
  hasTrend?: boolean;
  /** 재고 회전율 (연간) */
  turnoverRate?: number;
  /** 전년 대비 매출 성장률 (%) */
  yoyGrowthRate?: number;
  /** 재고 과다 여부 */
  isOverstock?: boolean;
  /** 유의미한 계절성 존재 여부 */
  hasSeasonality?: boolean;
  /** 월별 계절지수 (12개) */
  seasonalIndices?: number[];
  /** 0값 비율 (0~1, 간헐적 수요 판단용) */
  zeroProportion?: number;
}
