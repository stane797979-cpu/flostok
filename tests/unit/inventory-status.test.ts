import { describe, it, expect } from "vitest";
import {
  classifyInventoryStatus,
  needsReorder,
  isOverstocked,
} from "@/server/services/scm/inventory-status";
import { getInventoryStatus, INVENTORY_STATUS } from "@/lib/constants/inventory-status";

describe("classifyInventoryStatus — 7단계 재고상태 분류", () => {
  const SS = 50; // 안전재고
  const ROP = 100; // 발주점

  it("품절: 현재고 = 0", () => {
    const result = classifyInventoryStatus({ currentStock: 0, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("out_of_stock");
    expect(result.urgencyLevel).toBe(3);
    expect(result.needsAction).toBe(true);
  });

  it("위험: 0 < 현재고 < 안전재고 × 0.5 (20 < 25)", () => {
    const result = classifyInventoryStatus({ currentStock: 20, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("critical");
    expect(result.urgencyLevel).toBe(3);
  });

  it("위험 경계값: 현재고 = 24 (< 25)", () => {
    const result = classifyInventoryStatus({ currentStock: 24, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("critical");
  });

  it("부족 경계값: 현재고 = 25 (= 안전재고 × 0.5)", () => {
    const result = classifyInventoryStatus({ currentStock: 25, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("shortage");
    expect(result.urgencyLevel).toBe(2);
  });

  it("부족: 현재고 = 40 (25 ≤ 40 < 50)", () => {
    const result = classifyInventoryStatus({ currentStock: 40, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("shortage");
  });

  it("주의 경계값: 현재고 = 50 (= 안전재고)", () => {
    const result = classifyInventoryStatus({ currentStock: 50, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("caution");
    expect(result.urgencyLevel).toBe(1);
  });

  it("주의: 현재고 = 70 (50 ≤ 70 < 100)", () => {
    const result = classifyInventoryStatus({ currentStock: 70, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("caution");
  });

  it("적정 경계값: 현재고 = 100 (= 발주점)", () => {
    const result = classifyInventoryStatus({ currentStock: 100, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("optimal");
    expect(result.urgencyLevel).toBe(0);
    expect(result.needsAction).toBe(false);
  });

  it("적정: 현재고 = 120 (100 ≤ 120 < 150)", () => {
    const result = classifyInventoryStatus({ currentStock: 120, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("optimal");
  });

  it("과다 경계값: 현재고 = 150 (= 안전재고 × 3.0)", () => {
    const result = classifyInventoryStatus({ currentStock: 150, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("excess");
    expect(result.urgencyLevel).toBe(1);
  });

  it("과다: 현재고 = 200 (150 ≤ 200 < 250)", () => {
    const result = classifyInventoryStatus({ currentStock: 200, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("excess");
  });

  it("과잉 경계값: 현재고 = 250 (= 안전재고 × 5.0)", () => {
    const result = classifyInventoryStatus({ currentStock: 250, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("overstock");
    expect(result.urgencyLevel).toBe(2);
  });

  it("과잉: 현재고 = 300 (≥ 250)", () => {
    const result = classifyInventoryStatus({ currentStock: 300, safetyStock: SS, reorderPoint: ROP });
    expect(result.key).toBe("overstock");
  });

  it("안전재고 0일 때 정상 동작", () => {
    const result = classifyInventoryStatus({ currentStock: 5, safetyStock: 0, reorderPoint: 10 });
    // SS*0.5=0, SS=0 → critical과 shortage 조건 스킵, currentStock < reorderPoint → caution
    expect(result.key).toBe("caution");
  });

  it("발주점 = 안전재고일 때 caution 구간 없음", () => {
    const result = classifyInventoryStatus({ currentStock: 50, safetyStock: 50, reorderPoint: 50 });
    // currentStock < SS*0.5(25)? No. < SS(50)? No. < ROP(50)? No. < SS*3(150)? Yes → optimal
    expect(result.key).toBe("optimal");
  });
});

describe("needsReorder — 발주 필요 여부", () => {
  it("품절은 발주 필요", () => {
    expect(needsReorder({ currentStock: 0, safetyStock: 50, reorderPoint: 100 })).toBe(true);
  });

  it("위험은 발주 필요", () => {
    expect(needsReorder({ currentStock: 20, safetyStock: 50, reorderPoint: 100 })).toBe(true);
  });

  it("부족은 발주 필요", () => {
    expect(needsReorder({ currentStock: 40, safetyStock: 50, reorderPoint: 100 })).toBe(true);
  });

  it("주의는 발주 필요", () => {
    expect(needsReorder({ currentStock: 70, safetyStock: 50, reorderPoint: 100 })).toBe(true);
  });

  it("적정은 발주 불필요", () => {
    expect(needsReorder({ currentStock: 120, safetyStock: 50, reorderPoint: 100 })).toBe(false);
  });

  it("과다는 발주 불필요", () => {
    expect(needsReorder({ currentStock: 200, safetyStock: 50, reorderPoint: 100 })).toBe(false);
  });
});

describe("isOverstocked — 재고 과다 여부", () => {
  it("적정은 과다 아님", () => {
    expect(isOverstocked({ currentStock: 120, safetyStock: 50, reorderPoint: 100 })).toBe(false);
  });

  it("과다는 과다", () => {
    expect(isOverstocked({ currentStock: 200, safetyStock: 50, reorderPoint: 100 })).toBe(true);
  });

  it("과잉은 과다", () => {
    expect(isOverstocked({ currentStock: 300, safetyStock: 50, reorderPoint: 100 })).toBe(true);
  });
});

describe("getInventoryStatus (constants) — classifyInventoryStatus와 동일 로직 확인", () => {
  it("두 함수의 결과가 일치해야 함 (품절)", () => {
    const a = classifyInventoryStatus({ currentStock: 0, safetyStock: 50, reorderPoint: 100 });
    const b = getInventoryStatus(0, 50, 100);
    expect(a.status.key).toBe(b.key);
  });

  it("두 함수의 결과가 일치해야 함 (적정)", () => {
    const a = classifyInventoryStatus({ currentStock: 120, safetyStock: 50, reorderPoint: 100 });
    const b = getInventoryStatus(120, 50, 100);
    expect(a.status.key).toBe(b.key);
  });

  it("두 함수의 결과가 일치해야 함 (과잉)", () => {
    const a = classifyInventoryStatus({ currentStock: 300, safetyStock: 50, reorderPoint: 100 });
    const b = getInventoryStatus(300, 50, 100);
    expect(a.status.key).toBe(b.key);
  });
});
