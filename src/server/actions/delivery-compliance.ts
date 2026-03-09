"use server";

import { db } from "@/server/db";
import { purchaseOrders, purchaseOrderItems } from "@/server/db/schema";
import { suppliers } from "@/server/db/schema";
import { products } from "@/server/db/schema";
import { eq, and, ne, inArray, sql, gte, lte, like } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import {
  analyzeDeliveryCompliance,
  type DeliveryComplianceResult,
} from "@/server/services/scm/delivery-compliance";

const emptyResult: DeliveryComplianceResult = {
  items: [],
  supplierSummaries: [],
  overall: {
    totalOrders: 0,
    completedOrders: 0,
    onTimeRate: 0,
    avgLeadTime: 0,
    avgDelayDays: 0,
  },
};

/**
 * 납기분석 필터 옵션 조회 (공급자 목록 + 요약 통계만 빠르게 반환)
 */
export async function getDeliveryFilterOptions(): Promise<{
  suppliers: Array<{ id: string; name: string }>;
  orderCount: number;
  dateRange: { min: string | null; max: string | null };
}> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) return { suppliers: [], orderCount: 0, dateRange: { min: null, max: null } };

  const [supplierRows, statsRow] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.organizationId, orgId))
      .orderBy(suppliers.name),
    db
      .select({
        count: sql<number>`count(*)`,
        minDate: sql<string | null>`min(${purchaseOrders.orderDate})`,
        maxDate: sql<string | null>`max(${purchaseOrders.orderDate})`,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          ne(purchaseOrders.status, "cancelled"),
          ne(purchaseOrders.status, "draft")
        )
      ),
  ]);

  return {
    suppliers: supplierRows,
    orderCount: Number(statsRow[0]?.count || 0),
    dateRange: {
      min: statsRow[0]?.minDate || null,
      max: statsRow[0]?.maxDate || null,
    },
  };
}

/**
 * 납기준수 분석 데이터 조회 (필터 기반)
 */
export async function getDeliveryComplianceData(filters?: {
  supplierId?: string;
  orderNumber?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<DeliveryComplianceResult> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) return emptyResult;

  const { supplierId, orderNumber, startDate, endDate, limit = 100 } = filters || {};

  // 조건 빌드
  const conditions = [
    eq(purchaseOrders.organizationId, orgId),
    ne(purchaseOrders.status, "cancelled"),
    ne(purchaseOrders.status, "draft"),
  ];
  if (supplierId) conditions.push(eq(purchaseOrders.supplierId, supplierId));
  if (orderNumber) conditions.push(like(purchaseOrders.orderNumber, `%${orderNumber}%`));
  if (startDate) conditions.push(gte(purchaseOrders.orderDate, startDate));
  if (endDate) conditions.push(lte(purchaseOrders.orderDate, endDate));

  // 발주 데이터 + 공급자 정보를 병렬 조회
  const [orderRows, supplierRows] = await Promise.all([
    db
      .select({
        id: purchaseOrders.id,
        orderNumber: purchaseOrders.orderNumber,
        supplierId: purchaseOrders.supplierId,
        orderDate: purchaseOrders.orderDate,
        expectedDate: purchaseOrders.expectedDate,
        actualDate: purchaseOrders.actualDate,
        requestedDate: purchaseOrders.requestedDate,
        status: purchaseOrders.status,
      })
      .from(purchaseOrders)
      .where(and(...conditions))
      .orderBy(sql`${purchaseOrders.orderDate} DESC`)
      .limit(limit),
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        avgLeadTime: suppliers.avgLeadTime,
      })
      .from(suppliers)
      .where(eq(suppliers.organizationId, orgId)),
  ]);

  if (orderRows.length === 0) return emptyResult;

  const supplierMap = new Map(
    supplierRows.map((s) => [s.id, { name: s.name, avgLeadTime: s.avgLeadTime ?? 7 }])
  );

  // 발주 항목 + 제품명 조회 (필터된 발주만)
  const orderIds = orderRows.map((o) => o.id);
  const orderProductMap = new Map<string, string[]>();

  const itemRows = await db
    .select({
      purchaseOrderId: purchaseOrderItems.purchaseOrderId,
      productName: products.name,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(inArray(purchaseOrderItems.purchaseOrderId, orderIds));

  for (const row of itemRows) {
    const existing = orderProductMap.get(row.purchaseOrderId) || [];
    existing.push(row.productName);
    orderProductMap.set(row.purchaseOrderId, existing);
  }

  // 분석용 데이터 구성
  const analysisInput = orderRows.map((order) => {
    const supplier = order.supplierId ? supplierMap.get(order.supplierId) : null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierName: supplier?.name || "미지정",
      productNames: orderProductMap.get(order.id) || [],
      orderDate: order.orderDate,
      expectedDate: order.expectedDate,
      actualDate: order.actualDate,
      requestedDate: order.requestedDate,
      standardLeadTime: supplier?.avgLeadTime ?? 7,
      status: order.status,
    };
  });

  return analyzeDeliveryCompliance(analysisInput);
}
