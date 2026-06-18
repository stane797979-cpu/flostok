import { describe, it, expect } from "vitest";
import {
  calculateReorderPoint,
  shouldReorder,
  daysUntilReorder,
  calculateOrderQuantity,
} from "../reorder-point";

describe("calculateReorderPoint", () => {
  it("기본 계산: 일평균 × 리드타임 + 안전재고", () => {
    // 10 × 5 + 20 = 70
    const result = calculateReorderPoint({
      averageDailyDemand: 10,
      leadTimeDays: 5,
      safetyStock: 20,
    });
    expect(result.reorderPoint).toBe(70);
    expect(result.leadTimeDemand).toBe(50);
    expect(result.safetyStock).toBe(20);
  });

  it("리드타임 수요는 올림 처리", () => {
    // 7.5 × 4 = 30 (정수), + 10 = 40
    const result = calculateReorderPoint({
      averageDailyDemand: 7.5,
      leadTimeDays: 4,
      safetyStock: 10,
    });
    expect(result.leadTimeDemand).toBe(30);
    expect(result.reorderPoint).toBe(40);
  });

  it("소수 결과는 올림 처리", () => {
    // 3.3 × 3 = 9.9 → 10, + 5 = 15
    const result = calculateReorderPoint({
      averageDailyDemand: 3.3,
      leadTimeDays: 3,
      safetyStock: 5,
    });
    expect(result.leadTimeDemand).toBe(Math.ceil(3.3 * 3));
    expect(result.reorderPoint).toBe(Math.ceil(3.3 * 3) + 5);
  });

  it("안전재고 0이면 리드타임 수요만", () => {
    const result = calculateReorderPoint({
      averageDailyDemand: 20,
      leadTimeDays: 3,
      safetyStock: 0,
    });
    expect(result.reorderPoint).toBe(60);
  });
});

describe("shouldReorder", () => {
  it("현재고 <= 재발주점이면 true", () => {
    expect(shouldReorder(50, 50)).toBe(true);
    expect(shouldReorder(30, 50)).toBe(true);
  });

  it("현재고 > 재발주점이면 false", () => {
    expect(shouldReorder(51, 50)).toBe(false);
    expect(shouldReorder(100, 50)).toBe(false);
  });
});

describe("daysUntilReorder", () => {
  it("이미 발주점 도달이면 0 반환", () => {
    expect(daysUntilReorder(40, 50, 10)).toBe(0);
    expect(daysUntilReorder(50, 50, 10)).toBe(0);
  });

  it("남은 일수 계산: (현재고 - 재발주점) / 일평균", () => {
    // (100 - 50) / 10 = 5일
    expect(daysUntilReorder(100, 50, 10)).toBe(5);
  });

  it("소수 결과는 내림(floor) 처리", () => {
    // (75 - 50) / 10 = 2.5 → 2
    expect(daysUntilReorder(75, 50, 10)).toBe(2);
  });

  it("일평균 0이면 null 반환", () => {
    expect(daysUntilReorder(100, 50, 0)).toBeNull();
  });
});

describe("calculateOrderQuantity", () => {
  it("목표 재고일수 기반 발주량 계산", () => {
    // 목표재고 = 10 × 30 + 20 = 320, 현재고 50 → 발주 270
    const result = calculateOrderQuantity({
      currentStock: 50,
      reorderPoint: 30,
      safetyStock: 20,
      averageDailyDemand: 10,
      targetDaysOfInventory: 30,
    });
    expect(result.method).toBe("target_days");
    expect(result.recommendedQuantity).toBe(270);
    expect(result.projectedStock).toBe(320);
  });

  it("EOQ 우선 사용", () => {
    const result = calculateOrderQuantity({
      currentStock: 50,
      reorderPoint: 30,
      safetyStock: 20,
      averageDailyDemand: 10,
      eoq: 200,
    });
    expect(result.method).toBe("eoq");
    expect(result.recommendedQuantity).toBe(200);
  });

  it("최소 발주량 미달 시 최소 발주량 적용", () => {
    const result = calculateOrderQuantity({
      currentStock: 290,
      reorderPoint: 30,
      safetyStock: 20,
      averageDailyDemand: 10,
      targetDaysOfInventory: 30,
      minOrderQuantity: 50,
    });
    expect(result.recommendedQuantity).toBeGreaterThanOrEqual(50);
  });

  it("발주 배수 올림 적용", () => {
    // 발주량이 배수(100)에 맞게 올림
    const result = calculateOrderQuantity({
      currentStock: 50,
      reorderPoint: 30,
      safetyStock: 20,
      averageDailyDemand: 10,
      targetDaysOfInventory: 30,
      orderMultiple: 100,
    });
    expect(result.recommendedQuantity % 100).toBe(0);
  });

  it("발주 후 예상 재고일수 계산", () => {
    const result = calculateOrderQuantity({
      currentStock: 50,
      reorderPoint: 30,
      safetyStock: 20,
      averageDailyDemand: 10,
      targetDaysOfInventory: 30,
    });
    // (projectedStock - safetyStock) / dailyDemand
    const expected = Math.floor((result.projectedStock - 20) / 10);
    expect(result.projectedDaysOfInventory).toBe(expected);
  });
});
