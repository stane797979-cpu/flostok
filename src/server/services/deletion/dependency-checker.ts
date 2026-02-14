"use server";

import { db } from "@/server/db";
import {
  inventory,
  inventoryHistory,
  purchaseOrderItems,
  salesRecords,
  inboundRecords,
  supplierProducts,
  purchaseOrders,
} from "@/server/db/schema";
import { eq, and, sql, isNull, gt } from "drizzle-orm";

export interface DependencyInfo {
  entityType: string;
  label: string; // 한글 레이블
  count: number;
}

export interface DependencyCheckResult {
  canDelete: boolean;
  impactLevel: "low" | "medium" | "high";
  dependencies: DependencyInfo[];
  warnings: string[];
  errors: string[];
}

/**
 * 제품 삭제 전 의존성 체크
 *
 * - 현재고 > 0이면 삭제 불가
 * - 관련 레코드 건수 조회하여 영향도 산출
 */
export async function checkProductDependencies(
  productId: string,
  organizationId: string
): Promise<DependencyCheckResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const [inventoryResult, historyResult, orderItemsResult, salesResult, inboundResult] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventory)
        .where(
          and(
            eq(inventory.productId, productId),
            eq(inventory.organizationId, organizationId)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryHistory)
        .where(
          and(
            eq(inventoryHistory.productId, productId),
            eq(inventoryHistory.organizationId, organizationId)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.productId, productId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(salesRecords)
        .where(
          and(
            eq(salesRecords.productId, productId),
            eq(salesRecords.organizationId, organizationId)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(inboundRecords)
        .where(
          and(
            eq(inboundRecords.productId, productId),
            eq(inboundRecords.organizationId, organizationId)
          )
        ),
    ]);

  // 현재고 확인
  const currentStockResult = await db
    .select({ currentStock: inventory.currentStock })
    .from(inventory)
    .where(
      and(
        eq(inventory.productId, productId),
        eq(inventory.organizationId, organizationId),
        gt(inventory.currentStock, 0)
      )
    );

  const hasStock = currentStockResult.length > 0;
  if (hasStock) {
    errors.push("현재고가 있는 제품은 삭제할 수 없습니다. 재고를 먼저 0으로 조정해주세요.");
  }

  const dependencies: DependencyInfo[] = [
    { entityType: "inventory", label: "재고 레코드", count: inventoryResult[0]?.count || 0 },
    { entityType: "inventory_history", label: "재고 변동 이력", count: historyResult[0]?.count || 0 },
    { entityType: "purchase_order_items", label: "발주 항목", count: orderItemsResult[0]?.count || 0 },
    { entityType: "sales_records", label: "판매 기록", count: salesResult[0]?.count || 0 },
    { entityType: "inbound_records", label: "입고 기록", count: inboundResult[0]?.count || 0 },
  ].filter((d) => d.count > 0);

  const totalDeps = dependencies.reduce((sum, d) => sum + d.count, 0);

  if (totalDeps > 0) {
    warnings.push(
      `이 제품과 연관된 ${totalDeps}건의 데이터가 있습니다. 삭제 시 해당 데이터도 영향을 받습니다.`
    );
  }

  const impactLevel: "low" | "medium" | "high" =
    totalDeps > 100 ? "high" : totalDeps > 10 ? "medium" : "low";

  return {
    canDelete: !hasStock,
    impactLevel,
    dependencies,
    warnings,
    errors,
  };
}

/**
 * 공급자 삭제 전 의존성 체크
 *
 * - 연결된 제품/발주서 건수 조회
 */
export async function checkSupplierDependencies(
  supplierId: string,
  organizationId: string
): Promise<DependencyCheckResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const [supplierProductsResult, ordersResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(supplierProducts)
      .where(eq(supplierProducts.supplierId, supplierId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.supplierId, supplierId),
          eq(purchaseOrders.organizationId, organizationId),
          isNull(purchaseOrders.deletedAt)
        )
      ),
  ]);

  const dependencies: DependencyInfo[] = [
    {
      entityType: "supplier_products",
      label: "공급자-제품 매핑",
      count: supplierProductsResult[0]?.count || 0,
    },
    {
      entityType: "purchase_orders",
      label: "발주서",
      count: ordersResult[0]?.count || 0,
    },
  ].filter((d) => d.count > 0);

  const totalDeps = dependencies.reduce((sum, d) => sum + d.count, 0);

  if (totalDeps > 0) {
    warnings.push(
      `이 공급자와 연관된 ${totalDeps}건의 데이터가 있습니다.`
    );
  }

  // 진행 중인 발주가 있으면 삭제 불가
  const activeOrdersResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.supplierId, supplierId),
        eq(purchaseOrders.organizationId, organizationId),
        isNull(purchaseOrders.deletedAt),
        sql`${purchaseOrders.status} NOT IN ('completed', 'cancelled')`
      )
    );

  const hasActiveOrders = (activeOrdersResult[0]?.count || 0) > 0;
  if (hasActiveOrders) {
    errors.push(
      "진행 중인 발주가 있는 공급자는 삭제할 수 없습니다. 발주를 먼저 완료하거나 취소해주세요."
    );
  }

  const impactLevel: "low" | "medium" | "high" =
    totalDeps > 50 ? "high" : totalDeps > 5 ? "medium" : "low";

  return {
    canDelete: !hasActiveOrders,
    impactLevel,
    dependencies,
    warnings,
    errors,
  };
}

/**
 * 재고 삭제 전 의존성 체크
 *
 * - 해당 재고의 변동 이력 건수 조회
 */
export async function checkInventoryDependencies(
  inventoryId: string,
  organizationId: string
): Promise<DependencyCheckResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 해당 inventory 레코드 조회
  const [invRecord] = await db
    .select()
    .from(inventory)
    .where(
      and(
        eq(inventory.id, inventoryId),
        eq(inventory.organizationId, organizationId)
      )
    );

  if (!invRecord) {
    return {
      canDelete: false,
      impactLevel: "low",
      dependencies: [],
      warnings: [],
      errors: ["재고 항목을 찾을 수 없습니다"],
    };
  }

  const [historyResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryHistory)
      .where(
        and(
          eq(inventoryHistory.productId, invRecord.productId),
          eq(inventoryHistory.organizationId, organizationId)
        )
      ),
  ]);

  const dependencies: DependencyInfo[] = [
    { entityType: "inventory_history", label: "재고 변동 이력", count: historyResult[0]?.count || 0 },
  ].filter((d) => d.count > 0);

  const totalDeps = dependencies.reduce((sum, d) => sum + d.count, 0);

  if (invRecord.currentStock > 0) {
    warnings.push(
      `현재고 ${invRecord.currentStock.toLocaleString()}개가 0으로 처리됩니다.`
    );
  }

  if (totalDeps > 0) {
    warnings.push(
      `이 재고와 연관된 ${totalDeps}건의 변동 이력이 있습니다. 이력은 보존됩니다.`
    );
  }

  const impactLevel: "low" | "medium" | "high" =
    invRecord.currentStock > 100 ? "high" : invRecord.currentStock > 0 ? "medium" : "low";

  return {
    canDelete: true, // 재고는 항상 삭제 가능 (승인 프로세스로 통제)
    impactLevel,
    dependencies,
    warnings,
    errors,
  };
}

/**
 * 엔티티 타입별 의존성 체크 디스패처
 */
export async function checkEntityDependencies(
  entityType: string,
  entityId: string,
  organizationId: string
): Promise<DependencyCheckResult> {
  switch (entityType) {
    case "product":
      return checkProductDependencies(entityId, organizationId);
    case "supplier":
      return checkSupplierDependencies(entityId, organizationId);
    case "inventory":
      return checkInventoryDependencies(entityId, organizationId);
    case "inventory_adjustment":
    case "product_create":
    case "product_update":
    case "supplier_create":
    case "supplier_update":
      // 생성/수정/조정 요청은 의존성 체크 불필요 — 항상 허용 (승인으로 통제)
      return {
        canDelete: true,
        impactLevel: "low",
        dependencies: [],
        warnings: [],
        errors: [],
      };
    default:
      return {
        canDelete: true,
        impactLevel: "low",
        dependencies: [],
        warnings: [],
        errors: [],
      };
  }
}
