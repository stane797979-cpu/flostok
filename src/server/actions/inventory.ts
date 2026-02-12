"use server";

import { db } from "@/server/db";
import {
  inventory,
  inventoryHistory,
  products,
  type Inventory,
  type InventoryHistory,
} from "@/server/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { classifyInventoryStatus } from "@/server/services/scm/inventory-status";
import {
  type InventoryChangeTypeKey,
  getChangeTypeInfo,
} from "@/server/services/inventory/types";
import { deductByFIFO, formatDeductionNotes } from "@/server/services/inventory/lot-fifo";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import { checkAndCreateInventoryAlert } from "@/server/services/notifications/inventory-alerts";

/**
 * 재고 변동 입력 스키마
 */
const inventoryTransactionSchema = z.object({
  productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
  changeType: z.enum([
    "INBOUND_PURCHASE",
    "INBOUND_RETURN",
    "INBOUND_ADJUSTMENT",
    "INBOUND_TRANSFER",
    "OUTBOUND_SALE",
    "OUTBOUND_DISPOSAL",
    "OUTBOUND_ADJUSTMENT",
    "OUTBOUND_TRANSFER",
    "OUTBOUND_SAMPLE",
    "OUTBOUND_LOSS",
    "OUTBOUND_RETURN",
  ] as const),
  quantity: z.coerce.number().min(1, "수량은 1 이상이어야 합니다"),
  referenceId: z.string().uuid().optional(),
  notes: z.string().optional(),
  location: z.string().optional(),
});

export type InventoryTransactionInput = z.infer<typeof inventoryTransactionSchema>;

/**
 * 재고 목록 조회
 */
type InventoryListItem = {
  id: string;
  organizationId: string;
  productId: string;
  currentStock: number;
  availableStock: number | null;
  reservedStock: number | null;
  incomingStock: number | null;
  status: (typeof inventory.status.enumValues)[number] | null;
  location: string | null;
  inventoryValue: number | null;
  daysOfInventory: number | null;
  lastUpdatedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  product: { sku: string; name: string; safetyStock: number | null; reorderPoint: number | null; abcGrade: string | null; xyzGrade: string | null };
};

export async function getInventoryList(options?: {
  productId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: InventoryListItem[];
  total: number;
}> {
  const user = await requireAuth();
  const { productId, status, limit = 50, offset = 0 } = options || {};

  const conditions = [eq(inventory.organizationId, user.organizationId)];

  if (productId) {
    conditions.push(eq(inventory.productId, productId));
  }
  if (status) {
    conditions.push(eq(inventory.status, status as (typeof inventory.status.enumValues)[number]));
  }

  // 30일 전 날짜 (일평균출고량 계산용)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

  const [items, countResult, outboundData] = await Promise.all([
    db
      .select({
        id: inventory.id,
        organizationId: inventory.organizationId,
        productId: inventory.productId,
        currentStock: inventory.currentStock,
        availableStock: inventory.availableStock,
        reservedStock: inventory.reservedStock,
        incomingStock: inventory.incomingStock,
        status: inventory.status,
        location: inventory.location,
        inventoryValue: inventory.inventoryValue,
        daysOfInventory: inventory.daysOfInventory,
        lastUpdatedAt: inventory.lastUpdatedAt,
        updatedAt: inventory.updatedAt,
        createdAt: inventory.createdAt,
        product: {
          sku: products.sku,
          name: products.name,
          safetyStock: products.safetyStock,
          reorderPoint: products.reorderPoint,
          abcGrade: products.abcGrade,
          xyzGrade: products.xyzGrade,
        },
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(inventory.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(inventory)
      .where(and(...conditions)),
    // 최근 30일 제품별 총 출고수량 (inventory_history에서 음수 변동 합산)
    db
      .select({
        productId: inventoryHistory.productId,
        totalOutbound: sql<number>`coalesce(sum(abs(${inventoryHistory.changeAmount})), 0)`,
      })
      .from(inventoryHistory)
      .where(
        and(
          eq(inventoryHistory.organizationId, user.organizationId),
          gte(inventoryHistory.date, thirtyDaysAgoStr),
          sql`${inventoryHistory.changeAmount} < 0`
        )
      )
      .groupBy(inventoryHistory.productId),
  ]);

  // 제품별 일평균출고량 매핑
  const avgDailyOutboundMap = new Map<string, number>();
  for (const row of outboundData) {
    avgDailyOutboundMap.set(row.productId, Math.round((Number(row.totalOutbound) / 30) * 100) / 100);
  }

  return {
    items: items.map((row) => {
      const avgDailyOutbound = avgDailyOutboundMap.get(row.productId) ?? 0;
      const calculatedDoi =
        avgDailyOutbound > 0
          ? Math.round((row.currentStock / avgDailyOutbound) * 100) / 100
          : null;

      return {
        id: row.id,
        organizationId: row.organizationId,
        productId: row.productId,
        currentStock: row.currentStock,
        availableStock: row.availableStock,
        reservedStock: row.reservedStock,
        incomingStock: row.incomingStock,
        status: row.status,
        location: row.location,
        inventoryValue: row.inventoryValue,
        daysOfInventory: calculatedDoi,
        lastUpdatedAt: row.lastUpdatedAt,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
        product: row.product,
      };
    }),
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 제품별 재고 조회
 */
export async function getInventoryByProductId(productId: string): Promise<Inventory | null> {
  const user = await requireAuth();
  const result = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.productId, productId), eq(inventory.organizationId, user.organizationId)))
    .limit(1);

  return result[0] || null;
}

/**
 * 재고 변동 처리
 */
export async function processInventoryTransaction(input: InventoryTransactionInput): Promise<{
  success: boolean;
  stockBefore?: number;
  stockAfter?: number;
  changeAmount?: number;
  newStatus?: string;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // 유효성 검사
    const validated = inventoryTransactionSchema.parse(input);

    // 변동 유형 정보
    const changeTypeInfo = getChangeTypeInfo(validated.changeType as InventoryChangeTypeKey);
    const changeAmount = validated.quantity * changeTypeInfo.sign;

    // 제품 정보 조회
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, validated.productId), eq(products.organizationId, user.organizationId)))
      .limit(1);

    if (!product) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    // 현재 재고 조회 (없으면 생성)
    let currentInventory = await getInventoryByProductId(validated.productId);
    const stockBefore = currentInventory?.currentStock || 0;

    // 출고 시 재고 부족 체크
    if (changeAmount < 0 && stockBefore + changeAmount < 0) {
      return {
        success: false,
        error: `재고가 부족합니다. 현재고: ${stockBefore}, 출고 요청: ${Math.abs(changeAmount)}`,
      };
    }

    const stockAfter = stockBefore + changeAmount;

    // 재고상태 계산
    const statusResult = classifyInventoryStatus({
      currentStock: stockAfter,
      safetyStock: product.safetyStock || 0,
      reorderPoint: product.reorderPoint || 0,
    });

    const today = new Date().toISOString().split("T")[0];

    if (currentInventory) {
      // 재고 업데이트
      await db
        .update(inventory)
        .set({
          currentStock: stockAfter,
          availableStock: stockAfter, // TODO: 예약재고 반영
          status: statusResult.key as (typeof inventory.status.enumValues)[number],
          location: validated.location || currentInventory.location,
          lastUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, currentInventory.id));
    } else {
      // 재고 생성
      const [newInventory] = await db
        .insert(inventory)
        .values({
          organizationId: user.organizationId,
          productId: validated.productId,
          currentStock: stockAfter,
          availableStock: stockAfter,
          status: statusResult.key as (typeof inventory.status.enumValues)[number],
          location: validated.location,
        })
        .returning();
      currentInventory = newInventory;
    }

    // 출고 시 FIFO Lot 차감
    let lotNotes = validated.notes || "";
    if (changeAmount < 0) {
      const fifoResult = await deductByFIFO({
        organizationId: user.organizationId,
        productId: validated.productId,
        quantity: Math.abs(changeAmount),
      });
      if (fifoResult.success && fifoResult.deductions.length > 0) {
        const deductionInfo = formatDeductionNotes(fifoResult.deductions);
        lotNotes = lotNotes ? `${lotNotes} [Lot: ${deductionInfo}]` : `Lot: ${deductionInfo}`;
      }
      // Lot 부족 시에도 총재고 차감은 진행 (기존 데이터 호환)
    }

    // 재고 이력 기록
    await db.insert(inventoryHistory).values({
      organizationId: user.organizationId,
      productId: validated.productId,
      date: today,
      stockBefore,
      stockAfter,
      changeAmount,
      changeType: changeTypeInfo.key,
      referenceId: validated.referenceId,
      referenceType: changeTypeInfo.referenceType,
      notes: lotNotes || null,
    });

    revalidatePath("/dashboard/inventory");
    revalidatePath(`/products/${validated.productId}`);
    revalidateTag(`inventory-${user.organizationId}`);
    revalidateTag(`kpi-${user.organizationId}`);
    revalidateTag(`analytics-${user.organizationId}`);

    // 활동 로깅
    await logActivity({
      user,
      action: "UPDATE",
      entityType: "inventory",
      entityId: validated.productId,
      description: `재고 변동: ${changeTypeInfo.label} ${changeAmount > 0 ? "+" : ""}${changeAmount}개`,
    });

    // 알림 자동 트리거 (fire-and-forget)
    checkAndCreateInventoryAlert({
      organizationId: user.organizationId,
      productId: validated.productId,
      stockBefore,
      stockAfter,
      newStatus: statusResult.key,
    }).catch((err) => console.error("[inventoryAlert] 알림 트리거 오류:", err));

    return {
      success: true,
      stockBefore,
      stockAfter,
      changeAmount,
      newStatus: statusResult.key,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
        return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("재고 변동 처리 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "재고 변동 처리에 실패했습니다",
    };
  }
}

/**
 * 재고 이력 조회
 */
export async function getInventoryHistory(options?: {
  productId?: string;
  startDate?: string;
  endDate?: string;
  changeTypes?: string[];
  limit?: number;
  offset?: number;
}): Promise<{ records: InventoryHistory[]; total: number }> {
  const user = await requireAuth();
  const { productId, limit = 50, offset = 0 } = options || {};

  const conditions = [eq(inventoryHistory.organizationId, user.organizationId)];

  if (productId) {
    conditions.push(eq(inventoryHistory.productId, productId));
  }

  const [records, countResult] = await Promise.all([
    db
      .select()
      .from(inventoryHistory)
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
    records,
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 재고 통계 내부 로직
 */
async function _getInventoryStatsInternal(orgId: string) {
  const result = await db
    .select({
      status: inventory.status,
      count: sql<number>`count(*)`,
      totalValue: sql<number>`sum(${inventory.inventoryValue})`,
    })
    .from(inventory)
    .where(eq(inventory.organizationId, orgId))
    .groupBy(inventory.status);

  const stats = {
    totalProducts: 0,
    outOfStock: 0,
    critical: 0,
    shortage: 0,
    optimal: 0,
    excess: 0,
    totalValue: 0,
  };

  result.forEach((row) => {
    const count = Number(row.count);
    stats.totalProducts += count;
    stats.totalValue += Number(row.totalValue || 0);

    switch (row.status) {
      case "out_of_stock":
        stats.outOfStock = count;
        break;
      case "critical":
        stats.critical = count;
        break;
      case "shortage":
        stats.shortage = count;
        break;
      case "optimal":
        stats.optimal = count;
        break;
      case "excess":
      case "overstock":
        stats.excess += count;
        break;
    }
  });

  return stats;
}

/**
 * 재고 통계 (30초 캐시)
 */
export async function getInventoryStats(): Promise<{
  totalProducts: number;
  outOfStock: number;
  critical: number;
  shortage: number;
  optimal: number;
  excess: number;
  totalValue: number;
}> {
  const user = await requireAuth();
  return unstable_cache(
    () => _getInventoryStatsInternal(user.organizationId),
    [`inventory-stats-${user.organizationId}`],
    { revalidate: 30, tags: [`inventory-${user.organizationId}`] }
  )();
}

/**
 * 재고 초기화 (제품 생성 시)
 */
export async function initializeInventory(
  productId: string,
  initialStock: number = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const existing = await getInventoryByProductId(productId);
    if (existing) {
      return { success: true }; // 이미 존재
    }

    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, user.organizationId)))
      .limit(1);

    if (!product) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    const statusResult = classifyInventoryStatus({
      currentStock: initialStock,
      safetyStock: product.safetyStock || 0,
      reorderPoint: product.reorderPoint || 0,
    });

    await db.insert(inventory).values({
      organizationId: user.organizationId,
      productId,
      currentStock: initialStock,
      availableStock: initialStock,
      status: statusResult.key as (typeof inventory.status.enumValues)[number],
    });

    return { success: true };
  } catch (error) {
    console.error("재고 초기화 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "재고 초기화에 실패했습니다",
    };
  }
}
