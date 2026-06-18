import { describe, it, expect } from "vitest";
import {
  calculateEOQ,
  calculateHoldingCost,
  compareOrderQuantityCost,
  calculateEOQWithDiscount,
} from "../eoq";

describe("calculateEOQ", () => {
  it("기본 공식: √(2DS/H)", () => {
    // D=1000, S=50, H=2 → √(2×1000×50/2) = √50000 ≈ 224 → 올림
    const result = calculateEOQ({
      annualDemand: 1000,
      orderingCost: 50,
      holdingCostPerUnit: 2,
    });
    const raw = Math.sqrt((2 * 1000 * 50) / 2);
    expect(result.eoq).toBe(Math.ceil(raw));
  });

  it("연간 발주 횟수 = 연간수요 / EOQ", () => {
    const result = calculateEOQ({
      annualDemand: 1000,
      orderingCost: 50,
      holdingCostPerUnit: 2,
    });
    expect(result.ordersPerYear).toBeCloseTo(1000 / result.eoq, 2);
  });

  it("발주 주기 = 365 / 연간발주횟수", () => {
    const result = calculateEOQ({
      annualDemand: 1000,
      orderingCost: 50,
      holdingCostPerUnit: 2,
    });
    expect(result.orderCycleDays).toBe(Math.round(365 / result.ordersPerYear));
  });

  it("총비용 = 발주비용 + 유지비용", () => {
    const result = calculateEOQ({
      annualDemand: 1000,
      orderingCost: 50,
      holdingCostPerUnit: 2,
    });
    expect(result.totalAnnualCost).toBe(
      result.annualOrderingCost + result.annualHoldingCost
    );
  });

  it("입력값 0 이하이면 모두 0 반환", () => {
    const result = calculateEOQ({
      annualDemand: 0,
      orderingCost: 50,
      holdingCostPerUnit: 2,
    });
    expect(result.eoq).toBe(0);
    expect(result.totalAnnualCost).toBe(0);
  });

  it("EOQ에서 발주비용 ≈ 유지비용 (최적점 검증)", () => {
    const result = calculateEOQ({
      annualDemand: 10000,
      orderingCost: 100,
      holdingCostPerUnit: 5,
    });
    // EOQ 최적점에서 발주비용과 유지비용은 거의 같아야 함 (10% 오차 허용)
    const ratio = result.annualOrderingCost / result.annualHoldingCost;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });
});

describe("calculateHoldingCost", () => {
  it("기본 유지비율 25% 적용", () => {
    expect(calculateHoldingCost({ unitPrice: 10000 })).toBe(2500);
  });

  it("창고비·보험료·기타 합산", () => {
    const result = calculateHoldingCost({
      unitPrice: 10000,
      holdingRate: 0.2,
      monthlyStorageCost: 100,
      annualInsuranceCost: 50,
      otherAnnualCost: 50,
    });
    // 2000 + 1200 + 50 + 50 = 3300
    expect(result).toBe(3300);
  });
});

describe("compareOrderQuantityCost", () => {
  it("EOQ와 동일 수량이면 비용 차이 0에 가까움", () => {
    const eoqResult = calculateEOQ({
      annualDemand: 1000,
      orderingCost: 50,
      holdingCostPerUnit: 2,
    });
    const comparison = compareOrderQuantityCost(
      eoqResult, eoqResult.eoq, 1000, 50, 2
    );
    expect(Math.abs(comparison.costDifference)).toBeLessThan(10);
    expect(comparison.costIncreasePercent).toBeCloseTo(0, 0);
  });

  it("EOQ보다 많이 주문하면 비용 증가", () => {
    const eoqResult = calculateEOQ({
      annualDemand: 1000,
      orderingCost: 50,
      holdingCostPerUnit: 2,
    });
    const comparison = compareOrderQuantityCost(
      eoqResult, eoqResult.eoq * 2, 1000, 50, 2
    );
    expect(comparison.costDifference).toBeGreaterThan(0);
  });

  it("수량 0 이하이면 0 반환", () => {
    const eoqResult = calculateEOQ({ annualDemand: 1000, orderingCost: 50, holdingCostPerUnit: 2 });
    const comparison = compareOrderQuantityCost(eoqResult, 0, 1000, 50, 2);
    expect(comparison.actualAnnualCost).toBe(0);
  });
});

describe("calculateEOQWithDiscount", () => {
  it("할인 구간이 낮은 가격일수록 대량 주문이 유리할 수 있음", () => {
    const result = calculateEOQWithDiscount(1000, 50, 0.25, [
      { minQuantity: 1, discountedPrice: 10000 },
      { minQuantity: 500, discountedPrice: 9000 },
    ]);
    expect(result.optimalQuantity).toBeGreaterThan(0);
    expect(result.totalAnnualCost).toBeGreaterThan(0);
  });

  it("단일 구간이면 일반 EOQ와 동일", () => {
    const result = calculateEOQWithDiscount(1000, 50, 0.25, [
      { minQuantity: 1, discountedPrice: 10000 },
    ]);
    const holdingCost = 10000 * 0.25;
    const eoqResult = calculateEOQ({ annualDemand: 1000, orderingCost: 50, holdingCostPerUnit: holdingCost });
    expect(result.optimalQuantity).toBeGreaterThanOrEqual(eoqResult.eoq);
  });
});
