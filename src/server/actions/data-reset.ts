'use server'

/**
 * 조직 데이터 전체 리셋 Server Action
 *
 * 입고, 출고, 재고, 공급업체, 제품 등 조직의 모든 비즈니스 데이터를 삭제합니다.
 * admin 이상 권한 필수. 트랜잭션으로 원자성 보장.
 */

import { db } from '@/server/db'
import {
  gradeHistory,
  kpiMonthlySnapshots,
  deletionRequests,
  stockoutRecords,
  psiPlans,
  inventoryLots,
  importShipments,
  inboundRecords,
  inventoryHistory,
  salesRecords,
  demandForecasts,
  alerts,
  supplierProducts,
  inventory,
  purchaseOrders,
  outboundRequests,
  onboardingSessions,
  columnMappingProfiles,
  products,
  suppliers,
  warehouses,
} from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from './auth-helpers'
import { logActivity } from '@/server/services/activity-log'

export interface ResetResult {
  success: boolean
  error?: string
  deletedCounts?: Record<string, number>
}

export async function resetOrganizationData(): Promise<ResetResult> {
  try {
    const user = await requireAdmin()
    const orgId = user.organizationId

    const deletedCounts: Record<string, number> = {}

    await db.transaction(async (tx) => {
      // === 1단계: leaf 노드 (다른 테이블에서 참조되지 않는 테이블) ===
      deletedCounts['등급 이력'] = Number(
        (await tx.delete(gradeHistory).where(eq(gradeHistory.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['KPI 스냅샷'] = Number(
        (await tx.delete(kpiMonthlySnapshots).where(eq(kpiMonthlySnapshots.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['삭제 요청'] = Number(
        (await tx.delete(deletionRequests).where(eq(deletionRequests.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['품절 기록'] = Number(
        (await tx.delete(stockoutRecords).where(eq(stockoutRecords.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['PSI 계획'] = Number(
        (await tx.delete(psiPlans).where(eq(psiPlans.organizationId, orgId))).rowCount ?? 0
      )

      // === 2단계: 트랜잭션 데이터 ===
      deletedCounts['재고 LOT'] = Number(
        (await tx.delete(inventoryLots).where(eq(inventoryLots.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['입항 기록'] = Number(
        (await tx.delete(importShipments).where(eq(importShipments.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['입고 기록'] = Number(
        (await tx.delete(inboundRecords).where(eq(inboundRecords.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['재고 이력'] = Number(
        (await tx.delete(inventoryHistory).where(eq(inventoryHistory.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['판매 기록'] = Number(
        (await tx.delete(salesRecords).where(eq(salesRecords.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['수요 예측'] = Number(
        (await tx.delete(demandForecasts).where(eq(demandForecasts.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['알림'] = Number(
        (await tx.delete(alerts).where(eq(alerts.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['공급자-제품 매핑'] = Number(
        (await tx.delete(supplierProducts).where(eq(supplierProducts.organizationId, orgId))).rowCount ?? 0
      )

      // === 3단계: 집계/운영 데이터 (cascade로 하위 항목 자동 삭제) ===
      deletedCounts['현재 재고'] = Number(
        (await tx.delete(inventory).where(eq(inventory.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['발주서'] = Number(
        (await tx.delete(purchaseOrders).where(eq(purchaseOrders.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['출고 요청'] = Number(
        (await tx.delete(outboundRequests).where(eq(outboundRequests.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['온보딩 세션'] = Number(
        (await tx.delete(onboardingSessions).where(eq(onboardingSessions.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['컬럼 매핑'] = Number(
        (await tx.delete(columnMappingProfiles).where(eq(columnMappingProfiles.organizationId, orgId))).rowCount ?? 0
      )

      // === 4단계: 마스터 데이터 ===
      deletedCounts['제품'] = Number(
        (await tx.delete(products).where(eq(products.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['공급업체'] = Number(
        (await tx.delete(suppliers).where(eq(suppliers.organizationId, orgId))).rowCount ?? 0
      )
      deletedCounts['창고'] = Number(
        (await tx.delete(warehouses).where(eq(warehouses.organizationId, orgId))).rowCount ?? 0
      )
    })

    // 리셋 이력 기록 (트랜잭션 외부 — 활동 로그는 남겨야 함)
    await logActivity({
      user,
      action: 'DELETE',
      entityType: 'organization_settings',
      entityId: orgId,
      description: '조직 데이터 전체 리셋 완료',
      metadata: { deletedCounts },
    })

    // 캐시 무효화
    revalidatePath('/dashboard', 'layout')

    return { success: true, deletedCounts }
  } catch (error) {
    console.error('[데이터 리셋] 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '데이터 리셋에 실패했습니다',
    }
  }
}
