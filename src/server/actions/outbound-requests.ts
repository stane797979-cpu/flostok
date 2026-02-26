"use server";

import { db } from "@/server/db";
import {
  outboundRequests,
  outboundRequestItems,
  products,
  inventory,
  inventoryLots,
  salesRecords,
  users,
  warehouses,
} from "@/server/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import type { PickingListData } from "@/server/services/excel/picking-list-export";
import {
  requireAuth,
  requireManagerOrAbove,
  requireWarehouseOrAbove,
} from "./auth-helpers";
import { processInventoryTransaction, processBatchInventoryTransactions, type BatchInventoryItem } from "./inventory";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * 출고 유형 라벨 매핑
 */
const OUTBOUND_TYPE_LABELS: Record<string, string> = {
  OUTBOUND_SALE: "판매 출고",
  OUTBOUND_DISPOSAL: "폐기 출고",
  OUTBOUND_TRANSFER: "이동 출고",
  OUTBOUND_SAMPLE: "샘플 출고",
  OUTBOUND_LOSS: "분실/감모",
  OUTBOUND_RETURN: "반품 출고",
};

/**
 * 요청번호 생성 (OR-YYYYMMDD-XXX)
 */
function generateRequestNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `OR-${dateStr}-${random}`;
}

/**
 * 출고 요청 생성 입력 스키마
 */
const createOutboundRequestSchema = z.object({
  outboundType: z.string(),
  sourceWarehouseId: z.string().uuid().optional(),
  targetWarehouseId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        requestedQuantity: z.number().min(1),
        notes: z.string().optional(),
      })
    )
    .min(1, "최소 1개 이상의 항목이 필요합니다"),
  notes: z.string().optional(),
});

/**
 * 출고 요청 생성
 */
export async function createOutboundRequest(
  input: z.infer<typeof createOutboundRequestSchema>
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const user = await requireManagerOrAbove();
    const validated = createOutboundRequestSchema.parse(input);

    // sourceWarehouseId 없으면 기본 창고 자동 할당
    let sourceWarehouseId = validated.sourceWarehouseId;
    if (!sourceWarehouseId) {
      const { getDefaultWarehouse } = await import("./warehouses");
      const dw = await getDefaultWarehouse();
      if (!dw) return { success: false, error: "기본 창고를 찾을 수 없습니다" };
      sourceWarehouseId = dw.id;
    }

    // 재고 검증: 요청 수량이 가용재고(현재고 - 타 pending 대기수량)를 초과하는지 확인
    const productIds = validated.items.map((item) => item.productId);
    const stockRows = await db
      .select({
        productId: inventory.productId,
        currentStock: inventory.currentStock,
      })
      .from(inventory)
      .where(
        and(
          inArray(inventory.productId, productIds),
          eq(inventory.warehouseId, sourceWarehouseId),
          eq(inventory.organizationId, user.organizationId)
        )
      );
    const stockMap = new Map(stockRows.map((r) => [r.productId, r.currentStock]));

    // 같은 제품에 대한 다른 pending 출고 요청의 대기수량 조회
    const backlogRows = await db
      .select({
        productId: outboundRequestItems.productId,
        totalBacklog: sql<number>`coalesce(sum(${outboundRequestItems.requestedQuantity}), 0)`,
      })
      .from(outboundRequestItems)
      .innerJoin(outboundRequests, eq(outboundRequestItems.outboundRequestId, outboundRequests.id))
      .where(
        and(
          inArray(outboundRequestItems.productId, productIds),
          eq(outboundRequests.status, "pending"),
          eq(outboundRequests.organizationId, user.organizationId),
          eq(outboundRequests.sourceWarehouseId, sourceWarehouseId)
        )
      )
      .groupBy(outboundRequestItems.productId);
    const backlogMap = new Map(backlogRows.map((r) => [r.productId, Number(r.totalBacklog)]));

    const insufficientItems: string[] = [];
    for (const item of validated.items) {
      const current = stockMap.get(item.productId) ?? 0;
      const backlog = backlogMap.get(item.productId) ?? 0;
      const available = current - backlog;
      if (item.requestedQuantity > available) {
        insufficientItems.push(
          `현재고 ${current}, 대기 ${backlog}, 가용 ${available}, 요청 ${item.requestedQuantity}`
        );
      }
    }
    if (insufficientItems.length > 0) {
      return {
        success: false,
        error: `재고가 부족한 항목이 있습니다:\n${insufficientItems.join("\n")}`,
      };
    }

    const requestNumber = generateRequestNumber();

    // 출고 요청 생성 (창고 정보 포함)
    const [request] = await db
      .insert(outboundRequests)
      .values({
        organizationId: user.organizationId,
        sourceWarehouseId: sourceWarehouseId,
        targetWarehouseId: validated.targetWarehouseId || null,
        requestNumber,
        status: "pending",
        outboundType: validated.outboundType,
        requestedById: user.id,
        notes: validated.notes,
      })
      .returning();

    // 출고 요청 항목 생성
    await db.insert(outboundRequestItems).values(
      validated.items.map((item) => ({
        outboundRequestId: request.id,
        productId: item.productId,
        requestedQuantity: item.requestedQuantity,
        notes: item.notes,
      }))
    );

    revalidatePath("/dashboard/outbound");
    revalidatePath("/dashboard/warehouse/outbound");

    return { success: true, requestId: request.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("출고 요청 생성 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "출고 요청 생성에 실패했습니다",
    };
  }
}

/**
 * 출고 요청 목록 조회
 */
export async function getOutboundRequests(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  requests: Array<{
    id: string;
    requestNumber: string;
    status: string;
    outboundType: string;
    outboundTypeLabel: string;
    customerType: string | null;
    requestedByName: string | null;
    sourceWarehouseName: string | null;
    targetWarehouseName: string | null;
    recipientCompany: string | null;
    recipientName: string | null;
    recipientAddress: string | null;
    recipientPhone: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    itemsCount: number;
    totalQuantity: number;
    totalCurrentStock: number;
    totalBacklog: number;
    createdAt: Date;
  }>;
  total: number;
}> {
  const user = await requireAuth();
  const { status, limit = 50, offset = 0 } = options || {};

  const conditions = [eq(outboundRequests.organizationId, user.organizationId)];
  if (status) {
    conditions.push(
      eq(
        outboundRequests.status,
        status as (typeof outboundRequests.status.enumValues)[number]
      )
    );
  }

  // 요청 목록 조회
  const requestsData = await db
    .select({
      id: outboundRequests.id,
      requestNumber: outboundRequests.requestNumber,
      status: outboundRequests.status,
      outboundType: outboundRequests.outboundType,
      customerType: outboundRequests.customerType,
      sourceWarehouseId: outboundRequests.sourceWarehouseId,
      requestedByName: users.name,
      sourceWarehouseName: sql<string | null>`sw.name`,
      targetWarehouseName: sql<string | null>`tw.name`,
      recipientCompany: outboundRequests.recipientCompany,
      recipientName: outboundRequests.recipientName,
      recipientAddress: outboundRequests.recipientAddress,
      recipientPhone: outboundRequests.recipientPhone,
      courierName: outboundRequests.courierName,
      trackingNumber: outboundRequests.trackingNumber,
      createdAt: outboundRequests.createdAt,
    })
    .from(outboundRequests)
    .leftJoin(users, eq(outboundRequests.requestedById, users.id))
    .leftJoin(sql`${warehouses} as sw`, sql`sw.id = ${outboundRequests.sourceWarehouseId}`)
    .leftJoin(sql`${warehouses} as tw`, sql`tw.id = ${outboundRequests.targetWarehouseId}`)
    .where(and(...conditions))
    .orderBy(desc(outboundRequests.createdAt))
    .limit(limit)
    .offset(offset);

  // 각 요청의 항목 수 및 총 수량 계산
  const requestIds = requestsData.map((r) => r.id);
  const itemsStats = requestIds.length
    ? await db
        .select({
          outboundRequestId: outboundRequestItems.outboundRequestId,
          itemsCount: sql<number>`count(*)`,
          totalQuantity: sql<number>`sum(${outboundRequestItems.requestedQuantity})`,
        })
        .from(outboundRequestItems)
        .where(inArray(outboundRequestItems.outboundRequestId, requestIds))
        .groupBy(outboundRequestItems.outboundRequestId)
    : [];

  const statsMap = new Map(
    itemsStats.map((s) => [
      s.outboundRequestId,
      {
        itemsCount: Number(s.itemsCount),
        totalQuantity: Number(s.totalQuantity),
      },
    ])
  );

  // 현재고 조회: 각 요청의 품목별 현재고 합산
  // outbound_request_items -> inventory (출발 창고 기준)
  const stockMap = new Map<string, number>();
  if (requestIds.length > 0) {
    const stockRows = await db
      .select({
        outboundRequestId: outboundRequestItems.outboundRequestId,
        totalCurrentStock: sql<number>`COALESCE(SUM(COALESCE(${inventory.currentStock}, 0)), 0)`,
      })
      .from(outboundRequestItems)
      .innerJoin(outboundRequests, eq(outboundRequestItems.outboundRequestId, outboundRequests.id))
      .leftJoin(
        inventory,
        and(
          eq(inventory.productId, outboundRequestItems.productId),
          eq(inventory.warehouseId, outboundRequests.sourceWarehouseId)
        )
      )
      .where(inArray(outboundRequestItems.outboundRequestId, requestIds))
      .groupBy(outboundRequestItems.outboundRequestId);

    for (const row of stockRows) {
      stockMap.set(row.outboundRequestId, Number(row.totalCurrentStock));
    }
  }

  // 백로그 조회: 같은 제품에 대한 다른 pending 출고 요청의 수량 합
  const backlogMap = new Map<string, number>();
  if (requestIds.length > 0) {
    // 1) 현재 페이지 요청들의 모든 품목 productId 수집
    const requestItems = await db
      .select({
        outboundRequestId: outboundRequestItems.outboundRequestId,
        productId: outboundRequestItems.productId,
        requestedQuantity: outboundRequestItems.requestedQuantity,
      })
      .from(outboundRequestItems)
      .where(inArray(outboundRequestItems.outboundRequestId, requestIds));

    // 2) 모든 productId에 대해 pending 상태의 전체 출고 대기 수량 조회
    const allProductIds = [...new Set(requestItems.map((i) => i.productId))];
    if (allProductIds.length > 0) {
      const pendingTotals = await db
        .select({
          productId: outboundRequestItems.productId,
          totalPending: sql<number>`SUM(${outboundRequestItems.requestedQuantity})`,
        })
        .from(outboundRequestItems)
        .innerJoin(outboundRequests, eq(outboundRequestItems.outboundRequestId, outboundRequests.id))
        .where(
          and(
            eq(outboundRequests.status, "pending"),
            eq(outboundRequests.organizationId, user.organizationId),
            inArray(outboundRequestItems.productId, allProductIds)
          )
        )
        .groupBy(outboundRequestItems.productId);

      const pendingByProduct = new Map(
        pendingTotals.map((p) => [p.productId, Number(p.totalPending)])
      );

      // 3) 각 요청별 백로그 = (해당 제품들의 전체 pending 합) - (자기 요청 수량)
      const requestItemsGrouped = new Map<string, { productId: string; qty: number }[]>();
      for (const item of requestItems) {
        const arr = requestItemsGrouped.get(item.outboundRequestId) || [];
        arr.push({ productId: item.productId, qty: item.requestedQuantity });
        requestItemsGrouped.set(item.outboundRequestId, arr);
      }

      for (const [reqId, items] of requestItemsGrouped) {
        let backlog = 0;
        for (const item of items) {
          const totalPending = pendingByProduct.get(item.productId) || 0;
          // 백로그 = 전체 pending - 자기 수량
          backlog += Math.max(0, totalPending - item.qty);
        }
        backlogMap.set(reqId, backlog);
      }
    }
  }

  // 전체 개수
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(outboundRequests)
    .where(and(...conditions));

  return {
    requests: requestsData.map((r) => {
      const stats = statsMap.get(r.id) || { itemsCount: 0, totalQuantity: 0 };
      return {
        id: r.id,
        requestNumber: r.requestNumber,
        status: r.status!,
        outboundType: r.outboundType,
        outboundTypeLabel: OUTBOUND_TYPE_LABELS[r.outboundType] || r.outboundType,
        customerType: r.customerType,
        requestedByName: r.requestedByName,
        sourceWarehouseName: r.sourceWarehouseName ?? null,
        targetWarehouseName: r.targetWarehouseName ?? null,
        recipientCompany: r.recipientCompany,
        recipientName: r.recipientName,
        recipientAddress: r.recipientAddress,
        recipientPhone: r.recipientPhone,
        courierName: r.courierName,
        trackingNumber: r.trackingNumber,
        itemsCount: stats.itemsCount,
        totalQuantity: stats.totalQuantity,
        totalCurrentStock: stockMap.get(r.id) || 0,
        totalBacklog: backlogMap.get(r.id) || 0,
        createdAt: r.createdAt,
      };
    }),
    total: Number(countResult?.count || 0),
  };
}

/**
 * 출고 요청 상세 조회
 */
export async function getOutboundRequestById(requestId: string): Promise<{
  success: boolean;
  request?: {
    id: string;
    requestNumber: string;
    status: string;
    outboundType: string;
    outboundTypeLabel: string;
    customerType: string | null;
    requestedByName: string | null;
    confirmedByName: string | null;
    confirmedAt: Date | null;
    sourceWarehouseName: string | null;
    targetWarehouseName: string | null;
    recipientCompany: string | null;
    recipientName: string | null;
    recipientAddress: string | null;
    recipientPhone: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    notes: string | null;
    createdAt: Date;
    items: Array<{
      id: string;
      productId: string;
      productSku: string;
      productName: string;
      requestedQuantity: number;
      confirmedQuantity: number | null;
      currentStock: number;
      notes: string | null;
    }>;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // 요청 정보 조회
    const [request] = await db
      .select({
        id: outboundRequests.id,
        requestNumber: outboundRequests.requestNumber,
        status: outboundRequests.status,
        outboundType: outboundRequests.outboundType,
        customerType: outboundRequests.customerType,
        notes: outboundRequests.notes,
        createdAt: outboundRequests.createdAt,
        confirmedAt: outboundRequests.confirmedAt,
        requestedByName: sql<string>`requested_by.name`,
        confirmedByName: sql<string>`confirmed_by.name`,
        sourceWarehouseName: sql<string | null>`sw.name`,
        targetWarehouseName: sql<string | null>`tw.name`,
        recipientCompany: outboundRequests.recipientCompany,
        recipientName: outboundRequests.recipientName,
        recipientAddress: outboundRequests.recipientAddress,
        recipientPhone: outboundRequests.recipientPhone,
        courierName: outboundRequests.courierName,
        trackingNumber: outboundRequests.trackingNumber,
      })
      .from(outboundRequests)
      .leftJoin(
        sql`users as requested_by`,
        eq(outboundRequests.requestedById, sql`requested_by.id`)
      )
      .leftJoin(
        sql`users as confirmed_by`,
        eq(outboundRequests.confirmedById, sql`confirmed_by.id`)
      )
      .leftJoin(sql`${warehouses} as sw`, sql`sw.id = ${outboundRequests.sourceWarehouseId}`)
      .leftJoin(sql`${warehouses} as tw`, sql`tw.id = ${outboundRequests.targetWarehouseId}`)
      .where(
        and(
          eq(outboundRequests.id, requestId),
          eq(outboundRequests.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!request) {
      return { success: false, error: "출고 요청을 찾을 수 없습니다" };
    }

    // 요청 항목 조회 (제품 정보 + 현재고 포함)
    const items = await db
      .select({
        id: outboundRequestItems.id,
        productId: outboundRequestItems.productId,
        productSku: products.sku,
        productName: products.name,
        requestedQuantity: outboundRequestItems.requestedQuantity,
        confirmedQuantity: outboundRequestItems.confirmedQuantity,
        currentStock: inventory.currentStock,
        notes: outboundRequestItems.notes,
      })
      .from(outboundRequestItems)
      .innerJoin(products, eq(outboundRequestItems.productId, products.id))
      .leftJoin(inventory, eq(outboundRequestItems.productId, inventory.productId))
      .where(eq(outboundRequestItems.outboundRequestId, requestId));

    return {
      success: true,
      request: {
        id: request.id,
        requestNumber: request.requestNumber,
        status: request.status!,
        outboundType: request.outboundType,
        outboundTypeLabel: OUTBOUND_TYPE_LABELS[request.outboundType] || request.outboundType,
        customerType: request.customerType,
        requestedByName: request.requestedByName,
        confirmedByName: request.confirmedByName,
        confirmedAt: request.confirmedAt,
        sourceWarehouseName: request.sourceWarehouseName ?? null,
        targetWarehouseName: request.targetWarehouseName ?? null,
        recipientCompany: request.recipientCompany,
        recipientName: request.recipientName,
        recipientAddress: request.recipientAddress,
        recipientPhone: request.recipientPhone,
        courierName: request.courierName,
        trackingNumber: request.trackingNumber,
        notes: request.notes,
        createdAt: request.createdAt,
        items: items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productSku: item.productSku,
          productName: item.productName,
          requestedQuantity: item.requestedQuantity,
          confirmedQuantity: item.confirmedQuantity,
          currentStock: item.currentStock || 0,
          notes: item.notes,
        })),
      },
    };
  } catch (error) {
    console.error("출고 요청 상세 조회 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "출고 요청 조회에 실패했습니다",
    };
  }
}

/**
 * 출고 요청 확정 입력 스키마
 */
const confirmOutboundRequestSchema = z.object({
  requestId: z.string().uuid(),
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      confirmedQuantity: z.number().min(0),
    })
  ),
  notes: z.string().optional(),
});

/**
 * 출고 요청 확정 (창고에서 실제 출고 처리)
 */
export async function confirmOutboundRequest(
  input: z.infer<typeof confirmOutboundRequestSchema>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireWarehouseOrAbove();
    const validated = confirmOutboundRequestSchema.parse(input);

    // 요청 정보 확인
    const [request] = await db
      .select()
      .from(outboundRequests)
      .where(
        and(
          eq(outboundRequests.id, validated.requestId),
          eq(outboundRequests.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!request) {
      return { success: false, error: "출고 요청을 찾을 수 없습니다" };
    }

    if (request.status !== "pending") {
      return {
        success: false,
        error: "이미 처리되었거나 취소된 요청입니다",
      };
    }

    // 항목 정보 배치 조회 (N+1 제거)
    const itemIds = validated.items.map((i) => i.itemId);
    const requestItemRows = await db
      .select()
      .from(outboundRequestItems)
      .where(sql`${outboundRequestItems.id} IN ${itemIds}`);
    const requestItemMap = new Map(requestItemRows.map((r) => [r.id, r]));

    // 트랜잭션으로 확정 처리 전체를 원자적으로 실행
    // (재고 차감 + 상태 업데이트 + 판매 기록 생성이 한 번에 커밋/롤백되어야 함)
    await db.transaction(async (tx) => {
      // confirmedQuantity 배치 업데이트
      const updateItems = validated.items.filter((i) => i.confirmedQuantity > 0 && requestItemMap.has(i.itemId));
      if (updateItems.length > 0) {
        const qtyCase = updateItems.map((i) => sql`WHEN ${i.itemId} THEN ${i.confirmedQuantity}`);
        await tx
          .update(outboundRequestItems)
          .set({ confirmedQuantity: sql`CASE id ${sql.join(qtyCase, sql` `)} END` })
          .where(sql`${outboundRequestItems.id} IN ${updateItems.map((i) => i.itemId)}`);
      }

      // 재고 차감 배치 처리 (processBatchInventoryTransactions로 쿼리 수 최소화)
      // 출고는 FIFO 필요로 배치 함수 내부에서 개별 처리되지만, 제품·재고 조회는 배치로 수행됨
      const activeItems = validated.items.filter(
        (i) => i.confirmedQuantity > 0 && requestItemMap.has(i.itemId)
      );

      if (activeItems.length > 0) {
        // 출발 창고 출고 배치
        const outboundBatchItems: BatchInventoryItem[] = activeItems.map((i) => {
          const requestItem = requestItemMap.get(i.itemId)!;
          return {
            productId: requestItem.productId,
            changeType: request.outboundType as BatchInventoryItem["changeType"],
            quantity: i.confirmedQuantity,
            referenceId: validated.requestId,
            notes: validated.notes,
            warehouseId: request.sourceWarehouseId ?? undefined,
          };
        });

        const outboundResult = await processBatchInventoryTransactions(outboundBatchItems, {
          user,
          tx,
          warehouseId: request.sourceWarehouseId ?? undefined,
          skipRevalidate: true,
          skipActivityLog: true,
        });

        if (!outboundResult.success) {
          const failed = outboundResult.results.filter((r) => !r.success);
          throw new Error(`출고 실패: ${failed.map((r) => r.error).join(", ")}`);
        }

        // 이동 출고(OUTBOUND_TRANSFER)이면 도착 창고로 배치 입고
        if (request.outboundType === "OUTBOUND_TRANSFER" && request.targetWarehouseId) {
          const inboundBatchItems: BatchInventoryItem[] = activeItems.map((i) => {
            const requestItem = requestItemMap.get(i.itemId)!;
            return {
              productId: requestItem.productId,
              changeType: "INBOUND_TRANSFER" as const,
              quantity: i.confirmedQuantity,
              referenceId: validated.requestId,
              notes: validated.notes,
              warehouseId: request.targetWarehouseId!,
            };
          });

          const inboundResult = await processBatchInventoryTransactions(inboundBatchItems, {
            user,
            tx,
            warehouseId: request.targetWarehouseId,
            skipRevalidate: true,
            skipActivityLog: true,
          });

          if (!inboundResult.success) {
            const failed = inboundResult.results.filter((r) => !r.success);
            throw new Error(`입고 실패: ${failed.map((r) => r.error).join(", ")}`);
          }
        }
      }

      // 판매출고(OUTBOUND_SALE)인 경우 salesRecords에 자동 생성 (수요예측·분석 연동)
      if (request.outboundType === "OUTBOUND_SALE") {
        const today = new Date().toISOString().split("T")[0];
        const salesValues = validated.items
          .filter((i) => i.confirmedQuantity > 0 && requestItemMap.has(i.itemId))
          .map((i) => {
            const item = requestItemMap.get(i.itemId)!;
            return {
              organizationId: user.organizationId,
              productId: item.productId,
              date: today,
              quantity: i.confirmedQuantity,
              notes: `출고확정 자동생성 (${request.requestNumber})`,
            };
          });
        if (salesValues.length > 0) {
          await tx.insert(salesRecords).values(salesValues);
        }
      }

      // 요청 상태 업데이트 (confirmed)
      await tx
        .update(outboundRequests)
        .set({
          status: "confirmed",
          confirmedById: user.id,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(outboundRequests.id, validated.requestId));
    });

    revalidatePath("/dashboard/outbound");
    revalidatePath("/dashboard/warehouse/outbound");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("출고 요청 확정 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "출고 확정에 실패했습니다",
    };
  }
}

/**
 * 출고 요청 일괄 확정 (요청수량 = 확정수량으로 자동 처리)
 */
export async function bulkConfirmOutboundRequests(
  requestIds: string[]
): Promise<{ success: boolean; confirmedCount: number; errors: string[] }> {
  try {
    const user = await requireWarehouseOrAbove();
    const errors: string[] = [];
    let confirmedCount = 0;

    for (const requestId of requestIds) {
      // 요청 정보 확인
      const [request] = await db
        .select()
        .from(outboundRequests)
        .where(
          and(
            eq(outboundRequests.id, requestId),
            eq(outboundRequests.organizationId, user.organizationId)
          )
        )
        .limit(1);

      if (!request || request.status !== "pending") {
        errors.push(`${request?.requestNumber || requestId}: 이미 처리됨`);
        continue;
      }

      // 항목 조회
      const items = await db
        .select()
        .from(outboundRequestItems)
        .where(eq(outboundRequestItems.outboundRequestId, requestId));

      if (items.length === 0) {
        errors.push(`${request.requestNumber}: 항목 없음`);
        continue;
      }

      // confirmedQuantity = requestedQuantity 일괄 설정
      for (const item of items) {
        await db
          .update(outboundRequestItems)
          .set({ confirmedQuantity: item.requestedQuantity })
          .where(eq(outboundRequestItems.id, item.id));
      }

      // 재고 차감 순차 실행
      let hasError = false;
      for (const item of items) {
        if (item.requestedQuantity === 0) continue;

        const outboundResult = await processInventoryTransaction({
          productId: item.productId,
          changeType: request.outboundType as
            | "OUTBOUND_SALE"
            | "OUTBOUND_DISPOSAL"
            | "OUTBOUND_TRANSFER"
            | "OUTBOUND_SAMPLE"
            | "OUTBOUND_LOSS"
            | "OUTBOUND_RETURN",
          quantity: item.requestedQuantity,
          referenceId: requestId,
          warehouseId: request.sourceWarehouseId,
        });

        if (!outboundResult.success) {
          errors.push(`${request.requestNumber}: ${outboundResult.error}`);
          hasError = true;
          break;
        }

        // 이동 출고면 도착 창고 입고
        if (request.outboundType === "OUTBOUND_TRANSFER" && request.targetWarehouseId) {
          await processInventoryTransaction({
            productId: item.productId,
            changeType: "INBOUND_TRANSFER",
            quantity: item.requestedQuantity,
            referenceId: requestId,
            warehouseId: request.targetWarehouseId,
          });
        }
      }

      if (!hasError) {
        // 판매출고(OUTBOUND_SALE)인 경우 salesRecords에 자동 생성
        if (request.outboundType === "OUTBOUND_SALE") {
          const today = new Date().toISOString().split("T")[0];
          const salesValues = items
            .filter((i) => i.requestedQuantity > 0)
            .map((i) => ({
              organizationId: user.organizationId,
              productId: i.productId,
              date: today,
              quantity: i.requestedQuantity,
              notes: `출고확정 자동생성 (${request.requestNumber})`,
            }));
          if (salesValues.length > 0) {
            await db.insert(salesRecords).values(salesValues);
          }
        }

        await db
          .update(outboundRequests)
          .set({
            status: "confirmed",
            confirmedById: user.id,
            confirmedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(outboundRequests.id, requestId));
        confirmedCount++;
      }
    }

    revalidatePath("/dashboard/outbound");
    revalidatePath("/dashboard/warehouse/outbound");

    return { success: errors.length === 0, confirmedCount, errors };
  } catch (error) {
    console.error("일괄 출고 확정 오류:", error);
    return {
      success: false,
      confirmedCount: 0,
      errors: [error instanceof Error ? error.message : "일괄 출고 확정 실패"],
    };
  }
}

/**
 * 출고 요청 취소
 */
export async function cancelOutboundRequest(requestId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireManagerOrAbove();

    // 요청 확인
    const [request] = await db
      .select()
      .from(outboundRequests)
      .where(
        and(
          eq(outboundRequests.id, requestId),
          eq(outboundRequests.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!request) {
      return { success: false, error: "출고 요청을 찾을 수 없습니다" };
    }

    if (request.status !== "pending") {
      return {
        success: false,
        error: "이미 처리되었거나 취소된 요청입니다",
      };
    }

    // 상태 업데이트 (cancelled)
    await db
      .update(outboundRequests)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(outboundRequests.id, requestId));

    revalidatePath("/dashboard/outbound");
    revalidatePath("/dashboard/warehouse/outbound");

    return { success: true };
  } catch (error) {
    console.error("출고 요청 취소 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "출고 요청 취소에 실패했습니다",
    };
  }
}

/**
 * 피킹지 생성용 단일 출고 요청 상세 데이터 조회
 * - inventory.location (적치위치)
 * - inventory_lots (FIFO 기준 가장 오래된 active lot)
 */
export async function getOutboundRequestForPickingList(
  requestId: string
): Promise<{ success: boolean; data?: PickingListData; error?: string }> {
  try {
    const user = await requireAuth();

    // 1단계: 출고 요청 헤더 조회
    const [request] = await db
      .select({
        id: outboundRequests.id,
        requestNumber: outboundRequests.requestNumber,
        status: outboundRequests.status,
        outboundType: outboundRequests.outboundType,
        customerType: outboundRequests.customerType,
        notes: outboundRequests.notes,
        createdAt: outboundRequests.createdAt,
        confirmedAt: outboundRequests.confirmedAt,
        sourceWarehouseId: outboundRequests.sourceWarehouseId,
        requestedByName: sql<string>`requested_by.name`,
        sourceWarehouseName: sql<string>`sw.name`,
        sourceWarehouseCode: sql<string>`sw.code`,
        sourceWarehouseAddress: sql<string | null>`sw.address`,
        targetWarehouseName: sql<string | null>`tw.name`,
        recipientCompany: outboundRequests.recipientCompany,
        recipientName: outboundRequests.recipientName,
        recipientAddress: outboundRequests.recipientAddress,
        recipientPhone: outboundRequests.recipientPhone,
        courierName: outboundRequests.courierName,
        trackingNumber: outboundRequests.trackingNumber,
      })
      .from(outboundRequests)
      .leftJoin(sql`users as requested_by`, eq(outboundRequests.requestedById, sql`requested_by.id`))
      .leftJoin(sql`${warehouses} as sw`, sql`sw.id = ${outboundRequests.sourceWarehouseId}`)
      .leftJoin(sql`${warehouses} as tw`, sql`tw.id = ${outboundRequests.targetWarehouseId}`)
      .where(
        and(
          eq(outboundRequests.id, requestId),
          eq(outboundRequests.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!request) {
      return { success: false, error: "출고 요청을 찾을 수 없습니다" };
    }

    // 2단계: 출고 항목 + 제품 + 재고(위치) 조회
    const items = await db
      .select({
        id: outboundRequestItems.id,
        productId: outboundRequestItems.productId,
        productSku: products.sku,
        productName: products.name,
        category: products.category,
        unit: products.unit,
        requestedQuantity: outboundRequestItems.requestedQuantity,
        confirmedQuantity: outboundRequestItems.confirmedQuantity,
        currentStock: inventory.currentStock,
        location: inventory.location,
        itemNotes: outboundRequestItems.notes,
      })
      .from(outboundRequestItems)
      .innerJoin(products, eq(outboundRequestItems.productId, products.id))
      .leftJoin(
        inventory,
        and(
          eq(outboundRequestItems.productId, inventory.productId),
          eq(inventory.warehouseId, request.sourceWarehouseId)
        )
      )
      .where(eq(outboundRequestItems.outboundRequestId, requestId));

    // 3단계: 각 제품의 FIFO 기준 가장 오래된 active lot 조회
    const productIds = [...new Set(items.map((i) => i.productId))];
    const lotsMap = new Map<string, { lotNumber: string; expiryDate: string | null }>();

    if (productIds.length > 0) {
      const lots = await db
        .select({
          productId: inventoryLots.productId,
          lotNumber: inventoryLots.lotNumber,
          expiryDate: inventoryLots.expiryDate,
        })
        .from(inventoryLots)
        .where(
          and(
            eq(inventoryLots.warehouseId, request.sourceWarehouseId),
            eq(inventoryLots.status, "active"),
            sql`${inventoryLots.remainingQuantity} > 0`,
            inArray(inventoryLots.productId, productIds)
          )
        )
        .orderBy(inventoryLots.receivedDate);

      // 각 제품의 첫 번째(가장 오래된) lot만 저장
      for (const lot of lots) {
        if (!lotsMap.has(lot.productId)) {
          lotsMap.set(lot.productId, {
            lotNumber: lot.lotNumber,
            expiryDate: lot.expiryDate,
          });
        }
      }
    }

    return {
      success: true,
      data: {
        requestNumber: request.requestNumber,
        outboundTypeLabel: OUTBOUND_TYPE_LABELS[request.outboundType] || request.outboundType,
        status: request.status!,
        createdAt: request.createdAt,
        confirmedAt: request.confirmedAt,
        sourceWarehouseName: request.sourceWarehouseName || "-",
        sourceWarehouseCode: request.sourceWarehouseCode || "-",
        sourceWarehouseAddress: request.sourceWarehouseAddress ?? null,
        targetWarehouseName: request.targetWarehouseName ?? null,
        requestedByName: request.requestedByName ?? null,
        customerType: request.customerType,
        recipientCompany: request.recipientCompany,
        recipientName: request.recipientName,
        recipientAddress: request.recipientAddress,
        recipientPhone: request.recipientPhone,
        courierName: request.courierName,
        trackingNumber: request.trackingNumber,
        notes: request.notes,
        items: items.map((item) => {
          const lot = lotsMap.get(item.productId);
          return {
            productSku: item.productSku,
            productName: item.productName,
            category: item.category,
            unit: item.unit || "EA",
            location: item.location,
            lotNumber: lot?.lotNumber ?? null,
            expiryDate: lot?.expiryDate ?? null,
            requestedQuantity: item.requestedQuantity,
            confirmedQuantity: item.confirmedQuantity,
            currentStock: item.currentStock || 0,
            notes: item.itemNotes,
          };
        }),
      },
    };
  } catch (error) {
    console.error("피킹지 데이터 조회 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "피킹지 데이터 조회에 실패했습니다",
    };
  }
}

/**
 * 피킹지 생성용 복수 출고 요청 일괄 조회
 */
export async function getOutboundRequestsForPickingList(
  requestIds: string[]
): Promise<{ success: boolean; dataList?: PickingListData[]; error?: string }> {
  try {
    const results: PickingListData[] = [];

    for (const id of requestIds) {
      const result = await getOutboundRequestForPickingList(id);
      if (result.success && result.data) {
        results.push(result.data);
      }
    }

    if (results.length === 0) {
      return { success: false, error: "조회 가능한 출고 요청이 없습니다" };
    }

    return { success: true, dataList: results };
  } catch (error) {
    console.error("피킹지 일괄 데이터 조회 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "피킹지 데이터 조회에 실패했습니다",
    };
  }
}
