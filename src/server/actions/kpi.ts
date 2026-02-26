/**
 * KPI 서버 액션
 * KPI 실측 데이터를 조회하여 프론트엔드에 전달합니다.
 */

"use server";

import { revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { measureKPIMetrics, getKPITrendData } from "@/server/services/scm/kpi-measurement";
import type { KPIMetrics, KPITarget } from "@/server/services/scm/kpi-improvement";
import type { KPITrend, KPIFilterOptions } from "@/server/services/scm/kpi-measurement";
import { db } from "@/server/db";
import {
  organizations,
  inventory,
  products,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
} from "@/server/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

export type { KPIFilterOptions };

/** KPI 대시보드용 전체 데이터 */
export interface KPIDashboardData {
  metrics: KPIMetrics;
  trends: KPITrend[];
  targets: KPITarget;
}

/** 기본 목표값 (추후 조직별 설정 가능하도록) */
export const DEFAULT_TARGETS: KPITarget = {
  inventoryTurnoverRate: 10,
  averageInventoryDays: 40,
  inventoryAccuracy: 98,
  stockoutRate: 2,
  onTimeOrderRate: 90,
  averageLeadTime: 5,
  orderFulfillmentRate: 95,
};

/**
 * 조직별 KPI 목표값 조회 (organizations.settings.kpiTargets 저장)
 */
export async function getKPITargets(): Promise<KPITarget> {
  const user = await requireAuth();

  const result = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, user.organizationId))
    .limit(1);

  const settings = result[0]?.settings as Record<string, unknown> | null;
  const savedTargets = settings?.kpiTargets as Partial<KPITarget> | undefined;

  if (!savedTargets) return DEFAULT_TARGETS;

  return {
    inventoryTurnoverRate: savedTargets.inventoryTurnoverRate ?? DEFAULT_TARGETS.inventoryTurnoverRate,
    averageInventoryDays: savedTargets.averageInventoryDays ?? DEFAULT_TARGETS.averageInventoryDays,
    inventoryAccuracy: savedTargets.inventoryAccuracy ?? DEFAULT_TARGETS.inventoryAccuracy,
    stockoutRate: savedTargets.stockoutRate ?? DEFAULT_TARGETS.stockoutRate,
    onTimeOrderRate: savedTargets.onTimeOrderRate ?? DEFAULT_TARGETS.onTimeOrderRate,
    averageLeadTime: savedTargets.averageLeadTime ?? DEFAULT_TARGETS.averageLeadTime,
    orderFulfillmentRate: savedTargets.orderFulfillmentRate ?? DEFAULT_TARGETS.orderFulfillmentRate,
  };
}

/**
 * 조직별 KPI 목표값 저장 (organizations.settings.kpiTargets에 JSONB 저장)
 */
export async function saveKPITargets(targets: Partial<KPITarget>): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // 현재 settings 조회
    const result = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    const currentSettings = (result[0]?.settings as Record<string, unknown>) ?? {};

    // kpiTargets 병합 저장
    const newSettings = {
      ...currentSettings,
      kpiTargets: {
        ...(currentSettings.kpiTargets as Record<string, unknown> ?? {}),
        ...targets,
      },
    };

    await db
      .update(organizations)
      .set({
        settings: newSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, user.organizationId));

    // KPI 캐시 무효화
    revalidateTag(`kpi-${user.organizationId}`);

    return { success: true };
  } catch (error) {
    console.error("[saveKPITargets] Error:", error);
    return { success: false, error: "목표값 저장에 실패했습니다." };
  }
}

/**
 * KPI 대시보드 데이터 조회
 * @param filters - ABC/XYZ 등급 또는 제품 ID 필터 (선택)
 * @returns KPI 실측값, 트렌드, 목표값
 */
export async function getKPIDashboardData(
  filters?: KPIFilterOptions
): Promise<KPIDashboardData> {
  const user = await requireAuth();
  const filterKey = filters ? JSON.stringify(filters) : "all";

  return unstable_cache(
    async () => {
      const [metrics, trends, targets] = await Promise.all([
        measureKPIMetrics(user.organizationId, filters),
        getKPITrendData(user.organizationId, 6, filters),
        getKPITargets(),
      ]);

      return {
        metrics,
        trends,
        targets,
      };
    },
    [`kpi-data-${user.organizationId}-${filterKey}`],
    { revalidate: 60, tags: [`kpi-${user.organizationId}`] }
  )();
}

/**
 * KPI 요약 데이터 (대시보드 메인용, 3개 KPI만)
 */
export async function getKPISummary(): Promise<{
  inventoryTurnoverRate: number;
  averageInventoryDays: number;
  onTimeOrderRate: number;
  stockoutRate: number;
}> {
  const user = await requireAuth();

  return unstable_cache(
    async () => {
      const metrics = await measureKPIMetrics(user.organizationId);

      return {
        inventoryTurnoverRate: Number(metrics.inventoryTurnoverRate.toFixed(1)),
        averageInventoryDays: Number(metrics.averageInventoryDays.toFixed(1)),
        onTimeOrderRate: Number(metrics.onTimeOrderRate.toFixed(1)),
        stockoutRate: Number(metrics.stockoutRate.toFixed(1)),
      };
    },
    [`kpi-summary-${user.organizationId}`],
    { revalidate: 60, tags: [`kpi-${user.organizationId}`] }
  )();
}

// ────────────────────────────────────────────────────────────
// 드릴다운 타입 정의
// ────────────────────────────────────────────────────────────

export interface StockoutDrilldownItem {
  productId: string;
  productName: string;
  sku: string;
  category: string | null;
  currentStock: number;
  safetyStock: number;
}

export interface TurnoverDrilldownItem {
  productId: string;
  productName: string;
  sku: string;
  category: string | null;
  inventoryTurnoverRate: number;
  daysOfInventory: number;
  currentStock: number;
  inventoryValue: number;
}

export interface LeadTimeDrilldownItem {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  onTimeOrders: number;
  onTimeRate: number;
  avgLeadTime: number;
  avgDelay: number;
}

export interface FulfillmentDrilldownItem {
  orderId: string;
  orderNumber: string;
  supplierName: string | null;
  status: string;
  orderDate: string | null;
  expectedDate: string | null;
  totalOrdered: number;
  totalReceived: number;
  fulfillmentRate: number;
}

export type KPIDrilldownType =
  | "stockout"
  | "turnover"
  | "leadtime"
  | "fulfillment";

export type KPIDrilldownResult =
  | { type: "stockout"; items: StockoutDrilldownItem[] }
  | { type: "turnover"; items: TurnoverDrilldownItem[] }
  | { type: "leadtime"; items: LeadTimeDrilldownItem[] }
  | { type: "fulfillment"; items: FulfillmentDrilldownItem[] };

/**
 * KPI 드릴다운 데이터 조회
 */
export async function getKPIDrilldown(
  type: KPIDrilldownType
): Promise<KPIDrilldownResult> {
  const user = await requireAuth();
  const orgId = user.organizationId;

  switch (type) {
    case "stockout": {
      // 품절 및 위험 재고 제품 TOP 10 (현재고 낮은 순)
      const rows = await db
        .select({
          productId: inventory.productId,
          productName: products.name,
          sku: products.sku,
          category: products.category,
          currentStock: inventory.currentStock,
          safetyStock: products.safetyStock,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(
          and(
            eq(inventory.organizationId, orgId),
            inArray(inventory.status, ["out_of_stock", "critical"]),
          )
        )
        .orderBy(inventory.currentStock)
        .limit(10);

      return {
        type: "stockout",
        items: rows.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          sku: r.sku,
          category: r.category,
          currentStock: r.currentStock,
          safetyStock: r.safetyStock ?? 0,
        })),
      };
    }

    case "turnover": {
      // 재고회전율 하위 10개 제품 (inventoryValue가 있는 제품만)
      const rows = await db
        .select({
          productId: inventory.productId,
          productName: products.name,
          sku: products.sku,
          category: products.category,
          currentStock: inventory.currentStock,
          inventoryValue: inventory.inventoryValue,
          daysOfInventory: inventory.daysOfInventory,
        })
        .from(inventory)
        .innerJoin(products, eq(inventory.productId, products.id))
        .where(
          and(
            eq(inventory.organizationId, orgId),
            sql`${inventory.inventoryValue} > 0`,
          )
        )
        .orderBy(desc(inventory.daysOfInventory))
        .limit(10);

      return {
        type: "turnover",
        items: rows.map((r) => {
          const days = Number(r.daysOfInventory) || 0;
          const turnover = days > 0 ? Math.round((365 / days) * 10) / 10 : 0;
          return {
            productId: r.productId,
            productName: r.productName,
            sku: r.sku,
            category: r.category,
            inventoryTurnoverRate: turnover,
            daysOfInventory: Math.round(days),
            currentStock: r.currentStock,
            inventoryValue: r.inventoryValue ?? 0,
          };
        }),
      };
    }

    case "leadtime": {
      // 납기 지연 공급자 TOP 5 (완료된 발주 기준)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];

      const rows = await db
        .select({
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          totalOrders: sql<number>`COUNT(*)`,
          onTimeOrders: sql<number>`COUNT(*) FILTER (WHERE ${purchaseOrders.actualDate} IS NOT NULL AND ${purchaseOrders.expectedDate} IS NOT NULL AND ${purchaseOrders.actualDate} <= ${purchaseOrders.expectedDate})`,
          avgLeadTime: sql<number>`COALESCE(AVG(CASE WHEN ${purchaseOrders.actualDate} IS NOT NULL THEN ${purchaseOrders.actualDate}::date - ${purchaseOrders.orderDate}::date END), 0)`,
          avgDelay: sql<number>`COALESCE(AVG(CASE WHEN ${purchaseOrders.actualDate} IS NOT NULL AND ${purchaseOrders.expectedDate} IS NOT NULL AND ${purchaseOrders.actualDate} > ${purchaseOrders.expectedDate} THEN ${purchaseOrders.actualDate}::date - ${purchaseOrders.expectedDate}::date ELSE 0 END), 0)`,
        })
        .from(purchaseOrders)
        .innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            inArray(purchaseOrders.status, ["received", "completed"]),
            sql`${purchaseOrders.orderDate} >= ${oneYearAgoStr}`,
          )
        )
        .groupBy(purchaseOrders.supplierId, suppliers.name)
        .orderBy(sql`COUNT(*) FILTER (WHERE ${purchaseOrders.actualDate} IS NOT NULL AND ${purchaseOrders.expectedDate} IS NOT NULL AND ${purchaseOrders.actualDate} <= ${purchaseOrders.expectedDate}) * 1.0 / NULLIF(COUNT(*), 0)`)
        .limit(5);

      return {
        type: "leadtime",
        items: rows.map((r) => ({
          supplierId: r.supplierId ?? "",
          supplierName: r.supplierName,
          totalOrders: Number(r.totalOrders) || 0,
          onTimeOrders: Number(r.onTimeOrders) || 0,
          onTimeRate:
            Number(r.totalOrders) > 0
              ? Math.round((Number(r.onTimeOrders) / Number(r.totalOrders)) * 1000) / 10
              : 0,
          avgLeadTime: Math.round(Number(r.avgLeadTime) || 0),
          avgDelay: Math.round(Number(r.avgDelay) || 0),
        })),
      };
    }

    case "fulfillment": {
      // 미완납 발주서 목록 (부분 입고 + 완료되지 않은 발주)
      const rows = await db
        .select({
          orderId: purchaseOrders.id,
          orderNumber: purchaseOrders.orderNumber,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          orderDate: purchaseOrders.orderDate,
          expectedDate: purchaseOrders.expectedDate,
          totalOrdered: sql<number>`COALESCE(SUM(${purchaseOrderItems.quantity}), 0)`,
          totalReceived: sql<number>`COALESCE(SUM(${purchaseOrderItems.receivedQuantity}), 0)`,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
        .where(
          and(
            eq(purchaseOrders.organizationId, orgId),
            inArray(purchaseOrders.status, [
              "ordered",
              "confirmed",
              "shipped",
              "partially_received",
            ]),
          )
        )
        .groupBy(
          purchaseOrders.id,
          purchaseOrders.orderNumber,
          suppliers.name,
          purchaseOrders.status,
          purchaseOrders.orderDate,
          purchaseOrders.expectedDate,
        )
        .orderBy(purchaseOrders.expectedDate)
        .limit(20);

      return {
        type: "fulfillment",
        items: rows.map((r) => {
          const ordered = Number(r.totalOrdered) || 0;
          const received = Number(r.totalReceived) || 0;
          return {
            orderId: r.orderId,
            orderNumber: r.orderNumber,
            supplierName: r.supplierName ?? null,
            status: r.status,
            orderDate: r.orderDate,
            expectedDate: r.expectedDate,
            totalOrdered: ordered,
            totalReceived: received,
            fulfillmentRate: ordered > 0 ? Math.round((received / ordered) * 1000) / 10 : 0,
          };
        }),
      };
    }

    default:
      throw new Error("알 수 없는 드릴다운 타입입니다.");
  }
}
