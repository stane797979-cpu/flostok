import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/server/db'
import { organizations, inventory, products, alerts } from '@/server/db/schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getInventoryStatus(
  currentStock: number,
  safetyStock: number | null,
  reorderPoint: number | null
): { status: string } {
  const safe = safetyStock || 0

  if (currentStock === 0) return { status: 'out_of_stock' }
  if (currentStock < safe * 0.5) return { status: 'critical' }
  if (currentStock < safe) return { status: 'low' }
  if (currentStock >= safe * 5.0) return { status: 'overstock' }
  if (currentStock >= safe * 3.0) return { status: 'excess' }
  if ((reorderPoint || 0) > 0 && currentStock < (reorderPoint || 0)) return { status: 'warning' }
  return { status: 'optimal' }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const secret = request.nextUrl.searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error('[Inventory Check Cron] CRON_SECRET 환경변수가 설정되지 않았습니다')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (secret !== expectedSecret) {
      console.error('[Inventory Check Cron] 인증 실패')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Inventory Check Cron] 시작:', new Date().toISOString())

    const allOrganizations = await db.select().from(organizations)

    let totalChecked = 0
    let totalAlertsCreated = 0
    const results: Array<{
      organizationId: string
      organizationName: string
      productsChecked: number
      alertsCreated: number
      breakdown: {
        outOfStock: number
        critical: number
        low: number
        excess: number
        overstock: number
      }
      error?: string
    }> = []

    for (const org of allOrganizations) {
      try {
        const inventoryItems = await db
          .select({
            inventory,
            product: products,
          })
          .from(inventory)
          .innerJoin(products, eq(products.id, inventory.productId))
          .where(eq(inventory.organizationId, org.id))

        if (inventoryItems.length === 0) {
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            productsChecked: 0,
            alertsCreated: 0,
            breakdown: { outOfStock: 0, critical: 0, low: 0, excess: 0, overstock: 0 },
          })
          continue
        }

        const breakdown = { outOfStock: 0, critical: 0, low: 0, excess: 0, overstock: 0 }

        const alertsToCreate: Array<{
          organizationId: string
          productId: string
          type: 'stock_critical' | 'stock_shortage' | 'stock_excess'
          severity: 'critical' | 'warning' | 'info'
          title: string
          message: string
        }> = []

        for (const item of inventoryItems) {
          const inv = item.inventory
          const product = item.product
          const status = getInventoryStatus(inv.currentStock, product.safetyStock, product.reorderPoint)

          totalChecked++

          if (status.status === 'out_of_stock') {
            breakdown.outOfStock++
            alertsToCreate.push({
              organizationId: org.id,
              productId: product.id,
              type: 'stock_critical',
              severity: 'critical',
              title: `품절: ${product.name}`,
              message: `[${product.sku}] ${product.name}의 재고가 품절되었습니다.`,
            })
          } else if (status.status === 'critical') {
            breakdown.critical++
            alertsToCreate.push({
              organizationId: org.id,
              productId: product.id,
              type: 'stock_critical',
              severity: 'critical',
              title: `위험: ${product.name}`,
              message: `[${product.sku}] ${product.name}의 재고가 위험 수준입니다.`,
            })
          } else if (status.status === 'low') {
            breakdown.low++
            alertsToCreate.push({
              organizationId: org.id,
              productId: product.id,
              type: 'stock_shortage',
              severity: 'warning',
              title: `부족: ${product.name}`,
              message: `[${product.sku}] ${product.name}의 재고가 부족합니다.`,
            })
          } else if (status.status === 'excess') {
            breakdown.excess++
            alertsToCreate.push({
              organizationId: org.id,
              productId: product.id,
              type: 'stock_excess',
              severity: 'info',
              title: `과다: ${product.name}`,
              message: `[${product.sku}] ${product.name}의 재고가 과다합니다.`,
            })
          } else if (status.status === 'overstock') {
            breakdown.overstock++
            alertsToCreate.push({
              organizationId: org.id,
              productId: product.id,
              type: 'stock_excess',
              severity: 'warning',
              title: `과잉: ${product.name}`,
              message: `[${product.sku}] ${product.name}의 재고가 과잉입니다.`,
            })
          }
        }

        let newAlertsCreated = 0
        if (alertsToCreate.length > 0) {
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)

          for (const alert of alertsToCreate) {
            const existingAlerts = await db
              .select()
              .from(alerts)
              .where(
                and(
                  eq(alerts.organizationId, org.id),
                  eq(alerts.type, alert.type),
                  eq(alerts.productId, alert.productId)
                )
              )
              .limit(1)

            if (
              existingAlerts.length > 0 &&
              existingAlerts[0].createdAt &&
              existingAlerts[0].createdAt > sixHoursAgo
            ) {
              continue
            }

            await db.insert(alerts).values({
              organizationId: alert.organizationId,
              productId: alert.productId,
              type: alert.type,
              severity: alert.severity,
              title: alert.title,
              message: alert.message,
              isRead: false,
            })

            newAlertsCreated++
          }
        }

        totalAlertsCreated += newAlertsCreated

        results.push({
          organizationId: org.id,
          organizationName: org.name,
          productsChecked: inventoryItems.length,
          alertsCreated: newAlertsCreated,
          breakdown,
        })
      } catch (error) {
        console.error(`[Inventory Check Cron] 조직 ${org.name} 처리 실패:`, error)
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          productsChecked: 0,
          alertsCreated: 0,
          breakdown: { outOfStock: 0, critical: 0, low: 0, excess: 0, overstock: 0 },
          error: error instanceof Error ? error.message : '알 수 없는 오류',
        })
      }
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      summary: {
        totalOrganizations: allOrganizations.length,
        totalProductsChecked: totalChecked,
        totalAlertsCreated,
      },
      results,
    })
  } catch (error) {
    console.error('[Inventory Check Cron] 치명적 오류:', error)

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
