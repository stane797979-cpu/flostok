/**
 * 예측 방법 자동 선택 알고리즘
 *
 * 선택 로직 (8가지 고려):
 * 1. 데이터 기간 확인
 * 2. XYZ 등급 고려
 * 3. 추세 존재 여부 확인
 * 4. ABC 등급 (A: 정밀도 우선, C: 단순 선호)
 * 5. 계절성 (12개월+ 데이터 → 이동평균비율법)
 * 6. 회전율 (고회전: α↑, 저회전: α↓)
 * 7. 전년대비 성장률 (±20% → Holt's 고려)
 * 8. 재고 과다 (과다 → 보수적 조정 ×0.9)
 */

import { ForecastInput, ForecastResult, ForecastMetadata, ForecastMethod } from "./types";
import { smaMethod } from "./methods/simple-moving-average";
import { sesMethod, sesMethodWithGrade, simpleExponentialSmoothing, getDefaultAlpha } from "./methods/exponential-smoothing";
import { holtsMethod_auto, detectTrend } from "./methods/holts-method";
import { calculateMAPE } from "./accuracy/metrics";
import { detectSeasonality, isSignificantSeasonality, applySeasonalAdjustment } from "./methods/seasonal-adjustment";

/**
 * 메타데이터 추출
 */
function extractMetadata(input: ForecastInput): ForecastMetadata {
  const dataMonths = input.history.length;
  const values = input.history.map((d) => d.value);
  const hasTrend = detectTrend(values);

  // 계절성 감지 (12개월 이상)
  let hasSeasonality = false;
  let seasonalIndices: number[] | undefined;
  if (dataMonths >= 12) {
    const indices = detectSeasonality(values);
    if (indices && isSignificantSeasonality(indices)) {
      hasSeasonality = true;
      seasonalIndices = indices;
    }
  }

  return {
    dataMonths,
    xyzGrade: input.xyzGrade,
    abcGrade: input.abcGrade,
    hasTrend,
    turnoverRate: input.turnoverRate,
    yoyGrowthRate: input.yoyGrowthRate,
    isOverstock: input.isOverstock,
    hasSeasonality,
    seasonalIndices,
  };
}

/**
 * 사용 가능한 예측 방법 목록 반환
 */
function getAvailableMethods(metadata: ForecastMetadata): ForecastMethod[] {
  const methods: ForecastMethod[] = [];

  // SMA: 항상 사용 가능 (최소 1개 데이터)
  if (metadata.dataMonths >= smaMethod.minDataPoints) {
    methods.push(smaMethod);
  }

  // SES: 3개월 이상
  if (metadata.dataMonths >= sesMethod.minDataPoints) {
    if (metadata.xyzGrade) {
      // 회전율 기반 α 조정
      if (metadata.turnoverRate !== undefined) {
        const baseAlpha = getDefaultAlpha(metadata.xyzGrade);
        let adjustedAlpha = baseAlpha;
        if (metadata.turnoverRate > 12) {
          adjustedAlpha = Math.min(0.9, baseAlpha + 0.1); // 고회전: 최근 반영↑
        } else if (metadata.turnoverRate < 3) {
          adjustedAlpha = Math.max(0.1, baseAlpha - 0.1); // 저회전: 과거 반영↑
        }
        methods.push({
          name: "SES",
          minDataPoints: 3,
          forecast: (history: number[], periods: number) =>
            simpleExponentialSmoothing(history, periods, adjustedAlpha),
        });
      } else {
        methods.push(sesMethodWithGrade(metadata.xyzGrade));
      }
    } else {
      methods.push(sesMethod);
    }
  }

  // Holt's: 6개월 이상 && (추세 있음 OR 성장률 ±20% 이상)
  const hasSignificantGrowth =
    metadata.yoyGrowthRate !== undefined && Math.abs(metadata.yoyGrowthRate) >= 20;

  if (metadata.dataMonths >= holtsMethod_auto.minDataPoints) {
    if (metadata.hasTrend || hasSignificantGrowth) {
      methods.push(holtsMethod_auto);
    }
  }

  // ABC C등급: 복잡한 방법 제거 (SMA 선호)
  if (metadata.abcGrade === "C" && methods.length > 1) {
    const filtered = methods.filter((m) => m.name !== "Holts");
    if (filtered.length > 0) return filtered;
  }

  return methods;
}

/**
 * 교차 검증을 통한 방법 비교
 */
function crossValidateMethods(
  history: number[],
  methods: ForecastMethod[],
  testSize: number = 3
): { method: ForecastMethod; mape: number }[] {
  if (history.length < testSize + 3) {
    return methods.map((method) => ({ method, mape: 999 }));
  }

  const trainData = history.slice(0, -testSize);
  const testData = history.slice(-testSize);

  return methods.map((method) => {
    try {
      const result = method.forecast(trainData, testSize);
      const mape = calculateMAPE(testData, result.forecast);
      return { method, mape: isFinite(mape) ? mape : 999 };
    } catch {
      return { method, mape: 999 };
    }
  });
}

/**
 * 선택 사유 생성 (한국어)
 */
function buildSelectionReason(
  metadata: ForecastMetadata,
  methodName: string,
  params: Record<string, number>
): string {
  const factors: string[] = [];

  if (metadata.abcGrade) {
    const abcDesc: Record<string, string> = {
      A: "A등급(핵심품목)",
      B: "B등급(일반품목)",
      C: "C등급(저매출품목)",
    };
    factors.push(abcDesc[metadata.abcGrade] || `ABC:${metadata.abcGrade}`);
  }

  if (metadata.xyzGrade) {
    const xyzDesc: Record<string, string> = {
      X: "X등급(안정수요)",
      Y: "Y등급(변동수요)",
      Z: "Z등급(불규칙수요)",
    };
    factors.push(xyzDesc[metadata.xyzGrade] || `XYZ:${metadata.xyzGrade}`);
  }

  factors.push(`데이터 ${metadata.dataMonths}개월`);
  if (metadata.hasTrend) factors.push("추세 감지");
  if (metadata.hasSeasonality) factors.push("계절성 감지");

  if (metadata.turnoverRate !== undefined) {
    if (metadata.turnoverRate > 12) factors.push(`고회전(${metadata.turnoverRate.toFixed(1)}회)`);
    else if (metadata.turnoverRate < 3) factors.push(`저회전(${metadata.turnoverRate.toFixed(1)}회)`);
    else factors.push(`회전율 ${metadata.turnoverRate.toFixed(1)}회`);
  }

  if (metadata.yoyGrowthRate !== undefined) {
    const sign = metadata.yoyGrowthRate >= 0 ? "+" : "";
    factors.push(`전년비 ${sign}${metadata.yoyGrowthRate.toFixed(0)}%`);
  }

  if (metadata.isOverstock) factors.push("재고과다(보수적 조정)");

  const methodDesc: Record<string, string> = {
    SMA: "단순이동평균(SMA)",
    SES: `지수평활법(SES, α=${params.alpha?.toFixed(2) ?? "auto"})`,
    Holts: `이중지수평활(Holt's, α=${params.alpha?.toFixed(2) ?? "auto"}, β=${params.beta?.toFixed(2) ?? "auto"})`,
  };

  return `${factors.join(" · ")} → ${methodDesc[methodName] || methodName}`;
}

/**
 * 최적 예측 방법 선택 (자동)
 */
export function selectBestMethod(input: ForecastInput): ForecastResult {
  const metadata = extractMetadata(input);
  const values = input.history.map((d) => d.value);

  // 1. 사용 가능한 방법 필터링
  const availableMethods = getAvailableMethods(metadata);

  if (availableMethods.length === 0) {
    return {
      method: "SMA",
      parameters: {},
      forecast: Array(input.periods).fill(0),
      mape: 999,
      confidence: "low",
      selectionReason: "데이터 부족 → 단순이동평균(SMA) 기본값",
    };
  }

  // 2. 방법이 1개면 바로 사용
  if (availableMethods.length === 1) {
    const result = availableMethods[0].forecast(values, input.periods);
    result.confidence = "medium";
    result.selectionReason = buildSelectionReason(metadata, result.method, result.parameters);
    return postProcess(result, metadata, input);
  }

  // 3. 교차 검증으로 최적 방법 선택
  const validationResults = crossValidateMethods(values, availableMethods);
  validationResults.sort((a, b) => a.mape - b.mape);

  // Z등급: 단순 방법 선호
  if (metadata.xyzGrade === "Z") {
    const simpleMethod = validationResults.find(
      (r) => r.method.name === "SMA" || r.method.name === "SES"
    );
    if (simpleMethod && simpleMethod.mape < validationResults[0].mape * 1.2) {
      const result = simpleMethod.method.forecast(values, input.periods);
      result.mape = simpleMethod.mape;
      result.confidence = simpleMethod.mape < 30 ? "medium" : "low";
      result.selectionReason = buildSelectionReason(metadata, result.method, result.parameters);
      return postProcess(result, metadata, input);
    }
  }

  // A등급: 정밀 방법 선호 (SES/Holts)
  if (metadata.abcGrade === "A") {
    const preciseMethod = validationResults.find(
      (r) => r.method.name === "SES" || r.method.name === "Holts"
    );
    if (preciseMethod && preciseMethod.mape < validationResults[0].mape * 1.1) {
      const result = preciseMethod.method.forecast(values, input.periods);
      result.mape = preciseMethod.mape;
      if (result.mape! < 15) result.confidence = "high";
      else if (result.mape! < 30) result.confidence = "medium";
      else result.confidence = "low";
      result.selectionReason = buildSelectionReason(metadata, result.method, result.parameters);
      return postProcess(result, metadata, input);
    }
  }

  // 4. 최적 방법 사용
  const bestMethod = validationResults[0].method;
  const result = bestMethod.forecast(values, input.periods);
  result.mape = validationResults[0].mape;

  if (result.mape < 15) result.confidence = "high";
  else if (result.mape < 30) result.confidence = "medium";
  else result.confidence = "low";

  result.selectionReason = buildSelectionReason(metadata, result.method, result.parameters);
  return postProcess(result, metadata, input);
}

/**
 * 후처리: 계절 조정 + 과다재고 보수적 조정
 */
function postProcess(
  result: ForecastResult,
  metadata: ForecastMetadata,
  input: ForecastInput
): ForecastResult {
  // 계절 조정
  if (metadata.hasSeasonality && metadata.seasonalIndices) {
    const lastDate = input.history[input.history.length - 1]?.date;
    const startMonthIndex = lastDate ? (lastDate.getMonth() + 1) % 12 : 0;
    result.forecast = applySeasonalAdjustment(
      result.forecast,
      metadata.seasonalIndices,
      startMonthIndex
    );
    result.seasonallyAdjusted = true;
    result.selectionReason = (result.selectionReason || "") + " + 계절조정";
  }

  // 과다재고 보수적 조정 (×0.9)
  if (metadata.isOverstock) {
    result.forecast = result.forecast.map((v) => Math.round(v * 0.9));
  }

  return result;
}

/**
 * 규칙 기반 방법 선택 (교차 검증 없이)
 */
export function selectMethodByRules(metadata: ForecastMetadata): ForecastMethod {
  const { dataMonths, xyzGrade, abcGrade, hasTrend, yoyGrowthRate } = metadata;

  if (dataMonths < 3) return smaMethod;

  // C+Z: 항상 SMA
  if (abcGrade === "C" && xyzGrade === "Z") return smaMethod;

  if (dataMonths < 6) {
    if (xyzGrade === "X") return sesMethodWithGrade("X");
    if (xyzGrade === "Z") return smaMethod;
    return sesMethod;
  }

  // 성장률 ±20% 이상이면 Holt's 고려
  const hasSignificantGrowth = yoyGrowthRate !== undefined && Math.abs(yoyGrowthRate) >= 20;
  if ((hasTrend || hasSignificantGrowth) && dataMonths >= 6) {
    return holtsMethod_auto;
  }

  if (xyzGrade === "X") return sesMethodWithGrade("X");
  if (xyzGrade === "Y") return hasTrend ? holtsMethod_auto : sesMethod;
  if (xyzGrade === "Z") return smaMethod;

  return sesMethod;
}
