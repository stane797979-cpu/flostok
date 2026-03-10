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
import { eq, and, desc, asc, sql, count, gte, lte, or, isNull, ne, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { salesRecords, organizations, alerts, inboundRecords, activityLogs } from "@/server/db/schema";
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
import { parseExcelBuffer, sheetToJson } from "@/server/services/excel/parser";
import type { OrganizationSettings } from "@/types/organization-settings";

/**
 * 발주 필요 품목 조회 옵션 스키마
 */
const reorderOptionsSchema = z.object({
  urgencyLevel: z.number().min(0).max(3).optional(),
  abcGrade: z.enum(["A", "B", "C"]).optional(),
  limit: z.number().min(1).max(500).optional(),
});

/**
 * 발주 필요 품목 목록 조회 (내부 함수 — 인증 세션 불필요)
 *
 * 크론잡 등 서버 내부에서 orgId를 직접 알고 있는 경우 사용합니다.
 * orgSettings를 전달하면 organizations SELECT를 생략합니다.
 *
 * @param orgId - 조직 ID
 * @param orgSettings - 조직 settings (전달 시 organizations SELECT 생략)
 * @param options - 필터링 옵션
 * @returns 발주 필요 품목 목록
 */
export async function getReorderItemsInternal(
  orgId: string,
  orgSettings?: Record<string, unknown> | null,
  options?: {
    urgencyLevel?: number;
    abcGrade?: "A" | "B" | "C";
    limit?: number;
  }
): Promise<{
  items: ReorderItem[];
  total: number;
}> {
  // 옵션 유효성 검사
  const validatedOptions = reorderOptionsSchema.parse(options || {});
  const { urgencyLevel, abcGrade, limit = 500 } = validatedOptions;

  // 조직 설정에서 보정계수 로드 (orgSettings가 전달되지 않은 경우만 DB 조회)
  let resolvedSettings: OrganizationSettings | null = null;
  if (orgSettings !== undefined) {
    resolvedSettings = orgSettings as OrganizationSettings | null;
  } else {
    const [orgData] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    resolvedSettings = orgData?.settings as OrganizationSettings | null;
  }
  const supplyCoefficients = resolvedSettings?.orderPolicy?.supplyCoefficients;

  // 발주 필요 제품 조회 (전 창고 합산 현재고 <= 발주점, 활성 PO 없는 제품만)
  // 성능 최적화: NOT EXISTS 서브쿼리를 사전 조회 + LEFT JOIN IS NULL로 변경
  const MAX_CANDIDATES = 500;

  // 1단계: 활성 PO에 포함된 제품 ID를 먼저 한 번만 조회 (인덱스 활용)
  const reorderCandidates = await db.execute<{
    product_id: string;
    product_sku: string;
    product_name: string;
    safety_stock: number;
    reorder_point: number;
    moq: number;
    lead_time: number;
    unit_price: number;
    cost_price: number;
    abc_grade: string | null;
    xyz_grade: string | null;
    primary_supplier_id: string | null;
    total_stock: number;
    supplier_id: string | null;
    supplier_name: string | null;
    supplier_avg_lead_time: number | null;
  }>(sql`
      WITH active_po_products AS (
        SELECT DISTINCT poi.product_id
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.purchase_order_id
        WHERE po.organization_id = ${orgId}
          AND po.status NOT IN ('cancelled', 'received', 'completed')
          AND po.deleted_at IS NULL
      ),
      inv_agg AS (
        SELECT product_id, SUM(current_stock) AS total_stock
        FROM inventory
        WHERE organization_id = ${orgId}
        GROUP BY product_id
      )
      SELECT
        p.id AS product_id,
        p.sku AS product_sku,
        p.name AS product_name,
        COALESCE(p.safety_stock, 0) AS safety_stock,
        COALESCE(p.reorder_point, 0) AS reorder_point,
        COALESCE(p.moq, 1) AS moq,
        COALESCE(p.lead_time, 7) AS lead_time,
        COALESCE(p.unit_price, 0) AS unit_price,
        COALESCE(p.cost_price, 0) AS cost_price,
        p.abc_grade,
        p.xyz_grade,
        p.primary_supplier_id,
        COALESCE(ia.total_stock, 0) AS total_stock,
        s.id AS supplier_id,
        s.name AS supplier_name,
        s.avg_lead_time AS supplier_avg_lead_time
      FROM products p
      LEFT JOIN inv_agg ia ON ia.product_id = p.id
      LEFT JOIN suppliers s ON s.id = p.primary_supplier_id
      LEFT JOIN active_po_products app ON app.product_id = p.id
      WHERE p.organization_id = ${orgId}
        AND p.deleted_at IS NULL
        AND COALESCE(ia.total_stock, 0) <= COALESCE(p.reorder_point, 0)
        AND app.product_id IS NULL
      ORDER BY
        CASE WHEN COALESCE(ia.total_stock, 0) = 0 THEN 0
             WHEN COALESCE(ia.total_stock, 0) < COALESCE(p.safety_stock, 0) * 0.5 THEN 1
             ELSE 2
        END ASC,
        COALESCE(ia.total_stock, 0) ASC
      LIMIT ${MAX_CANDIDATES}
    `);

  type CandidateRow = {
    product_id: string; product_sku: string; product_name: string;
    safety_stock: number; reorder_point: number; moq: number; lead_time: number;
    unit_price: number; cost_price: number; abc_grade: string | null; xyz_grade: string | null;
    primary_supplier_id: string | null; total_stock: number;
    supplier_id: string | null; supplier_name: string | null; supplier_avg_lead_time: number | null;
  };
  const candidateRows = Array.from(reorderCandidates as unknown as CandidateRow[]);

  const productIds = candidateRows.map((r) => r.product_id);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  const avgSalesMap = new Map<string, number>();
  const forecastMap = new Map<string, { dailySales: number; method: string }>();

  if (productIds.length > 0) {
    const forecastStart = new Date();
    forecastStart.setDate(1);
    const forecastEnd = new Date();
    forecastEnd.setMonth(forecastEnd.getMonth() + 3);
    const forecastStartStr = forecastStart.toISOString().split("T")[0];
    const forecastEndStr = forecastEnd.toISOString().split("T")[0];

    const [salesData, forecastData] = await Promise.all([
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

  const allReorderItems = candidateRows
    .map((row) => {
      const avgDailySales = avgSalesMap.get(row.product_id) || 0;
      const forecast = forecastMap.get(row.product_id);

      const data: ProductReorderData = {
        productId: row.product_id,
        sku: row.product_sku,
        productName: row.product_name,
        currentStock: Number(row.total_stock) || 0,
        safetyStock: Number(row.safety_stock) || 0,
        reorderPoint: Number(row.reorder_point) || 0,
        avgDailySales,
        abcGrade: (row.abc_grade as "A" | "B" | "C") || undefined,
        xyzGrade: (row.xyz_grade as "X" | "Y" | "Z") || undefined,
        moq: Number(row.moq) || 1,
        leadTime: Number(row.supplier_avg_lead_time) || Number(row.lead_time) || 7,
        unitPrice: Number(row.unit_price) || 0,
        costPrice: Number(row.cost_price) || 0,
        supplierId: row.supplier_id ?? undefined,
        supplierName: row.supplier_name ?? undefined,
        supplyCoefficients,
        forecastDailySales: forecast?.dailySales,
        forecastMethod: forecast?.method,
      };

      return convertToReorderItem(data);
    })
    .filter((item): item is ReorderItem => item !== null);

  const abcGradesMap = new Map<string, "A" | "B" | "C">();
  candidateRows.forEach((row) => {
    if (row.abc_grade) {
      abcGradesMap.set(row.product_id, row.abc_grade as "A" | "B" | "C");
    }
  });

  let filteredItems = allReorderItems;
  if (urgencyLevel !== undefined) {
    filteredItems = filterByUrgency(filteredItems, urgencyLevel);
  }
  if (abcGrade) {
    filteredItems = filterByABCGrade(filteredItems, abcGradesMap, abcGrade);
  }

  const sortedItems = sortReorderItems(filteredItems, abcGradesMap);
  const limitedItems = sortedItems.slice(0, limit);

  return {
    items: limitedItems,
    total: filteredItems.length,
  };
}

/**
 * 발주 필요 품목 목록 조회
 *
 * 인증 세션에서 orgId를 추출하여 getReorderItemsInternal에 위임합니다.
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
    if (!user?.organizationId) {
      throw new Error("인증된 사용자를 찾을 수 없습니다");
    }
    // organizations SELECT는 getReorderItemsInternal 내부에서 처리 (orgSettings 미전달 시)
    return await getReorderItemsInternal(user.organizationId, undefined, options);
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

    // 인증 먼저 (orgId 필요)
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      throw new Error("인증된 사용자를 찾을 수 없습니다");
    }
    const orgId = user.organizationId;

    // 제품 + 판매량 + 조직설정 3개 병렬 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [productDataArr, salesResult, singleOrgDataArr] = await Promise.all([
      db
        .select({
          product: products,
          inventory: inventory,
          supplier: suppliers,
        })
        .from(products)
        .leftJoin(inventory, eq(products.id, inventory.productId))
        .leftJoin(suppliers, eq(products.primarySupplierId, suppliers.id))
        .where(eq(products.id, productId))
        .limit(1),
      db
        .select({ total: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)` })
        .from(salesRecords)
        .where(
          and(
            eq(salesRecords.organizationId, orgId),
            eq(salesRecords.productId, productId),
            gte(salesRecords.date, thirtyDaysAgo.toISOString().split("T")[0])
          )
        ),
      db
        .select({ settings: organizations.settings })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1),
    ]);

    const productData = productDataArr[0];
    if (!productData) {
      throw new Error("제품을 찾을 수 없습니다");
    }

    const avgDailySales = Math.round((Number(salesResult[0]?.total || 0) / 30) * 100) / 100;
    const singleOrgSettings = singleOrgDataArr[0]?.settings as OrganizationSettings | null;

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
  warehouseId: z.string().uuid().optional(),
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
    if (!user?.organizationId) {
      return { success: false, error: "인증된 사용자를 찾을 수 없습니다" };
    }
    const orgId = user.organizationId;

    // 공급자 + 제품 + 발주번호 시퀀스 병렬 조회
    const productIds = validated.items.map((item) => item.productId);
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");

    const [supplierResult, productsData] = await Promise.all([
      db
        .select()
        .from(suppliers)
        .where(and(eq(suppliers.id, validated.supplierId), eq(suppliers.organizationId, orgId)))
        .limit(1),
      db
        .select()
        .from(products)
        .where(and(sql`${products.id} IN ${productIds}`, eq(products.organizationId, orgId))),
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

    // warehouseId 결정: 입력값 또는 기본 창고
    let warehouseId = validated.warehouseId;
    if (!warehouseId) {
      const { getDefaultWarehouse } = await import("./warehouses");
      const dw = await getDefaultWarehouse();
      if (!dw) return { success: false, error: "기본 창고를 찾을 수 없습니다" };
      warehouseId = dw.id;
    }

    // 예상입고일 계산 (리드타임 기반)
    let expectedDate = validated.expectedDate;
    if (!expectedDate) {
      const expectedDateObj = new Date();
      expectedDateObj.setDate(expectedDateObj.getDate() + (supplier.avgLeadTime || 7));
      expectedDate = expectedDateObj.toISOString().split("T")[0];
    }

    // 트랜잭션으로 발주번호 시퀀스 + 발주서 + 발주 항목 원자적 생성
    const newOrder = await db.transaction(async (tx) => {
      // 발주번호 시퀀스를 트랜잭션 안에서 생성 (동시 요청 시 중복 방지)
      const [todayCount] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            sql`DATE(${purchaseOrders.createdAt}) = CURRENT_DATE`
          )
        );
      const sequence = (Number(todayCount?.count || 0) + 1).toString().padStart(3, "0");
      const orderNumber = `PO-${dateStr}-${sequence}`;

      // 발주서 생성 (destinationWarehouseId 포함)
      const [order] = await tx
        .insert(purchaseOrders)
        .values({
          organizationId: orgId,
          destinationWarehouseId: warehouseId,
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

      return { order, orderNumber };
    });

    revalidatePath("/dashboard/orders");

    // 활동 로깅 (비동기 — 응답 지연 방지)
    if (user) {
      logActivity({
        user,
        action: "CREATE",
        entityType: "purchase_order",
        entityId: newOrder.order.id,
        description: `${newOrder.orderNumber} 발주서 생성`,
      }).catch(console.error);
    }

    return { success: true, orderId: newOrder.order.id };
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

    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return { success: false, error: "인증된 사용자를 찾을 수 없습니다" };
    }
    const orgId = user.organizationId;

    // 현재 발주서 조회
    const [order] = await db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.organizationId, orgId)))
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

    // 승인(approved) 전환은 admin만 가능
    if (newStatus === "approved" && user.role !== "admin") {
      return { success: false, error: "발주서 승인은 관리자만 할 수 있습니다" };
    }

    // 상태 업데이트
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    // 승인 시 승인자/승인일 기록
    if (newStatus === "approved") {
      updateData.approvedById = user.id;
      updateData.approvedAt = new Date();
    }

    // 승인 → 발주 확정 시에도 승인자 기록 (pending에서 바로 ordered로 전환하는 admin)
    if (newStatus === "ordered" && oldStatus === "pending") {
      updateData.approvedById = user.id;
      updateData.approvedAt = new Date();
    }

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
    await logActivity({
      user,
      action: "UPDATE",
      entityType: "purchase_order",
      entityId: orderId,
      description: `발주서 상태 변경: ${oldStatus} → ${newStatus}`,
    });

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
  excludeStatus?: string;
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
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return { orders: [], total: 0 };
  }
  const orgId = user.organizationId;

  const { status, excludeStatus, supplierId, startDate, endDate, limit = 50, offset = 0 } = options || {};

  const conditions = [eq(purchaseOrders.organizationId, orgId), isNull(purchaseOrders.deletedAt)];

  if (status) {
    conditions.push(
      eq(purchaseOrders.status, status as (typeof purchaseOrders.status.enumValues)[number])
    );
  }
  if (excludeStatus) {
    conditions.push(
      ne(purchaseOrders.status, excludeStatus as (typeof purchaseOrders.status.enumValues)[number])
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

  // 성능 최적화: 상관 서브쿼리 제거 → 발주서 조회 후 항목 수를 배치로 가져옴
  const [orderRows, countResult] = await Promise.all([
    db
      .select({
        order: purchaseOrders,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
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

  // 발주 항목 수를 한 번의 쿼리로 배치 조회 (N+1 → 1 쿼리)
  const orderIds = orderRows.map((r) => r.order.id);
  let itemsCountMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const itemsCounts = await db
      .select({
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        count: sql<number>`count(*)`,
      })
      .from(purchaseOrderItems)
      .where(sql`${purchaseOrderItems.purchaseOrderId} IN ${orderIds}`)
      .groupBy(purchaseOrderItems.purchaseOrderId);
    itemsCountMap = new Map(itemsCounts.map((r) => [r.purchaseOrderId, Number(r.count)]));
  }

  return {
    orders: orderRows.map((row) => ({
      ...row.order,
      supplier: row.supplier?.id ? row.supplier : null,
      itemsCount: itemsCountMap.get(row.order.id) || 0,
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
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return null;
  }
  const orgId = user.organizationId;

  // 3개 쿼리를 완전 병렬 실행 (순차 2라운드트립 → 1라운드트립)
  const [orderRows, items, shipments] = await Promise.all([
    db
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
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.organizationId, orgId)))
      .limit(1),
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

  const orderData = orderRows[0];
  if (!orderData) return null;

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
 * 발주서 상세 + 입고 기록 + 변경 이력을 단일 요청으로 조회
 * (클라이언트에서 서버 액션 3개를 별도 호출하면 각각 HTTP 요청 + 인증 = 느림)
 */
export async function getPurchaseOrderDetail(orderId: string): Promise<{
  order: Awaited<ReturnType<typeof getPurchaseOrderById>>;
  inboundRecords: Array<{
    id: string;
    date: string;
    productName: string;
    productSku: string;
    receivedQuantity: number;
    qualityResult: string | null;
  }>;
  activityLogs: Array<{
    id: string;
    description: string;
    userName: string | null;
    action: string;
    createdAt: Date;
  }>;
} | null> {
  const user = await getCurrentUser();
  if (!user?.organizationId) return null;
  const orgId = user.organizationId;

  // 5개 쿼리를 단일 인증 + 완전 병렬로 실행
  const [orderRows, items, shipments, inboundRows, logs] = await Promise.all([
    // 1. 발주서 기본 정보
    db
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
      .where(and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.organizationId, orgId)))
      .limit(1),
    // 2. 발주 항목
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
    // 3. 입항스케줄
    db
      .select({
        warehouseEtaDate: importShipments.warehouseEtaDate,
        etaDate: importShipments.etaDate,
      })
      .from(importShipments)
      .where(eq(importShipments.purchaseOrderId, orderId))
      .orderBy(desc(importShipments.createdAt))
      .limit(1),
    // 4. 입고 기록 (인라인 — 별도 서버 액션 호출 제거)
    db
      .select({
        id: inboundRecords.id,
        date: inboundRecords.date,
        receivedQuantity: inboundRecords.receivedQuantity,
        qualityResult: inboundRecords.qualityResult,
        productName: products.name,
        productSku: products.sku,
      })
      .from(inboundRecords)
      .innerJoin(products, eq(inboundRecords.productId, products.id))
      .where(
        and(
          eq(inboundRecords.organizationId, orgId),
          eq(inboundRecords.purchaseOrderId, orderId)
        )
      )
      .orderBy(desc(inboundRecords.createdAt))
      .limit(100),
    // 5. 변경 이력 (인라인 — 별도 서버 액션 호출 제거)
    db
      .select({
        id: activityLogs.id,
        description: activityLogs.description,
        userName: activityLogs.userName,
        action: activityLogs.action,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.organizationId, orgId),
          eq(activityLogs.entityId, orderId)
        )
      )
      .orderBy(desc(activityLogs.createdAt))
      .limit(30),
  ]);

  const orderData = orderRows[0];
  if (!orderData) return null;

  const latestShipment = shipments[0];
  const shipmentEta = latestShipment?.warehouseEtaDate || latestShipment?.etaDate || null;

  return {
    order: {
      ...orderData.order,
      supplier: orderData.supplier?.id ? orderData.supplier : null,
      items: items.map((row) => ({
        ...row.item,
        product: row.product,
      })),
      shipmentEta,
    },
    inboundRecords: inboundRows,
    activityLogs: logs,
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
    if (!user?.organizationId) return { success: false, error: "인증이 필요합니다" };
    const orgId = user.organizationId;

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

    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return { success: false, cancelledCount: 0, errors: [{ orderId: "", orderNumber: "", error: "인증이 필요합니다" }] };
    }
    const orgId = user.organizationId;

    // 선택된 발주서 조회
    const orders = await db
      .select({ id: purchaseOrders.id, orderNumber: purchaseOrders.orderNumber, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          sql`${purchaseOrders.id} IN ${orderIds}`
        )
      );

    const cancellableStatuses = ["draft", "pending", "approved", "ordered", "confirmed"];

    const cancellableIds: string[] = [];
    for (const order of orders) {
      if (!cancellableStatuses.includes(order.status)) {
        errors.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          error: `현재 상태(${order.status})에서는 취소할 수 없습니다`,
        });
      } else {
        cancellableIds.push(order.id);
      }
    }

    if (cancellableIds.length > 0) {
      await db
        .update(purchaseOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            sql`${purchaseOrders.id} IN ${cancellableIds}`
          )
        );
      cancelledCount = cancellableIds.length;
    }

    revalidatePath("/dashboard/orders");
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
        supplierNotes: z.string().optional(),
      })
    )
    .min(1, "최소 1개 이상의 품목이 필요합니다"),
  warehouseId: z.string().uuid().optional(),
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

    // 활동 로그 기록 (fire-and-forget — 응답 지연 방지)
    const user = await getCurrentUser();
    if (user) {
      logActivity({
        user,
        action: "CREATE",
        entityType: "purchase_order",
        description: `자동 발주 추천 ${recommendationIds.length}건 승인 → 발주서 ${result.createdOrders.length}건 생성`,
        metadata: { recommendationIds, createdOrders: result.createdOrders },
      }).catch((err: unknown) => console.error("활동 로그 기록 오류:", err));
    }

    // revalidatePath는 createBulkPurchaseOrders 내부에서 이미 호출됨 — 중복 제거

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

    // 사용자 정보 조회
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return { success: false, createdOrders: [], errors: [{ productId: "AUTH", error: "인증이 필요합니다" }] };
    }
    const orgId = user.organizationId;

    // 1. 공급자별로 품목 그룹화 (메모리 작업, DB 쿼리 전에 먼저 수행)
    const itemsBySupplier = new Map<string, typeof validated.items>();
    validated.items.forEach((item) => {
      const supplierItems = itemsBySupplier.get(item.supplierId) || [];
      supplierItems.push(item);
      itemsBySupplier.set(item.supplierId, supplierItems);
    });

    const allSupplierIds = [...itemsBySupplier.keys()];
    const allProductIds = validated.items.map((i) => i.productId);

    // 2. 모든 사전 데이터를 단일 Promise.all로 병렬 조회
    //    (warehouseId, checkOrderLimit, suppliers, products, baseCount — 5개 쿼리 동시 실행)
    const { checkOrderLimit } = await import("@/server/services/subscription/limits");
    const warehousePromise = validated.warehouseId
      ? Promise.resolve(validated.warehouseId)
      : import("./warehouses").then(({ getDefaultWarehouseId }) => getDefaultWarehouseId(orgId));

    const [resolvedWarehouseId, limit, allSuppliersData, allProductsData, baseCountRow] = await Promise.all([
      warehousePromise,
      checkOrderLimit(orgId),
      db.select().from(suppliers).where(
        and(eq(suppliers.organizationId, orgId), sql`${suppliers.id} IN ${allSupplierIds}`)
      ),
      db.select().from(products).where(
        and(eq(products.organizationId, orgId), sql`${products.id} IN ${allProductIds}`)
      ),
      db.select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            sql`DATE(${purchaseOrders.createdAt}) = CURRENT_DATE`
          )
        )
        .then((r) => r[0]),
    ]);

    // warehouseId 검증
    if (!resolvedWarehouseId) {
      return { success: false, createdOrders: [], errors: [{ productId: "WAREHOUSE", error: "기본 창고를 찾을 수 없습니다" }] };
    }
    const warehouseId = resolvedWarehouseId;

    // 발주 제한 확인
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

    const suppliersMap = new Map(allSuppliersData.map((s) => [s.id, s]));
    const productsMap = new Map(allProductsData.map((p) => [p.id, p]));
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
    const baseCount = Number(baseCountRow?.count || 0);

    const supplierEntries = [...itemsBySupplier.entries()];

    // 역할 기반 발주 상태 결정: admin → ordered (즉시 발주), manager → pending (결재 대기)
    const initialStatus = user.role === "admin" ? "ordered" as const : "pending" as const;

    // 성능 최적화: 공급자별 개별 트랜잭션 → 단일 트랜잭션 배치 INSERT
    // 메모리에서 모든 발주 데이터를 준비한 후, 1개 트랜잭션으로 일괄 처리
    const ordersToInsert: Array<{
      orderValues: {
        organizationId: string;
        destinationWarehouseId: string;
        orderNumber: string;
        supplierId: string;
        status: "ordered" | "pending";
        totalAmount: number;
        orderDate: string;
        expectedDate: string;
        notes?: string;
        createdById?: string;
      };
      items: Array<{ productId: string; quantity: number; unitPrice: number; totalPrice: number }>;
    }> = [];

    for (const [supplierId, items] of supplierEntries) {
      const supplier = suppliersMap.get(supplierId);
      if (!supplier) {
        items.forEach((item) => {
          errors.push({ productId: item.productId, error: `공급자를 찾을 수 없습니다 (ID: ${supplierId})` });
        });
        continue;
      }

      const validItems = items.filter((item) => {
        if (!productsMap.has(item.productId)) {
          errors.push({ productId: item.productId, error: "제품을 찾을 수 없습니다" });
          return false;
        }
        return true;
      });
      if (validItems.length === 0) continue;

      let totalAmount = 0;
      const orderItems = validItems.map((item) => {
        const product = productsMap.get(item.productId)!;
        const unitPrice = product.costPrice || 0;
        const totalPrice = unitPrice * item.quantity;
        totalAmount += totalPrice;
        return { productId: item.productId, quantity: item.quantity, unitPrice, totalPrice };
      });
      if (orderItems.length === 0) continue;

      const expectedDateObj = new Date();
      expectedDateObj.setDate(expectedDateObj.getDate() + (supplier.avgLeadTime || 7));
      const expectedDate = expectedDateObj.toISOString().split("T")[0];

      const idx = ordersToInsert.length;
      const sequence = (baseCount + idx + 1).toString().padStart(3, "0");
      const orderNumber = `PO-${dateStr}-${sequence}`;

      // 공급자 그룹 내 아이템의 supplierNotes가 있으면 우선 사용
      const supplierNote = validItems.find((item) => item.supplierNotes)?.supplierNotes;

      ordersToInsert.push({
        orderValues: {
          organizationId: orgId,
          destinationWarehouseId: warehouseId,
          orderNumber,
          supplierId,
          status: initialStatus,
          totalAmount,
          orderDate: today.toISOString().split("T")[0],
          expectedDate,
          notes: supplierNote || validated.notes,
          createdById: user.id,
        },
        items: orderItems,
      });
    }

    // 단일 트랜잭션: 모든 발주서 + 모든 발주 항목을 배치 INSERT
    if (ordersToInsert.length > 0) {
      try {
        const insertedOrders = await db.transaction(async (tx) => {
          // 발주서 배치 INSERT
          const orders = await tx
            .insert(purchaseOrders)
            .values(ordersToInsert.map((o) => o.orderValues))
            .returning();

          // 발주 항목 배치 INSERT (모든 항목을 한 번에)
          const allOrderItems = orders.flatMap((order, index) =>
            ordersToInsert[index].items.map((item) => ({
              purchaseOrderId: order.id,
              ...item,
            }))
          );
          if (allOrderItems.length > 0) {
            await tx.insert(purchaseOrderItems).values(allOrderItems);
          }

          return orders;
        });

        createdOrders.push(...insertedOrders.map((o) => o.id));
      } catch (error) {
        console.error("일괄 발주서 생성 트랜잭션 오류:", error);
        ordersToInsert.forEach((o) => {
          o.items.forEach((item) => {
            errors.push({ productId: item.productId, error: "발주서 생성에 실패했습니다" });
          });
        });
      }
    }

    revalidatePath("/dashboard/orders");

    // fire-and-forget: 활동 로깅 + 결재대기 알림 (응답 지연 방지)
    if (createdOrders.length > 0 && user) {
      logActivity({
        user,
        action: "CREATE",
        entityType: "purchase_order",
        entityId: createdOrders[0],
        description: `발주서 ${createdOrders.length}건 일괄 생성`,
      }).catch((err: unknown) => {
        console.error("활동 로그 기록 오류:", err);
      });

      // 매니저가 발주 상신(pending) 시 관리자에게 알림 생성
      if (initialStatus === "pending") {
        db.insert(alerts).values({
          organizationId: orgId,
          type: "order_pending",
          severity: "warning",
          title: "발주 결재 요청",
          message: `${user.name || user.email}님이 발주서 ${createdOrders.length}건의 승인을 요청했습니다.`,
          actionUrl: "/dashboard/orders?tab=orders",
        }).catch((err: unknown) => {
          console.error("결재 알림 생성 오류:", err);
        });
      }
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
    if (!user?.organizationId) return { success: false, message: "인증이 필요합니다", createdCount: 0 };
    const orgId = user.organizationId;

    const file = formData.get("file") as File;
    if (!file) return { success: false, message: "파일이 없습니다", createdCount: 0 };

    const buffer = await file.arrayBuffer();
    const workbook = await parseExcelBuffer(buffer);
    const rows = await sheetToJson<Record<string, unknown>>(workbook);

    if (rows.length === 0) return { success: false, message: "데이터가 없습니다", createdCount: 0 };

    const MAX_UPLOAD_ROWS = 500;
    if (rows.length > MAX_UPLOAD_ROWS) {
      return { success: false, message: `한 번에 최대 ${MAX_UPLOAD_ROWS}행까지 업로드 가능합니다. 현재 ${rows.length}행입니다. 파일을 나누어 업로드해 주세요.`, createdCount: 0 };
    }

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

    // SKU → productId + primarySupplierId 매핑
    const productList = await db
      .select({ id: products.id, sku: products.sku, primarySupplierId: products.primarySupplierId })
      .from(products)
      .where(eq(products.organizationId, orgId));
    const skuMap = new Map(productList.map((p) => [p.sku, p.id]));

    // 공급자명 → supplierId 매핑
    const supplierList = await db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.organizationId, orgId));
    const supplierNameMap = new Map(supplierList.map((s) => [s.name, s.id]));

    // 엑셀에 있는 공급자명 중 DB에 없는 것은 자동 생성 (배치 INSERT)
    if (supplierCol) {
      const excelSupplierNames = new Set(
        rows.map((row) => String(row[supplierCol] || "").trim()).filter(Boolean)
      );
      const newSupplierNames = [...excelSupplierNames].filter((name) => !supplierNameMap.has(name));
      if (newSupplierNames.length > 0) {
        const createdSuppliers = await db
          .insert(suppliers)
          .values(newSupplierNames.map((name) => ({ organizationId: orgId, name })))
          .returning({ id: suppliers.id, name: suppliers.name });
        for (const created of createdSuppliers) {
          supplierNameMap.set(created.name, created.id);
        }
      }
    }

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

    // productId → primarySupplierId 매핑 (products 테이블에서 직접)
    const productToSupplier = new Map<string, string>();
    for (const p of productList) {
      if (p.primarySupplierId) {
        productToSupplier.set(p.id, p.primarySupplierId);
      }
    }

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

      // 공급자: 엑셀에 있으면 매칭, 없으면 primarySupplierId에서 조회
      let supplierId = "";
      if (supplierCol && row[supplierCol]) {
        const supplierName = String(row[supplierCol]).trim();
        supplierId = supplierNameMap.get(supplierName) || "";
      }
      if (!supplierId) {
        supplierId = productToSupplier.get(productId) || "";
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

    // 모든 공급자의 items를 하나의 배열로 통합 (supplierNotes에 공급자별 메모 포함)
    const allBulkItems: Array<{
      productId: string;
      quantity: number;
      supplierId: string;
      supplierNotes?: string;
    }> = [];
    for (const [supplierId, items] of itemsBySupplier.entries()) {
      const noteParts: string[] = [];
      const blNumbers = items.map((i) => i.blNumber).filter(Boolean);
      const containerNumbers = items.map((i) => i.containerNumber).filter(Boolean);
      const itemNotes = items.map((i) => i.notes).filter(Boolean);
      if (blNumbers.length > 0) noteParts.push(`B/L: ${[...new Set(blNumbers)].join(", ")}`);
      if (containerNumbers.length > 0) noteParts.push(`CNTR: ${[...new Set(containerNumbers)].join(", ")}`);
      if (itemNotes.length > 0) noteParts.push(itemNotes.join("; "));
      const supplierNotes = noteParts.length > 0 ? `[엑셀 업로드] ${noteParts.join(" | ")}` : "[엑셀 업로드]";

      for (const item of items) {
        allBulkItems.push({
          productId: item.productId,
          quantity: item.quantity,
          supplierId,
          supplierNotes,
        });
      }
    }

    const result = await createBulkPurchaseOrders({
      items: allBulkItems,
      notes: "[엑셀 업로드]",
    });
    const createdItems = result.success ? result.createdOrders : [];

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
    const detail = error instanceof Error ? error.message : "알 수 없는 오류";
    return { success: false, message: `업로드 중 오류가 발생했습니다: ${detail}`, createdCount: 0 };
  }
}
