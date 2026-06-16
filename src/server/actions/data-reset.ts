'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { requireAuth } from './auth-helpers'
import { db } from '@/server/db'
import {
  inventory,
  inventoryHistory,
  inventoryLots,
  inboundRecords,
  salesRecords,
  outboundRequests,
} from '@/server/db/schema'
import { eq } from 'drizzle-orm'

function revalidateAll(orgId: string) {
  revalidateTag(`analytics-${orgId}`)
  revalidatePath('/dashboard/inventory')
  revalidatePath('/dashboard/analytics')
  revalidatePath('/dashboard/inbound')
  revalidatePath('/dashboard/outbound')
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
    return { success: false, error: '재고 데이터 삭제 중 오류가 발생했습니다.' }
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
    return { success: false, error: '입고 데이터 삭제 중 오류가 발생했습니다.' }
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
    return { success: false, error: '출고/판매 데이터 삭제 중 오류가 발생했습니다.' }
  }
}

/** 전체 초기화 (재고 + 입고 + 출고/판매) */
export async function resetAllData(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    await db.transaction(async (tx) => {
      await tx.delete(inventoryLots).where(eq(inventoryLots.organizationId, orgId))
      await tx.delete(inventoryHistory).where(eq(inventoryHistory.organizationId, orgId))
      await tx.delete(inventory).where(eq(inventory.organizationId, orgId))
      await tx.delete(inboundRecords).where(eq(inboundRecords.organizationId, orgId))
      await tx.delete(outboundRequests).where(eq(outboundRequests.organizationId, orgId))
      await tx.delete(salesRecords).where(eq(salesRecords.organizationId, orgId))
    })

    revalidateAll(orgId)
    return { success: true }
  } catch (error) {
    console.error('전체 초기화 오류:', error)
    return { success: false, error: '전체 데이터 삭제 중 오류가 발생했습니다.' }
  }
}
