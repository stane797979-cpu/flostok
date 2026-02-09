/**
 * 발주 추천 서비스
 * 발주 필요 품목 식별 및 추천 수량 계산
 */

import { classifyInventoryStatus } from "./inventory-status";
import { calculateEOQ, calculateHoldingCost } from "./eoq";
import { calculateOrderQuantity } from "./reorder-point";
import type { SupplyAdjustmentCoefficients } from "@/types/organization-settings";
import { getSupplyCoefficient } from "@/types/organization-settings";

export interface ReorderItem {
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  avgDailySales: number;
  daysOfStock: number | null; // 현재 재고로 버틸 수 있는 일수
  recommendedQty: number;
  urgencyLevel: number; // 0-3
  status: "out_of_stock" | "critical" | "shortage" | "caution";
  supplier?: {
    id: string;
    name: string;
    leadTime: number;
  };
}

export interface ProductReorderData {
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  avgDailySales: number;
  abcGrade?: "A" | "B" | "C";
  xyzGrade?: "X" | "Y" | "Z";
  moq: number;
  leadTime: number;
  unitPrice: number;
  costPrice: number;
  supplierId?: string;
  supplierName?: string;
  /** 조직 설정의 공급물량 보정계수 */
  supplyCoefficients?: SupplyAdjustmentCoefficients;
}

/**
 * 발주 필요 여부 판단
 */
export function shouldReorder(currentStock: number, reorderPoint: number): boolean {
  return currentStock <= reorderPoint;
}

/**
 * 재고일수 계산 (현재 재고로 몇 일 버틸 수 있는지)
 */
export function calculateDaysOfStock(
  currentStock: number,
  avgDailySales: number,
  safetyStock: number = 0
): number | null {
  if (avgDailySales <= 0) return null;

  // 안전재고 제외하고 가용 재고일수 계산
  const availableStock = Math.max(0, currentStock - safetyStock);
  return Math.floor(availableStock / avgDailySales);
}

/**
 * 발주 필요 품목으로 변환
 */
export function convertToReorderItem(data: ProductReorderData): ReorderItem | null {
  const { currentStock, safetyStock, reorderPoint, avgDailySales } = data;

  // 발주 필요 여부 확인
  if (!shouldReorder(currentStock, reorderPoint)) {
    return null;
  }

  // 재고상태 분류
  const statusResult = classifyInventoryStatus({
    currentStock,
    safetyStock,
    reorderPoint,
  });

  // 발주 필요 상태만 포함
  if (!["out_of_stock", "critical", "shortage", "caution"].includes(statusResult.key)) {
    return null;
  }

  // 재고일수 계산
  const daysOfStock = calculateDaysOfStock(currentStock, avgDailySales, safetyStock);

  // 추천 수량 계산
  const recommendedQty = calculateRecommendedQuantity(data);

  return {
    productId: data.productId,
    sku: data.sku,
    productName: data.productName,
    currentStock,
    safetyStock,
    reorderPoint,
    avgDailySales,
    daysOfStock,
    recommendedQty,
    urgencyLevel: statusResult.urgencyLevel,
    status: statusResult.key as "out_of_stock" | "critical" | "shortage" | "caution",
    supplier:
      data.supplierId && data.supplierName
        ? {
            id: data.supplierId,
            name: data.supplierName,
            leadTime: data.leadTime,
          }
        : undefined,
  };
}

/**
 * 추천 발주 수량 계산
 *
 * 보정계수 적용 로직:
 * 적정재고 = (일평균출고 × 목표재고일수 × 보정계수) + 안전재고
 * 보정계수는 ABC-XYZ 등급 조합에 따라 0.65~1.0 범위
 * (AX=1.0 → 핵심+안정 품목은 그대로, CZ=0.65 → 저가+불안정 품목은 35% 축소)
 */
export function calculateRecommendedQuantity(data: ProductReorderData): number {
  const { currentStock, safetyStock, avgDailySales, moq, costPrice } = data;

  // ABC-XYZ 보정계수 조회
  const coefficient = getSupplyCoefficient(
    data.supplyCoefficients,
    data.abcGrade,
    data.xyzGrade
  );

  // 연간 수요 추정 (보정계수 적용)
  const adjustedDailySales = avgDailySales * coefficient;
  const annualDemand = adjustedDailySales * 365;

  // EOQ 계산 (연간 수요가 충분한 경우)
  let eoqQty = 0;
  if (annualDemand > 0 && costPrice > 0) {
    const orderingCost = 50000; // 1회 발주 비용 (기본값 5만원)
    const holdingCost = calculateHoldingCost({
      unitPrice: costPrice,
      holdingRate: 0.25, // 25% 유지비율
    });

    const eoqResult = calculateEOQ({
      annualDemand,
      orderingCost,
      holdingCostPerUnit: holdingCost,
    });

    eoqQty = eoqResult.eoq;
  }

  // 발주량 계산 (EOQ 또는 목표 재고일수 기반, 보정된 일평균 적용)
  const orderQtyResult = calculateOrderQuantity({
    currentStock,
    reorderPoint: data.reorderPoint,
    safetyStock,
    averageDailyDemand: adjustedDailySales,
    targetDaysOfInventory: 30, // 목표 30일 재고
    eoq: eoqQty > 0 ? eoqQty : undefined,
    minOrderQuantity: moq,
    orderMultiple: 1,
  });

  return orderQtyResult.recommendedQuantity;
}

/**
 * 발주 필요 품목 우선순위 스코어링
 *
 * 스코어링 기준:
 * 1. 재고상태 (50점): 품절(50) > 위험(40) > 부족(30) > 주의(20)
 * 2. ABC등급 (30점): A(30) > B(20) > C(10)
 * 3. 재고일수 (20점): 음수/0일(20) > 1-3일(15) > 4-7일(10) > 7일+(5)
 */
export function calculateReorderPriority(item: ReorderItem, abcGrade?: "A" | "B" | "C"): number {
  let score = 0;

  // 1. 재고상태 스코어 (50점)
  const statusScores = {
    out_of_stock: 50,
    critical: 40,
    shortage: 30,
    caution: 20,
  };
  score += statusScores[item.status];

  // 2. ABC등급 스코어 (30점)
  if (abcGrade) {
    const abcScores = { A: 30, B: 20, C: 10 };
    score += abcScores[abcGrade];
  } else {
    score += 15; // 등급 미지정 시 중간값
  }

  // 3. 재고일수 스코어 (20점)
  if (item.daysOfStock === null || item.daysOfStock <= 0) {
    score += 20; // 재고일수 계산 불가 또는 0일
  } else if (item.daysOfStock <= 3) {
    score += 15; // 1-3일
  } else if (item.daysOfStock <= 7) {
    score += 10; // 4-7일
  } else {
    score += 5; // 7일 이상
  }

  return score;
}

/**
 * 발주 필요 품목 목록 정렬
 * 우선순위 점수 기준 내림차순
 */
export function sortReorderItems(
  items: ReorderItem[],
  productsABCGrades: Map<string, "A" | "B" | "C">
): ReorderItem[] {
  return items.sort((a, b) => {
    const scoreA = calculateReorderPriority(a, productsABCGrades.get(a.productId));
    const scoreB = calculateReorderPriority(b, productsABCGrades.get(b.productId));
    return scoreB - scoreA; // 높은 점수 우선
  });
}

/**
 * 긴급도별 필터링
 */
export function filterByUrgency(items: ReorderItem[], urgencyLevel?: number): ReorderItem[] {
  if (urgencyLevel === undefined) return items;
  return items.filter((item) => item.urgencyLevel >= urgencyLevel);
}

/**
 * ABC등급별 필터링
 */
export function filterByABCGrade(
  items: ReorderItem[],
  productsABCGrades: Map<string, "A" | "B" | "C">,
  grade?: "A" | "B" | "C"
): ReorderItem[] {
  if (!grade) return items;
  return items.filter((item) => productsABCGrades.get(item.productId) === grade);
}
