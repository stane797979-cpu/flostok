/**
 * AI 도구: 발주 관련 도구
 * Anthropic Claude Tool Calling 형식
 */

import { db } from "@/server/db";
import { products, inventory, suppliers, purchaseOrders } from "@/server/db/schema";
import { eq, and, sql, or, desc } from "drizzle-orm";
import { getAverageDailySales } from "@/server/actions/sales";
import {
  convertToReorderItem,
  calculateReorderPriority,
  type ProductReorderData,
} from "@/server/services/scm/reorder-recommendation";

// TODO: 인증 구현 후 실제 organizationId로 교체
const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * 발주 추천 목록 조회 도구 정의
 */
export const getReorderRecommendationsTool = {
  name: "get_reorder_recommendations",
  description: `발주가 필요한 제품 목록과 추천 수량을 조회합니다.

  발주점 계산 공식: 발주점 = 일평균판매량 x 리드타임(일) + 안전재고

  반환 정보:
  - 제품 정보 (SKU, 이름, 카테고리)
  - 현재 재고 및 안전재고, 발주점
  - 재고 상태 및 긴급도 레벨 (0-3)
  - 추천 발주 수량
  - 공급자 정보 및 리드타임
  - 우선순위 점수 (100점 만점)`,
  input_schema: {
    type: "object" as const,
    properties: {
      urgencyLevel: {
        type: "number",
        description:
          "최소 긴급도 레벨 (0: 전체, 1: 주의 이상, 2: 부족 이상, 3: 위험/품절만)",
      },
      abcGrade: {
        type: "string",
        enum: ["A", "B", "C"],
        description: "특정 ABC 등급만 필터링",
      },
      supplierId: {
        type: "string",
        description: "특정 공급자의 제품만 필터링",
      },
      limit: {
        type: "number",
        description: "반환할 최대 항목 수 (기본값: 20)",
      },
    },
    required: [],
  },
};

/**
 * 발주 추천 목록 조회 실행
 */
export async function executeGetReorderRecommendations(input: {
  urgencyLevel?: number;
  abcGrade?: "A" | "B" | "C";
  supplierId?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: {
    summary: {
      totalItemsNeedingReorder: number;
      urgentCount: number;
      totalEstimatedValue: number;
      byStatus: Record<string, number>;
    };
    items: Array<{
      productId: string;
      sku: string;
      productName: string;
      category: string | null;
      currentStock: number;
      safetyStock: number;
      reorderPoint: number;
      avgDailySales: number;
      daysOfStock: number | null;
      recommendedQty: number;
      estimatedCost: number;
      status: string;
      statusLabel: string;
      urgencyLevel: number;
      priorityScore: number;
      supplier?: {
        id: string;
        name: string;
        leadTime: number;
      };
      abcGrade: string | null;
    }>;
  };
  error?: string;
}> {
  try {
    const { urgencyLevel = 0, abcGrade, supplierId, limit = 20 } = input;

    // 발주 필요 제품 조회 (현재고 <= 발주점)
    const conditions = [
      eq(products.organizationId, TEMP_ORG_ID),
      sql`${products.isActive} IS NOT NULL`,
    ];

    if (abcGrade) {
      conditions.push(eq(products.abcGrade, abcGrade));
    }
    if (supplierId) {
      conditions.push(eq(products.primarySupplierId, supplierId));
    }

    const reorderCandidates = await db
      .select({
        product: products,
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
          ...conditions,
          or(
            sql`${inventory.currentStock} IS NULL`,
            sql`${inventory.currentStock} <= ${products.reorderPoint}`
          )
        )
      );

    // 각 제품의 발주 추천 정보 생성
    const reorderItemsPromises = reorderCandidates.map(async (row) => {
      const avgDailySales = await getAverageDailySales(row.product.id, 30);

      const data: ProductReorderData = {
        productId: row.product.id,
        sku: row.product.sku,
        productName: row.product.name,
        currentStock: row.inventory?.currentStock || 0,
        safetyStock: row.product.safetyStock || 0,
        reorderPoint: row.product.reorderPoint || 0,
        avgDailySales,
        abcGrade: row.product.abcGrade || undefined,
        moq: row.product.moq || 1,
        leadTime: row.supplier?.avgLeadTime || row.product.leadTime || 7,
        unitPrice: row.product.unitPrice || 0,
        costPrice: row.product.costPrice || 0,
        supplierId: row.supplier?.id,
        supplierName: row.supplier?.name,
      };

      const reorderItem = convertToReorderItem(data);
      return {
        item: reorderItem,
        product: row.product,
        supplier: row.supplier,
        avgDailySales,
      };
    });

    const results = await Promise.all(reorderItemsPromises);
    const validResults = results.filter((r) => r.item !== null);

    // 긴급도 필터링
    const filteredResults = validResults.filter(
      (r) => r.item!.urgencyLevel >= urgencyLevel
    );

    // ABC 등급 매핑
    const abcGradesMap = new Map<string, "A" | "B" | "C">();
    filteredResults.forEach((r) => {
      if (r.product.abcGrade) {
        abcGradesMap.set(r.product.id, r.product.abcGrade);
      }
    });

    // 우선순위 정렬
    const sortedItems = filteredResults.sort((a, b) => {
      const scoreA = calculateReorderPriority(a.item!, abcGradesMap.get(a.product.id));
      const scoreB = calculateReorderPriority(b.item!, abcGradesMap.get(b.product.id));
      return scoreB - scoreA;
    });

    // limit 적용
    const limitedItems = sortedItems.slice(0, limit);

    // 상태별 집계
    const byStatus: Record<string, number> = {};
    let totalEstimatedValue = 0;
    let urgentCount = 0;

    filteredResults.forEach((r) => {
      const status = r.item!.status;
      byStatus[status] = (byStatus[status] || 0) + 1;

      const estimatedCost = r.item!.recommendedQty * (r.product.costPrice || 0);
      totalEstimatedValue += estimatedCost;

      if (r.item!.urgencyLevel >= 2) {
        urgentCount++;
      }
    });

    const statusLabels: Record<string, string> = {
      out_of_stock: "품절",
      critical: "위험",
      shortage: "부족",
      caution: "주의",
    };

    return {
      success: true,
      data: {
        summary: {
          totalItemsNeedingReorder: filteredResults.length,
          urgentCount,
          totalEstimatedValue,
          byStatus,
        },
        items: limitedItems.map((r) => ({
          productId: r.product.id,
          sku: r.product.sku,
          productName: r.product.name,
          category: r.product.category,
          currentStock: r.item!.currentStock,
          safetyStock: r.item!.safetyStock,
          reorderPoint: r.item!.reorderPoint,
          avgDailySales: r.avgDailySales,
          daysOfStock: r.item!.daysOfStock,
          recommendedQty: r.item!.recommendedQty,
          estimatedCost: r.item!.recommendedQty * (r.product.costPrice || 0),
          status: r.item!.status,
          statusLabel: statusLabels[r.item!.status] || r.item!.status,
          urgencyLevel: r.item!.urgencyLevel,
          priorityScore: calculateReorderPriority(r.item!, abcGradesMap.get(r.product.id)),
          supplier: r.supplier?.id
            ? {
                id: r.supplier.id,
                name: r.supplier.name,
                leadTime: r.supplier.avgLeadTime || r.product.leadTime || 7,
              }
            : undefined,
          abcGrade: r.product.abcGrade,
        })),
      },
    };
  } catch (error) {
    console.error("발주 추천 목록 조회 오류:", error);
    return { success: false, error: "발주 추천 목록 조회에 실패했습니다" };
  }
}

/**
 * 발주 현황 조회 도구 정의
 */
export const getPurchaseOrderStatusTool = {
  name: "get_purchase_order_status",
  description: `발주서 현황을 조회합니다.

  발주 상태:
  - draft: 초안 (작성 중)
  - approved: 승인됨
  - ordered: 발주완료 (공급자에게 전송됨)
  - partially_received: 부분입고
  - received: 입고완료
  - cancelled: 취소됨`,
  input_schema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        enum: ["draft", "approved", "ordered", "partially_received", "received", "cancelled"],
        description: "특정 상태의 발주서만 필터링",
      },
      supplierId: {
        type: "string",
        description: "특정 공급자의 발주서만 필터링",
      },
      limit: {
        type: "number",
        description: "반환할 최대 발주서 수 (기본값: 10)",
      },
    },
    required: [],
  },
};

/**
 * 발주 현황 조회 실행
 */
export async function executeGetPurchaseOrderStatus(input: {
  status?: string;
  supplierId?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: {
    summary: {
      totalOrders: number;
      totalAmount: number;
      byStatus: Record<string, { count: number; amount: number }>;
    };
    orders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      statusLabel: string;
      supplierName: string | null;
      totalAmount: number;
      orderDate: string | null;
      expectedDate: string | null;
      itemCount: number;
    }>;
  };
  error?: string;
}> {
  try {
    const { status, supplierId, limit = 10 } = input;

    const conditions = [eq(purchaseOrders.organizationId, TEMP_ORG_ID)];

    if (status) {
      conditions.push(
        eq(purchaseOrders.status, status as (typeof purchaseOrders.status.enumValues)[number])
      );
    }
    if (supplierId) {
      conditions.push(eq(purchaseOrders.supplierId, supplierId));
    }

    // 상태별 집계
    const statusAggregation = await db
      .select({
        status: purchaseOrders.status,
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`sum(${purchaseOrders.totalAmount})`,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, TEMP_ORG_ID))
      .groupBy(purchaseOrders.status);

    const byStatus: Record<string, { count: number; amount: number }> = {};
    let totalOrders = 0;
    let totalAmount = 0;

    statusAggregation.forEach((row) => {
      const count = Number(row.count);
      const amount = Number(row.totalAmount || 0);
      totalOrders += count;
      totalAmount += amount;
      byStatus[row.status] = { count, amount };
    });

    // 발주서 목록 조회
    const orders = await db
      .select({
        order: purchaseOrders,
        supplier: {
          name: suppliers.name,
        },
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(limit);

    const statusLabels: Record<string, string> = {
      draft: "초안",
      approved: "승인됨",
      ordered: "발주완료",
      partially_received: "부분입고",
      received: "입고완료",
      cancelled: "취소됨",
    };

    return {
      success: true,
      data: {
        summary: {
          totalOrders,
          totalAmount,
          byStatus,
        },
        orders: orders.map((row) => ({
          id: row.order.id,
          orderNumber: row.order.orderNumber,
          status: row.order.status as string,
          statusLabel: statusLabels[row.order.status] || row.order.status,
          supplierName: row.supplier?.name || null,
          totalAmount: row.order.totalAmount ?? 0,
          orderDate: row.order.orderDate,
          expectedDate: row.order.expectedDate,
          itemCount: 0, // TODO: join으로 실제 count 조회
        })),
      },
    };
  } catch (error) {
    console.error("발주 현황 조회 오류:", error);
    return { success: false, error: "발주 현황 조회에 실패했습니다" };
  }
}
