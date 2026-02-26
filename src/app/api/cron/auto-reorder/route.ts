import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db'
import { organizations, products, purchaseOrders, purchaseOrderItems, suppliers, warehouses } from '@/server/db/schema'
import { sql, eq, and } from 'drizzle-orm'

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

    // 3. 각 조직별로 자동 발주 처리 (병렬 처리)
    const settled = await Promise.allSettled(
      allOrganizations.map(async (org) => {
        console.log(`[Auto-Reorder Cron] 조직 처리 시작: ${org.name} (${org.id})`)

        // 조직 설정에서 자동 발주 활성화 여부 확인
        const settings = (org.settings as Record<string, unknown>) || {}
        const autoReorderEnabled = settings.autoReorderEnabled ?? true // 기본값: true

        if (!autoReorderEnabled) {
          console.log(`[Auto-Reorder Cron] 조직 ${org.name}: 자동 발주 비활성화됨`)
          return {
            organizationId: org.id,
            organizationName: org.name,
            productsProcessed: 0,
            ordersCreated: 0,
          }
        }

        // 발주 필요 제품 조회
        const { getReorderItems } = await import('@/server/actions/purchase-orders')
        const { items: recommendations } = await getReorderItems({ limit: 100 })

        if (recommendations.length === 0) {
          console.log(`[Auto-Reorder Cron] 조직 ${org.name}: 발주 필요 제품 없음`)
          return {
            organizationId: org.id,
            organizationName: org.name,
            productsProcessed: 0,
            ordersCreated: 0,
          }
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

        // 필요한 제품 ID 수집 후 배치 가격 조회
        const productIds = recommendations.filter((r) => r.supplier?.id).map((r) => r.productId)
        const productPriceMap = new Map<string, { unitPrice: number; costPrice: number | null }>()

        if (productIds.length > 0) {
          const priceRows = await db
            .select({ id: products.id, unitPrice: products.unitPrice, costPrice: products.costPrice })
            .from(products)
            .where(sql`${products.id} IN ${productIds}`)
          for (const row of priceRows) {
            productPriceMap.set(row.id, { unitPrice: row.unitPrice ?? 0, costPrice: row.costPrice })
          }
        }

        for (const rec of recommendations) {
          if (!rec.supplier?.id) {
            console.warn(`[Auto-Reorder Cron] 제품 ${rec.productId}: 공급자 없음`)
            continue
          }

          const supplierId = rec.supplier.id
          const product = productPriceMap.get(rec.productId)

          if (!product) {
            console.warn(`[Auto-Reorder Cron] 제품 ${rec.productId}: 찾을 수 없음`)
            continue
          }

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

        // 공급자 정보 배치 조회
        const supplierIds = [...supplierGroups.keys()]
        const supplierMap = new Map<string, typeof suppliers.$inferSelect>()

        if (supplierIds.length > 0) {
          const supplierRows = await db.select().from(suppliers).where(sql`${suppliers.id} IN ${supplierIds}`)
          for (const row of supplierRows) {
            supplierMap.set(row.id, row)
          }
        }

        // 조직의 기본 창고 조회
        const [defaultWarehouse] = await db
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(and(eq(warehouses.organizationId, org.id), eq(warehouses.isDefault, true)))
          .limit(1)

        const destinationWarehouseId = defaultWarehouse?.id || null

        // 공급자별 발주서 데이터 준비 (배치 INSERT를 위해 먼저 수집)
        const today = new Date().toISOString().split('T')[0]
        const ordersToInsert: Array<{
          supplierId: string
          supplierName: string
          items: typeof supplierGroups extends Map<string, infer V> ? V : never
          orderValues: {
            organizationId: string
            supplierId: string
            orderNumber: string
            orderDate: string
            expectedDate: string
            status: string
            totalAmount: number
            destinationWarehouseId: string | null
            notes: string
            isAutoGenerated: Date
          }
        }> = []

        for (const [supplierId, items] of supplierGroups.entries()) {
          const supplier = supplierMap.get(supplierId)

          if (!supplier) {
            console.warn(`[Auto-Reorder Cron] 공급자 ${supplierId}: 찾을 수 없음`)
            continue
          }

          const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
          const leadTime = supplier.avgLeadTime || 7
          const expectedDate = new Date(Date.now() + leadTime * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0]

          ordersToInsert.push({
            supplierId,
            supplierName: supplier.name,
            items,
            orderValues: {
              organizationId: org.id,
              supplierId,
              orderNumber: `AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
              orderDate: today,
              expectedDate,
              status: 'draft',
              totalAmount,
              destinationWarehouseId,
              notes: `[자동 발주] ${today} 시스템 자동 생성`,
              isAutoGenerated: new Date(),
            },
          })
        }

        let ordersCreated = 0

        if (ordersToInsert.length > 0) {
          // 발주서 배치 INSERT (단일 쿼리)
          const insertedOrders = await db
            .insert(purchaseOrders)
            .values(ordersToInsert.map((o) => o.orderValues))
            .returning()

          // 발주 항목 배치 INSERT (단일 쿼리)
          const allOrderItems = insertedOrders.flatMap((order, index) => {
            const entry = ordersToInsert[index]
            return entry.items.map((item) => ({
              purchaseOrderId: order.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            }))
          })

          if (allOrderItems.length > 0) {
            await db.insert(purchaseOrderItems).values(allOrderItems)
          }

          ordersCreated = insertedOrders.length

          // 생성된 발주서 로그 출력
          for (let i = 0; i < insertedOrders.length; i++) {
            const order = insertedOrders[i]
            const entry = ordersToInsert[i]
            const totalAmount = entry.orderValues.totalAmount
            console.log(
              `[Auto-Reorder Cron] 발주서 생성: ${order.orderNumber} (공급자: ${entry.supplierName}, 품목 ${entry.items.length}개, 총액 ${totalAmount.toLocaleString()}원)`
            )
          }
        }

        return {
          organizationId: org.id,
          organizationName: org.name,
          productsProcessed: recommendations.length,
          ordersCreated,
        }
      })
    )

    for (const [i, result] of settled.entries()) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
        totalProcessed += result.value.productsProcessed
        totalOrdered += result.value.ordersCreated
      } else {
        const org = allOrganizations[i]
        console.error(`[Auto-Reorder Cron] 조직 ${org.name} 처리 실패:`, result.reason)
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          productsProcessed: 0,
          ordersCreated: 0,
          error: result.reason instanceof Error ? result.reason.message : '알 수 없는 오류',
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
