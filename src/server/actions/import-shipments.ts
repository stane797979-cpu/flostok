"use server";

import { db } from "@/server/db";
import {
  importShipments,
  products,
  purchaseOrders,
  purchaseOrderItems,
  inboundRecords,
  inventoryLots,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser, requireAuth } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { processInventoryTransaction } from "./inventory";
import { logActivity } from "@/server/services/activity-log";

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
 * 발주서 예상입고일 동기화
 * 입항스케줄의 창고입고예정일(또는 입항예정일)로 발주서 expectedDate를 업데이트
 */
async function syncExpectedDate(purchaseOrderId: string, warehouseEtaDate?: string | null, etaDate?: string | null) {
  const newExpectedDate = warehouseEtaDate || etaDate;
  if (!newExpectedDate || !purchaseOrderId) return;

  await db
    .update(purchaseOrders)
    .set({ expectedDate: newExpectedDate, updatedAt: new Date() })
    .where(eq(purchaseOrders.id, purchaseOrderId));
}

/**
 * 입항스케줄 등록 + 발주서 예상입고일 자동 동기화
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

    // 발주서 예상입고일 자동 동기화
    if (data.purchaseOrderId) {
      await syncExpectedDate(data.purchaseOrderId, data.warehouseEtaDate, data.etaDate);
    }

    revalidatePath("/dashboard/orders");
    return { success: true, message: "입항스케줄이 등록되었습니다" };
  } catch (error) {
    console.error("입항스케줄 등록 실패:", error);
    return { success: false, message: "등록 중 오류가 발생했습니다" };
  }
}

/**
 * 입항스케줄 수정 + 발주서 예상입고일 동기화
 */
export async function updateImportShipment(
  id: string,
  data: {
    blNumber?: string;
    containerNumber?: string;
    invoiceNumber?: string;
    quantity?: number;
    unitPriceUsd?: number;
    etaDate?: string;
    ataDate?: string;
    warehouseEtaDate?: string;
    notes?: string;
  }
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

    // 기존 레코드 조회
    const [existing] = await db
      .select({ purchaseOrderId: importShipments.purchaseOrderId })
      .from(importShipments)
      .where(and(eq(importShipments.id, id), eq(importShipments.organizationId, orgId)))
      .limit(1);

    if (!existing) {
      return { success: false, message: "입항스케줄을 찾을 수 없습니다" };
    }

    await db
      .update(importShipments)
      .set({
        blNumber: data.blNumber !== undefined ? (data.blNumber || null) : undefined,
        containerNumber: data.containerNumber !== undefined ? (data.containerNumber || null) : undefined,
        invoiceNumber: data.invoiceNumber !== undefined ? (data.invoiceNumber || null) : undefined,
        quantity: data.quantity,
        unitPriceUsd: data.unitPriceUsd?.toString() ?? undefined,
        etaDate: data.etaDate !== undefined ? (data.etaDate || null) : undefined,
        ataDate: data.ataDate !== undefined ? (data.ataDate || null) : undefined,
        warehouseEtaDate: data.warehouseEtaDate !== undefined ? (data.warehouseEtaDate || null) : undefined,
        notes: data.notes !== undefined ? (data.notes || null) : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(importShipments.id, id), eq(importShipments.organizationId, orgId)));

    // 발주서 예상입고일 동기화
    if (existing.purchaseOrderId) {
      await syncExpectedDate(existing.purchaseOrderId, data.warehouseEtaDate, data.etaDate);
    }

    revalidatePath("/dashboard/orders");
    return { success: true, message: "입항스케줄이 수정되었습니다" };
  } catch (error) {
    console.error("입항스케줄 수정 실패:", error);
    return { success: false, message: "수정 중 오류가 발생했습니다" };
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

/**
 * 입항스케줄 기반 입고 처리
 * 창고실입고일 + 입고수량 입력 → inbound_records 생성 + 재고 증가 + 발주 상태 업데이트
 */
export async function confirmShipmentInbound(data: {
  shipmentId: string;
  actualDate?: string; // 실제 입고일 (기본: 오늘)
  receivedQuantity: number;
  location?: string;
  lotNumber?: string;
  expiryDate?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const user = await requireAuth();

    if (data.receivedQuantity <= 0) {
      return { success: false, message: "입고 수량은 1 이상이어야 합니다" };
    }

    // 입항스케줄 조회
    const [shipment] = await db
      .select()
      .from(importShipments)
      .where(
        and(
          eq(importShipments.id, data.shipmentId),
          eq(importShipments.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!shipment) {
      return { success: false, message: "입항스케줄을 찾을 수 없습니다" };
    }

    if (shipment.warehouseActualDate) {
      return { success: false, message: "이미 입고 처리된 스케줄입니다" };
    }

    const today = data.actualDate || new Date().toISOString().split("T")[0];
    const lotNum = data.lotNumber || `AUTO-${today.replace(/-/g, "")}-${Date.now().toString(36)}`;

    // 트랜잭션으로 입고 처리
    await db.transaction(async (tx) => {
      // 1. 입항스케줄 업데이트 (창고실입고일 + 입항실제일)
      await tx
        .update(importShipments)
        .set({
          warehouseActualDate: today,
          ataDate: shipment.ataDate || today, // 입항실제일이 없으면 입고일로 설정
          updatedAt: new Date(),
        })
        .where(eq(importShipments.id, data.shipmentId));

      // 2. inbound_records 생성
      const [inboundRecord] = await tx
        .insert(inboundRecords)
        .values({
          organizationId: user.organizationId,
          purchaseOrderId: shipment.purchaseOrderId,
          productId: shipment.productId,
          date: today,
          expectedQuantity: shipment.quantity,
          receivedQuantity: data.receivedQuantity,
          acceptedQuantity: data.receivedQuantity,
          rejectedQuantity: 0,
          qualityResult: "pass",
          location: data.location,
          lotNumber: lotNum,
          expiryDate: data.expiryDate,
          notes: data.notes || `입항스케줄 입고 (B/L: ${shipment.blNumber || "-"})`,
        })
        .returning();

      // 3. LOT 재고 생성
      await tx.insert(inventoryLots).values({
        organizationId: user.organizationId,
        productId: shipment.productId,
        lotNumber: lotNum,
        expiryDate: data.expiryDate,
        initialQuantity: data.receivedQuantity,
        remainingQuantity: data.receivedQuantity,
        inboundRecordId: inboundRecord.id,
        receivedDate: today,
        status: "active",
      });

      // 4. 재고 증가 처리
      const inventoryResult = await processInventoryTransaction({
        productId: shipment.productId,
        changeType: "INBOUND_PURCHASE",
        quantity: data.receivedQuantity,
        referenceId: shipment.purchaseOrderId || shipment.id,
        notes: `입항스케줄 입고 (B/L: ${shipment.blNumber || "-"})`,
        location: data.location,
      });

      if (!inventoryResult.success) {
        throw new Error(`재고 증가 처리 실패: ${inventoryResult.error}`);
      }

      // 5. 발주서 상태 업데이트 (연결된 발주가 있으면)
      if (shipment.purchaseOrderId) {
        // 발주 항목 조회 → receivedQuantity 업데이트
        const orderItems = await tx
          .select()
          .from(purchaseOrderItems)
          .where(
            and(
              eq(purchaseOrderItems.purchaseOrderId, shipment.purchaseOrderId),
              eq(purchaseOrderItems.productId, shipment.productId)
            )
          );

        // 첫 번째 매칭 항목의 입고수량 증가
        if (orderItems.length > 0) {
          const orderItem = orderItems[0];
          const newReceivedQty = (orderItem.receivedQuantity || 0) + data.receivedQuantity;
          await tx
            .update(purchaseOrderItems)
            .set({ receivedQuantity: newReceivedQty })
            .where(eq(purchaseOrderItems.id, orderItem.id));
        }

        // 전체 발주 항목 입고 상태 확인
        const allItems = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderId, shipment.purchaseOrderId));

        const allFullyReceived = allItems.every(
          (item) => (item.receivedQuantity ?? 0) >= item.quantity
        );
        const hasPartial = allItems.some(
          (item) => item.receivedQuantity && item.receivedQuantity > 0
        );

        const newStatus = allFullyReceived
          ? "received" as const
          : hasPartial
          ? "partially_received" as const
          : undefined;

        if (newStatus) {
          await tx
            .update(purchaseOrders)
            .set({
              status: newStatus,
              actualDate: allFullyReceived ? today : undefined,
              updatedAt: new Date(),
            })
            .where(eq(purchaseOrders.id, shipment.purchaseOrderId));
        }
      }
    });

    await logActivity({
      user,
      action: "CREATE",
      entityType: "inbound_record",
      description: `입항스케줄 입고 처리 (B/L: ${shipment.blNumber || "-"}, 수량: ${data.receivedQuantity})`,
    });

    revalidatePath("/dashboard/orders");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/psi");

    return {
      success: true,
      message: `${data.receivedQuantity}개 입고 처리 완료`,
    };
  } catch (error) {
    console.error("입항스케줄 입고 처리 실패:", error);
    return { success: false, message: "입고 처리 중 오류가 발생했습니다" };
  }
}
