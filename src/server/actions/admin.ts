'use server'

import { db } from '@/server/db'
import {
  organizations,
  users,
  products,
  purchaseOrders,
  subscriptions,
  paymentHistory,
  inventory,
  salesRecords,
  suppliers,
  kpiMonthlySnapshots,
} from '@/server/db/schema'
import { eq, desc, asc, sql, count, sum, gte, and, ne, inArray } from 'drizzle-orm'
import { requireSuperadmin } from './auth-helpers'

type ActionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000'

// ========== 시스템 통계 ==========

interface SystemStats {
  totalOrganizations: number
  totalUsers: number
  totalRevenue: number
  activeSubscriptions: number
  recentSignupsCount: number
}

export async function getSystemStats(): Promise<ActionResponse<SystemStats>> {
  try {
    await requireSuperadmin()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 독립적인 집계 쿼리 5개를 Promise.all로 병렬화 (순차 → 동시)
    const [
      [orgCount],
      [userCount],
      [revenue],
      [activeSubs],
      [recentSignups],
    ] = await Promise.all([
      db.select({ value: count() }).from(organizations).where(ne(organizations.id, SYSTEM_ORG_ID)),
      db.select({ value: count() }).from(users).where(eq(users.isSuperadmin, false)),
      db.select({ value: sum(paymentHistory.amount) }).from(paymentHistory).where(eq(paymentHistory.status, 'success')),
      db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
      db.select({ value: count() }).from(organizations).where(and(ne(organizations.id, SYSTEM_ORG_ID), gte(organizations.createdAt, thirtyDaysAgo))),
    ])

    return {
      success: true,
      data: {
        totalOrganizations: orgCount?.value ?? 0,
        totalUsers: userCount?.value ?? 0,
        totalRevenue: Number(revenue?.value) || 0,
        activeSubscriptions: activeSubs?.value ?? 0,
        recentSignupsCount: recentSignups?.value ?? 0,
      },
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '시스템 통계 조회 실패' }
  }
}

// ========== 조직 관리 ==========

export interface OrganizationWithStats {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: Date
  userCount: number
  productCount: number
  orderCount: number
}

export async function getAllOrganizations(): Promise<ActionResponse<OrganizationWithStats[]>> {
  try {
    await requireSuperadmin()

    const orgs = await db
      .select()
      .from(organizations)
      .where(ne(organizations.id, SYSTEM_ORG_ID))
      .orderBy(desc(organizations.createdAt))

    if (orgs.length === 0) {
      return { success: true, data: [] }
    }

    const orgIds = orgs.map((org) => org.id)

    // GROUP BY 집계 쿼리 3개를 병렬 실행
    const [userCounts, productCounts, orderCounts] = await Promise.all([
      db
        .select({ orgId: users.organizationId, value: count() })
        .from(users)
        .where(inArray(users.organizationId, orgIds))
        .groupBy(users.organizationId),
      db
        .select({ orgId: products.organizationId, value: count() })
        .from(products)
        .where(inArray(products.organizationId, orgIds))
        .groupBy(products.organizationId),
      db
        .select({ orgId: purchaseOrders.organizationId, value: count() })
        .from(purchaseOrders)
        .where(inArray(purchaseOrders.organizationId, orgIds))
        .groupBy(purchaseOrders.organizationId),
    ])

    // Map으로 변환 (O(1) 조회)
    const userCountMap = new Map(userCounts.map((item) => [item.orgId, item.value]))
    const productCountMap = new Map(productCounts.map((item) => [item.orgId, item.value]))
    const orderCountMap = new Map(orderCounts.map((item) => [item.orgId, item.value]))

    // 동기적으로 조합
    const orgsWithStats = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      createdAt: org.createdAt,
      userCount: userCountMap.get(org.id) ?? 0,
      productCount: productCountMap.get(org.id) ?? 0,
      orderCount: orderCountMap.get(org.id) ?? 0,
    }))

    return { success: true, data: orgsWithStats }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '조직 목록 조회 실패' }
  }
}

export interface OrganizationDetail {
  organization: {
    id: string
    name: string
    slug: string
    plan: string
    createdAt: Date
  }
  users: {
    id: string
    email: string
    name: string | null
    role: string
    createdAt: Date
  }[]
  subscription: {
    plan: string
    status: string
    billingCycle: string
    currentPeriodEnd: Date
  } | null
  usageStats: {
    userCount: number
    productCount: number
    orderCount: number
    inventoryCount: number
  }
  recentPayments: {
    id: string
    amount: number
    status: string
    method: string
    createdAt: Date
  }[]
}

export async function getOrganizationDetail(organizationId: string): Promise<ActionResponse<OrganizationDetail>> {
  try {
    await requireSuperadmin()

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (!org) {
      return { success: false, error: '조직을 찾을 수 없습니다' }
    }

    // 6개 독립 쿼리를 Promise.all로 병렬 실행 (순차 8쿼리 → 병렬 6쿼리)
    const [orgUsers, [sub], [uc], [pc], [oc], [ic], payments] = await Promise.all([
      db.select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
        .from(users).where(eq(users.organizationId, organizationId)).orderBy(desc(users.createdAt)),
      db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId))
        .orderBy(desc(subscriptions.createdAt)).limit(1),
      db.select({ value: count() }).from(users).where(eq(users.organizationId, organizationId)),
      db.select({ value: count() }).from(products).where(eq(products.organizationId, organizationId)),
      db.select({ value: count() }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId)),
      db.select({ value: count() }).from(inventory).where(eq(inventory.organizationId, organizationId)),
      db.select({ id: paymentHistory.id, amount: paymentHistory.amount, status: paymentHistory.status, method: paymentHistory.method, createdAt: paymentHistory.createdAt })
        .from(paymentHistory).where(eq(paymentHistory.organizationId, organizationId)).orderBy(desc(paymentHistory.createdAt)).limit(10),
    ])

    return {
      success: true,
      data: {
        organization: { id: org.id, name: org.name, slug: org.slug, plan: org.plan, createdAt: org.createdAt },
        users: orgUsers,
        subscription: sub ? { plan: sub.plan, status: sub.status, billingCycle: sub.billingCycle, currentPeriodEnd: sub.currentPeriodEnd } : null,
        usageStats: {
          userCount: uc?.value ?? 0,
          productCount: pc?.value ?? 0,
          orderCount: oc?.value ?? 0,
          inventoryCount: ic?.value ?? 0,
        },
        recentPayments: payments,
      },
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '조직 상세 조회 실패' }
  }
}

// ========== 조직별 상세 데이터 (읽기 전용) ==========

export interface AdminProductItem {
  id: string
  sku: string
  name: string
  category: string | null
  unit: string | null
  unitPrice: number | null
  costPrice: number | null
  abcGrade: string | null
  xyzGrade: string | null
  safetyStock: number | null
  reorderPoint: number | null
  leadTime: number | null
  isActive: Date | null
  createdAt: Date
}

export async function getOrganizationProducts(organizationId: string): Promise<ActionResponse<AdminProductItem[]>> {
  try {
    await requireSuperadmin()

    const items = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        category: products.category,
        unit: products.unit,
        unitPrice: products.unitPrice,
        costPrice: products.costPrice,
        abcGrade: products.abcGrade,
        xyzGrade: products.xyzGrade,
        safetyStock: products.safetyStock,
        reorderPoint: products.reorderPoint,
        leadTime: products.leadTime,
        isActive: products.isActive,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(eq(products.organizationId, organizationId))
      .orderBy(desc(products.createdAt))
      .limit(200)

    return { success: true, data: items }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '제품 목록 조회 실패' }
  }
}

export interface AdminInventoryItem {
  id: string
  productSku: string
  productName: string
  currentStock: number
  availableStock: number | null
  reservedStock: number | null
  incomingStock: number | null
  status: string | null
  location: string | null
  daysOfInventory: string | null
  inventoryValue: number | null
}

export async function getOrganizationInventory(organizationId: string): Promise<ActionResponse<AdminInventoryItem[]>> {
  try {
    await requireSuperadmin()

    const items = await db
      .select({
        id: inventory.id,
        productSku: products.sku,
        productName: products.name,
        currentStock: inventory.currentStock,
        availableStock: inventory.availableStock,
        reservedStock: inventory.reservedStock,
        incomingStock: inventory.incomingStock,
        status: inventory.status,
        location: inventory.location,
        daysOfInventory: inventory.daysOfInventory,
        inventoryValue: inventory.inventoryValue,
      })
      .from(inventory)
      .leftJoin(products, eq(inventory.productId, products.id))
      .where(eq(inventory.organizationId, organizationId))
      .orderBy(asc(inventory.status))
      .limit(200)

    return { success: true, data: items }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '재고 목록 조회 실패' }
  }
}

export interface AdminSalesItem {
  id: string
  date: string
  productSku: string | null
  productName: string | null
  quantity: number
  unitPrice: number | null
  totalAmount: number | null
  channel: string | null
}

export async function getOrganizationSales(organizationId: string): Promise<ActionResponse<AdminSalesItem[]>> {
  try {
    await requireSuperadmin()

    const items = await db
      .select({
        id: salesRecords.id,
        date: salesRecords.date,
        productSku: products.sku,
        productName: products.name,
        quantity: salesRecords.quantity,
        unitPrice: salesRecords.unitPrice,
        totalAmount: salesRecords.totalAmount,
        channel: salesRecords.channel,
      })
      .from(salesRecords)
      .leftJoin(products, eq(salesRecords.productId, products.id))
      .where(eq(salesRecords.organizationId, organizationId))
      .orderBy(desc(salesRecords.date))
      .limit(100)

    return { success: true, data: items }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '판매 기록 조회 실패' }
  }
}

export interface AdminOrderItem {
  id: string
  orderNumber: string
  supplierName: string | null
  status: string
  orderDate: string | null
  expectedDate: string | null
  totalAmount: number | null
  isAutoGenerated: Date | null
  createdAt: Date
}

export async function getOrganizationOrders(organizationId: string): Promise<ActionResponse<AdminOrderItem[]>> {
  try {
    await requireSuperadmin()

    const items = await db
      .select({
        id: purchaseOrders.id,
        orderNumber: purchaseOrders.orderNumber,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        orderDate: purchaseOrders.orderDate,
        expectedDate: purchaseOrders.expectedDate,
        totalAmount: purchaseOrders.totalAmount,
        isAutoGenerated: purchaseOrders.isAutoGenerated,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(eq(purchaseOrders.organizationId, organizationId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(100)

    return { success: true, data: items }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '발주 목록 조회 실패' }
  }
}

// ========== 고객 모니터링 (멀티테넌시) ==========

export interface OrgMonitoringData {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: Date
  userCount: number
  productCount: number
  totalInventoryValue: number
  stockoutCount: number
  criticalCount: number
  lowCount: number
  normalCount: number
  excessCount: number
  monthlySalesAmount: number
  monthlyOrderCount: number
  pendingOrderCount: number
  turnoverRate: number | null
  stockoutRate: number | null
}

export async function getOrganizationsMonitoring(): Promise<ActionResponse<OrgMonitoringData[]>> {
  try {
    await requireSuperadmin()

    const orgs = await db
      .select()
      .from(organizations)
      .where(ne(organizations.id, SYSTEM_ORG_ID))
      .orderBy(asc(organizations.name))

    if (orgs.length === 0) {
      return { success: true, data: [] }
    }

    const orgIds = orgs.map((org) => org.id)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    // 7개의 GROUP BY 집계 쿼리를 병렬 실행
    const [
      userCounts,
      productCounts,
      inventoryStats,
      salesStats,
      monthlyOrderCounts,
      pendingOrderCounts,
      kpiSnapshots,
    ] = await Promise.all([
      // 1. 사용자 수
      db
        .select({ orgId: users.organizationId, value: count() })
        .from(users)
        .where(inArray(users.organizationId, orgIds))
        .groupBy(users.organizationId)
        .catch(() => []),
      // 2. 제품 수
      db
        .select({ orgId: products.organizationId, value: count() })
        .from(products)
        .where(inArray(products.organizationId, orgIds))
        .groupBy(products.organizationId)
        .catch(() => []),
      // 3. 재고 통계
      db
        .select({
          orgId: inventory.organizationId,
          totalValue: sql<number>`coalesce(sum(${inventory.inventoryValue}), 0)`,
          stockout: sql<number>`count(case when ${inventory.status} = '품절' then 1 end)`,
          critical: sql<number>`count(case when ${inventory.status} = '위험' then 1 end)`,
          low: sql<number>`count(case when ${inventory.status} in ('부족', '주의') then 1 end)`,
          normal: sql<number>`count(case when ${inventory.status} = '적정' then 1 end)`,
          excess: sql<number>`count(case when ${inventory.status} in ('과다', '과잉') then 1 end)`,
        })
        .from(inventory)
        .where(inArray(inventory.organizationId, orgIds))
        .groupBy(inventory.organizationId)
        .catch(() => []),
      // 4. 월간 판매액
      db
        .select({
          orgId: salesRecords.organizationId,
          totalAmount: sql<number>`coalesce(sum(${salesRecords.totalAmount}), 0)`,
        })
        .from(salesRecords)
        .where(and(inArray(salesRecords.organizationId, orgIds), gte(salesRecords.date, thirtyDaysAgoStr)))
        .groupBy(salesRecords.organizationId)
        .catch(() => []),
      // 5. 월간 발주 수
      db
        .select({ orgId: purchaseOrders.organizationId, value: count() })
        .from(purchaseOrders)
        .where(and(inArray(purchaseOrders.organizationId, orgIds), gte(purchaseOrders.createdAt, thirtyDaysAgo)))
        .groupBy(purchaseOrders.organizationId)
        .catch(() => []),
      // 6. 대기 중인 발주 수
      db
        .select({ orgId: purchaseOrders.organizationId, value: count() })
        .from(purchaseOrders)
        .where(and(inArray(purchaseOrders.organizationId, orgIds), eq(purchaseOrders.status, 'pending')))
        .groupBy(purchaseOrders.organizationId)
        .catch(() => []),
      // 7. 최신 KPI (윈도우 함수 사용)
      db
        .select({
          orgId: kpiMonthlySnapshots.organizationId,
          turnoverRate: kpiMonthlySnapshots.turnoverRate,
          stockoutRate: kpiMonthlySnapshots.stockoutRate,
          rowNum: sql<number>`row_number() over (partition by ${kpiMonthlySnapshots.organizationId} order by ${kpiMonthlySnapshots.period} desc)`,
        })
        .from(kpiMonthlySnapshots)
        .where(inArray(kpiMonthlySnapshots.organizationId, orgIds))
        .catch(() => []),
    ])

    // Map으로 변환 (O(1) 조회)
    const userCountMap = new Map(userCounts.map((item) => [item.orgId, item.value]))
    const productCountMap = new Map(productCounts.map((item) => [item.orgId, item.value]))

    type InventoryStatsValue = {
      totalValue: number
      stockout: number
      critical: number
      low: number
      normal: number
      excess: number
    }
    const inventoryStatsMap = new Map<string, InventoryStatsValue>(
      inventoryStats.map((item) => [
        item.orgId,
        {
          totalValue: Number(item.totalValue) || 0,
          stockout: Number(item.stockout) || 0,
          critical: Number(item.critical) || 0,
          low: Number(item.low) || 0,
          normal: Number(item.normal) || 0,
          excess: Number(item.excess) || 0,
        },
      ])
    )
    const salesStatsMap = new Map(salesStats.map((item) => [item.orgId, Number(item.totalAmount) || 0]))
    const monthlyOrderCountMap = new Map(monthlyOrderCounts.map((item) => [item.orgId, item.value]))
    const pendingOrderCountMap = new Map(pendingOrderCounts.map((item) => [item.orgId, item.value]))

    type KpiValue = {
      turnoverRate: number | null
      stockoutRate: number | null
    }
    const kpiMap = new Map<string, KpiValue>(
      kpiSnapshots
        .filter((item) => item.rowNum === 1)
        .map((item) => [
          item.orgId,
          {
            turnoverRate: item.turnoverRate ? parseFloat(item.turnoverRate) : null,
            stockoutRate: item.stockoutRate ? parseFloat(item.stockoutRate) : null,
          },
        ])
    )

    // 동기적으로 조합
    const results = orgs.map((org) => {
      const inv = inventoryStatsMap.get(org.id) || {
        totalValue: 0,
        stockout: 0,
        critical: 0,
        low: 0,
        normal: 0,
        excess: 0,
      }
      const kpi = kpiMap.get(org.id)

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        createdAt: org.createdAt,
        userCount: userCountMap.get(org.id) ?? 0,
        productCount: productCountMap.get(org.id) ?? 0,
        totalInventoryValue: inv.totalValue,
        stockoutCount: inv.stockout,
        criticalCount: inv.critical,
        lowCount: inv.low,
        normalCount: inv.normal,
        excessCount: inv.excess,
        monthlySalesAmount: salesStatsMap.get(org.id) ?? 0,
        monthlyOrderCount: monthlyOrderCountMap.get(org.id) ?? 0,
        pendingOrderCount: pendingOrderCountMap.get(org.id) ?? 0,
        turnoverRate: kpi?.turnoverRate ?? null,
        stockoutRate: kpi?.stockoutRate ?? null,
      }
    })

    return { success: true, data: results }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '고객 모니터링 데이터 조회 실패' }
  }
}

// ========== 조직별 KPI ==========

export interface AdminKpiItem {
  id: string
  period: string
  turnoverRate: number | null
  stockoutRate: number | null
  onTimeDeliveryRate: number | null
  fulfillmentRate: number | null
  actualShipmentRate: number | null
  comment: string | null
}

export async function getOrganizationKpi(organizationId: string): Promise<ActionResponse<AdminKpiItem[]>> {
  try {
    await requireSuperadmin()

    const rows = await db
      .select()
      .from(kpiMonthlySnapshots)
      .where(eq(kpiMonthlySnapshots.organizationId, organizationId))
      .orderBy(desc(kpiMonthlySnapshots.period))
      .limit(12)

    const items: AdminKpiItem[] = rows.map((r) => ({
      id: r.id,
      period: r.period,
      turnoverRate: r.turnoverRate ? parseFloat(r.turnoverRate) : null,
      stockoutRate: r.stockoutRate ? parseFloat(r.stockoutRate) : null,
      onTimeDeliveryRate: r.onTimeDeliveryRate ? parseFloat(r.onTimeDeliveryRate) : null,
      fulfillmentRate: r.fulfillmentRate ? parseFloat(r.fulfillmentRate) : null,
      actualShipmentRate: r.actualShipmentRate ? parseFloat(r.actualShipmentRate) : null,
      comment: r.comment,
    }))

    return { success: true, data: items }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'KPI 조회 실패' }
  }
}
