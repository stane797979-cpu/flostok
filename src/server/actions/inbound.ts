"use server";

import { db } from "@/server/db";
import {
  purchaseOrders,
  purchaseOrderItems,
  inboundRecords,
  inventoryLots,
  products,
  suppliers,
} from "@/server/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { processInventoryTransaction } from "./inventory";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

/**
 * 입고 항목 입력 스키마
 */
const inboundItemSchema = z.object({
  productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
  orderItemId: z.string().uuid("유효한 발주 항목 ID가 아닙니다"),
  expectedQuantity: z.number().min(0, "예상 수량은 0 이상이어야 합니다"),
  receivedQuantity: z.number().min(0, "입고 수량은 0 이상이어야 합니다"),
  location: z.string().optional(),
  lotNumber: z.string().optional(),
  expiryDate: z.string().optional(), // 유통기한 (YYYY-MM-DD)
  notes: z.string().optional(),
});

/**
 * 입고 확인 입력 스키마
 */
const confirmInboundSchema = z.object({
  orderId: z.string().uuid("유효한 발주서 ID가 아닙니다"),
  items: z.array(inboundItemSchema).min(1, "최소 1개 이상의 입고 항목이 필요합니다"),
  notes: z.string().optional(),
});

export type ConfirmInboundInput = z.infer<typeof confirmInboundSchema>;

/**
 * 입고 확인 처리
 *
 * 발주서의 입고를 확인하고 재고를 자동 증가시킵니다.
 * 부분 입고도 지원합니다.
 *
 * @param input - 입고 확인 데이터
 * @returns 성공 여부 및 생성된 입고 기록 ID 배열
 */
export async function confirmInbound(input: ConfirmInboundInput): Promise<{
  success: boolean;
  recordIds?: string[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // 유효성 검사
    const validated = confirmInboundSchema.parse(input);

    // 발주서 조회
    const [purchaseOrder] = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(eq(purchaseOrders.id, validated.orderId), eq(purchaseOrders.organizationId, user.organizationId))
      )
      .limit(1);

    if (!purchaseOrder) {
      return { success: false, error: "발주서를 찾을 수 없습니다" };
    }

    // 발주서가 입고 가능한 상태인지 확인
    if (!["ordered", "confirmed", "shipped", "partially_received"].includes(purchaseOrder.status)) {
      return {
        success: false,
        error: `입고 처리할 수 없는 발주서 상태입니다: ${purchaseOrder.status}`,
      };
    }

    // 발주 항목 조회
    const orderItems = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, validated.orderId));

    const orderItemsMap = new Map(orderItems.map((item) => [item.id, item]));

    // 입고 항목 검증
    for (const item of validated.items) {
      const orderItem = orderItemsMap.get(item.orderItemId);
      if (!orderItem) {
        return {
          success: false,
          error: `발주 항목을 찾을 수 없습니다 (ID: ${item.orderItemId})`,
        };
      }

      // 입고 수량이 발주 수량을 초과하는지 확인
      const currentReceivedQty = orderItem.receivedQuantity || 0;
      const totalReceivedQty = currentReceivedQty + item.receivedQuantity;
      if (totalReceivedQty > orderItem.quantity) {
        return {
          success: false,
          error: `입고 수량이 발주 수량을 초과합니다 (제품 ID: ${item.productId})`,
        };
      }
    }

    const today = new Date().toISOString().split("T")[0];

    // [최적화] 입고 항목에 필요한 제품 정보를 배치 조회
    const productIds = validated.items.map(item => item.productId);
    const productsData = productIds.length > 0
      ? await db.select().from(products).where(
          and(inArray(products.id, productIds), eq(products.organizationId, user.organizationId))
        )
      : [];
    const productsMap = new Map(productsData.map(p => [p.id, p]));

    // 트랜잭션으로 전체 입고 처리
    const result = await db.transaction(async (tx) => {
      const recordIds: string[] = [];

      // 각 항목별 입고 처리
      for (const item of validated.items) {
        if (item.receivedQuantity === 0) continue; // 입고 수량이 0이면 스킵

        // Lot 번호: 입력값 또는 자동 생성
        const lotNum = item.lotNumber || `AUTO-${today.replace(/-/g, "")}-${Date.now().toString(36)}`;

        // 1. 입고 기록 생성
        const [inboundRecord] = await tx
          .insert(inboundRecords)
          .values({
            organizationId: user.organizationId,
            purchaseOrderId: validated.orderId,
            productId: item.productId,
            date: today,
            expectedQuantity: item.expectedQuantity,
            receivedQuantity: item.receivedQuantity,
            acceptedQuantity: item.receivedQuantity, // 품질 검수 미구현 시 전량 합격 처리
            rejectedQuantity: 0,
            qualityResult: "pass",
            location: item.location,
            lotNumber: lotNum,
            expiryDate: item.expiryDate,
            notes: item.notes || validated.notes,
          })
          .returning();

        recordIds.push(inboundRecord.id);

        // 1-1. Lot 재고 생성
        await tx.insert(inventoryLots).values({
          organizationId: user.organizationId,
          productId: item.productId,
          lotNumber: lotNum,
          expiryDate: item.expiryDate,
          initialQuantity: item.receivedQuantity,
          remainingQuantity: item.receivedQuantity,
          inboundRecordId: inboundRecord.id,
          receivedDate: today,
          status: "active",
        });

        // 2. 재고 증가 처리 (user + product 전달, revalidate/log는 루프 후 1회만)
        const inventoryResult = await processInventoryTransaction(
          {
            productId: item.productId,
            changeType: "INBOUND_PURCHASE",
            quantity: item.receivedQuantity,
            referenceId: validated.orderId,
            notes: `발주서 ${purchaseOrder.orderNumber} 입고`,
            location: item.location,
          },
          {
            user,
            product: productsMap.get(item.productId),
            skipRevalidate: true,
            skipActivityLog: true,
          },
        );

        if (!inventoryResult.success) {
          throw new Error(`재고 증가 처리 실패 (제품 ID: ${item.productId}): ${inventoryResult.error}`);
        }

        // 3. 발주 항목의 입고 수량 업데이트
        const orderItem = orderItemsMap.get(item.orderItemId)!;
        const newReceivedQuantity = (orderItem.receivedQuantity || 0) + item.receivedQuantity;

        await tx
          .update(purchaseOrderItems)
          .set({
            receivedQuantity: newReceivedQuantity,
          })
          .where(eq(purchaseOrderItems.id, item.orderItemId));
      }

      // 4. 발주서 상태 업데이트
      // 모든 항목이 전량 입고되었는지 확인
      const updatedOrderItems = await tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, validated.orderId));

      const allItemsFullyReceived = updatedOrderItems.every(
        (item) => (item.receivedQuantity ?? 0) >= item.quantity
      );

      const hasPartiallyReceived = updatedOrderItems.some(
        (item) => item.receivedQuantity && item.receivedQuantity > 0
      );

      let newStatus: (typeof purchaseOrders.status.enumValues)[number];
      if (allItemsFullyReceived) {
        newStatus = "received"; // 전체 입고 완료
      } else if (hasPartiallyReceived) {
        newStatus = "partially_received"; // 부분 입고
      } else {
        newStatus = purchaseOrder.status; // 상태 유지
      }

      await tx
        .update(purchaseOrders)
        .set({
          status: newStatus,
          actualDate: allItemsFullyReceived ? today : null,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, validated.orderId));

      return recordIds;
    });

    await logActivity({
      user,
      action: "CREATE",
      entityType: "inbound_record",
      description: `입고 확인 처리`,
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/psi");
    revalidateTag(`psi-${user.organizationId}`);
    revalidateTag(`kpi-${user.organizationId}`);
    revalidateTag(`turnover-${user.organizationId}`);

    return {
      success: true,
      recordIds: result,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`,
      };
    }
    console.error("입고 확인 처리 오류:", error);
    return { success: false, error: "입고 확인 처리에 실패했습니다" };
  }
}

/**
 * 부분입고 완료 처리 (잔여수량 포기)
 *
 * 부분입고 상태의 발주서를 잔여수량을 포기하고 완료 처리합니다.
 *
 * @param orderId - 발주서 ID
 * @param notes - 사유 메모
 * @returns 성공 여부
 */
export async function closeOrderWithPartialInbound(
  orderId: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // 발주서 조회
    const [purchaseOrder] = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, orderId),
          eq(purchaseOrders.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!purchaseOrder) {
      return { success: false, error: "발주서를 찾을 수 없습니다" };
    }

    if (!["partially_received", "ordered", "confirmed", "shipped"].includes(purchaseOrder.status)) {
      return {
        success: false,
        error: `완료 처리할 수 없는 발주서 상태입니다: ${purchaseOrder.status}`,
      };
    }

    const today = new Date().toISOString().split("T")[0];

    await db
      .update(purchaseOrders)
      .set({
        status: "completed",
        actualDate: today,
        notes: purchaseOrder.notes
          ? `${purchaseOrder.notes}\n[부분입고 완료] ${notes || "잔여수량 포기"}`
          : `[부분입고 완료] ${notes || "잔여수량 포기"}`,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, orderId));

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "purchase_order",
      description: `발주서 ${purchaseOrder.orderNumber} 부분입고 완료 처리 (잔여수량 포기)`,
    });

    revalidatePath("/dashboard/orders");

    return { success: true };
  } catch (error) {
    console.error("부분입고 완료 처리 오류:", error);
    return { success: false, error: "부분입고 완료 처리에 실패했습니다" };
  }
}

/**
 * 기타 입고 (반품/조정/이동 입고) 스키마
 */
const otherInboundSchema = z.object({
  productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
  inboundType: z.enum(["INBOUND_RETURN", "INBOUND_ADJUSTMENT", "INBOUND_TRANSFER"] as const),
  quantity: z.coerce.number().min(1, "수량은 1 이상이어야 합니다"),
  location: z.string().optional(),
  lotNumber: z.string().optional(),
  expiryDate: z.string().optional(), // 유통기한 (YYYY-MM-DD)
  notes: z.string().optional(),
});

export type OtherInboundInput = z.infer<typeof otherInboundSchema>;

/**
 * 기타 입고 처리 (반품/조정/이동)
 *
 * 발주 없이 직접 입고를 처리합니다.
 * - 입고 기록 생성 (purchaseOrderId: null)
 * - 재고 자동 증가 + 이력 기록
 */
export async function createOtherInbound(input: OtherInboundInput): Promise<{
  success: boolean;
  recordId?: string;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const validated = otherInboundSchema.parse(input);

    const today = new Date().toISOString().split("T")[0];
    const lotNum = validated.lotNumber || `AUTO-${today.replace(/-/g, "")}-${Date.now().toString(36)}`;

    // 1. 입고 기록 생성 (purchaseOrderId = null)
    const [record] = await db
      .insert(inboundRecords)
      .values({
        organizationId: user.organizationId,
        purchaseOrderId: null,
        productId: validated.productId,
        date: today,
        expectedQuantity: validated.quantity,
        receivedQuantity: validated.quantity,
        acceptedQuantity: validated.quantity,
        rejectedQuantity: 0,
        qualityResult: "pass",
        location: validated.location,
        lotNumber: lotNum,
        expiryDate: validated.expiryDate,
        notes: validated.notes,
      })
      .returning();

    // 1-1. Lot 재고 생성
    await db.insert(inventoryLots).values({
      organizationId: user.organizationId,
      productId: validated.productId,
      lotNumber: lotNum,
      expiryDate: validated.expiryDate,
      initialQuantity: validated.quantity,
      remainingQuantity: validated.quantity,
      inboundRecordId: record.id,
      receivedDate: today,
      status: "active",
    });

    // 2. 재고 증가 처리
    const inventoryResult = await processInventoryTransaction({
      productId: validated.productId,
      changeType: validated.inboundType,
      quantity: validated.quantity,
      notes: validated.notes,
      location: validated.location,
    });

    if (!inventoryResult.success) {
      return {
        success: false,
        error: `재고 처리 실패: ${inventoryResult.error}`,
      };
    }

    await logActivity({
      user,
      action: "CREATE",
      entityType: "inbound_record",
      description: `기타 입고 처리`,
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/psi");
    revalidateTag(`psi-${user.organizationId}`);
    revalidateTag(`kpi-${user.organizationId}`);
    revalidateTag(`turnover-${user.organizationId}`);

    return { success: true, recordId: record.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("기타 입고 처리 오류:", error);
    return { success: false, error: "기타 입고 처리에 실패했습니다" };
  }
}

/**
 * 입고 기록 날짜 변경
 */
export async function updateInboundRecordDate(
  recordId: string,
  newDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return { success: false, error: "유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)" };
    }

    const [record] = await db
      .select({ id: inboundRecords.id, date: inboundRecords.date })
      .from(inboundRecords)
      .where(
        and(
          eq(inboundRecords.id, recordId),
          eq(inboundRecords.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!record) {
      return { success: false, error: "입고 기록을 찾을 수 없습니다" };
    }

    await db
      .update(inboundRecords)
      .set({ date: newDate })
      .where(eq(inboundRecords.id, recordId));

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "inbound_record",
      entityId: recordId,
      description: `입고일 변경: ${record.date} → ${newDate}`,
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/psi");
    revalidateTag(`psi-${user.organizationId}`);
    revalidateTag(`kpi-${user.organizationId}`);
    revalidateTag(`turnover-${user.organizationId}`);

    return { success: true };
  } catch (error) {
    console.error("입고일 변경 오류:", error);
    return { success: false, error: "입고일 변경에 실패했습니다" };
  }
}

/**
 * 입고 기록 조회 스키마
 */
const getInboundRecordsSchema = z.object({
  orderId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
});

export type GetInboundRecordsOptions = z.infer<typeof getInboundRecordsSchema>;

/**
 * 입고 기록 목록 조회
 *
 * @param options - 필터 옵션
 * @returns 입고 기록 목록 및 총 개수
 */
export async function getInboundRecords(options?: GetInboundRecordsOptions): Promise<{
  records: Array<{
    id: string;
    purchaseOrderId: string | null;
    orderNumber: string | null;
    productId: string;
    productName: string;
    productSku: string;
    date: string;
    scheduledDate: string | null;
    expectedQuantity: number | null;
    receivedQuantity: number;
    acceptedQuantity: number | null;
    rejectedQuantity: number | null;
    qualityResult: string | null;
    location: string | null;
    lotNumber: string | null;
    expiryDate: string | null;
    notes: string | null;
    createdAt: Date;
  }>;
  total: number;
}> {
  try {
    const user = await requireAuth();
    const validated = getInboundRecordsSchema.parse(options || {});
    const { orderId, productId, startDate, endDate, limit = 50, offset = 0 } = validated;

    const conditions = [eq(inboundRecords.organizationId, user.organizationId)];

    if (orderId) {
      conditions.push(eq(inboundRecords.purchaseOrderId, orderId));
    }
    if (productId) {
      conditions.push(eq(inboundRecords.productId, productId));
    }
    if (startDate) {
      conditions.push(sql`${inboundRecords.date} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${inboundRecords.date} <= ${endDate}`);
    }

    const [records, countResult] = await Promise.all([
      db
        .select({
          record: inboundRecords,
          product: {
            name: products.name,
            sku: products.sku,
          },
          order: {
            orderNumber: purchaseOrders.orderNumber,
            expectedDate: purchaseOrders.expectedDate,
          },
        })
        .from(inboundRecords)
        .innerJoin(products, eq(inboundRecords.productId, products.id))
        .leftJoin(purchaseOrders, eq(inboundRecords.purchaseOrderId, purchaseOrders.id))
        .where(and(...conditions))
        .orderBy(sql`${inboundRecords.date} DESC, ${inboundRecords.createdAt} DESC`)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(inboundRecords)
        .where(and(...conditions)),
    ]);

    return {
      records: records.map((row) => ({
        id: row.record.id,
        purchaseOrderId: row.record.purchaseOrderId,
        orderNumber: row.order?.orderNumber || null,
        productId: row.record.productId,
        productName: row.product.name,
        productSku: row.product.sku,
        date: row.record.date,
        scheduledDate: row.order?.expectedDate || null,
        expectedQuantity: row.record.expectedQuantity,
        receivedQuantity: row.record.receivedQuantity,
        acceptedQuantity: row.record.acceptedQuantity,
        rejectedQuantity: row.record.rejectedQuantity,
        qualityResult: row.record.qualityResult,
        location: row.record.location,
        lotNumber: row.record.lotNumber,
        expiryDate: row.record.expiryDate,
        notes: row.record.notes,
        createdAt: row.record.createdAt,
      })),
      total: Number(countResult[0]?.count || 0),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`);
    }
    console.error("입고 기록 조회 오류:", error);
    throw new Error("입고 기록 조회에 실패했습니다");
  }
}

/**
 * 일괄 입고확인 (전량 입고)
 *
 * 선택된 발주서들의 미입고 항목을 전량 입고 처리합니다.
 */
export async function bulkConfirmInbound(
  orderIds: string[]
): Promise<{
  success: boolean;
  processedCount: number;
  errors: Array<{ orderId: string; orderNumber: string; error: string }>;
}> {
  const errors: Array<{ orderId: string; orderNumber: string; error: string }> = [];
  let processedCount = 0;

  try {
    const user = await requireAuth();

    if (orderIds.length === 0) {
      return { success: false, processedCount: 0, errors: [{ orderId: "", orderNumber: "", error: "선택된 발주서가 없습니다" }] };
    }

    // 선택된 발주서 조회
    const orders = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, user.organizationId),
          inArray(purchaseOrders.id, orderIds)
        )
      );

    const inboundCapableStatuses = ["ordered", "confirmed", "shipped", "partially_received"];

    for (const order of orders) {
      if (!inboundCapableStatuses.includes(order.status)) {
        errors.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          error: `현재 상태(${order.status})에서는 입고 처리할 수 없습니다`,
        });
        continue;
      }

      try {
        // 해당 발주서의 항목 조회
        const items = await db
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, order.id));

        // 미입고 항목 필터링
        const pendingItems = items.filter(
          (item) => (item.receivedQuantity ?? 0) < item.quantity
        );

        if (pendingItems.length === 0) {
          errors.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            error: "이미 전량 입고 완료된 발주서입니다",
          });
          continue;
        }

        // confirmInbound 호출용 데이터 구성
        const inboundItems = pendingItems.map((item) => ({
          orderItemId: item.id,
          productId: item.productId,
          expectedQuantity: item.quantity - (item.receivedQuantity ?? 0),
          receivedQuantity: item.quantity - (item.receivedQuantity ?? 0),
        }));

        const result = await confirmInbound({
          orderId: order.id,
          items: inboundItems,
          notes: "일괄 입고확인 처리",
        });

        if (result.success) {
          processedCount++;
        } else {
          errors.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            error: result.error || "입고 처리 실패",
          });
        }
      } catch (err) {
        errors.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          error: "입고 처리 중 오류 발생",
        });
      }
    }

    return {
      success: processedCount > 0,
      processedCount,
      errors,
    };
  } catch (error) {
    console.error("일괄 입고확인 오류:", error);
    return {
      success: false,
      processedCount: 0,
      errors: [{ orderId: "", orderNumber: "", error: "일괄 입고확인 처리에 실패했습니다" }],
    };
  }
}

/**
 * 창고 입고예정 목록 조회
 *
 * ordered, confirmed, shipped, partially_received 상태의 발주서 목록을 반환합니다.
 */
export async function getWarehouseInboundOrders(): Promise<{
  orders: Array<{
    id: string;
    orderNumber: string;
    supplierName: string | null;
    status: string;
    expectedDate: string | null;
    orderDate: string | null;
    itemsCount: number;
    totalQuantity: number;
    receivedQuantity: number;
  }>;
}> {
  try {
    const user = await requireAuth();

    // 입고 대기중인 발주서 조회
    const inboundCapableStatuses = ["ordered", "confirmed", "shipped", "partially_received"] as (typeof purchaseOrders.status.enumValues)[number][];

    const ordersData = await db
      .select({
        order: purchaseOrders,
        supplier: {
          name: suppliers.name,
        },
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(
        and(
          eq(purchaseOrders.organizationId, user.organizationId),
          inArray(purchaseOrders.status, inboundCapableStatuses)
        )
      )
      .orderBy(sql`${purchaseOrders.expectedDate} ASC NULLS LAST, ${purchaseOrders.orderDate} ASC`);

    // 각 발주서의 항목 통계 조회
    const orderIds = ordersData.map((row) => row.order.id);

    if (orderIds.length === 0) {
      return { orders: [] };
    }

    const itemsStats = await db
      .select({
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        itemsCount: sql<number>`count(*)`,
        totalQuantity: sql<number>`coalesce(sum(${purchaseOrderItems.quantity}), 0)`,
        receivedQuantity: sql<number>`coalesce(sum(${purchaseOrderItems.receivedQuantity}), 0)`,
      })
      .from(purchaseOrderItems)
      .where(inArray(purchaseOrderItems.purchaseOrderId, orderIds))
      .groupBy(purchaseOrderItems.purchaseOrderId);

    const statsMap = new Map(
      itemsStats.map((stat) => [
        stat.purchaseOrderId,
        {
          itemsCount: Number(stat.itemsCount),
          totalQuantity: Number(stat.totalQuantity),
          receivedQuantity: Number(stat.receivedQuantity),
        },
      ])
    );

    return {
      orders: ordersData.map((row) => {
        const stats = statsMap.get(row.order.id) || {
          itemsCount: 0,
          totalQuantity: 0,
          receivedQuantity: 0,
        };

        return {
          id: row.order.id,
          orderNumber: row.order.orderNumber,
          supplierName: row.supplier?.name || null,
          status: row.order.status,
          expectedDate: row.order.expectedDate,
          orderDate: row.order.orderDate,
          itemsCount: stats.itemsCount,
          totalQuantity: stats.totalQuantity,
          receivedQuantity: stats.receivedQuantity,
        };
      }),
    };
  } catch (error) {
    console.error("창고 입고예정 목록 조회 오류:", error);
    throw new Error("창고 입고예정 목록 조회에 실패했습니다");
  }
}

/**
 * 발주서 상세 정보 조회 (입고용)
 *
 * 특정 발주서의 항목 목록을 반환합니다.
 */
export async function getWarehouseInboundOrderDetail(orderId: string): Promise<{
  order: {
    id: string;
    orderNumber: string;
    supplierName: string | null;
    status: string;
    expectedDate: string | null;
  };
  items: Array<{
    orderItemId: string;
    productId: string;
    productSku: string;
    productName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    unitPrice: number;
  }>;
}> {
  try {
    const user = await requireAuth();

    // 발주서 조회
    const [orderData] = await db
      .select({
        order: purchaseOrders,
        supplier: {
          name: suppliers.name,
        },
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(
        and(
          eq(purchaseOrders.id, orderId),
          eq(purchaseOrders.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!orderData) {
      throw new Error("발주서를 찾을 수 없습니다");
    }

    // 발주 항목 조회
    const itemsData = await db
      .select({
        item: purchaseOrderItems,
        product: {
          sku: products.sku,
          name: products.name,
        },
      })
      .from(purchaseOrderItems)
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

    return {
      order: {
        id: orderData.order.id,
        orderNumber: orderData.order.orderNumber,
        supplierName: orderData.supplier?.name || null,
        status: orderData.order.status,
        expectedDate: orderData.order.expectedDate,
      },
      items: itemsData.map((row) => ({
        orderItemId: row.item.id,
        productId: row.item.productId,
        productSku: row.product.sku,
        productName: row.product.name,
        orderedQuantity: row.item.quantity,
        receivedQuantity: row.item.receivedQuantity || 0,
        unitPrice: row.item.unitPrice,
      })),
    };
  } catch (error) {
    console.error("발주서 상세 조회 오류:", error);
    throw new Error("발주서 상세 조회에 실패했습니다");
  }
}
