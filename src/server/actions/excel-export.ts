"use server";

import { z } from "zod";
import { db } from "@/server/db";
import {
  purchaseOrders,
  purchaseOrderItems,
  products,
  suppliers,
  inventoryHistory,
  organizations,
} from "@/server/db/schema";
import { eq, and, sql, inArray, isNull, ne, desc } from "drizzle-orm";
import {
  generatePurchaseOrderExcel,
  generateMultiplePurchaseOrdersExcel,
  type PurchaseOrderWithDetails,
} from "@/server/services/excel/order-export";
import { generateInboundExcel, generateInventoryExcel } from "@/server/services/excel/data-export";
import { generateInventoryMovementExcel } from "@/server/services/excel/inventory-movement-export";
import { getInboundRecords } from "./inbound";
import { getInventoryList } from "./inventory";
import { requireAuth } from "./auth-helpers";
import { classifyInventoryStatus } from "@/server/services/scm/inventory-status";
import { logActivity } from "@/server/services/activity-log";

/**
 * 단일 발주서 Excel 다운로드 스키마
 */
const exportSingleOrderSchema = z.object({
  orderId: z.string().uuid("유효한 발주서 ID가 아닙니다"),
});

/**
 * 단일 발주서 Excel 다운로드
 */
export async function exportPurchaseOrderToExcel(orderId: string): Promise<{
  success: boolean;
  data?: {
    buffer: string;
    filename: string;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    exportSingleOrderSchema.parse({ orderId });

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
      .where(
        and(eq(purchaseOrders.id, orderId), eq(purchaseOrders.organizationId, user.organizationId))
      )
      .limit(1);

    if (!orderData) {
      return { success: false, error: "발주서를 찾을 수 없습니다" };
    }

    const items = await db
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
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

    const order: PurchaseOrderWithDetails = {
      ...orderData.order,
      supplier: orderData.supplier?.id ? orderData.supplier : null,
      items: items.map((row) => ({
        ...row.item,
        product: row.product,
      })),
    };

    const buffer = await generatePurchaseOrderExcel(order);
    const filename = `${order.orderNumber}_${order.orderDate || "미정"}.xlsx`;
    const base64Buffer = buffer.toString("base64");

    // 활동 로그 기록
    await logActivity({
      user,
      action: "EXPORT",
      entityType: "excel_export",
      entityId: orderId,
      description: `발주서 Excel 다운로드`,
    });

    return {
      success: true,
      data: { buffer: base64Buffer, filename },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`,
      };
    }
    console.error("발주서 Excel 다운로드 오류:", error);
    return { success: false, error: "발주서 Excel 다운로드에 실패했습니다" };
  }
}

/**
 * 복수 발주서 Excel 다운로드 스키마
 */
const exportMultipleOrdersSchema = z.object({
  orderIds: z
    .array(z.string().uuid("유효한 발주서 ID가 아닙니다"))
    .min(1, "최소 1개 이상의 발주서가 필요합니다")
    .max(50, "최대 50개까지만 다운로드 가능합니다"),
});

/**
 * 복수 발주서 Excel 다운로드
 */
export async function exportPurchaseOrdersToExcel(
  orderIds: string[],
  organizationId: string
): Promise<{
  success: boolean;
  data?: {
    buffer: string;
    filename: string;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    exportMultipleOrdersSchema.parse({ orderIds });

    const ordersData = await db
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
      .where(and(sql`${purchaseOrders.id} IN ${orderIds}`, eq(purchaseOrders.organizationId, organizationId)));

    if (ordersData.length === 0) {
      return { success: false, error: "발주서를 찾을 수 없습니다" };
    }

    // 배치 아이템 조회: N개 개별 쿼리 → 1개 쿼리로 통합
    const poIds = ordersData.map(o => o.order.id);
    const allItems = await db
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
      .where(inArray(purchaseOrderItems.purchaseOrderId, poIds));

    const itemsByOrderId = new Map<string, typeof allItems>();
    for (const row of allItems) {
      const poId = row.item.purchaseOrderId;
      if (!itemsByOrderId.has(poId)) itemsByOrderId.set(poId, []);
      itemsByOrderId.get(poId)!.push(row);
    }

    const orders: PurchaseOrderWithDetails[] = ordersData.map((orderData) => ({
      ...orderData.order,
      supplier: orderData.supplier?.id ? orderData.supplier : null,
      items: (itemsByOrderId.get(orderData.order.id) || []).map((row) => ({
        ...row.item,
        product: row.product,
      })),
    }));

    const buffer = await generateMultiplePurchaseOrdersExcel(orders);
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `발주서_${today}.xlsx`;
    const base64Buffer = buffer.toString("base64");

    // 활동 로그 기록
    await logActivity({
      user,
      action: "EXPORT",
      entityType: "excel_export",
      description: `발주서 ${orderIds.length}건 Excel 다운로드`,
    });

    return {
      success: true,
      data: { buffer: base64Buffer, filename },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `입력 데이터가 올바르지 않습니다: ${error.issues[0]?.message}`,
      };
    }
    console.error("복수 발주서 Excel 다운로드 오류:", error);
    return { success: false, error: "발주서 Excel 다운로드에 실패했습니다" };
  }
}

/**
 * 입고 현황 Excel 다운로드
 */
export async function exportInboundRecordsToExcel(options: {
  startDate: string;
  endDate: string;
}): Promise<{
  success: boolean;
  data?: {
    buffer: string;
    filename: string;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const result = await getInboundRecords({
      startDate: options.startDate,
      endDate: options.endDate,
      limit: 1000,
    });

    if (result.records.length === 0) {
      return { success: false, error: "해당 기간의 입고 기록이 없습니다" };
    }

    const buffer = await generateInboundExcel(result.records);
    const filename = `입고현황_${options.startDate}_${options.endDate}.xlsx`;
    const base64Buffer = Buffer.from(buffer).toString("base64");

    // 활동 로그 기록
    await logActivity({
      user,
      action: "EXPORT",
      entityType: "excel_export",
      description: `입고현황 Excel 다운로드`,
    });

    return {
      success: true,
      data: { buffer: base64Buffer, filename },
    };
  } catch (error) {
    console.error("입고 현황 Excel 다운로드 오류:", error);
    return {
      success: false,
      error: "입고 현황 Excel 다운로드에 실패했습니다",
    };
  }
}

/**
 * 재고 수불부 Excel 다운로드
 *
 * 제품별 일일 기초재고 + 입고수량 + 출고수량 = 기말재고
 */
export async function exportInventoryMovementToExcel(options: {
  startDate: string;
  endDate: string;
}): Promise<{
  success: boolean;
  data?: {
    buffer: string;
    filename: string;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // 회사명 조회
    let organizationName = "";
    try {
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);
      organizationName = org?.name || "";
    } catch {
      /* 조직 조회 실패 무시 */
    }

    // 기간 내 모든 재고 변동 이력 조회 (제품 단위/원가 포함)
    const records = await db
      .select({
        record: inventoryHistory,
        product: {
          sku: products.sku,
          name: products.name,
          unit: products.unit,
          costPrice: products.costPrice,
        },
      })
      .from(inventoryHistory)
      .innerJoin(products, eq(inventoryHistory.productId, products.id))
      .where(
        and(
          eq(inventoryHistory.organizationId, user.organizationId),
          sql`${inventoryHistory.date} >= ${options.startDate}`,
          sql`${inventoryHistory.date} <= ${options.endDate}`
        )
      )
      .orderBy(sql`${inventoryHistory.date} ASC, ${inventoryHistory.createdAt} ASC`);

    if (records.length === 0) {
      return { success: false, error: "해당 기간의 재고 변동 이력이 없습니다" };
    }

    const movementRecords = records.map((row) => ({
      productId: row.record.productId,
      productSku: row.product.sku,
      productName: row.product.name,
      productUnit: row.product.unit || "EA",
      date: row.record.date,
      changeAmount: row.record.changeAmount,
      stockBefore: row.record.stockBefore,
      stockAfter: row.record.stockAfter,
      changeType: row.record.changeType,
      costPrice: row.product.costPrice ?? 0,
      notes: row.record.notes || undefined,
      referenceId: row.record.referenceId,
      referenceType: row.record.referenceType,
    }));

    const buffer = await generateInventoryMovementExcel({
      records: movementRecords,
      startDate: options.startDate,
      endDate: options.endDate,
      organizationName,
    });

    const filename = `재고수불부_${options.startDate}_${options.endDate}.xlsx`;
    const base64Buffer = Buffer.from(buffer).toString("base64");

    // 활동 로그 기록
    await logActivity({
      user,
      action: "EXPORT",
      entityType: "excel_export",
      description: `재고수불부 Excel 다운로드`,
    });

    return {
      success: true,
      data: { buffer: base64Buffer, filename },
    };
  } catch (error) {
    console.error("재고 수불부 Excel 다운로드 오류:", error);
    return {
      success: false,
      error: "재고 수불부 Excel 다운로드에 실패했습니다",
    };
  }
}

/**
 * 재고 현황 Excel 다운로드
 */
export async function exportInventoryToExcel(): Promise<{
  success: boolean;
  data?: {
    buffer: string;
    filename: string;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const result = await getInventoryList({ limit: 5000 });

    if (result.items.length === 0) {
      return { success: false, error: "재고 데이터가 없습니다" };
    }

    const exportItems = result.items.map((item) => {
      const statusResult = classifyInventoryStatus({
        currentStock: item.currentStock,
        safetyStock: item.product.safetyStock ?? 0,
        reorderPoint: item.product.reorderPoint ?? 0,
      });

      return {
        sku: item.product.sku,
        name: item.product.name,
        currentStock: item.currentStock,
        availableStock: item.availableStock ?? item.currentStock,
        safetyStock: item.product.safetyStock ?? 0,
        reorderPoint: item.product.reorderPoint ?? 0,
        status: statusResult.key,
        daysOfInventory: item.daysOfInventory ?? 0,
        location: item.location,
      };
    });

    const buffer = await generateInventoryExcel(exportItems);
    const today = new Date().toISOString().split("T")[0];
    const filename = `재고현황_${today}.xlsx`;
    const base64Buffer = Buffer.from(buffer).toString("base64");

    // 활동 로그 기록
    await logActivity({
      user,
      action: "EXPORT",
      entityType: "excel_export",
      description: `재고현황 Excel 다운로드`,
    });

    return {
      success: true,
      data: { buffer: base64Buffer, filename },
    };
  } catch (error) {
    console.error("재고 현황 Excel 다운로드 오류:", error);
    return {
      success: false,
      error: "재고 현황 Excel 다운로드에 실패했습니다",
    };
  }
}

/**
 * 발주 현황 전체 리스트 Excel 다운로드
 */
export async function exportPurchaseOrdersListToExcel(options?: {
  excludeStatus?: string;
}): Promise<{
  success: boolean;
  data?: { buffer: string; filename: string };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const conditions = [
      eq(purchaseOrders.organizationId, user.organizationId),
      isNull(purchaseOrders.deletedAt),
    ];

    if (options?.excludeStatus) {
      conditions.push(
        ne(
          purchaseOrders.status,
          options.excludeStatus as (typeof purchaseOrders.status.enumValues)[number]
        )
      );
    }

    const ordersData = await db
      .select({
        orderNumber: purchaseOrders.orderNumber,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        orderDate: purchaseOrders.orderDate,
        expectedDate: purchaseOrders.expectedDate,
        notes: purchaseOrders.notes,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt));

    if (ordersData.length === 0) {
      return { success: false, error: "발주 데이터가 없습니다" };
    }

    const statusLabel: Record<string, string> = {
      draft: "초안", pending: "대기", approved: "승인",
      ordered: "발주완료", confirmed: "확정", shipped: "배송중",
      partially_received: "부분입고", received: "입고완료",
      completed: "완료", cancelled: "취소",
    };

    const XLSX = await import("xlsx");

    const rows = ordersData.map((o) => ({
      발주번호: o.orderNumber,
      공급자: o.supplierName || "미지정",
      상태: statusLabel[o.status] || o.status,
      총금액: o.totalAmount ? Number(o.totalAmount) : 0,
      발주일: o.orderDate || "",
      예상입고일: o.expectedDate || "",
      비고: o.notes || "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 18 }, { wch: 16 }, { wch: 10 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 24 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, "발주현황");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const today = new Date().toISOString().split("T")[0];
    const filename = `발주현황_${today}.xlsx`;
    const base64Buffer = Buffer.from(buffer).toString("base64");

    await logActivity({
      user,
      action: "EXPORT",
      entityType: "excel_export",
      description: `발주현황 전체 Excel 다운로드 (${rows.length}건)`,
    });

    return { success: true, data: { buffer: base64Buffer, filename } };
  } catch (error) {
    console.error("발주 현황 Excel 다운로드 오류:", error);
    return { success: false, error: "발주 현황 Excel 다운로드에 실패했습니다" };
  }
}
