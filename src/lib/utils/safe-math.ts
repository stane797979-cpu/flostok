/**
 * 안전한 수학 연산 유틸리티
 * NaN, Infinity, 음수 입력에 대한 방어적 처리
 *
 * SCM 계산에서 발생할 수 있는 비정상 입력값을 안전하게 처리합니다.
 */

/** 안전한 제곱근 — 음수/NaN/Infinity 시 0 반환 */
export function safeSqrt(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.sqrt(value);
}

/** 안전한 나눗셈 — 0으로 나누기/NaN/Infinity 시 fallback 반환 */
export function safeDivide(
  numerator: number,
  denominator: number,
  fallback = 0
): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return fallback;
  }
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/** 숫자 안전 변환 — NaN/undefined/null 시 fallback 반환 */
export function safeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/** 양수 보장 — 0 이하이면 fallback */
export function ensurePositive(value: number, fallback = 0): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
