/**
 * 재고상태 7단계 정의
 * CLAUDE.md의 SCM 도메인 규칙에 따름
 */

export const INVENTORY_STATUS = {
  OUT_OF_STOCK: {
    key: "out_of_stock",
    label: "품절",
    description: "현재고 = 0",
    color: "zinc",
    bgClass: "bg-zinc-100",
    textClass: "text-zinc-900",
    dotClass: "bg-zinc-900",
    borderClass: "border-zinc-300",
  },
  CRITICAL: {
    key: "critical",
    label: "위험",
    description: "0 < 현재고 < 안전재고 × 0.5",
    color: "red",
    bgClass: "bg-red-100",
    textClass: "text-red-700",
    dotClass: "bg-red-500",
    borderClass: "border-red-300",
  },
  SHORTAGE: {
    key: "shortage",
    label: "부족",
    description: "안전재고 × 0.5 ≤ 현재고 < 안전재고",
    color: "orange",
    bgClass: "bg-orange-100",
    textClass: "text-orange-700",
    dotClass: "bg-orange-500",
    borderClass: "border-orange-300",
  },
  CAUTION: {
    key: "caution",
    label: "주의",
    description: "안전재고 ≤ 현재고 < 발주점",
    color: "yellow",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-700",
    dotClass: "bg-yellow-500",
    borderClass: "border-yellow-300",
  },
  OPTIMAL: {
    key: "optimal",
    label: "적정",
    description: "발주점 ≤ 현재고 < 안전재고 × 3.0",
    color: "green",
    bgClass: "bg-green-100",
    textClass: "text-green-700",
    dotClass: "bg-green-500",
    borderClass: "border-green-300",
  },
  EXCESS: {
    key: "excess",
    label: "과다",
    description: "안전재고 × 3.0 ≤ 현재고 < 안전재고 × 5",
    color: "blue",
    bgClass: "bg-blue-100",
    textClass: "text-blue-700",
    dotClass: "bg-blue-500",
    borderClass: "border-blue-300",
  },
  OVERSTOCK: {
    key: "overstock",
    label: "과잉",
    description: "현재고 ≥ 안전재고 × 5.0",
    color: "purple",
    bgClass: "bg-purple-100",
    textClass: "text-purple-700",
    dotClass: "bg-purple-500",
    borderClass: "border-purple-300",
  },
} as const;

export type InventoryStatusKey = keyof typeof INVENTORY_STATUS;
export type InventoryStatus = (typeof INVENTORY_STATUS)[InventoryStatusKey];

/**
 * 재고 수량·안전재고·발주점 기반 재고상태 분류 핵심 로직
 * (getInventoryStatus와 classifyInventoryStatus 양쪽에서 공유)
 */
function _resolveStatus(
  currentStock: number,
  safetyStock: number,
  reorderPoint: number
): InventoryStatus {
  if (currentStock === 0) {
    return INVENTORY_STATUS.OUT_OF_STOCK;
  }
  // 안전재고 미설정 시 — safetyStock=0이면 배수 비교가 무의미
  if (safetyStock <= 0) {
    if (reorderPoint > 0 && currentStock < reorderPoint) {
      return INVENTORY_STATUS.CAUTION;
    }
    return INVENTORY_STATUS.OPTIMAL;
  }
  if (currentStock < safetyStock * 0.5) {
    return INVENTORY_STATUS.CRITICAL;
  }
  if (currentStock < safetyStock) {
    return INVENTORY_STATUS.SHORTAGE;
  }
  if (currentStock < reorderPoint) {
    return INVENTORY_STATUS.CAUTION;
  }
  if (currentStock < safetyStock * 3.0) {
    return INVENTORY_STATUS.OPTIMAL;
  }
  if (currentStock < safetyStock * 5.0) {
    return INVENTORY_STATUS.EXCESS;
  }
  return INVENTORY_STATUS.OVERSTOCK;
}

/**
 * 재고 수량과 안전재고, 발주점을 기반으로 재고상태를 계산
 *
 * 내부적으로 `_resolveStatus()`를 호출하여 로직을 단일화합니다.
 * 전체 메타데이터(needsAction, urgencyLevel 등)가 필요한 경우
 * `services/scm/inventory-status`의 `classifyInventoryStatus()` 사용을 권장합니다.
 */
export function getInventoryStatus(
  currentStock: number,
  safetyStock: number,
  reorderPoint: number
): InventoryStatus {
  return _resolveStatus(currentStock, safetyStock, reorderPoint);
}

/**
 * @internal
 * services/scm/inventory-status의 classifyInventoryStatus()에서 사용하기 위해
 * 분류 핵심 로직을 노출합니다. 외부에서는 직접 사용하지 마세요.
 */
export { _resolveStatus as _resolveInventoryStatus };
