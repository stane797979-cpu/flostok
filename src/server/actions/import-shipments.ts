"use server";

import { db } from "@/server/db";
import { importShipments, products, purchaseOrders } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import { revalidatePath } from "next/cache";

export interface ImportShipmentItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  purchaseOrderId: string | null;
  orderNumber: string | null;
  blNumber: string | null;
  containerNumber: string | null;
  invoiceNumber: string | null;
  customsDeclarationNumber: string | null;
  containerQty: number | null;
  cartonQty: number | null;
  quantity: number;
  unitPriceUsd: string | null;
  invoiceAmountUsd: string | null;
  etaDate: string | null;
  ataDate: string | null;
  warehouseEtaDate: string | null;
  warehouseActualDate: string | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * 입항스케줄 목록 조회
 */
export async function getImportShipments(options?: {
  limit?: number;
}): Promise<{ items: ImportShipmentItem[] }> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";
  const limit = options?.limit ?? 100;

  const rows = await db
    .select({
      id: importShipments.id,
      productId: importShipments.productId,
      productName: products.name,
      productSku: products.sku,
      purchaseOrderId: importShipments.purchaseOrderId,
      orderNumber: purchaseOrders.orderNumber,
      blNumber: importShipments.blNumber,
      containerNumber: importShipments.containerNumber,
      invoiceNumber: importShipments.invoiceNumber,
      customsDeclarationNumber: importShipments.customsDeclarationNumber,
      containerQty: importShipments.containerQty,
      cartonQty: importShipments.cartonQty,
      quantity: importShipments.quantity,
      unitPriceUsd: importShipments.unitPriceUsd,
      invoiceAmountUsd: importShipments.invoiceAmountUsd,
      etaDate: importShipments.etaDate,
      ataDate: importShipments.ataDate,
      warehouseEtaDate: importShipments.warehouseEtaDate,
      warehouseActualDate: importShipments.warehouseActualDate,
      notes: importShipments.notes,
      createdAt: importShipments.createdAt,
    })
    .from(importShipments)
    .leftJoin(products, eq(importShipments.productId, products.id))
    .leftJoin(purchaseOrders, eq(importShipments.purchaseOrderId, purchaseOrders.id))
    .where(eq(importShipments.organizationId, orgId))
    .orderBy(desc(importShipments.etaDate))
    .limit(limit);

  return {
    items: rows.map((r) => ({
      ...r,
      productName: r.productName ?? "알 수 없음",
      productSku: r.productSku ?? "-",
      createdAt: new Date(r.createdAt),
    })),
  };
}

/**
 * 입항스케줄 등록
 */
export async function createImportShipment(data: {
  productId: string;
  purchaseOrderId?: string;
  blNumber?: string;
  containerNumber?: string;
  invoiceNumber?: string;
  customsDeclarationNumber?: string;
  containerQty?: number;
  cartonQty?: number;
  quantity: number;
  unitPriceUsd?: number;
  invoiceAmountUsd?: number;
  etaDate?: string;
  ataDate?: string;
  warehouseEtaDate?: string;
  warehouseActualDate?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    await db.insert(importShipments).values({
      organizationId: orgId,
      productId: data.productId,
      purchaseOrderId: data.purchaseOrderId || null,
      blNumber: data.blNumber || null,
      containerNumber: data.containerNumber || null,
      invoiceNumber: data.invoiceNumber || null,
      customsDeclarationNumber: data.customsDeclarationNumber || null,
      containerQty: data.containerQty ?? null,
      cartonQty: data.cartonQty ?? null,
      quantity: data.quantity,
      unitPriceUsd: data.unitPriceUsd?.toString() ?? null,
      invoiceAmountUsd: data.invoiceAmountUsd?.toString() ?? null,
      etaDate: data.etaDate || null,
      ataDate: data.ataDate || null,
      warehouseEtaDate: data.warehouseEtaDate || null,
      warehouseActualDate: data.warehouseActualDate || null,
      notes: data.notes || null,
    });

    revalidatePath("/dashboard/orders");
    return { success: true, message: "입항스케줄이 등록되었습니다" };
  } catch (error) {
    console.error("입항스케줄 등록 실패:", error);
    return { success: false, message: "등록 중 오류가 발생했습니다" };
  }
}

/**
 * 입항스케줄 삭제
 */
export async function deleteImportShipment(
  id: string
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    await db
      .delete(importShipments)
      .where(
        and(
          eq(importShipments.id, id),
          eq(importShipments.organizationId, orgId)
        )
      );

    revalidatePath("/dashboard/orders");
    return { success: true, message: "삭제되었습니다" };
  } catch (error) {
    console.error("입항스케줄 삭제 실패:", error);
    return { success: false, message: "삭제 중 오류가 발생했습니다" };
  }
}
