"use server";

import { db } from "@/server/db";
import {
  purchaseOrders,
  purchaseOrderItems,
  products,
  inventory,
  suppliers,
  demandForecasts,
  importShipments,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from "@/server/db/schema";
import { eq, and, desc, asc, sql, gte, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { salesRecords, organizations } from "@/server/db/schema";
import {
  convertToReorderItem,
  sortReorderItems,
  filterByUrgency,
  filterByABCGrade,
  calculateRecommendedQuantity,
  type ReorderItem,
  type ProductReorderData,
} from "@/server/services/scm/reorder-recommendation";
import { getCurrentUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import type { OrganizationSettings } from "@/types/organization-settings";

// TODO: 인증 구현 후 실제 organizationId로 교체
const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * 발주 필요 품목 조회 옵션 스키마
 */
const reorderOptionsSchema = z.object({
  urgencyLevel: z.number().min(0).max(3).optional(),
  abcGrade: z.enum(["A", "B", "C"]).optional(),
  limit: z.number().min(1).max(1000).optional(),
});

/**
 * 발주 필요 품목 목록 조회
 *
 * @param options - 필터링 옵션
 * @returns 발주 필요 품목 목록
 */
export async function getReorderItems(options?: {
  urgencyLevel?: number;
  abcGrade?: "A" | "B" | "C";
  limit?: number;
}): Promise<{
  items: ReorderItem[];
  total: number;
}> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;

    // 옵션 유효성 검사
    const validatedOptions = reorderOptionsSchema.parse(options || {});
    const { urgencyLevel, abcGrade, limit = 100 } = validatedOptions;

    // 조직 설정에서 보정계수 로드
    const [orgData] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const orgSettings = orgData?.settings as OrganizationSettings | null;
    const supplyCoefficients = orgSettings?.orderPolicy?.supplyCoefficients;

    // 발주 필요 제품 조회 (현재고 <= 발주점)
    const reorderCandidates = await db
      .select({
        product: {
          id: products.id,
          sku: products.sku,
          name: products.name,
          safetyStock: products.safetyStock,
          reorderPoint: products.reorderPoint,
          moq: products.moq,
          leadTime: products.leadTime,
          unitPrice: products.unitPrice,
          costPrice: products.costPrice,
          abcGrade: products.abcGrade,
          xyzGrade: products.xyzGrade,
          primarySupplierId: products.primarySupplierId,
        },
        inventory: {
          currentStock: inventory.currentStock,
        },
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
          avgLeadTime: suppliers.avgLeadTime,
        },
      })
      .from(products)
      .leftJoin(inventory, eq(products.id, inventory.productId))
      .leftJoin(suppliers, eq(products.primarySupplierId, suppliers.id))
      .where(
        and(
          eq(products.organizationId, orgId),
          // 현재고 <= 발주점
          or(
            sql`${inventory.currentStock} IS NULL`,
            sql`${inventory.currentStock} <= ${products.reorderPoint}`
          )
        )
      );

    // 일평균 판매량을 단일 그룹 쿼리로 일괄 조회 (N+1 쿼리 제거)
    const productIds = reorderCandidates.map((r) => r.product.id);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    // 실적 기반 일평균 + 수요예측 기반 일평균을 병렬 조회
    const avgSalesMap = new Map<string, number>();
    const forecastMap = new Map<string, { dailySales: number; method: string }>();

    if (productIds.length > 0) {
      // 향후 3개월 예측 기간
      const forecastStart = new Date();
      forecastStart.setDate(1); // 이번 달 1일
      const forecastEnd = new Date();
      forecastEnd.setMonth(forecastEnd.getMonth() + 3);
      const forecastStartStr = forecastStart.toISOString().split("T")[0];
      const forecastEndStr = forecastEnd.toISOString().split("T")[0];

      const [salesData, forecastData] = await Promise.all([
        // 실적 기반: 최근 30일 판매량
        db
          .select({
            productId: salesRecords.productId,
            totalQuantity: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)`,
          })
          .from(salesRecords)
          .where(
            and(
              eq(salesRecords.organizationId, orgId),
              sql`${salesRecords.productId} IN ${productIds}`,
              gte(salesRecords.date, thirtyDaysAgoStr),
              lte(salesRecords.date, todayStr)
            )
          )
          .groupBy(salesRecords.productId),

        // 수요예측 기반: 향후 3개월 예측 월평균 → 일평균 환산
        db
          .select({
            productId: demandForecasts.productId,
            avgMonthlyForecast: sql<number>`coalesce(avg(${demandForecasts.forecastQuantity}), 0)`,
            method: sql<string>`(array_agg(${demandForecasts.method} ORDER BY ${demandForecasts.updatedAt} DESC))[1]`,
          })
          .from(demandForecasts)
          .where(
            and(
              eq(demandForecasts.organizationId, orgId),
              sql`${demandForecasts.productId} IN ${productIds}`,
              gte(demandForecasts.period, forecastStartStr),
              lte(demandForecasts.period, forecastEndStr)
            )
          )
          .groupBy(demandForecasts.productId),
      ]);

      for (const row of salesData) {
        avgSalesMap.set(row.productId, Math.round((Number(row.totalQuantity) / 30) * 100) / 100);
      }

      // 수요예측: 월 평균 예측량 → 일평균 (÷30)
      const methodLabelMap: Record<string, string> = {
        sma_3: "SMA", sma_6: "SMA", ses: "SES", holt: "Holt's", wma: "WMA", holt_winters: "Holt-Winters",
      };
      for (const row of forecastData) {
        const monthlyAvg = Number(row.avgMonthlyForecast);
        if (monthlyAvg > 0) {
          forecastMap.set(row.productId, {
            dailySales: Math.round((monthlyAvg / 30) * 100) / 100,
            method: methodLabelMap[row.method] || row.method,
          });
        }
      }
    }

    // 발주 아이템 변환 (DB 호출 없이 메모리에서 처리)
    const allReorderItems = reorderCandidates
      .map((row) => {
        const avgDailySales = avgSalesMap.get(row.product.id) || 0;
        const forecast = forecastMap.get(row.product.id);

        const data: ProductReorderData = {
          productId: row.product.id,
          sku: row.product.sku,
          productName: row.product.name,
          currentStock: row.inventory?.currentStock || 0,
          safetyStock: row.product.safetyStock || 0,
          reorderPoint: row.product.reorderPoint || 0,
          avgDailySales,
          abcGrade: row.product.abcGrade || undefined,
          xyzGrade: row.product.xyzGrade || undefined,
          moq: row.product.moq || 1,
          leadTime: row.supplier?.avgLeadTime || row.product.leadTime || 7,
          unitPrice: row.product.unitPrice || 0,
          costPrice: row.product.costPrice || 0,
          supplierId: row.supplier?.id,
          supplierName: row.supplier?.name,
          supplyCoefficients,
          // 수요예측 기반 일평균 (있으면 우선 사용)
          forecastDailySales: forecast?.dailySales,
          forecastMethod: forecast?.method,
        };

        return convertToReorderItem(data);
      })
      .filter((item): item is ReorderItem => item !== null);

    // ABC 등급 매핑
    const abcGradesMap = new Map<string, "A" | "B" | "C">();
    reorderCandidates.forEach((row) => {
      if (row.product.abcGrade) {
        abcGradesMap.set(row.product.id, row.product.abcGrade);
      }
    });

    // 필터링
    let filteredItems = allReorderItems;
    if (urgencyLevel !== undefined) {
      filteredItems = filterByUrgency(filteredItems, urgencyLevel);
    }
    if (abcGrade) {
      filteredItems = filterByABCGrade(filteredItems, abcGradesMap, abcGrade);
    }

    // 우선순위 정렬
    const sortedItems = sortReorderItems(filteredItems, abcGradesMap);

    // limit 적용
    const limitedItems = sortedItems.slice(0, limit);

    return {
      items: limitedItems,
      total: filteredItems.length,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`);
    }
    console.error("발주 필요 품목 조회 오류:", error);
    throw new Error("발주 필요 품목 조회에 실패했습니다");
  }
}

/**
 * 발주 추천 수량 계산 스키마
 */
const calculateReorderQtySchema = z.object({
  productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
});

/**
 * 발주 추천 수량 계산
 *
 * @param productId - 제품 ID
 * @returns 추천 수량 및 계산 방식
 */
export async function calculateReorderQuantity(productId: string): Promise<{
  recommendedQty: number;
  eoqQty: number;
  method: "eoq" | "rop" | "min_order";
  reason: string;
}> {
  try {
    // 유효성 검사
    calculateReorderQtySchema.parse({ productId });

    // 제품 정보 조회
    const [productData] = await db
      .select({
        product: products,
        inventory: inventory,
        supplier: suppliers,
      })
      .from(products)
      .leftJoin(inventory, eq(products.id, inventory.productId))
      .leftJoin(suppliers, eq(products.primarySupplierId, suppliers.id))
      .where(and(eq(products.id, productId), eq(products.organizationId, TEMP_ORG_ID)))
      .limit(1);

    if (!productData) {
      throw new Error("제품을 찾을 수 없습니다");
    }

    // 일평균 판매량 조회 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const salesResult = await db
      .select({ total: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)` })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, TEMP_ORG_ID),
          eq(salesRecords.productId, productId),
          gte(salesRecords.date, thirtyDaysAgo.toISOString().split("T")[0])
        )
      );
    const avgDailySales = Math.round((Number(salesResult[0]?.total || 0) / 30) * 100) / 100;

    // 조직 설정에서 보정계수 로드
    const [singleOrgData] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, TEMP_ORG_ID))
      .limit(1);
    const singleOrgSettings = singleOrgData?.settings as OrganizationSettings | null;

    // 추천 수량 계산
    const data: ProductReorderData = {
      productId: productData.product.id,
      sku: productData.product.sku,
      productName: productData.product.name,
      currentStock: productData.inventory?.currentStock || 0,
      safetyStock: productData.product.safetyStock || 0,
      reorderPoint: productData.product.reorderPoint || 0,
      avgDailySales,
      abcGrade: productData.product.abcGrade || undefined,
      xyzGrade: productData.product.xyzGrade || undefined,
      moq: productData.product.moq || 1,
      leadTime: productData.supplier?.avgLeadTime || productData.product.leadTime || 7,
      unitPrice: productData.product.unitPrice || 0,
      costPrice: productData.product.costPrice || 0,
      supplierId: productData.supplier?.id,
      supplierName: productData.supplier?.name,
      supplyCoefficients: singleOrgSettings?.orderPolicy?.supplyCoefficients,
    };

    const recommendedQty = calculateRecommendedQuantity(data);

    // EOQ 별도 계산 (참고용)
    const annualDemand = avgDailySales * 365;
    let eoqQty = 0;
    if (annualDemand > 0 && data.costPrice > 0) {
      const { calculateEOQ, calculateHoldingCost } = await import("@/server/services/scm/eoq");
      const orderingCost = 50000;
      const holdingCost = calculateHoldingCost({
        unitPrice: data.costPrice,
        holdingRate: 0.25,
      });
      const eoqResult = calculateEOQ({
        annualDemand,
        orderingCost,
        holdingCostPerUnit: holdingCost,
      });
      eoqQty = eoqResult.eoq;
    }

    // 계산 방식 결정
    let method: "eoq" | "rop" | "min_order" = "rop";
    let reason = "";

    if (recommendedQty === data.moq) {
      method = "min_order";
      reason = `최소발주수량(MOQ) ${data.moq}개 적용`;
    } else if (eoqQty > 0 && Math.abs(recommendedQty - eoqQty) < eoqQty * 0.1) {
      method = "eoq";
      reason = `경제적 발주량(EOQ) 기반 계산`;
    } else {
      method = "rop";
      reason = `발주점(ROP) 및 목표 재고일수(30일) 기반 계산`;
    }

    return {
      recommendedQty,
      eoqQty,
      method,
      reason,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`);
    }
    console.error("발주 수량 계산 오류:", error);
    throw new Error("발주 수량 계산에 실패했습니다");
  }
}

/**
 * 발주서 생성 스키마
 */
const createPurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
        quantity: z.number().min(1, "수량은 1 이상이어야 합니다"),
        unitPrice: z.number().min(0).optional(),
      })
    )
    .min(1, "최소 1개 이상의 품목이 필요합니다"),
  supplierId: z.string().uuid("유효한 공급자 ID가 아닙니다"),
  expectedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

/**
 * 발주서 생성
 *
 * @param input - 발주서 생성 데이터
 * @returns 성공 여부 및 발주서 ID
 */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<{
  success: boolean;
  orderId?: string;
  error?: string;
}> {
  try {
    // 유효성 검사
    const validated = createPurchaseOrderSchema.parse(input);

    // 조직 ID 가져오기
    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;

    // 공급자 + 제품 + 발주번호 시퀀스 병렬 조회
    const productIds = validated.items.map((item) => item.productId);
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");

    const [supplierResult, productsData, todayOrders] = await Promise.all([
      db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, validated.supplierId), eq(suppliers.organizationId, orgId)))
        .limit(1),
      db
        .select()
        .from(products)
        .where(and(sql`${products.id} IN ${productIds}`, eq(products.organizationId, orgId))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            sql`DATE(${purchaseOrders.createdAt}) = CURRENT_DATE`
          )
        ),
    ]);

    const supplier = supplierResult[0];
    if (!supplier) {
      return { success: false, error: "공급자를 찾을 수 없습니다" };
    }

    if (productsData.length !== validated.items.length) {
      return { success: false, error: "일부 제품을 찾을 수 없습니다" };
    }

    // 제품 정보 매핑
    const productsMap = new Map(productsData.map((p) => [p.id, p]));

    // 발주 항목 계산
    let totalAmount = 0;
    const orderItems = validated.items.map((item) => {
      const product = productsMap.get(item.productId)!;
      const unitPrice = item.unitPrice ?? product.costPrice ?? 0;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      };
    });

    // 발주번호 생성 (PO-YYYYMMDD-XXX)
    const sequence = (Number(todayOrders[0]?.count || 0) + 1).toString().padStart(3, "0");
    const orderNumber = `PO-${dateStr}-${sequence}`;

    // 예상입고일 계산 (리드타임 기반)
    let expectedDate = validated.expectedDate;
    if (!expectedDate) {
      const expectedDateObj = new Date();
      expectedDateObj.setDate(expectedDateObj.getDate() + (supplier.avgLeadTime || 7));
      expectedDate = expectedDateObj.toISOString().split("T")[0];
    }

    // 트랜잭션으로 발주서 및 발주 항목 생성
    const newOrder = await db.transaction(async (tx) => {
      // 발주서 생성
      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          organizationId: orgId,
          orderNumber,
          supplierId: validated.supplierId,
          status: "ordered",
          totalAmount,
          orderDate: today.toISOString().split("T")[0],
          expectedDate,
          notes: validated.notes,
        })
        .returning();

      // 발주 항목 생성
      await tx.insert(purchaseOrderItems).values(
        orderItems.map((item) => ({
          purchaseOrderId: order.id,
          ...item,
        }))
      );

      return order;
    });

    revalidatePath("/dashboard/orders");

    // 활동 로깅 (비동기 — 응답 지연 방지)
    if (user) {
      logActivity({
        user,
        action: "CREATE",
        entityType: "purchase_order",
        entityId: newOrder.id,
        description: `${orderNumber} 발주서 생성`,
      }).catch(console.error);
    }

    return { success: true, orderId: newOrder.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`,
      };
    }
    console.error("발주서 생성 오류:", error);
    return { success: false, error: "발주서 생성에 실패했습니다" };
  }
}

/**
 * 발주서 상태 변경
 *
 * 허용 전이:
 * draft → ordered, cancelled
 * ordered → confirmed, shipped, cancelled
 * confirmed → shipped, cancelled
 * shipped → partially_received, received
 * partially_received → received
 * received → completed
 */
const validStatusTransitions: Record<string, string[]> = {
  draft: ["ordered", "cancelled"],
  pending: ["approved", "ordered", "cancelled"],
  approved: ["ordered", "cancelled"],
  ordered: ["confirmed", "shipped", "partially_received", "received", "cancelled"],
  confirmed: ["shipped", "partially_received", "received", "cancelled"],
  shipped: ["partially_received", "received"],
  partially_received: ["received"],
  received: ["completed"],
};

export async function updatePurchaseOrderStatus(
  orderId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validStatuses = [
      "draft", "pending", "approved", "ordered", "confirmed",
      "shipped", "partially_received", "received", "completed", "cancelled",
    ];
    if (!validStatuses.includes(newStatus)) {
      return { success: false, error: "유효하지 않은 상태입니다" };
    }

    // 현재 발주서 조회
    const [order] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.organizationId, TEMP_ORG_ID)))
      .limit(1);

    if (!order) {
      return { success: false, error: "발주서를 찾을 수 없습니다" };
    }

    // 상태 전이 유효성 확인
    const allowed = validStatusTransitions[order.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return {
        success: false,
        error: `'${order.status}' 상태에서 '${newStatus}'(으)로 변경할 수 없습니다`,
      };
    }

    // 기존 상태 저장 (로깅용)
    const oldStatus = order.status;

    // 상태 업데이트
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    // 입고완료/완료 시 실제입고일 기록
    if (newStatus === "received" || newStatus === "completed") {
      updateData.actualDate = new Date().toISOString().split("T")[0];
    }

    await db
      .update(purchaseOrders)
      .set(updateData)
      .where(eq(purchaseOrders.id, orderId));

    revalidatePath("/dashboard/orders");

    // 활동 로깅
    const user = await getCurrentUser();
    if (user) {
      await logActivity({
        user,
        action: "UPDATE",
        entityType: "purchase_order",
        entityId: orderId,
        description: `발주서 상태 변경: ${oldStatus} → ${newStatus}`,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("발주서 상태 변경 오류:", error);
    return { success: false, error: "발주서 상태 변경에 실패했습니다" };
  }
}

/**
 * 발주서 목록 조회
 */
export async function getPurchaseOrders(options?: {
  status?: string;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  orders: (PurchaseOrder & {
    supplier?: { id: string; name: string } | null;
    itemsCount: number;
  })[];
  total: number;
}> {
  const { status, supplierId, startDate, endDate, limit = 50, offset = 0 } = options || {};

  const conditions = [eq(purchaseOrders.organizationId, TEMP_ORG_ID)];

  if (status) {
    conditions.push(
      eq(purchaseOrders.status, status as (typeof purchaseOrders.status.enumValues)[number])
    );
  }
  if (supplierId) {
    conditions.push(eq(purchaseOrders.supplierId, supplierId));
  }
  if (startDate) {
    conditions.push(gte(purchaseOrders.orderDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(purchaseOrders.orderDate, endDate));
  }

  const [orders, countResult] = await Promise.all([
    db
      .select({
        order: purchaseOrders,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
        itemsCount: sql<number>`(
          SELECT COUNT(*)
          FROM ${purchaseOrderItems}
          WHERE ${purchaseOrderItems.purchaseOrderId} = ${purchaseOrders.id}
        )`,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(and(...conditions)),
  ]);

  return {
    orders: orders.map((row) => ({
      ...row.order,
      supplier: row.supplier?.id ? row.supplier : null,
      itemsCount: Number(row.itemsCount),
    })),
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 발주서 상세 조회 (입항스케줄 정보 포함)
 */
export async function getPurchaseOrderById(orderId: string): Promise<
  | (PurchaseOrder & {
      supplier?: { id: string; name: string; contactPhone: string | null } | null;
      items: (PurchaseOrderItem & {
        product: { sku: string; name: string; unit: string | null };
      })[];
      shipmentEta?: string | null; // 입항스케줄 기반 예상입고일 (warehouseEtaDate 우선, etaDate 폴백)
    })
  | null
> {
  const [orderData] = await db
    .select({
      order: purchaseOrders,
      supplier: {
        id: suppliers.id,
        name: suppliers.name,
        contactPhone: suppliers.contactPhone,
      },
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.organizationId, TEMP_ORG_ID)))
    .limit(1);

  if (!orderData) return null;

  // 발주 항목 + 입항스케줄 최신 예상일 병렬 조회
  const [items, shipments] = await Promise.all([
    db
      .select({
        item: purchaseOrderItems,
        product: {
          sku: products.sku,
          name: products.name,
          unit: products.unit,
        },
      })
      .from(purchaseOrderItems)
      .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId))
      .orderBy(asc(purchaseOrderItems.createdAt)),
    db
      .select({
        warehouseEtaDate: importShipments.warehouseEtaDate,
        etaDate: importShipments.etaDate,
      })
      .from(importShipments)
      .where(eq(importShipments.purchaseOrderId, orderId))
      .orderBy(desc(importShipments.createdAt))
      .limit(1),
  ]);

  // 입항스케줄에서 예상입고일 추출 (warehouseEtaDate 우선, etaDate 폴백)
  const latestShipment = shipments[0];
  const shipmentEta = latestShipment?.warehouseEtaDate || latestShipment?.etaDate || null;

  return {
    ...orderData.order,
    supplier: orderData.supplier?.id ? orderData.supplier : null,
    items: items.map((row) => ({
      ...row.item,
      product: row.product,
    })),
    shipmentEta,
  };
}

/**
 * 발주서 예상입고일 변경
 */
export async function updatePurchaseOrderExpectedDate(
  orderId: string,
  expectedDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!expectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) {
      return { success: false, error: "유효한 날짜 형식이 아닙니다 (YYYY-MM-DD)" };
    }

    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;

    const [order] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.organizationId, orgId)))
      .limit(1);

    if (!order) {
      return { success: false, error: "발주서를 찾을 수 없습니다" };
    }

    await db
      .update(purchaseOrders)
      .set({ expectedDate, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, orderId));

    revalidatePath("/dashboard/orders");

    if (user) {
      logActivity({
        user,
        action: "UPDATE",
        entityType: "purchase_order",
        entityId: orderId,
        description: `예상입고일 변경: ${expectedDate}`,
      }).catch(console.error);
    }

    return { success: true };
  } catch (error) {
    console.error("예상입고일 변경 오류:", error);
    return { success: false, error: "예상입고일 변경에 실패했습니다" };
  }
}

/**
 * 발주서 일괄 취소
 *
 * 선택된 발주서들을 한번에 취소 처리합니다.
 * 취소 가능한 상태(draft, ordered, confirmed)만 처리됩니다.
 */
export async function cancelBulkPurchaseOrders(
  orderIds: string[]
): Promise<{
  success: boolean;
  cancelledCount: number;
  errors: Array<{ orderId: string; orderNumber: string; error: string }>;
}> {
  const errors: Array<{ orderId: string; orderNumber: string; error: string }> = [];
  let cancelledCount = 0;

  try {
    if (orderIds.length === 0) {
      return { success: false, cancelledCount: 0, errors: [] };
    }

    // 선택된 발주서 조회
    const orders = await db
      .select({ id: purchaseOrders.id, orderNumber: purchaseOrders.orderNumber, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, TEMP_ORG_ID),
          sql`${purchaseOrders.id} IN ${orderIds}`
        )
      );

    const cancellableStatuses = ["draft", "pending", "approved", "ordered", "confirmed"];

    for (const order of orders) {
      if (!cancellableStatuses.includes(order.status)) {
        errors.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          error: `현재 상태(${order.status})에서는 취소할 수 없습니다`,
        });
        continue;
      }

      await db
        .update(purchaseOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(purchaseOrders.id, order.id));

      cancelledCount++;
    }

    revalidatePath("/dashboard/orders");

    // 활동 로깅
    const user = await getCurrentUser();
    if (user && cancelledCount > 0) {
      await logActivity({
        user,
        action: "UPDATE",
        entityType: "purchase_order",
        description: `발주서 ${cancelledCount}건 일괄 취소`,
        metadata: { orderIds: orderIds.slice(0, 10) },
      });
    }

    return { success: cancelledCount > 0, cancelledCount, errors };
  } catch (error) {
    console.error("발주서 일괄 취소 오류:", error);
    return {
      success: false,
      cancelledCount: 0,
      errors: [{ orderId: "", orderNumber: "", error: "일괄 취소 처리 중 오류가 발생했습니다" }],
    };
  }
}

/**
 * 일괄 발주서 생성 스키마
 */
const createBulkPurchaseOrdersSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
        quantity: z.number().min(1, "수량은 1 이상이어야 합니다"),
        supplierId: z.string().uuid("유효한 공급자 ID가 아닙니다"),
      })
    )
    .min(1, "최소 1개 이상의 품목이 필요합니다"),
  notes: z.string().optional(),
});

export type CreateBulkPurchaseOrdersInput = z.infer<typeof createBulkPurchaseOrdersSchema>;

/**
 * 자동 발주 추천 승인 및 발주서 생성
 *
 * 클라이언트에서 선택된 추천 품목의 데이터를 받아
 * createBulkPurchaseOrders를 호출하여 실제 발주서를 생성합니다.
 *
 * @param recommendationIds - 승인할 추천 ID 배열 (클라이언트 참조용)
 * @param items - 추천 품목 데이터 (productId, quantity, supplierId)
 * @returns 성공 여부, 생성된 발주서 ID 배열, 에러 목록
 */
export async function approveAutoReorders(
  recommendationIds: string[],
  items?: Array<{ productId: string; quantity: number; supplierId: string }>
): Promise<{
  success: boolean;
  createdOrders: string[];
  errors: Array<{ recommendationId: string; error: string }>;
}> {
  try {
    if (!items || items.length === 0) {
      return {
        success: false,
        createdOrders: [],
        errors: [{ recommendationId: "all", error: "승인할 품목 데이터가 없습니다" }],
      };
    }

    // 공급자 ID가 없는 품목은 기본 공급자를 찾아서 매핑
    const validItems: Array<{ productId: string; quantity: number; supplierId: string }> = [];
    const errors: Array<{ recommendationId: string; error: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.supplierId) {
        // 공급자 없는 품목은 에러 처리
        errors.push({
          recommendationId: recommendationIds[i] || `item-${i}`,
          error: `${item.productId}: 공급자가 지정되지 않았습니다`,
        });
        continue;
      }
      validItems.push(item);
    }

    if (validItems.length === 0) {
      return { success: false, createdOrders: [], errors };
    }

    // createBulkPurchaseOrders 호출하여 실제 발주서 생성
    const result = await createBulkPurchaseOrders({
      items: validItems,
      notes: "자동 발주 추천에 의해 생성된 발주서",
    });

    // 활동 로그 기록
    const user = await getCurrentUser();
    if (user) {
      await logActivity({
        user,
        action: "CREATE",
        entityType: "purchase_order",
        description: `자동 발주 추천 ${recommendationIds.length}건 승인 → 발주서 ${result.createdOrders.length}건 생성`,
        metadata: { recommendationIds, createdOrders: result.createdOrders },
      });
    }

    revalidatePath("/dashboard/orders");

    return {
      success: result.success,
      createdOrders: result.createdOrders,
      errors: [
        ...errors,
        ...result.errors.map((e) => ({
          recommendationId: e.productId,
          error: e.error,
        })),
      ],
    };
  } catch (error) {
    console.error("[approveAutoReorders] Error:", error);
    return {
      success: false,
      createdOrders: [],
      errors: [{ recommendationId: "all", error: "발주서 생성 중 오류가 발생했습니다" }],
    };
  }
}

/**
 * 자동 발주 추천 거부
 *
 * 추천 목록은 클라이언트 메모리에서 관리되므로
 * 거부 시 목록에서 제거하고 활동 로그만 기록합니다.
 *
 * @param recommendationIds - 거부할 추천 ID 배열
 * @returns 성공 여부, 에러 목록
 */
export async function rejectAutoReorders(
  recommendationIds: string[]
): Promise<{
  success: boolean;
  errors: Array<{ recommendationId: string; error: string }>;
}> {
  try {
    // 활동 로그 기록
    const user = await getCurrentUser();
    if (user) {
      await logActivity({
        user,
        action: "UPDATE",
        entityType: "purchase_order",
        description: `자동 발주 추천 ${recommendationIds.length}건 거부`,
        metadata: { recommendationIds },
      });
    }

    revalidatePath("/dashboard/orders");

    return { success: true, errors: [] };
  } catch (error) {
    console.error("[rejectAutoReorders] Error:", error);
    return {
      success: false,
      errors: [{ recommendationId: "all", error: "거부 처리 중 오류가 발생했습니다" }],
    };
  }
}

/**
 * 일괄 발주서 생성
 *
 * 선택된 품목들을 공급자별로 그룹화하여 발주서 생성
 *
 * @param input - 일괄 발주 데이터
 * @returns 성공 여부, 생성된 발주서 ID 배열, 에러 목록
 */
export async function createBulkPurchaseOrders(input: CreateBulkPurchaseOrdersInput): Promise<{
  success: boolean;
  createdOrders: string[];
  errors: Array<{ productId: string; error: string }>;
}> {
  const createdOrders: string[] = [];
  const errors: Array<{ productId: string; error: string }> = [];

  try {
    // 유효성 검사
    const validated = createBulkPurchaseOrdersSchema.parse(input);

    // 사용자 정보 조회 (활동 로깅용)
    const user = await getCurrentUser();

    // 1. 공급자별로 품목 그룹화
    const itemsBySupplier = new Map<string, typeof validated.items>();
    validated.items.forEach((item) => {
      const supplierItems = itemsBySupplier.get(item.supplierId) || [];
      supplierItems.push(item);
      itemsBySupplier.set(item.supplierId, supplierItems);
    });

    // 발주 제한 확인 (생성할 발주서 수만큼 확인)
    const { checkOrderLimit } = await import("@/server/services/subscription/limits");
    const limit = await checkOrderLimit(TEMP_ORG_ID);
    const ordersToCreate = itemsBySupplier.size;

    if (limit.limit !== Infinity && limit.current + ordersToCreate > limit.limit) {
      return {
        success: false,
        createdOrders: [],
        errors: [
          {
            productId: "BULK",
            error: `월간 발주 한도를 초과합니다. 현재 플랜(${limit.plan})에서는 월 ${limit.limit}건의 발주를 생성할 수 있습니다. (현재: ${limit.current}건, 추가: ${ordersToCreate}건)`,
          },
        ],
      };
    }

    // 2. 사전 데이터 로드 (루프 밖에서 1회만 조회)
    const allSupplierIds = [...itemsBySupplier.keys()];
    const allProductIds = validated.items.map((i) => i.productId);

    const [allSuppliersData, allProductsData, todayOrderCount] = await Promise.all([
      // 전체 공급자 한번에 조회
      db.select().from(suppliers).where(
        and(eq(suppliers.organizationId, TEMP_ORG_ID), sql`${suppliers.id} IN ${allSupplierIds}`)
      ),
      // 전체 제품 한번에 조회
      db.select().from(products).where(
        and(eq(products.organizationId, TEMP_ORG_ID), sql`${products.id} IN ${allProductIds}`)
      ),
      // 오늘 발주 수 1회만 조회
      db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(
        and(eq(purchaseOrders.organizationId, TEMP_ORG_ID), sql`DATE(${purchaseOrders.createdAt}) = CURRENT_DATE`)
      ),
    ]);

    const suppliersMap = new Map(allSuppliersData.map((s) => [s.id, s]));
    const productsMap = new Map(allProductsData.map((p) => [p.id, p]));
    const baseOrderCount = Number(todayOrderCount[0]?.count || 0);
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");

    // 3. 공급자별로 발주서 생성 (DB 조회 없이 메모리에서 처리)
    for (const [supplierId, items] of itemsBySupplier.entries()) {
      try {
        const supplier = suppliersMap.get(supplierId);
        if (!supplier) {
          items.forEach((item) => {
            errors.push({ productId: item.productId, error: `공급자를 찾을 수 없습니다 (ID: ${supplierId})` });
          });
          continue;
        }

        // 제품 유효성 검증 (메모리에서)
        const validItems = items.filter((item) => {
          if (!productsMap.has(item.productId)) {
            errors.push({ productId: item.productId, error: "제품을 찾을 수 없습니다" });
            return false;
          }
          return true;
        });
        if (validItems.length === 0) continue;

        // 발주 항목 계산
        let totalAmount = 0;
        const orderItems = validItems.map((item) => {
          const product = productsMap.get(item.productId)!;
          const unitPrice = product.costPrice || 0;
          const totalPrice = unitPrice * item.quantity;
          totalAmount += totalPrice;
          return { productId: item.productId, quantity: item.quantity, unitPrice, totalPrice };
        });

        if (orderItems.length === 0) continue;

        // 발주번호 생성 (사전 조회된 카운트 사용)
        const sequence = (baseOrderCount + createdOrders.length + 1).toString().padStart(3, "0");
        const orderNumber = `PO-${dateStr}-${sequence}`;

        // 예상입고일 계산 (리드타임 기반)
        const expectedDateObj = new Date();
        expectedDateObj.setDate(expectedDateObj.getDate() + (supplier.avgLeadTime || 7));
        const expectedDate = expectedDateObj.toISOString().split("T")[0];

        // 트랜잭션으로 발주서 및 발주 항목 생성
        const newOrder = await db.transaction(async (tx) => {
          // 발주서 생성
          const [order] = await tx
            .insert(purchaseOrders)
            .values({
              organizationId: TEMP_ORG_ID,
              orderNumber,
              supplierId,
              status: "ordered",
              totalAmount,
              orderDate: today.toISOString().split("T")[0],
              expectedDate,
              notes: validated.notes,
            })
            .returning();

          // 발주 항목 생성
          await tx.insert(purchaseOrderItems).values(
            orderItems.map((item) => ({
              purchaseOrderId: order.id,
              ...item,
            }))
          );

          return order;
        });

        createdOrders.push(newOrder.id);

        // 활동 로깅
        if (user) {
          await logActivity({
            user,
            action: "CREATE",
            entityType: "purchase_order",
            entityId: newOrder.id,
            description: `${orderNumber} 발주서 생성`,
          });
        }
      } catch (error) {
        console.error(`공급자 ${supplierId} 발주서 생성 오류:`, error);
        items.forEach((item) => {
          errors.push({
            productId: item.productId,
            error: "발주서 생성에 실패했습니다",
          });
        });
      }
    }

    revalidatePath("/dashboard/orders");

    // 일괄 생성 전체에 대한 활동 로깅
    if (createdOrders.length > 0 && user) {
      await logActivity({
        user,
        action: "CREATE",
        entityType: "purchase_order",
        entityId: createdOrders[0], // 첫 번째 발주서 ID 참조
        description: `발주서 ${createdOrders.length}건 일괄 생성`,
      });
    }

    return {
      success: createdOrders.length > 0,
      createdOrders,
      errors,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        createdOrders: [],
        errors: [
          {
            productId: "",
            error: `입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`,
          },
        ],
      };
    }
    console.error("일괄 발주서 생성 오류:", error);
    return {
      success: false,
      createdOrders: [],
      errors: [{ productId: "", error: "일괄 발주서 생성에 실패했습니다" }],
    };
  }
}

/**
 * 발주 엑셀 업로드
 *
 * 엑셀 형식:
 * SKU | 수량 | 공급자명 | 예상입고일 | B/L번호 | 컨테이너번호 | 메모
 *
 * 공급자가 같은 품목끼리 자동으로 묶어서 발주서를 생성합니다.
 */
export async function uploadPurchaseOrderExcel(
  formData: FormData
): Promise<{ success: boolean; message: string; createdCount: number }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;

    const file = formData.get("file") as File;
    if (!file) return { success: false, message: "파일이 없습니다", createdCount: 0 };

    const { default: XLSX } = await import("xlsx");
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) return { success: false, message: "데이터가 없습니다", createdCount: 0 };

    // 헤더 파싱
    const headers = Object.keys(rows[0]);
    const skuCol = headers.find((h) => ["sku", "SKU", "품번", "제품코드", "품목코드"].includes(h.trim()));
    const qtyCol = headers.find((h) => ["수량", "qty", "Qty", "QTY", "발주수량", "주문수량"].includes(h.trim()));
    const supplierCol = headers.find((h) => ["공급자", "공급자명", "supplier", "Supplier", "거래처", "업체명"].includes(h.trim()));

    if (!skuCol) return { success: false, message: "SKU 컬럼을 찾을 수 없습니다 (SKU, 품번, 제품코드 중 하나 필요)", createdCount: 0 };
    if (!qtyCol) return { success: false, message: "수량 컬럼을 찾을 수 없습니다 (수량, qty, 발주수량 중 하나 필요)", createdCount: 0 };

    // 선택적 컬럼
    const expectedDateCol = headers.find((h) => ["예상입고일", "입고일", "expectedDate", "ETA", "eta"].includes(h.trim()));
    const blCol = headers.find((h) => ["B/L", "B/L번호", "BL", "bl_number", "선하증권"].includes(h.trim()));
    const containerCol = headers.find((h) => ["컨테이너", "컨테이너번호", "CNTR", "container", "Container"].includes(h.trim()));
    const notesCol = headers.find((h) => ["메모", "비고", "notes", "Notes", "memo"].includes(h.trim()));

    // SKU → productId 매핑
    const productList = await db
      .select({ id: products.id, sku: products.sku })
      .from(products)
      .where(eq(products.organizationId, orgId));
    const skuMap = new Map(productList.map((p) => [p.sku, p.id]));

    // 공급자명 → supplierId 매핑
    const supplierList = await db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.organizationId, orgId));
    const supplierNameMap = new Map(supplierList.map((s) => [s.name, s.id]));

    // 행 파싱 및 공급자별 그룹화
    type ParsedItem = {
      productId: string;
      quantity: number;
      supplierId: string;
      expectedDate?: string;
      blNumber?: string;
      containerNumber?: string;
      notes?: string;
    };

    const itemsBySupplier = new Map<string, ParsedItem[]>();
    const skipped: string[] = [];

    for (const row of rows) {
      const sku = String(row[skuCol] || "").trim();
      if (!sku) continue;

      const productId = skuMap.get(sku);
      if (!productId) {
        skipped.push(sku);
        continue;
      }

      const quantity = Number(row[qtyCol]) || 0;
      if (quantity <= 0) continue;

      // 공급자: 엑셀에 있으면 매칭, 없으면 첫 번째 공급자
      let supplierId = "";
      if (supplierCol && row[supplierCol]) {
        const supplierName = String(row[supplierCol]).trim();
        supplierId = supplierNameMap.get(supplierName) || "";
      }
      if (!supplierId) {
        // 제품의 공급자 매핑에서 조회
        const [mapping] = await db
          .select({ supplierId: sql<string>`supplier_id` })
          .from(sql`supplier_products`)
          .where(sql`product_id = ${productId}`)
          .limit(1);
        supplierId = mapping?.supplierId || "";
      }
      if (!supplierId) {
        skipped.push(`${sku} (공급자 미지정)`);
        continue;
      }

      const item: ParsedItem = {
        productId,
        quantity,
        supplierId,
        expectedDate: expectedDateCol ? String(row[expectedDateCol] || "").trim() || undefined : undefined,
        blNumber: blCol ? String(row[blCol] || "").trim() || undefined : undefined,
        containerNumber: containerCol ? String(row[containerCol] || "").trim() || undefined : undefined,
        notes: notesCol ? String(row[notesCol] || "").trim() || undefined : undefined,
      };

      if (!itemsBySupplier.has(supplierId)) itemsBySupplier.set(supplierId, []);
      itemsBySupplier.get(supplierId)!.push(item);
    }

    if (itemsBySupplier.size === 0) {
      return {
        success: false,
        message: skipped.length > 0
          ? `발주 가능한 품목이 없습니다. 건너뛴 SKU: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? ` 외 ${skipped.length - 5}건` : ""}`
          : "발주 가능한 품목이 없습니다",
        createdCount: 0,
      };
    }

    // 공급자별 발주서 생성
    const createdItems = [];
    for (const [supplierId, items] of itemsBySupplier.entries()) {
      const bulkItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        supplierId,
      }));

      // 메모에 B/L, 컨테이너 정보 포함
      const noteParts: string[] = [];
      const blNumbers = items.map((i) => i.blNumber).filter(Boolean);
      const containerNumbers = items.map((i) => i.containerNumber).filter(Boolean);
      const itemNotes = items.map((i) => i.notes).filter(Boolean);
      if (blNumbers.length > 0) noteParts.push(`B/L: ${[...new Set(blNumbers)].join(", ")}`);
      if (containerNumbers.length > 0) noteParts.push(`CNTR: ${[...new Set(containerNumbers)].join(", ")}`);
      if (itemNotes.length > 0) noteParts.push(itemNotes.join("; "));

      const result = await createBulkPurchaseOrders({
        items: bulkItems,
        notes: noteParts.length > 0 ? `[엑셀 업로드] ${noteParts.join(" | ")}` : "[엑셀 업로드]",
      });

      if (result.success) {
        createdItems.push(...result.createdOrders);
      }
    }

    revalidatePath("/dashboard/orders");

    const skippedMsg = skipped.length > 0
      ? ` (건너뛴 SKU: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? ` 외 ${skipped.length - 3}건` : ""})`
      : "";

    return {
      success: true,
      message: `${createdItems.length}건의 발주서가 생성되었습니다${skippedMsg}`,
      createdCount: createdItems.length,
    };
  } catch (error) {
    console.error("발주 엑셀 업로드 실패:", error);
    return { success: false, message: "업로드 중 오류가 발생했습니다", createdCount: 0 };
  }
}
