import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db'
import { organizations, products, purchaseOrders, purchaseOrderItems, suppliers } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 자동 발주 크론잡
 *
 * 스케줄: 매일 09:00 KST
 * 기능:
 * - 모든 조직의 재고 상태 확인
 * - 발주점 이하 제품 자동 발주서 생성
 * - 자동 발주 활성화된 제품만 처리
 *
 * Railway 크론잡 설정:
 * - 환경변수: CRON_SECRET
 * - 요청: GET /api/cron/auto-reorder?secret={CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // 1. CRON_SECRET 검증
    const secret = request.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error('[Auto-Reorder Cron] CRON_SECRET 환경변수가 설정되지 않았습니다')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (secret !== expectedSecret) {
      console.error('[Auto-Reorder Cron] 인증 실패: 잘못된 secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Auto-Reorder Cron] 시작:', new Date().toISOString())

    // 2. 모든 조직 가져오기
    const allOrganizations = await db.select().from(organizations)

    console.log(`[Auto-Reorder Cron] 처리할 조직 수: ${allOrganizations.length}`)

    let totalProcessed = 0
    let totalOrdered = 0
    const results: Array<{
      organizationId: string
      organizationName: string
      productsProcessed: number
      ordersCreated: number
      error?: string
    }> = []

    // 3. 각 조직별로 자동 발주 처리
    for (const org of allOrganizations) {
      try {
        console.log(`[Auto-Reorder Cron] 조직 처리 시작: ${org.name} (${org.id})`)

        // 조직 설정에서 자동 발주 활성화 여부 확인
        const settings = (org.settings as Record<string, unknown>) || {}
        const autoReorderEnabled = settings.autoReorderEnabled ?? true // 기본값: true

        if (!autoReorderEnabled) {
          console.log(`[Auto-Reorder Cron] 조직 ${org.name}: 자동 발주 비활성화됨`)
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            productsProcessed: 0,
            ordersCreated: 0,
          })
          continue
        }

        // TODO: getReorderItems를 organizationId를 받도록 수정 필요
        // 현재는 TEMP_ORG_ID만 지원하므로 해당 조직만 처리
        if (org.id !== '00000000-0000-0000-0000-000000000001') {
          console.log(`[Auto-Reorder Cron] 조직 ${org.name}: 아직 미구현 (멀티테넌시 지원 필요)`)
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            productsProcessed: 0,
            ordersCreated: 0,
          })
          continue
        }

        // 발주 필요 제품 조회 (임시: DB에서 직접 조회)
        const { getReorderItems } = await import('@/server/actions/purchase-orders')
        const { items: recommendations } = await getReorderItems({ limit: 100 })

        if (recommendations.length === 0) {
          console.log(`[Auto-Reorder Cron] 조직 ${org.name}: 발주 필요 제품 없음`)
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            productsProcessed: 0,
            ordersCreated: 0,
          })
          continue
        }

        console.log(`[Auto-Reorder Cron] 조직 ${org.name}: 발주 필요 제품 ${recommendations.length}개`)

        // 공급자별로 그룹화
        const supplierGroups = new Map<
          string,
          Array<{
            productId: string
            productName: string
            quantity: number
            unitPrice: number
          }>
        >()

        for (const rec of recommendations) {
          // supplierId가 없으면 스킵
          if (!rec.supplier?.id) {
            console.warn(`[Auto-Reorder Cron] 제품 ${rec.productId}: 공급자 없음`)
            continue
          }

          const supplierId = rec.supplier.id

          // 제품 가격 정보 조회
          const [product] = await db
            .select({
              unitPrice: products.unitPrice,
              costPrice: products.costPrice,
            })
            .from(products)
            .where(eq(products.id, rec.productId))
            .limit(1)

          if (!product) {
            console.warn(`[Auto-Reorder Cron] 제품 ${rec.productId}: 찾을 수 없음`)
            continue
          }

          // 공급자별 그룹에 추가
          if (!supplierGroups.has(supplierId)) {
            supplierGroups.set(supplierId, [])
          }

          supplierGroups.get(supplierId)!.push({
            productId: rec.productId,
            productName: rec.productName,
            quantity: rec.recommendedQty,
            unitPrice: product.costPrice || product.unitPrice || 0,
          })
        }

        // 공급자별로 발주서 생성
        let ordersCreated = 0
        for (const [supplierId, items] of supplierGroups.entries()) {
          // 공급자 정보 가져오기
          const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)

          if (!supplier) {
            console.warn(`[Auto-Reorder Cron] 공급자 ${supplierId}: 찾을 수 없음`)
            continue
          }

          // 발주서 생성
          const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
          const today = new Date().toISOString().split('T')[0]
          const leadTime = supplier.avgLeadTime || 7
          const expectedDate = new Date(Date.now() + leadTime * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]

          const [order] = await db
            .insert(purchaseOrders)
            .values({
              organizationId: org.id,
              supplierId,
              orderNumber: `AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
              orderDate: today,
              expectedDate,
              status: 'draft',
              totalAmount,
              notes: `[자동 발주] ${today} 시스템 자동 생성`,
              isAutoGenerated: new Date(),
            })
            .returning()

          // 발주 항목 생성
          const orderItems = items.map((item) => ({
            purchaseOrderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          }))

          await db.insert(purchaseOrderItems).values(orderItems)

          ordersCreated++
          console.log(
            `[Auto-Reorder Cron] 발주서 생성: ${order.orderNumber} (공급자: ${supplier.name}, 품목 ${items.length}개, 총액 ${totalAmount.toLocaleString()}원)`
          )
        }

        totalProcessed += recommendations.length
        totalOrdered += ordersCreated

        results.push({
          organizationId: org.id,
          organizationName: org.name,
          productsProcessed: recommendations.length,
          ordersCreated,
        })
      } catch (error) {
        console.error(`[Auto-Reorder Cron] 조직 ${org.name} 처리 실패:`, error)
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          productsProcessed: 0,
          ordersCreated: 0,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        })
      }
    }

    const duration = Date.now() - startTime

    console.log('[Auto-Reorder Cron] 완료:', {
      duration: `${duration}ms`,
      totalOrganizations: allOrganizations.length,
      totalProductsProcessed: totalProcessed,
      totalOrdersCreated: totalOrdered,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      summary: {
        totalOrganizations: allOrganizations.length,
        totalProductsProcessed: totalProcessed,
        totalOrdersCreated: totalOrdered,
      },
      results,
    })
  } catch (error) {
    console.error('[Auto-Reorder Cron] 치명적 오류:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
