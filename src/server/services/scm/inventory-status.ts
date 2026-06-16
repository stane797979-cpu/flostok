/**
 * 재고상태 분류 서비스
 * DB enum과 동기화된 7단계 재고상태 분류
 */

import { INVENTORY_STATUS, type InventoryStatus } from "@/lib/constants/inventory-status";

export type InventoryStatusKey =
  | "out_of_stock"
  | "critical"
  | "shortage"
  | "caution"
  | "optimal"
  | "excess"
  | "overstock";

export interface InventoryStatusInput {
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
}

export interface InventoryStatusResult {
  status: InventoryStatus;
  key: InventoryStatusKey;
  needsAction: boolean;
  urgencyLevel: number; // 0-3 (0: 없음, 1: 낮음, 2: 중간, 3: 높음)
  recommendation: string;
}

/**
 * 재고상태 분류 및 권장 조치 반환
 *
 * 조건:
 * - 품절: 현재고 = 0
 * - 위험: 0 < 현재고 < 안전재고 × 0.5
 * - 부족: 안전재고 × 0.5 ≤ 현재고 < 안전재고
 * - 주의: 안전재고 ≤ 현재고 < 발주점
 * - 적정: 발주점 ≤ 현재고 < 안전재고 × 3.0
 * - 과다: 안전재고 × 3.0 ≤ 현재고 < 안전재고 × 5
 * - 과잉: 현재고 ≥ 안전재고 × 5.0
 */
export function classifyInventoryStatus(input: InventoryStatusInput): InventoryStatusResult {
  const { currentStock, safetyStock, reorderPoint } = input;

  if (currentStock === 0) {
    return {
      status: INVENTORY_STATUS.OUT_OF_STOCK,
      key: "out_of_stock",
      needsAction: true,
      urgencyLevel: 3,
      recommendation: "즉시 긴급 발주 필요",
    };
  }

  if (currentStock < safetyStock * 0.5) {
    return {
      status: INVENTORY_STATUS.CRITICAL,
      key: "critical",
      needsAction: true,
      urgencyLevel: 3,
      recommendation: "긴급 발주 권장, 리드타임 단축 협의 필요",
    };
  }

  if (currentStock < safetyStock) {
    return {
      status: INVENTORY_STATUS.SHORTAGE,
      key: "shortage",
      needsAction: true,
      urgencyLevel: 2,
      recommendation: "발주 진행 필요",
    };
  }

  if (currentStock < reorderPoint) {
    return {
      status: INVENTORY_STATUS.CAUTION,
      key: "caution",
      needsAction: true,
      urgencyLevel: 1,
      recommendation: "발주 검토 권장",
    };
  }

  if (currentStock < safetyStock * 3.0) {
    return {
      status: INVENTORY_STATUS.OPTIMAL,
      key: "optimal",
      needsAction: false,
      urgencyLevel: 0,
      recommendation: "적정 재고 유지 중",
    };
  }

  if (currentStock < safetyStock * 5.0) {
    return {
      status: INVENTORY_STATUS.EXCESS,
      key: "excess",
      needsAction: true,
      urgencyLevel: 1,
      recommendation: "재고 소진 방안 검토 (프로모션, 타 사업장 이동)",
    };
  }

  return {
    status: INVENTORY_STATUS.OVERSTOCK,
    key: "overstock",
    needsAction: true,
    urgencyLevel: 2,
    recommendation: "재고 처분 계획 수립 필요 (할인, 반품, 폐기 검토)",
  };
}

/**
 * 발주 필요 여부 확인
 */
export function needsReorder(input: InventoryStatusInput): boolean {
  const result = classifyInventoryStatus(input);
  return ["out_of_stock", "critical", "shortage", "caution"].includes(result.key);
}

/**
 * 재고 과다 여부 확인
 */
export function isOverstocked(input: InventoryStatusInput): boolean {
  const result = classifyInventoryStatus(input);
  return ["excess", "overstock"].includes(result.key);
}
