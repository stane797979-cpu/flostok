import { describe, it, expect } from "vitest";
import {
  calculateSafetyStock,
  calculateSimpleSafetyStock,
  getZScore,
} from "../safety-stock";

describe("getZScore", () => {
  it("정확한 서비스레벨 Z값 반환", () => {
    expect(getZScore(0.95)).toBe(1.65);
    expect(getZScore(0.90)).toBe(1.28);
    expect(getZScore(0.99)).toBe(2.33);
    expect(getZScore(0.999)).toBe(3.09);
  });

  it("0.9 미만은 1.28 반환", () => {
    expect(getZScore(0.5)).toBe(1.28);
    expect(getZScore(0.89)).toBe(1.28);
  });

  it("0.999 이상은 3.09 반환", () => {
    expect(getZScore(0.9999)).toBe(3.09);
  });

  it("중간값은 선형 보간", () => {
    const z = getZScore(0.925);
    expect(z).toBeGreaterThan(1.41); // 0.92
    expect(z).toBeLessThan(1.48);    // 0.93
  });
});

describe("calculateSafetyStock - 단순화 공식 (리드타임 변동 없음)", () => {
  it("기본 계산: Z × σ × √LT", () => {
    // Z=1.65(95%), σ=10, LT=4 → 1.65 × 10 × 2 = 33
    const result = calculateSafetyStock({
      averageDailyDemand: 100,
      demandStdDev: 10,
      leadTimeDays: 4,
      serviceLevel: 0.95,
    });
    expect(result.method).toBe("simplified");
    expect(result.zScore).toBe(1.65);
    expect(result.safetyStock).toBe(Math.ceil(1.65 * 10 * Math.sqrt(4)));
  });

  it("서비스레벨 90% 적용", () => {
    const result = calculateSafetyStock({
      averageDailyDemand: 50,
      demandStdDev: 5,
      leadTimeDays: 9,
      serviceLevel: 0.90,
    });
    expect(result.zScore).toBe(1.28);
    expect(result.safetyStock).toBe(Math.ceil(1.28 * 5 * Math.sqrt(9)));
  });

  it("수요 표준편차 0이면 안전재고 0", () => {
    const result = calculateSafetyStock({
      averageDailyDemand: 100,
      demandStdDev: 0,
      leadTimeDays: 5,
      serviceLevel: 0.95,
    });
    expect(result.safetyStock).toBe(0);
  });

  it("결과는 항상 올림(ceil) 처리", () => {
    const result = calculateSafetyStock({
      averageDailyDemand: 10,
      demandStdDev: 3,
      leadTimeDays: 2,
      serviceLevel: 0.95,
    });
    const raw = 1.65 * 3 * Math.sqrt(2);
    expect(result.safetyStock).toBe(Math.ceil(raw));
    expect(result.safetyStock).toBeGreaterThanOrEqual(raw);
  });

  it("serviceLevel 미입력 시 기본값 95% 적용", () => {
    const result = calculateSafetyStock({
      averageDailyDemand: 50,
      demandStdDev: 8,
      leadTimeDays: 4,
    });
    expect(result.serviceLevel).toBe(0.95);
    expect(result.zScore).toBe(1.65);
  });
});

describe("calculateSafetyStock - 전체 공식 (리드타임 변동 포함)", () => {
  it("리드타임 변동 있으면 full 방식 사용", () => {
    const result = calculateSafetyStock({
      averageDailyDemand: 100,
      demandStdDev: 10,
      leadTimeDays: 4,
      leadTimeStdDev: 1,
      serviceLevel: 0.95,
    });
    expect(result.method).toBe("full");
  });

  it("전체 공식: Z × √(LT×σd² + d̄²×σLT²)", () => {
    const d = 100, sd = 10, lt = 4, slt = 1, z = 1.65;
    const expected = Math.ceil(z * Math.sqrt(lt * sd ** 2 + d ** 2 * slt ** 2));
    const result = calculateSafetyStock({
      averageDailyDemand: d,
      demandStdDev: sd,
      leadTimeDays: lt,
      leadTimeStdDev: slt,
      serviceLevel: 0.95,
    });
    expect(result.safetyStock).toBe(expected);
  });

  it("리드타임 변동 추가 시 단순화 공식보다 안전재고 증가", () => {
    const base = {
      averageDailyDemand: 100,
      demandStdDev: 10,
      leadTimeDays: 4,
      serviceLevel: 0.95,
    };
    const simplified = calculateSafetyStock(base);
    const full = calculateSafetyStock({ ...base, leadTimeStdDev: 1 });
    expect(full.safetyStock).toBeGreaterThan(simplified.safetyStock);
  });
});

describe("calculateSimpleSafetyStock", () => {
  it("일평균 × 리드타임 × 안전계수", () => {
    // 100 × 5 × 0.5 = 250
    expect(calculateSimpleSafetyStock(100, 5, 0.5)).toBe(250);
  });

  it("기본 안전계수 0.5 적용", () => {
    expect(calculateSimpleSafetyStock(60, 10)).toBe(300);
  });

  it("소수 결과는 올림 처리", () => {
    // 7 × 3 × 0.5 = 10.5 → 11
    expect(calculateSimpleSafetyStock(7, 3, 0.5)).toBe(11);
  });
});
