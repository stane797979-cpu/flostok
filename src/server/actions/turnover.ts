"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { products, inventory, salesRecords } from "@/server/db/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";

export interface TurnoverData {
  id: string;
  sku: string;
  name: string;
  annualRevenue: number;
  cogs: number;
  avgInventoryValue: number;
  turnoverRate: number;
  daysOfInventory: number;
  status: "high" | "normal" | "low" | "critical";
}

export interface TurnoverSummary {
  items: TurnoverData[];
  avgTurnoverRate: number;
  avgDaysOfInventory: number;
  lowTurnoverCount: number;
  top5Fastest: TurnoverData[];
  top5Slowest: TurnoverData[];
}

function classifyTurnoverStatus(rate: number): TurnoverData["status"] {
  if (rate >= 12) return "high";
  if (rate >= 6) return "normal";
  if (rate >= 3) return "low";
  return "critical";
}

/**
 * 재고회전율 데이터 조회 (실제 DB)
 * 회전율 = 연간판매원가(COGS) / 평균재고금액
 * 재고일수 = 365 / 회전율
 */
export async function getInventoryTurnoverData(): Promise<TurnoverSummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) {
    return {
      items: [],
      avgTurnoverRate: 0,
      avgDaysOfInventory: 0,
      lowTurnoverCount: 0,
      top5Fastest: [],
      top5Slowest: [],
    };
  }

  return unstable_cache(
    async () => {
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      // 판매 데이터 사전 집계 서브쿼리 (상관 서브쿼리 제거 → JOIN으로 10배 개선)
      const salesAgg = db
        .select({
          productId: salesRecords.productId,
          totalQty: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)`,
          totalAmount: sql<number>`coalesce(sum(${salesRecords.totalAmount}), 0)`,
        })
        .from(salesRecords)
        .where(
          and(
            eq(salesRecords.organizationId, orgId),
            sql`${salesRecords.date} >= ${oneYearAgoStr}`,
            sql`${salesRecords.date} <= ${todayStr}`
          )
        )
        .groupBy(salesRecords.productId)
        .as('sales_agg');

      // 메인 쿼리에서 LEFT JOIN (기존 상관 서브쿼리 대체)
      const rows = await db
        .select({
          productId: products.id,
          sku: products.sku,
          name: products.name,
          costPrice: products.costPrice,
          unitPrice: products.unitPrice,
          currentStock: inventory.currentStock,
          annualSalesQty: sql<number>`coalesce(${salesAgg.totalQty}, 0)`,
          annualSalesAmount: sql<number>`coalesce(${salesAgg.totalAmount}, 0)`,
        })
        .from(products)
        .leftJoin(inventory, eq(products.id, inventory.productId))
        .leftJoin(salesAgg, eq(products.id, salesAgg.productId))
        .where(
          and(
            eq(products.organizationId, orgId),
            isNotNull(products.isActive)
          )
        );

      const items: TurnoverData[] = [];

      for (const row of rows) {
        const costPrice = row.costPrice || 0;
        const unitPrice = row.unitPrice || 0;
        const currentStock = row.currentStock || 0;
        const annualSalesQty = Number(row.annualSalesQty) || 0;
        const annualSalesAmount = Number(row.annualSalesAmount) || 0;

        // COGS = 판매수량 × 원가 (원가가 없으면 판매액의 70% 추정)
        const cogs = costPrice > 0
          ? annualSalesQty * costPrice
          : annualSalesAmount * 0.7;

        // 평균재고금액 = 현재재고 × 원가 (원가 없으면 판매단가의 70%)
        const effectiveCost = costPrice > 0 ? costPrice : unitPrice * 0.7;
        const avgInventoryValue = currentStock * effectiveCost;

        // 회전율 계산 (재고금액이 0이면 판매가 없는 것으로 간주)
        let turnoverRate = 0;
        let daysOfInventory = 999;

        if (avgInventoryValue > 0 && cogs > 0) {
          turnoverRate = cogs / avgInventoryValue;
          daysOfInventory = 365 / turnoverRate;
        } else if (cogs > 0 && avgInventoryValue === 0) {
          // 재고 0인데 판매가 있으면 → 매우 높은 회전율
          turnoverRate = 999;
          daysOfInventory = 0;
        }

        items.push({
          id: row.productId,
          sku: row.sku,
          name: row.name,
          annualRevenue: annualSalesAmount,
          cogs: Math.round(cogs),
          avgInventoryValue: Math.round(avgInventoryValue),
          turnoverRate: Math.round(turnoverRate * 10) / 10,
          daysOfInventory: Math.round(daysOfInventory),
          status: classifyTurnoverStatus(turnoverRate),
        });
      }

      // 통계 계산 (회전율 999인 항목 제외)
      const validItems = items.filter((i) => i.turnoverRate < 999 && i.turnoverRate > 0);
      const avgTurnoverRate = validItems.length > 0
        ? validItems.reduce((s, i) => s + i.turnoverRate, 0) / validItems.length
        : 0;
      const avgDOI = validItems.length > 0
        ? validItems.reduce((s, i) => s + i.daysOfInventory, 0) / validItems.length
        : 0;
      const lowTurnoverCount = items.filter(
        (i) => i.status === "low" || i.status === "critical"
      ).length;

      // TOP5 빠름/느림 (유효 데이터만)
      const sorted = [...validItems].sort((a, b) => b.turnoverRate - a.turnoverRate);
      const top5Fastest = sorted.slice(0, 5);
      const top5Slowest = sorted.slice(-5).reverse();

      return {
        items,
        avgTurnoverRate: Math.round(avgTurnoverRate * 10) / 10,
        avgDaysOfInventory: Math.round(avgDOI),
        lowTurnoverCount,
        top5Fastest,
        top5Slowest,
      };
    },
    [`turnover-data-${orgId}`],
    { revalidate: 120, tags: [`turnover-${orgId}`] }
  )();
}
