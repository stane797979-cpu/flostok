/**
 * 계절성 감지 및 조정
 *
 * 이동평균비율법으로 월별 계절지수를 산출하고,
 * 예측값에 계절지수를 적용하여 계절 조정된 예측을 생성합니다.
 *
 * 최소 12개월 이상의 데이터가 필요합니다.
 */

/**
 * 계절지수 계산 (이동평균비율법)
 *
 * 1) 12개월 중심이동평균(CMA) 계산
 * 2) 실제값 / CMA = 비율
 * 3) 동일 월의 비율 평균 → 월별 계절지수
 * 4) 12개월 합이 12가 되도록 정규화
 */
export function detectSeasonality(history: number[]): number[] | null {
  if (history.length < 12) return null;

  const n = history.length;

  // 12개월 중심이동평균 (CMA)
  const cma: (number | null)[] = new Array(n).fill(null);
  for (let i = 6; i < n - 5; i++) {
    // 12개월 평균 (i-5 ~ i+6) → 13개 합하기 / 2 / 12 = (sum of 12 + half of boundaries) / 12
    // 표준 12개월 CMA: (0.5*D[i-6] + D[i-5] + ... + D[i+5] + 0.5*D[i+6]) / 12
    let sum = 0;
    for (let j = i - 5; j <= i + 5; j++) {
      sum += history[j];
    }
    // 양 끝 절반
    if (i - 6 >= 0 && i + 6 < n) {
      sum += history[i - 6] * 0.5 + history[i + 6] * 0.5;
      cma[i] = sum / 12;
    }
  }

  // 비율 계산: 실제값 / CMA
  const ratios: Map<number, number[]> = new Map();
  for (let i = 0; i < n; i++) {
    if (cma[i] === null || cma[i] === 0) continue;
    const monthIndex = i % 12; // 0~11
    if (!ratios.has(monthIndex)) ratios.set(monthIndex, []);
    ratios.get(monthIndex)!.push(history[i] / cma[i]!);
  }

  // 12개 월 모두 비율이 있어야 함
  if (ratios.size < 12) {
    // 데이터가 부족한 달이 있으면 단순 비율법 사용
    return detectSeasonalitySimple(history);
  }

  // 월별 평균 계절지수
  const rawIndices: number[] = [];
  for (let m = 0; m < 12; m++) {
    const values = ratios.get(m) || [1];
    rawIndices.push(values.reduce((a, b) => a + b, 0) / values.length);
  }

  // 정규화: 12개월 합 = 12
  const sum = rawIndices.reduce((a, b) => a + b, 0);
  const normalizedIndices = rawIndices.map((v) => (v / sum) * 12);

  return normalizedIndices;
}

/**
 * 단순 비율법 (데이터가 정확히 12~23개월인 경우)
 * 각 월의 값을 전체 평균으로 나눠 비율 계산
 */
function detectSeasonalitySimple(history: number[]): number[] | null {
  if (history.length < 12) return null;

  const avg = history.reduce((a, b) => a + b, 0) / history.length;
  if (avg === 0) return null;

  // 월별 평균
  const monthSums: number[] = new Array(12).fill(0);
  const monthCounts: number[] = new Array(12).fill(0);
  for (let i = 0; i < history.length; i++) {
    const m = i % 12;
    monthSums[m] += history[i];
    monthCounts[m]++;
  }

  const rawIndices: number[] = [];
  for (let m = 0; m < 12; m++) {
    if (monthCounts[m] === 0) {
      rawIndices.push(1);
    } else {
      rawIndices.push(monthSums[m] / monthCounts[m] / avg);
    }
  }

  // 정규화
  const sum = rawIndices.reduce((a, b) => a + b, 0);
  return rawIndices.map((v) => (v / sum) * 12);
}

/**
 * 계절성이 유의미한지 판단
 * 계절지수의 변동계수(CV) > 0.15이면 유의미
 */
export function isSignificantSeasonality(indices: number[]): boolean {
  if (indices.length !== 12) return false;

  const mean = indices.reduce((a, b) => a + b, 0) / indices.length;
  if (mean === 0) return false;

  const variance =
    indices.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / indices.length;
  const cv = Math.sqrt(variance) / mean;

  return cv > 0.15;
}

/**
 * 예측값에 계절지수 적용
 *
 * @param forecast 원래 예측값 배열
 * @param seasonalIndices 12개 월별 계절지수
 * @param startMonthIndex 예측 시작 월 인덱스 (0=1월, 11=12월)
 * @returns 계절 조정된 예측값
 */
export function applySeasonalAdjustment(
  forecast: number[],
  seasonalIndices: number[],
  startMonthIndex: number
): number[] {
  return forecast.map((value, i) => {
    const monthIdx = (startMonthIndex + i) % 12;
    const adjusted = value * seasonalIndices[monthIdx];
    return Math.max(0, Math.round(adjusted));
  });
}
