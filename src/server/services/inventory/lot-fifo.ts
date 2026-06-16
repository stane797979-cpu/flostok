/**
 * Lot 기반 FIFO(선입선출) 차감 서비스
 *
 * 출고 시 유통기한 빠른 순(FEFO) → 입고일 빠른 순(FIFO) → 생성일 순으로 자동 차감
 */

import { db } from "@/server/db";
import { inventoryLots } from "@/server/db/schema";
import { eq, and, gt, asc, sql } from "drizzle-orm";

export interface FIFODeduction {
  lotId: string;
  lotNumber: string;
  quantity: number;
  expiryDate: string | null;
}

export interface DeductByFIFOParams {
  organizationId: string;
  productId: string;
  quantity: number;
}

export interface DeductByFIFOResult {
  success: boolean;
  deductions: FIFODeduction[];
  error?: string;
}

/**
 * FIFO 기반 Lot 재고 차감
 *
 * 정렬 우선순위:
 * 1. expiryDate ASC NULLS LAST (유통기한 빠른 것 우선, 없는 것은 마지막)
 * 2. receivedDate ASC (입고일 빠른 것 우선)
 * 3. createdAt ASC (생성일 빠른 것 우선)
 */
export async function deductByFIFO(
  params: DeductByFIFOParams
): Promise<DeductByFIFOResult> {
  const { organizationId, productId, quantity } = params;

  if (quantity <= 0) {
    return { success: false, deductions: [], error: "차감 수량은 1 이상이어야 합니다" };
  }

  // 해당 제품의 active Lot 조회 (FIFO 순서)
  const activeLots = await db
    .select()
    .from(inventoryLots)
    .where(
      and(
        eq(inventoryLots.organizationId, organizationId),
        eq(inventoryLots.productId, productId),
        eq(inventoryLots.status, "active"),
        gt(inventoryLots.remainingQuantity, 0)
      )
    )
    .orderBy(
      sql`${inventoryLots.expiryDate} ASC NULLS LAST`,
      asc(inventoryLots.receivedDate),
      asc(inventoryLots.createdAt)
    );

  // 사용 가능한 총 수량 확인
  const totalAvailable = activeLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
  if (totalAvailable < quantity) {
    return {
      success: false,
      deductions: [],
      error: `Lot 재고가 부족합니다. 요청: ${quantity}, Lot 가용: ${totalAvailable}`,
    };
  }

  // 순차 차감
  let remaining = quantity;
  const deductions: FIFODeduction[] = [];

  for (const lot of activeLots) {
    if (remaining <= 0) break;

    const deductQty = Math.min(remaining, lot.remainingQuantity);
    const newRemaining = lot.remainingQuantity - deductQty;
    const newStatus = newRemaining === 0 ? "depleted" : "active";

    await db
      .update(inventoryLots)
      .set({
        remainingQuantity: newRemaining,
        status: newStatus as "active" | "depleted" | "expired",
        updatedAt: new Date(),
      })
      .where(eq(inventoryLots.id, lot.id));

    deductions.push({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      quantity: deductQty,
      expiryDate: lot.expiryDate,
    });

    remaining -= deductQty;
  }

  return { success: true, deductions };
}

/**
 * FIFO 차감 내역을 notes 문자열로 변환
 */
export function formatDeductionNotes(deductions: FIFODeduction[]): string {
  if (deductions.length === 0) return "";
  return deductions
    .map((d) => {
      const expiry = d.expiryDate ? ` (기한:${d.expiryDate})` : "";
      return `${d.lotNumber}: ${d.quantity}개${expiry}`;
    })
    .join(", ");
}
