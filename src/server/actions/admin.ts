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
import { eq, desc, asc, sql, count, sum, gte, and, ne } from 'drizzle-orm'
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

    const [orgCount] = await db
      .select({ value: count() })
      .from(organizations)
      .where(ne(organizations.id, SYSTEM_ORG_ID))

    const [userCount] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.isSuperadmin, false))

    const [revenue] = await db
      .select({ value: sum(paymentHistory.amount) })
      .from(paymentHistory)
      .where(eq(paymentHistory.status, 'success'))

    const [activeSubs] = await db
      .select({ value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const [recentSignups] = await db
      .select({ value: count() })
      .from(organizations)
      .where(and(ne(organizations.id, SYSTEM_ORG_ID), gte(organizations.createdAt, thirtyDaysAgo)))

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

    const orgsWithStats = await Promise.all(
      orgs.map(async (org) => {
        const [uc] = await db.select({ value: count() }).from(users).where(eq(users.organizationId, org.id))
        const [pc] = await db.select({ value: count() }).from(products).where(eq(products.organizationId, org.id))
        const [oc] = await db.select({ value: count() }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, org.id))

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          createdAt: org.createdAt,
          userCount: uc?.value ?? 0,
          productCount: pc?.value ?? 0,
          orderCount: oc?.value ?? 0,
        }
      })
    )

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

    const orgUsers = await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.organizationId, organizationId))
      .orderBy(desc(users.createdAt))

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.organizationId, organizationId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)

    const [uc] = await db.select({ value: count() }).from(users).where(eq(users.organizationId, organizationId))
    const [pc] = await db.select({ value: count() }).from(products).where(eq(products.organizationId, organizationId))
    const [oc] = await db.select({ value: count() }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId))
    const [ic] = await db.select({ value: count() }).from(inventory).where(eq(inventory.organizationId, organizationId))

    const payments = await db
      .select({ id: paymentHistory.id, amount: paymentHistory.amount, status: paymentHistory.status, method: paymentHistory.method, createdAt: paymentHistory.createdAt })
      .from(paymentHistory)
      .where(eq(paymentHistory.organizationId, organizationId))
      .orderBy(desc(paymentHistory.createdAt))
      .limit(10)

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
