import { describe, it, expect } from "vitest";
import {
  calculateReorderPoint,
  shouldReorder,
  daysUntilReorder,
  calculateOrderQuantity,
} from "@/server/services/scm/reorder-point";

describe("calculateReorderPoint — 발주점 계산", () => {
  it("기본 공식: 일평균판매량 × 리드타임 + 안전재고", () => {
    const result = calculateReorderPoint({
      averageDailyDemand: 10,
      leadTimeDays: 7,
      safetyStock: 30,
    });
    // 10 * 7 + 30 = 100
    expect(result.reorderPoint).toBe(100);
    expect(result.leadTimeDemand).toBe(70);
    expect(result.safetyStock).toBe(30);
  });

  it("일평균 0일 때 발주점 = 안전재고", () => {
    const result = calculateReorderPoint({
      averageDailyDemand: 0,
      leadTimeDays: 14,
      safetyStock: 50,
    });
    expect(result.reorderPoint).toBe(50);
    expect(result.leadTimeDemand).toBe(0);
  });

  it("리드타임 0일 때 발주점 = 안전재고", () => {
    const result = calculateReorderPoint({
      averageDailyDemand: 20,
      leadTimeDays: 0,
      safetyStock: 100,
    });
    expect(result.reorderPoint).toBe(100);
    expect(result.leadTimeDemand).toBe(0);
  });

  it("안전재고 0일 때 발주점 = 리드타임 수요", () => {
    const result = calculateReorderPoint({
      averageDailyDemand: 15,
      leadTimeDays: 5,
      safetyStock: 0,
    });
    expect(result.reorderPoint).toBe(75);
  });

  it("소수점 올림 처리", () => {
    const result = calculateReorderPoint({
      averageDailyDemand: 3.3,
      leadTimeDays: 7,
      safetyStock: 10,
    });
    // 3.3 * 7 = 23.1 → ceil = 24, + 10 = 34 → ceil = 34
    expect(result.reorderPoint).toBe(34);
    expect(result.leadTimeDemand).toBe(24);
  });

  it("대량 제품 시나리오", () => {
    const result = calculateReorderPoint({
      averageDailyDemand: 500,
      leadTimeDays: 30,
      safetyStock: 5000,
    });
    // 500 * 30 + 5000 = 20000
    expect(result.reorderPoint).toBe(20000);
  });
});

describe("shouldReorder — 발주 필요 여부", () => {
  it("현재고 < 발주점이면 발주 필요", () => {
    expect(shouldReorder(90, 100)).toBe(true);
  });

  it("현재고 = 발주점이면 발주 필요", () => {
    expect(shouldReorder(100, 100)).toBe(true);
  });

  it("현재고 > 발주점이면 발주 불필요", () => {
    expect(shouldReorder(101, 100)).toBe(false);
  });

  it("현재고 0이면 발주 필요", () => {
    expect(shouldReorder(0, 50)).toBe(true);
  });
});

describe("daysUntilReorder — 발주까지 남은 일수", () => {
  it("이미 발주점 이하면 0일", () => {
    expect(daysUntilReorder(50, 100, 10)).toBe(0);
  });

  it("정상 계산: (150-100) / 10 = 5일", () => {
    expect(daysUntilReorder(150, 100, 10)).toBe(5);
  });

  it("일평균 0이면 null", () => {
    expect(daysUntilReorder(150, 100, 0)).toBeNull();
  });

  it("일평균 음수이면 null", () => {
    expect(daysUntilReorder(150, 100, -5)).toBeNull();
  });
});

describe("calculateOrderQuantity — 권장 발주량", () => {
  it("EOQ 기반: eoq 값이 있으면 우선 사용", () => {
    const result = calculateOrderQuantity({
      currentStock: 20,
      reorderPoint: 100,
      safetyStock: 50,
      averageDailyDemand: 10,
      eoq: 200,
    });
    expect(result.recommendedQuantity).toBe(200);
    expect(result.method).toBe("eoq");
    expect(result.projectedStock).toBe(220); // 20 + 200
  });

  it("목표 재고일수 기반: eoq 없으면 target_days 사용", () => {
    const result = calculateOrderQuantity({
      currentStock: 20,
      reorderPoint: 100,
      safetyStock: 50,
      averageDailyDemand: 10,
      targetDaysOfInventory: 30,
    });
    // targetStock = 10*30 + 50 = 350, qty = 350-20 = 330
    expect(result.recommendedQuantity).toBe(330);
    expect(result.method).toBe("target_days");
    expect(result.projectedStock).toBe(350);
  });

  it("MOQ 적용", () => {
    const result = calculateOrderQuantity({
      currentStock: 340,
      reorderPoint: 100,
      safetyStock: 50,
      averageDailyDemand: 10,
      targetDaysOfInventory: 30,
      minOrderQuantity: 100,
    });
    // targetStock=350, qty=350-340=10 → min(10,100) = 100
    expect(result.recommendedQuantity).toBe(100);
  });

  it("발주 배수 적용", () => {
    const result = calculateOrderQuantity({
      currentStock: 20,
      reorderPoint: 100,
      safetyStock: 50,
      averageDailyDemand: 10,
      targetDaysOfInventory: 30,
      orderMultiple: 100,
    });
    // qty = 330 → ceil(330/100)*100 = 400
    expect(result.recommendedQuantity).toBe(400);
    expect(result.recommendedQuantity % 100).toBe(0);
  });
});
