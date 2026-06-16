"use server";

import { db } from "@/server/db";
import { inventory, inventoryHistory, products } from "@/server/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "./auth-helpers";
import { getChangeTypeByKey } from "@/server/services/inventory/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/server/services/activity-log";

export interface OutboundRecord {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  date: string;
  changeAmount: number;
  changeType: string;
  changeTypeLabel: string;
  stockBefore: number;
  stockAfter: number;
  notes: string | null;
  createdAt: Date;
}

/**
 * 출고 기록 조회
 *
 * inventory_history에서 changeAmount < 0인 기록을 조회합니다.
 */
export async function getOutboundRecords(options?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ records: OutboundRecord[]; total: number }> {
  const user = await requireAuth();
  const { startDate, endDate, limit = 100, offset = 0 } = options || {};

  const conditions = [
    eq(inventoryHistory.organizationId, user.organizationId),
    sql`${inventoryHistory.changeAmount} < 0`,
  ];

  if (startDate) {
    conditions.push(sql`${inventoryHistory.date} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${inventoryHistory.date} <= ${endDate}`);
  }

  const [records, countResult] = await Promise.all([
    db
      .select({
        record: inventoryHistory,
        product: {
          sku: products.sku,
          name: products.name,
        },
      })
      .from(inventoryHistory)
      .innerJoin(products, eq(inventoryHistory.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryHistory.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryHistory)
      .where(and(...conditions)),
  ]);

  return {
    records: records.map((row) => {
      const typeInfo = getChangeTypeByKey(row.record.changeType);
      return {
        id: row.record.id,
        productId: row.record.productId,
        productSku: row.product.sku,
        productName: row.product.name,
        date: row.record.date,
        changeAmount: row.record.changeAmount,
        changeType: row.record.changeType,
        changeTypeLabel: typeInfo?.label || row.record.changeType,
        stockBefore: row.record.stockBefore,
        stockAfter: row.record.stockAfter,
        notes: row.record.notes,
        createdAt: row.record.createdAt,
      };
    }),
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 출고 기록 수정 (수량, 비고)
 *
 * inventory_history 수정 + inventory.currentStock 보정
 */
const updateOutboundSchema = z.object({
  historyId: z.string().uuid(),
  quantity: z.number().int().positive("수량은 1 이상이어야 합니다"),
  notes: z.string().optional(),
});

export async function updateOutboundRecord(input: {
  historyId: string;
  quantity: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const validated = updateOutboundSchema.parse(input);

    // 기존 이력 조회
    const [existing] = await db
      .select()
      .from(inventoryHistory)
      .where(
        and(
          eq(inventoryHistory.id, validated.historyId),
          eq(inventoryHistory.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: "출고 기록을 찾을 수 없습니다" };
    }

    // 기존 출고수량 (음수) → 양수로 변환
    const oldQuantity = Math.abs(existing.changeAmount);
    const newQuantity = validated.quantity;
    const diff = oldQuantity - newQuantity; // 양수: 출고 줄어듦(재고 증가), 음수: 출고 늘어남(재고 감소)

    // inventory_history 수정
    const newChangeAmount = -newQuantity;
    const newStockAfter = existing.stockBefore + newChangeAmount;

    await db
      .update(inventoryHistory)
      .set({
        changeAmount: newChangeAmount,
        stockAfter: newStockAfter,
        notes: validated.notes ?? existing.notes,
      })
      .where(eq(inventoryHistory.id, validated.historyId));

    // inventory.currentStock 보정
    if (diff !== 0) {
      await db
        .update(inventory)
        .set({
          currentStock: sql`${inventory.currentStock} + ${diff}`,
          availableStock: sql`${inventory.availableStock} + ${diff}`,
          lastUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventory.organizationId, user.organizationId),
            eq(inventory.productId, existing.productId)
          )
        );
    }

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "outbound_record",
      entityId: validated.historyId,
      description: `출고 기록 수정 (수량: ${oldQuantity} → ${newQuantity})`,
    });

    revalidatePath("/dashboard/outbound");
    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message };
    }
    console.error("출고 기록 수정 오류:", error);
    return { success: false, error: "출고 기록 수정에 실패했습니다" };
  }
}

/**
 * 출고 기록 삭제 (재고 복원)
 *
 * inventory_history 삭제 + inventory.currentStock 복원
 */
export async function deleteOutboundRecord(historyId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // 기존 이력 조회
    const [existing] = await db
      .select()
      .from(inventoryHistory)
      .where(
        and(
          eq(inventoryHistory.id, historyId),
          eq(inventoryHistory.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: "출고 기록을 찾을 수 없습니다" };
    }

    // 출고 수량 복원 (changeAmount는 음수이므로 절대값만큼 재고 복원)
    const restoreAmount = Math.abs(existing.changeAmount);

    // inventory_history 삭제
    await db
      .delete(inventoryHistory)
      .where(eq(inventoryHistory.id, historyId));

    // inventory.currentStock 복원
    await db
      .update(inventory)
      .set({
        currentStock: sql`${inventory.currentStock} + ${restoreAmount}`,
        availableStock: sql`${inventory.availableStock} + ${restoreAmount}`,
        lastUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventory.organizationId, user.organizationId),
          eq(inventory.productId, existing.productId)
        )
      );

    await logActivity({
      user,
      action: "DELETE",
      entityType: "outbound_record",
      entityId: historyId,
      description: `출고 기록 삭제 (${restoreAmount}개 재고 복원)`,
    });

    revalidatePath("/dashboard/outbound");
    revalidatePath("/dashboard/inventory");
    return { success: true };
  } catch (error) {
    console.error("출고 기록 삭제 오류:", error);
    return { success: false, error: "출고 기록 삭제에 실패했습니다" };
  }
}
