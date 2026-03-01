"use server";

import { db } from "@/server/db";
import { purchaseOrders, purchaseOrderItems } from "@/server/db/schema";
import { suppliers } from "@/server/db/schema";
import { products } from "@/server/db/schema";
import { eq, and, ne, inArray } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import {
  analyzeDeliveryCompliance,
  type DeliveryComplianceResult,
} from "@/server/services/scm/delivery-compliance";

/**
 * 납기준수 분석 데이터 조회
 */
export async function getDeliveryComplianceData(): Promise<DeliveryComplianceResult> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) {
    return {
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
  }

  // 발주 데이터 + 공급자 정보를 Promise.all로 병렬 조회 (독립적이므로 동시 실행)
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
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          ne(purchaseOrders.status, "cancelled"),
          ne(purchaseOrders.status, "draft")
        )
      ),
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        avgLeadTime: suppliers.avgLeadTime,
      })
      .from(suppliers)
      .where(eq(suppliers.organizationId, orgId)),
  ]);

  const supplierMap = new Map(
    supplierRows.map((s) => [s.id, { name: s.name, avgLeadTime: s.avgLeadTime ?? 7 }])
  );

  // itemRows는 orderIds에 의존하므로 2단계 유지
  const orderIds = orderRows.map((o) => o.id);
  const orderProductMap = new Map<string, string[]>();

  if (orderIds.length > 0) {
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
