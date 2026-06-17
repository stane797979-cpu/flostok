'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAuth } from './auth-helpers'
import { db } from '@/server/db'
import {
  products,
  supplierProducts,
  inventory,
  inventoryHistory,
  inventoryLots,
  inboundRecords,
  salesRecords,
  outboundRequests,
  suppliers,
  purchaseOrders,
  purchaseOrderItems,
  demandForecasts,
  gradeHistory,
  stockoutRecords,
  alerts,
  kpiMonthlySnapshots,
  importShipments,
  psiPlans,
  activityLogs,
} from '@/server/db/schema'
import { eq, inArray, sql, and } from 'drizzle-orm'

function revalidateAll(orgId: string) {
  revalidateTag(`analytics-${orgId}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/inventory')
  revalidatePath('/dashboard/analytics')
  revalidatePath('/dashboard/inbound')
  revalidatePath('/dashboard/outbound')
  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard/suppliers')
}

/** 재고 전체 초기화 (inventory + inventoryHistory + inventoryLots) */
export async function resetInventoryData(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    await db.transaction(async (tx) => {
      await tx.delete(inventoryLots).where(eq(inventoryLots.organizationId, orgId))
      await tx.delete(inventoryHistory).where(eq(inventoryHistory.organizationId, orgId))
      await tx.delete(inventory).where(eq(inventory.organizationId, orgId))
    })

    revalidateAll(orgId)
    return { success: true }
  } catch (error) {
    console.error('재고 초기화 오류:', error)
    return { success: false, error: `재고 데이터 삭제 중 오류: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** 입고 전체 초기화 (inbound_records) */
export async function resetInboundData(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    await db.delete(inboundRecords).where(eq(inboundRecords.organizationId, orgId))

    revalidateAll(orgId)
    return { success: true }
  } catch (error) {
    console.error('입고 초기화 오류:', error)
    return { success: false, error: `입고 데이터 삭제 중 오류: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** 출고/판매 전체 초기화 (sales_records + outbound_requests) */
export async function resetSalesData(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    await db.transaction(async (tx) => {
      await tx.delete(outboundRequests).where(eq(outboundRequests.organizationId, orgId))
      await tx.delete(salesRecords).where(eq(salesRecords.organizationId, orgId))
    })

    revalidateAll(orgId)
    return { success: true }
  } catch (error) {
    console.error('출고/판매 초기화 오류:', error)
    return { success: false, error: `출고/판매 데이터 삭제 중 오류: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** 공급업체 전체 초기화 (supplier_products → suppliers) */
export async function resetSuppliersData(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    await db.transaction(async (tx) => {
      // supplier_products에는 organizationId가 없으므로 supplierId 경유
      const supplierIds = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.organizationId, orgId))
      if (supplierIds.length > 0) {
        await tx.delete(supplierProducts).where(
          inArray(supplierProducts.supplierId, supplierIds.map((s) => s.id))
        )
      }
      await tx.delete(suppliers).where(eq(suppliers.organizationId, orgId))
    })

    revalidateAll(orgId)
    return { success: true }
  } catch (error) {
    console.error('공급업체 초기화 오류:', error)
    return { success: false, error: `공급업체 데이터 삭제 중 오류: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** 발주 전체 초기화 (purchase_order_items → purchase_orders) */
export async function resetOrdersData(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    await db.transaction(async (tx) => {
      // purchase_order_items에는 organizationId가 없어 purchaseOrderId 경유
      const poIds = await tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, orgId))
      if (poIds.length > 0) {
        await tx.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, poIds.map((p) => p.id)))
      }
      await tx.delete(purchaseOrders).where(eq(purchaseOrders.organizationId, orgId))
    })

    revalidateAll(orgId)
    return { success: true }
  } catch (error) {
    console.error('발주 초기화 오류:', error)
    return { success: false, error: `발주 데이터 삭제 중 오류: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** 전체 초기화 — 모든 운영 데이터 삭제 (제품·조직·사용자 제외) */
export async function resetAllData(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    await db.transaction(async (tx) => {
      // leaf 테이블 먼저 (organizationId 없는 테이블은 부모 ID 경유)
      const poIds = await tx.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, orgId))
      if (poIds.length > 0) {
        await tx.delete(purchaseOrderItems).where(inArray(purchaseOrderItems.purchaseOrderId, poIds.map((p) => p.id)))
      }
      await tx.delete(inventoryLots).where(eq(inventoryLots.organizationId, orgId))
      await tx.delete(inventoryHistory).where(eq(inventoryHistory.organizationId, orgId))
      await tx.delete(outboundRequests).where(eq(outboundRequests.organizationId, orgId))
      // supplier_products (organizationId 없음 — supplierId 경유)
      const supplierIds = await tx.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.organizationId, orgId))
      if (supplierIds.length > 0) {
        await tx.delete(supplierProducts).where(inArray(supplierProducts.supplierId, supplierIds.map((s) => s.id)))
      }
      // 부모 테이블
      await tx.delete(purchaseOrders).where(eq(purchaseOrders.organizationId, orgId))
      await tx.delete(inventory).where(eq(inventory.organizationId, orgId))
      await tx.delete(inboundRecords).where(eq(inboundRecords.organizationId, orgId))
      await tx.delete(salesRecords).where(eq(salesRecords.organizationId, orgId))
      await tx.delete(suppliers).where(eq(suppliers.organizationId, orgId))
      // 분석·이력 데이터
      await tx.delete(demandForecasts).where(eq(demandForecasts.organizationId, orgId))
      await tx.delete(gradeHistory).where(eq(gradeHistory.organizationId, orgId))
      await tx.delete(stockoutRecords).where(eq(stockoutRecords.organizationId, orgId))
      await tx.delete(alerts).where(eq(alerts.organizationId, orgId))
      await tx.delete(kpiMonthlySnapshots).where(eq(kpiMonthlySnapshots.organizationId, orgId))
      await tx.delete(importShipments).where(eq(importShipments.organizationId, orgId))
      await tx.delete(psiPlans).where(eq(psiPlans.organizationId, orgId))
      await tx.delete(activityLogs).where(eq(activityLogs.organizationId, orgId))
      // 마스터 데이터 (제품 — supplier_products는 위에서 이미 삭제)
      await tx.delete(products).where(eq(products.organizationId, orgId))
    })

    revalidateAll(orgId)
    return { success: true }
  } catch (error) {
    console.error('전체 초기화 오류:', error)
    return { success: false, error: `전체 데이터 삭제 중 오류: ${error instanceof Error ? error.message : String(error)}` }
  }
}
