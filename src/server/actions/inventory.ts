"use server";

import { db } from "@/server/db";
import {
  inventory,
  inventoryHistory,
  products,
  type Inventory,
  type InventoryHistory,
} from "@/server/db/schema";
import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { classifyInventoryStatus } from "@/server/services/scm/inventory-status";
import {
  type InventoryChangeTypeKey,
  getChangeTypeInfo,
} from "@/server/services/inventory/types";
import { deductByFIFO, formatDeductionNotes } from "@/server/services/inventory/lot-fifo";
import { requireAuth, requireManagerOrAbove, type AuthUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import { createDeletionRequest } from "@/server/services/deletion/deletion-workflow";
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
  warehouseId: z.string().uuid().optional(),
});

export type InventoryTransactionInput = z.infer<typeof inventoryTransactionSchema>;

/**
 * 재고 목록 조회
 */
type InventoryListItem = {
  id: string;
  organizationId: string;
  warehouseId: string;
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
  warehouseId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: InventoryListItem[];
  total: number;
}> {
  const user = await requireAuth();
  const orgId = user.organizationId;
  const { productId, status, warehouseId, limit: lim = 50, offset: off = 0 } = options || {};
  const filterKey = JSON.stringify({ productId, status, warehouseId, lim, off });

  return unstable_cache(
    async () => {
      const conditions = [eq(inventory.organizationId, orgId)];

      if (productId) {
        conditions.push(eq(inventory.productId, productId));
      }
      if (status) {
        conditions.push(eq(inventory.status, status as (typeof inventory.status.enumValues)[number]));
      }
      if (warehouseId) {
        conditions.push(eq(inventory.warehouseId, warehouseId));
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
            warehouseId: inventory.warehouseId,
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
          .limit(lim)
          .offset(off),
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
              eq(inventoryHistory.organizationId, orgId),
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
            warehouseId: row.warehouseId,
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
    },
    [`inventory-list-${orgId}-${filterKey}`],
    { revalidate: 15, tags: [`inventory-${orgId}`] }
  )();
}

/**
 * 특정 기준일 시점의 재고 현황 조회
 * inventory_history에서 해당 날짜 이전 마지막 stockAfter를 조회하여 복원
 */
export async function getInventoryAsOfDate(asOfDate: string, options?: {
  warehouseId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: InventoryListItem[];
  total: number;
  stats: { totalProducts: number; totalStock: number };
}> {
  const user = await requireAuth();
  const orgId = user.organizationId;
  const { warehouseId, limit: lim = 50, offset: off = 0 } = options || {};

  // 기준일까지의 제품별 마지막 재고를 서브쿼리로 조회
  const warehouseCondition = warehouseId
    ? sql`AND ih.warehouse_id = ${warehouseId}`
    : sql``;

  const historicalData = await db.execute(sql`
    WITH latest_history AS (
      SELECT DISTINCT ON (ih.product_id)
        ih.product_id,
        ih.warehouse_id,
        ih.stock_after,
        ih.date
      FROM inventory_history ih
      WHERE ih.organization_id = ${orgId}
        AND ih.date <= ${asOfDate}
        ${warehouseCondition}
      ORDER BY ih.product_id, ih.date DESC, ih.created_at DESC
    )
    SELECT
      lh.product_id,
      lh.warehouse_id,
      lh.stock_after as current_stock,
      lh.date as last_date,
      p.sku,
      p.name as product_name,
      p.safety_stock,
      p.reorder_point,
      p.abc_grade,
      p.xyz_grade
    FROM latest_history lh
    INNER JOIN products p ON p.id = lh.product_id
    ORDER BY p.sku ASC
  `);

  const allRows = historicalData as Array<{
    product_id: string;
    warehouse_id: string;
    current_stock: number;
    last_date: string;
    sku: string;
    product_name: string;
    safety_stock: number | null;
    reorder_point: number | null;
    abc_grade: string | null;
    xyz_grade: string | null;
  }>;

  const total = allRows.length;
  const paginatedRows = allRows.slice(off, off + lim);
  const totalStock = allRows.reduce((sum, r) => sum + Number(r.current_stock), 0);

  const items: InventoryListItem[] = paginatedRows.map((row) => ({
    id: `hist-${row.product_id}`,
    organizationId: orgId,
    warehouseId: row.warehouse_id,
    productId: row.product_id,
    currentStock: Number(row.current_stock),
    availableStock: Number(row.current_stock),
    reservedStock: 0,
    incomingStock: 0,
    status: null,
    location: null,
    inventoryValue: 0,
    daysOfInventory: null,
    lastUpdatedAt: null,
    updatedAt: null,
    createdAt: null,
    product: {
      sku: row.sku,
      name: row.product_name,
      safetyStock: Number(row.safety_stock) || 0,
      reorderPoint: Number(row.reorder_point) || 0,
      abcGrade: row.abc_grade,
      xyzGrade: row.xyz_grade,
    },
  }));

  return {
    items,
    total,
    stats: { totalProducts: total, totalStock },
  };
}

/**
 * 제품별 재고 조회 (다중 창고 대응)
 */
export async function getInventoryByProductId(
  productId: string,
  warehouseId?: string
): Promise<Inventory | null> {
  const user = await requireAuth();

  // warehouseId 없으면 기본 창고 사용
  let targetWarehouseId = warehouseId;
  if (!targetWarehouseId) {
    const { getDefaultWarehouse } = await import("./warehouses");
    const dw = await getDefaultWarehouse();
    if (!dw) return null;
    targetWarehouseId = dw.id;
  }

  const result = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.productId, productId),
        eq(inventory.organizationId, user.organizationId),
        eq(inventory.warehouseId, targetWarehouseId)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * 재고 변동 처리
 */
/** 배치 처리 시 전달 가능한 컨텍스트 */
interface InventoryTransactionContext {
  user?: AuthUser;
  product?: typeof products.$inferSelect;
  skipRevalidate?: boolean;
  skipActivityLog?: boolean;
}

export async function processInventoryTransaction(
  input: InventoryTransactionInput,
  context?: InventoryTransactionContext,
): Promise<{
  success: boolean;
  stockBefore?: number;
  stockAfter?: number;
  changeAmount?: number;
  newStatus?: string;
  error?: string;
}> {
  try {
    const user = context?.user ?? await requireAuth();

    // 유효성 검사
    const validated = inventoryTransactionSchema.parse(input);

    // warehouseId 결정: 입력값 또는 기본 창고
    let warehouseId = validated.warehouseId;
    if (!warehouseId) {
      const { getDefaultWarehouse } = await import("./warehouses");
      const dw = await getDefaultWarehouse();
      if (!dw) return { success: false, error: "기본 창고를 찾을 수 없습니다" };
      warehouseId = dw.id;
    }

    // 변동 유형 정보
    const changeTypeInfo = getChangeTypeInfo(validated.changeType as InventoryChangeTypeKey);
    const changeAmount = validated.quantity * changeTypeInfo.sign;

    // 제품 정보 조회 (컨텍스트에 있으면 DB 조회 생략)
    const product = context?.product ?? (await db
      .select()
      .from(products)
      .where(and(eq(products.id, validated.productId), eq(products.organizationId, user.organizationId)))
      .limit(1)
    )[0];

    if (!product) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    // 현재 재고 조회 (창고별)
    const invResult = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.productId, validated.productId),
          eq(inventory.organizationId, user.organizationId),
          eq(inventory.warehouseId, warehouseId)
        )
      )
      .limit(1);
    let currentInventory: typeof inventory.$inferSelect | null = invResult[0] || null;
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
      // 원자적 재고 업데이트 — race condition 방지
      const [updated] = await db
        .update(inventory)
        .set({
          currentStock: sql`${inventory.currentStock} + ${changeAmount}`,
          availableStock: sql`${inventory.availableStock} + ${changeAmount}`,
          inventoryValue: sql`(${inventory.currentStock} + ${changeAmount}) * ${product.costPrice || 0}`,
          status: statusResult.key as (typeof inventory.status.enumValues)[number],
          location: validated.location || currentInventory.location,
          lastUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inventory.id, currentInventory.id),
            // DB 레벨에서 음수 재고 방지
            sql`${inventory.currentStock} + ${changeAmount} >= 0`
          )
        )
        .returning();

      if (!updated) {
        return {
          success: false,
          error: `재고가 부족합니다. 동시 요청으로 인해 처리할 수 없습니다.`,
        };
      }
    } else {
      // 재고 생성 (창고 포함)
      const [newInventory] = await db
        .insert(inventory)
        .values({
          organizationId: user.organizationId,
          warehouseId: warehouseId,
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
        warehouseId: warehouseId,
        quantity: Math.abs(changeAmount),
      });
      if (fifoResult.success && fifoResult.deductions.length > 0) {
        const deductionInfo = formatDeductionNotes(fifoResult.deductions);
        lotNotes = lotNotes ? `${lotNotes} [Lot: ${deductionInfo}]` : `Lot: ${deductionInfo}`;
      }
      // Lot 부족 시에도 총재고 차감은 진행 (기존 데이터 호환)
    }

    // 재고 이력 기록 (창고 포함)
    await db.insert(inventoryHistory).values({
      organizationId: user.organizationId,
      warehouseId: warehouseId,
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

    if (!context?.skipRevalidate) {
      revalidatePath("/dashboard/inventory");
      revalidatePath(`/products/${validated.productId}`);
      revalidateTag(`inventory-${user.organizationId}`);
      revalidateTag(`kpi-${user.organizationId}`);
      revalidateTag(`analytics-${user.organizationId}`);
    }

    // 활동 로깅
    if (!context?.skipActivityLog) {
      await logActivity({
        user,
        action: "UPDATE",
        entityType: "inventory",
        entityId: validated.productId,
        description: `재고 변동: ${changeTypeInfo.label} ${changeAmount > 0 ? "+" : ""}${changeAmount}개`,
      });
    }

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

// ===== 배치 재고 처리 (N+1 쿼리 제거용) =====

export interface BatchInventoryItem {
  productId: string;
  changeType: InventoryChangeTypeKey;
  quantity: number;
  referenceId?: string;
  notes?: string;
  location?: string;
  warehouseId?: string;
}

/**
 * 배치 재고 처리 — 여러 제품의 재고를 한 번에 처리
 *
 * 단건 processInventoryTransaction을 N번 호출하는 대신,
 * 배치 SELECT → 메모리 계산 → 배치 UPDATE/INSERT로 쿼리 수를 최소화합니다.
 *
 * 주의: FIFO Lot 차감은 제품별로 순차 처리해야 하므로 출고 시에는 여전히 개별 호출합니다.
 * 입고(sign=+1)인 경우에만 완전한 배치 최적화가 적용됩니다.
 */
export async function processBatchInventoryTransactions(
  items: BatchInventoryItem[],
  context?: {
    user?: AuthUser;
    productsMap?: Map<string, typeof products.$inferSelect>;
    warehouseId?: string;
    skipRevalidate?: boolean;
    skipActivityLog?: boolean;
  }
): Promise<{ success: boolean; results: Array<{ productId: string; success: boolean; stockAfter?: number; error?: string }> }> {
  if (items.length === 0) return { success: true, results: [] };

  try {
    const user = context?.user ?? await requireAuth();

    // warehouseId 결정 (공통 또는 아이템별)
    let defaultWarehouseId = context?.warehouseId;
    if (!defaultWarehouseId) {
      const { getDefaultWarehouse } = await import("./warehouses");
      const dw = await getDefaultWarehouse();
      if (!dw) return { success: false, results: items.map(i => ({ productId: i.productId, success: false, error: "기본 창고 없음" })) };
      defaultWarehouseId = dw.id;
    }

    // 1. 고유 productId 추출
    const uniqueProductIds = [...new Set(items.map(i => i.productId))];

    // 2. 배치 제품 조회 (context에 없는 경우만)
    let productsMap = context?.productsMap ?? new Map<string, typeof products.$inferSelect>();
    if (!context?.productsMap && uniqueProductIds.length > 0) {
      const rows = await db
        .select()
        .from(products)
        .where(and(inArray(products.id, uniqueProductIds), eq(products.organizationId, user.organizationId)));
      productsMap = new Map(rows.map(p => [p.id, p]));
    }

    // 3. 배치 현재 재고 조회
    const existingInventory = uniqueProductIds.length > 0
      ? await db
          .select()
          .from(inventory)
          .where(
            and(
              inArray(inventory.productId, uniqueProductIds),
              eq(inventory.organizationId, user.organizationId),
              eq(inventory.warehouseId, defaultWarehouseId)
            )
          )
      : [];
    const inventoryMap = new Map(existingInventory.map(inv => [inv.productId, inv]));

    // 4. 제품별 변동량 집계 (동일 제품 여러 번 등장 가능)
    const changesByProduct = new Map<string, { totalChange: number; items: BatchInventoryItem[] }>();
    for (const item of items) {
      const info = getChangeTypeInfo(item.changeType);
      const change = item.quantity * info.sign;
      const existing = changesByProduct.get(item.productId);
      if (existing) {
        existing.totalChange += change;
        existing.items.push(item);
      } else {
        changesByProduct.set(item.productId, { totalChange: change, items: [item] });
      }
    }

    // 5. 출고(음수) 포함 제품은 FIFO가 필요하므로 개별 처리 목록 분리
    const batchUpdates: Array<{
      productId: string;
      stockBefore: number;
      stockAfter: number;
      invId?: string;
      newStatus: string;
    }> = [];
    const historyInserts: Array<{
      organizationId: string;
      warehouseId: string;
      productId: string;
      date: string;
      stockBefore: number;
      stockAfter: number;
      changeAmount: number;
      changeType: string;
      referenceId?: string;
      referenceType: string;
      notes: string | null;
    }> = [];
    const results: Array<{ productId: string; success: boolean; stockAfter?: number; error?: string }> = [];
    const today = new Date().toISOString().split("T")[0];

    // 출고가 포함된 제품: FIFO 필요 → 기존 단건 호출
    const fifoNeededProducts: string[] = [];

    for (const [productId, data] of changesByProduct.entries()) {
      const product = productsMap.get(productId);
      if (!product) {
        results.push({ productId, success: false, error: "제품을 찾을 수 없습니다" });
        continue;
      }

      const hasOutbound = data.items.some(i => getChangeTypeInfo(i.changeType).sign < 0);

      if (hasOutbound) {
        // FIFO 필요: 기존 단건 처리로 폴백 (하지만 product 캐싱 활용)
        fifoNeededProducts.push(productId);
        for (const item of data.items) {
          const wId = item.warehouseId || defaultWarehouseId;
          const result = await processInventoryTransaction(
            { ...item, warehouseId: wId },
            { user, product, skipRevalidate: true, skipActivityLog: true }
          );
          results.push({ productId, success: result.success, stockAfter: result.stockAfter, error: result.error });
        }
        continue;
      }

      // 입고만 있는 경우: 배치 최적화
      const currentInv = inventoryMap.get(productId);
      const stockBefore = currentInv?.currentStock || 0;
      const stockAfter = stockBefore + data.totalChange;

      if (stockAfter < 0) {
        results.push({ productId, success: false, error: `재고 부족: 현재고 ${stockBefore}, 변동 ${data.totalChange}` });
        continue;
      }

      const statusResult = classifyInventoryStatus({
        currentStock: stockAfter,
        safetyStock: product.safetyStock || 0,
        reorderPoint: product.reorderPoint || 0,
      });

      batchUpdates.push({
        productId,
        stockBefore,
        stockAfter,
        invId: currentInv?.id,
        newStatus: statusResult.key,
      });

      // 이력 생성 (각 item별)
      for (const item of data.items) {
        const info = getChangeTypeInfo(item.changeType);
        const change = item.quantity * info.sign;
        historyInserts.push({
          organizationId: user.organizationId,
          warehouseId: defaultWarehouseId,
          productId,
          date: today,
          stockBefore,
          stockAfter,
          changeAmount: change,
          changeType: info.key,
          referenceId: item.referenceId,
          referenceType: info.referenceType,
          notes: item.notes || null,
        });
      }

      results.push({ productId, success: true, stockAfter });
    }

    // 6. 배치 UPDATE/INSERT 실행
    if (batchUpdates.length > 0) {
      const updateOps: Promise<unknown>[] = [];
      const insertValues: Array<typeof inventory.$inferInsert> = [];

      for (const upd of batchUpdates) {
        if (upd.invId) {
          updateOps.push(
            db.update(inventory).set({
              currentStock: upd.stockAfter,
              availableStock: upd.stockAfter,
              status: upd.newStatus as (typeof inventory.status.enumValues)[number],
              lastUpdatedAt: new Date(),
              updatedAt: new Date(),
            }).where(eq(inventory.id, upd.invId))
          );
        } else {
          insertValues.push({
            organizationId: user.organizationId,
            warehouseId: defaultWarehouseId,
            productId: upd.productId,
            currentStock: upd.stockAfter,
            availableStock: upd.stockAfter,
            status: upd.newStatus as (typeof inventory.status.enumValues)[number],
          });
        }
      }

      // 병렬 UPDATE + 배치 INSERT
      await Promise.all([
        ...updateOps,
        ...(insertValues.length > 0 ? [db.insert(inventory).values(insertValues)] : []),
      ]);
    }

    // 7. 배치 이력 INSERT
    if (historyInserts.length > 0) {
      await db.insert(inventoryHistory).values(historyInserts);
    }

    // 8. 알림 트리거 (fire-and-forget)
    for (const upd of batchUpdates) {
      checkAndCreateInventoryAlert({
        organizationId: user.organizationId,
        productId: upd.productId,
        stockBefore: upd.stockBefore,
        stockAfter: upd.stockAfter,
        newStatus: upd.newStatus,
      }).catch(() => {});
    }

    if (!context?.skipRevalidate) {
      revalidatePath("/dashboard/inventory");
      revalidateTag(`inventory-${user.organizationId}`);
      revalidateTag(`kpi-${user.organizationId}`);
      revalidateTag(`analytics-${user.organizationId}`);
    }

    return { success: results.every(r => r.success), results };
  } catch (error) {
    console.error("배치 재고 처리 오류:", error);
    return { success: false, results: items.map(i => ({ productId: i.productId, success: false, error: "배치 처리 실패" })) };
  }
}

/**
 * 재고 수동 조정 (승인 워크플로우 적용)
 * - superadmin: 즉시 조정 (processInventoryTransaction 직접 호출)
 * - admin/manager: 조정 요청 생성 (승인 후 실행)
 * - 시스템 호출(입고, 판매 등)은 processInventoryTransaction을 직접 사용
 */
export async function requestInventoryAdjustment(input: {
  productId: string;
  changeType: "INBOUND_ADJUSTMENT" | "OUTBOUND_ADJUSTMENT";
  quantity: number;
  warehouseId?: string;
  notes?: string;
  location?: string;
}): Promise<{
  success: boolean;
  isRequest?: boolean;
  stockBefore?: number;
  stockAfter?: number;
  changeAmount?: number;
  newStatus?: string;
  error?: string;
}> {
  try {
    const user = await requireManagerOrAbove();

    // superadmin: 즉시 조정
    if (user.isSuperadmin) {
      return processInventoryTransaction({
        productId: input.productId,
        changeType: input.changeType,
        quantity: input.quantity,
        warehouseId: input.warehouseId,
        notes: input.notes ? `${input.notes} (슈퍼관리자 즉시 조정)` : "슈퍼관리자 즉시 조정",
        location: input.location,
      });
    }

    // admin/manager: 조정 요청 생성
    const result = await createDeletionRequest(
      {
        entityType: "inventory_adjustment",
        entityId: input.productId,
        reason: input.notes || `재고 ${input.changeType === "INBOUND_ADJUSTMENT" ? "증가" : "감소"} ${input.quantity}개 조정 요청`,
        adjustmentInfo: {
          changeType: input.changeType,
          quantity: input.quantity,
          warehouseId: input.warehouseId,
        },
      },
      user
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, isRequest: true };
  } catch (error) {
    console.error("재고 조정 요청 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "재고 조정 요청에 실패했습니다",
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
async function _getInventoryStatsInternal(orgId: string, warehouseId?: string) {
  const conditions = [eq(inventory.organizationId, orgId)];
  if (warehouseId) {
    conditions.push(eq(inventory.warehouseId, warehouseId));
  }

  const result = await db
    .select({
      status: inventory.status,
      count: sql<number>`count(*)`,
      totalValue: sql<number>`sum(${inventory.inventoryValue})`,
    })
    .from(inventory)
    .where(and(...conditions))
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
export async function getInventoryStats(warehouseId?: string): Promise<{
  totalProducts: number;
  outOfStock: number;
  critical: number;
  shortage: number;
  optimal: number;
  excess: number;
  totalValue: number;
}> {
  const user = await requireAuth();
  const cacheKey = warehouseId
    ? `inventory-stats-${user.organizationId}-${warehouseId}`
    : `inventory-stats-${user.organizationId}`;

  return unstable_cache(
    () => _getInventoryStatsInternal(user.organizationId, warehouseId),
    [cacheKey],
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

    // 기본 창고 조회
    const { getDefaultWarehouse } = await import("./warehouses");
    const warehouse = await getDefaultWarehouse();
    if (!warehouse) return { success: false, error: "기본 창고를 찾을 수 없습니다" };

    const existing = await getInventoryByProductId(productId, warehouse.id);
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
      warehouseId: warehouse.id,
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

/**
 * 복수 상태 재고 목록 조회 (단일 쿼리 + 30초 캐시)
 * 대시보드에서 out_of_stock + critical을 한 번에 가져올 때 사용
 */
async function _getInventoryListByStatusesInternal(
  orgId: string,
  statuses: (typeof inventory.status.enumValues)[number][],
  limit: number
): Promise<InventoryListItem[]> {
  const items = await db
    .select({
      id: inventory.id,
      organizationId: inventory.organizationId,
      warehouseId: inventory.warehouseId,
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
    .where(
      and(
        eq(inventory.organizationId, orgId),
        inArray(inventory.status, statuses)
      )
    )
    .orderBy(desc(inventory.updatedAt))
    .limit(limit);

  return items.map((row) => ({
    ...row,
    daysOfInventory: row.daysOfInventory ? Number(row.daysOfInventory) : null,
  }));
}

export async function getInventoryListByStatuses(options: {
  statuses: string[];
  limit?: number;
}): Promise<InventoryListItem[]> {
  const user = await requireAuth();
  const { statuses, limit = 20 } = options;
  const validStatuses = statuses as (typeof inventory.status.enumValues)[number][];
  const cacheKey = `inventory-by-statuses-${user.organizationId}-${statuses.sort().join(",")}`;

  return unstable_cache(
    () => _getInventoryListByStatusesInternal(user.organizationId, validStatuses, limit),
    [cacheKey],
    { revalidate: 30, tags: [`inventory-${user.organizationId}`] }
  )();
}

/**
 * 재고 개별 삭제
 * - superadmin: 즉시 삭제
 * - admin/manager: 삭제 요청 생성 (승인 워크플로우)
 * - inventory_history는 보존 (감사 추적)
 */
export async function deleteInventoryItem(
  inventoryId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; isRequest?: boolean }> {
  try {
    const user = await requireManagerOrAbove();

    const [item] = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.id, inventoryId),
          eq(inventory.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!item) {
      return { success: false, error: "재고 항목을 찾을 수 없습니다" };
    }

    // superadmin: 즉시 삭제
    if (user.isSuperadmin) {
      if (item.currentStock > 0) {
        await db.insert(inventoryHistory).values({
          organizationId: user.organizationId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          changeType: "OUTBOUND_ADJUSTMENT",
          changeAmount: -item.currentStock,
          stockBefore: item.currentStock,
          stockAfter: 0,
          date: new Date().toISOString().split("T")[0],
          notes: `재고 삭제 (슈퍼관리자)${reason ? ` 사유: ${reason}` : ""}`,
        });
      }
      await db.delete(inventory).where(eq(inventory.id, inventoryId));

      await logActivity({
        user,
        action: "DELETE",
        entityType: "product",
        entityId: item.productId,
        description: `재고 즉시 삭제 (슈퍼관리자, 수량: ${item.currentStock})${reason ? ` 사유: ${reason}` : ""}`,
        metadata: { inventoryId, stockBefore: item.currentStock, reason },
      });

      revalidatePath("/dashboard/inventory");
      revalidateTag(`inventory-${user.organizationId}`);
      return { success: true };
    }

    // admin/manager: 삭제 요청 생성
    const result = await createDeletionRequest(
      {
        entityType: "inventory",
        entityId: inventoryId,
        reason: reason || "재고 삭제 요청",
      },
      user
    );

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, isRequest: true };
  } catch (error) {
    console.error("재고 삭제 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "재고 삭제에 실패했습니다",
    };
  }
}

/**
 * 재고 일괄 삭제 (선택된 항목들)
 * - superadmin: 즉시 삭제
 * - admin/manager: 각 항목별 삭제 요청 생성
 */
export async function deleteInventoryItems(
  inventoryIds: string[],
  reason?: string
): Promise<{ success: boolean; deletedCount: number; requestedCount?: number; error?: string; isRequest?: boolean }> {
  try {
    const user = await requireManagerOrAbove();

    if (inventoryIds.length === 0) {
      return { success: false, deletedCount: 0, error: "삭제할 항목이 없습니다" };
    }

    const items = await db
      .select()
      .from(inventory)
      .where(
        and(
          inArray(inventory.id, inventoryIds),
          eq(inventory.organizationId, user.organizationId)
        )
      );

    if (items.length === 0) {
      return { success: false, deletedCount: 0, error: "삭제할 재고를 찾을 수 없습니다" };
    }

    // superadmin: 즉시 일괄 삭제
    if (user.isSuperadmin) {
      const historyValues = items
        .filter((item) => item.currentStock > 0)
        .map((item) => ({
          organizationId: user.organizationId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          changeType: "OUTBOUND_ADJUSTMENT" as const,
          changeAmount: -item.currentStock,
          stockBefore: item.currentStock,
          stockAfter: 0,
          date: new Date().toISOString().split("T")[0],
          notes: `일괄 재고 삭제 (슈퍼관리자)${reason ? ` 사유: ${reason}` : ""}`,
        }));

      if (historyValues.length > 0) {
        await db.insert(inventoryHistory).values(historyValues);
      }

      await db
        .delete(inventory)
        .where(
          and(
            inArray(inventory.id, inventoryIds),
            eq(inventory.organizationId, user.organizationId)
          )
        );

      await logActivity({
        user,
        action: "DELETE",
        entityType: "product",
        entityId: items[0].productId,
        description: `재고 일괄 삭제 (슈퍼관리자): ${items.length}건${reason ? ` (사유: ${reason})` : ""}`,
        metadata: { inventoryIds, deletedCount: items.length, reason },
      });

      revalidatePath("/dashboard/inventory");
      revalidateTag(`inventory-${user.organizationId}`);
      return { success: true, deletedCount: items.length };
    }

    // admin/manager: 각 항목별 삭제 요청 생성
    let requestedCount = 0;
    for (const item of items) {
      const result = await createDeletionRequest(
        {
          entityType: "inventory",
          entityId: item.id,
          reason: reason || `일괄 재고 삭제 요청 (${items.length}건 중)`,
        },
        user
      );
      if (result.success) requestedCount++;
    }

    return { success: true, deletedCount: 0, requestedCount, isRequest: true };
  } catch (error) {
    console.error("재고 일괄 삭제 오류:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "재고 일괄 삭제에 실패했습니다",
    };
  }
}

/**
 * 전체 재고 삭제
 * - superadmin만 가능 (전체 삭제는 즉시 실행, 승인 요청 불가)
 */
export async function deleteAllInventory(
  reason: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const user = await requireAuth();

    if (!user.isSuperadmin) {
      return { success: false, deletedCount: 0, error: "전체 재고 삭제는 슈퍼관리자만 가능합니다" };
    }

    if (!reason.trim()) {
      return { success: false, deletedCount: 0, error: "전체 삭제 시 사유 입력은 필수입니다" };
    }

    const items = await db
      .select()
      .from(inventory)
      .where(eq(inventory.organizationId, user.organizationId));

    if (items.length === 0) {
      return { success: false, deletedCount: 0, error: "삭제할 재고가 없습니다" };
    }

    const historyValues = items
      .filter((item) => item.currentStock > 0)
      .map((item) => ({
        organizationId: user.organizationId,
        productId: item.productId,
        warehouseId: item.warehouseId,
        changeType: "OUTBOUND_ADJUSTMENT" as const,
        changeAmount: -item.currentStock,
        stockBefore: item.currentStock,
        stockAfter: 0,
        date: new Date().toISOString().split("T")[0],
        notes: `전체 재고 삭제 (슈퍼관리자, 사유: ${reason})`,
      }));

    if (historyValues.length > 0) {
      await db.insert(inventoryHistory).values(historyValues);
    }

    await db
      .delete(inventory)
      .where(eq(inventory.organizationId, user.organizationId));

    await logActivity({
      user,
      action: "DELETE",
      entityType: "product",
      entityId: "all",
      description: `전체 재고 삭제 (슈퍼관리자): ${items.length}건 (사유: ${reason})`,
      metadata: { deletedCount: items.length, reason },
    });

    revalidatePath("/dashboard/inventory");
    revalidateTag(`inventory-${user.organizationId}`);

    return { success: true, deletedCount: items.length };
  } catch (error) {
    console.error("전체 재고 삭제 오류:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "전체 재고 삭제에 실패했습니다",
    };
  }
}
