'use server'

/**
 * 조직 데이터 전체 리셋 Server Action
 *
 * 입고, 출고, 재고, 공급업체, 제품 등 조직의 모든 비즈니스 데이터를 삭제합니다.
 * admin 이상 권한 필수. FK 의존성 순서대로 순차 삭제.
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

// 삭제 대상 테이블 목록 (FK 의존성 순서)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DELETE_STEPS: Array<{ name: string; table: any; column: string }> = [
  // 1단계: leaf 노드
  { name: '등급 이력', table: gradeHistory, column: 'organizationId' },
  { name: 'KPI 스냅샷', table: kpiMonthlySnapshots, column: 'organizationId' },
  { name: '삭제 요청', table: deletionRequests, column: 'organizationId' },
  { name: '품절 기록', table: stockoutRecords, column: 'organizationId' },
  { name: 'PSI 계획', table: psiPlans, column: 'organizationId' },
  // 2단계: 트랜잭션 데이터
  { name: '재고 LOT', table: inventoryLots, column: 'organizationId' },
  { name: '입항 기록', table: importShipments, column: 'organizationId' },
  { name: '입고 기록', table: inboundRecords, column: 'organizationId' },
  { name: '재고 이력', table: inventoryHistory, column: 'organizationId' },
  { name: '판매 기록', table: salesRecords, column: 'organizationId' },
  { name: '수요 예측', table: demandForecasts, column: 'organizationId' },
  { name: '알림', table: alerts, column: 'organizationId' },
  { name: '공급자-제품 매핑', table: supplierProducts, column: 'organizationId' },
  // 3단계: 운영 데이터 (cascade → 하위 항목 자동 삭제)
  { name: '현재 재고', table: inventory, column: 'organizationId' },
  { name: '발주서', table: purchaseOrders, column: 'organizationId' },
  { name: '출고 요청', table: outboundRequests, column: 'organizationId' },
  { name: '온보딩 세션', table: onboardingSessions, column: 'organizationId' },
  { name: '컬럼 매핑', table: columnMappingProfiles, column: 'organizationId' },
  // 4단계: 마스터 데이터
  { name: '제품', table: products, column: 'organizationId' },
  { name: '공급업체', table: suppliers, column: 'organizationId' },
  { name: '창고', table: warehouses, column: 'organizationId' },
]

export async function resetOrganizationData(): Promise<ResetResult> {
  try {
    const user = await requireAdmin()
    const orgId = user.organizationId

    const deletedCounts: Record<string, number> = {}
    let failedAt = ''

    // 트랜잭션 없이 순차 삭제 (PgBouncer 타임아웃 방지)
    for (const step of DELETE_STEPS) {
      try {
        const result = await db
          .delete(step.table)
          .where(eq(step.table[step.column], orgId))
        deletedCounts[step.name] = Number(result.rowCount ?? 0)
      } catch (err) {
        failedAt = step.name
        console.error(`[데이터 리셋] ${step.name} 삭제 실패:`, err)
        throw new Error(`${step.name} 삭제 중 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      }
    }

    // 리셋 이력 기록
    await logActivity({
      user,
      action: 'DELETE',
      entityType: 'organization_settings',
      entityId: orgId,
      description: `조직 데이터 전체 리셋 완료`,
      metadata: { deletedCounts },
    }).catch(() => {}) // 로그 실패는 무시

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
