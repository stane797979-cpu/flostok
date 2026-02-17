"use server";

import { db } from "@/server/db";
import {
  outboundRequests,
  outboundRequestItems,
  products,
  inventory,
  users,
  warehouses,
} from "@/server/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import {
  requireAuth,
  requireManagerOrAbove,
  requireWarehouseOrAbove,
} from "./auth-helpers";
import { processInventoryTransaction } from "./inventory";
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
    requestedByName: string | null;
    sourceWarehouseName: string | null;
    targetWarehouseName: string | null;
    itemsCount: number;
    totalQuantity: number;
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
      requestedByName: users.name,
      sourceWarehouseName: sql<string | null>`sw.name`,
      targetWarehouseName: sql<string | null>`tw.name`,
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
        requestedByName: r.requestedByName,
        sourceWarehouseName: r.sourceWarehouseName ?? null,
        targetWarehouseName: r.targetWarehouseName ?? null,
        itemsCount: stats.itemsCount,
        totalQuantity: stats.totalQuantity,
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
    requestedByName: string | null;
    confirmedByName: string | null;
    confirmedAt: Date | null;
    sourceWarehouseName: string | null;
    targetWarehouseName: string | null;
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
        notes: outboundRequests.notes,
        createdAt: outboundRequests.createdAt,
        confirmedAt: outboundRequests.confirmedAt,
        requestedByName: sql<string>`requested_by.name`,
        confirmedByName: sql<string>`confirmed_by.name`,
        sourceWarehouseName: sql<string | null>`sw.name`,
        targetWarehouseName: sql<string | null>`tw.name`,
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
        requestedByName: request.requestedByName,
        confirmedByName: request.confirmedByName,
        confirmedAt: request.confirmedAt,
        sourceWarehouseName: request.sourceWarehouseName ?? null,
        targetWarehouseName: request.targetWarehouseName ?? null,
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

    // confirmedQuantity 배치 업데이트
    const updateItems = validated.items.filter((i) => i.confirmedQuantity > 0 && requestItemMap.has(i.itemId));
    if (updateItems.length > 0) {
      const qtyCase = updateItems.map((i) => sql`WHEN ${i.itemId} THEN ${i.confirmedQuantity}`);
      await db
        .update(outboundRequestItems)
        .set({ confirmedQuantity: sql`CASE id ${sql.join(qtyCase, sql` `)} END` })
        .where(sql`${outboundRequestItems.id} IN ${updateItems.map((i) => i.itemId)}`);
    }

    // 재고 차감은 순차 실행 (데이터 무결성)
    for (const item of validated.items) {
      const requestItem = requestItemMap.get(item.itemId);
      if (!requestItem) continue;
      if (item.confirmedQuantity === 0) continue;

      // 출발 창고에서 출고
      const outboundResult = await processInventoryTransaction({
        productId: requestItem.productId,
        changeType: request.outboundType as
          | "OUTBOUND_SALE"
          | "OUTBOUND_DISPOSAL"
          | "OUTBOUND_TRANSFER"
          | "OUTBOUND_SAMPLE"
          | "OUTBOUND_LOSS"
          | "OUTBOUND_RETURN",
        quantity: item.confirmedQuantity,
        referenceId: validated.requestId,
        notes: validated.notes,
        warehouseId: request.sourceWarehouseId,
      });

      if (!outboundResult.success) {
        return {
          success: false,
          error: `출고 실패: ${outboundResult.error}`,
        };
      }

      // 이동 출고(OUTBOUND_TRANSFER)이면 도착 창고로 입고
      if (request.outboundType === "OUTBOUND_TRANSFER" && request.targetWarehouseId) {
        const inboundResult = await processInventoryTransaction({
          productId: requestItem.productId,
          changeType: "INBOUND_TRANSFER",
          quantity: item.confirmedQuantity,
          referenceId: validated.requestId,
          notes: validated.notes,
          warehouseId: request.targetWarehouseId,
        });

        if (!inboundResult.success) {
          return {
            success: false,
            error: `입고 실패: ${inboundResult.error}`,
          };
        }
      }
    }

    // 요청 상태 업데이트 (confirmed)
    await db
      .update(outboundRequests)
      .set({
        status: "confirmed",
        confirmedById: user.id,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(outboundRequests.id, validated.requestId));

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
