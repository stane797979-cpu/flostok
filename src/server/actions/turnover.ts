"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { products, inventory, salesRecords, inventoryHistory } from "@/server/db/schema";
import { eq, and, sql, isNotNull, lt } from "drizzle-orm";
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
  periodLabel: string;
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
      periodLabel: "",
    };
  }

  return unstable_cache(
    async () => {
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      // ── 쿼리 1: 전체 제품별 판매/재고 데이터 (전체 items 목록용) ──
      // 판매 집계 서브쿼리 (상관 서브쿼리 제거 → JOIN으로 처리)
      const salesAgg = db
        .select({
          productId: salesRecords.productId,
          totalQty: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)`.as('total_qty'),
          totalAmount: sql<number>`coalesce(sum(${salesRecords.totalAmount}), 0)`.as('total_amount'),
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

      // ── 쿼리 2 (병렬): inventoryHistory 출고 집계 (salesRecords 보충용)
      //   - change_amount < 0 partial index 활용 (inventory_history_org_product_outbound_idx)
      //   - Drizzle lt() 연산자 사용
      const [rows, outboundHistoryRows] = await Promise.all([
        db
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
          ),
        db
          .select({
            productId: inventoryHistory.productId,
            totalQty: sql<number>`coalesce(sum(abs(${inventoryHistory.changeAmount})), 0)`.as('total_qty'),
          })
          .from(inventoryHistory)
          .where(
            and(
              eq(inventoryHistory.organizationId, orgId),
              sql`${inventoryHistory.date} >= ${oneYearAgoStr}`,
              sql`${inventoryHistory.date} <= ${todayStr}`,
              lt(inventoryHistory.changeAmount, 0) // partial index 활용
            )
          )
          .groupBy(inventoryHistory.productId),
      ]);

      // inventoryHistory 출고 집계 맵 (productId → totalQty)
      const outboundMap = new Map<string, number>();
      for (const row of outboundHistoryRows) {
        outboundMap.set(row.productId, Number(row.totalQty));
      }

      // 전체 items 목록 구성 + 통계 1회 순회 계산
      const items: TurnoverData[] = [];
      let sumTurnover = 0;
      let sumDOI = 0;
      let validCount = 0;
      let lowTurnoverCount = 0;

      for (const row of rows) {
        const costPrice = row.costPrice || 0;
        const unitPrice = row.unitPrice || 0;
        const currentStock = row.currentStock || 0;
        const salesQtyRaw = Number(row.annualSalesQty) || 0;
        const annualSalesAmount = Number(row.annualSalesAmount) || 0;

        // salesRecords에 데이터가 없는 제품은 inventoryHistory 출고 수량으로 보충
        const annualSalesQty = salesQtyRaw > 0
          ? salesQtyRaw
          : (outboundMap.get(row.productId) ?? 0);

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

        const status = classifyTurnoverStatus(turnoverRate);

        // 통계 누산 (999 제외, 양수만)
        if (turnoverRate > 0 && turnoverRate < 999) {
          sumTurnover += turnoverRate;
          sumDOI += daysOfInventory;
          validCount++;
        }
        if (status === "low" || status === "critical") {
          lowTurnoverCount++;
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
          status,
        });
      }

      const avgTurnoverRate = validCount > 0 ? sumTurnover / validCount : 0;
      const avgDOI = validCount > 0 ? sumDOI / validCount : 0;

      // ── TOP5 빠름/느림: DB 레벨에서 회전율 계산 후 LIMIT 5 ──
      // 회전율 공식: COGS / 평균재고금액
      //   - salesRecords 우선, 없으면 inventoryHistory 출고량 fallback
      //   - 유효 조건: 평균재고금액 > 0 AND COGS > 0 AND 회전율 < 999
      const top5Sql = sql<{
        id: string; sku: string; name: string;
        annual_revenue: number; cogs: number;
        avg_inventory_value: number; turnover_rate: number;
        days_of_inventory: number;
      }>`
        WITH sales_agg AS (
          SELECT
            product_id,
            COALESCE(SUM(quantity), 0)      AS total_qty,
            COALESCE(SUM(total_amount), 0)  AS total_amount
          FROM sales_records
          WHERE organization_id = ${orgId}
            AND date >= ${oneYearAgoStr}
            AND date <= ${todayStr}
          GROUP BY product_id
        ),
        outbound_agg AS (
          SELECT
            product_id,
            COALESCE(SUM(ABS(change_amount)), 0) AS total_qty
          FROM inventory_history
          WHERE organization_id = ${orgId}
            AND date >= ${oneYearAgoStr}
            AND date <= ${todayStr}
            AND change_amount < 0
          GROUP BY product_id
        ),
        turnover_calc AS (
          SELECT
            p.id,
            p.sku,
            p.name,
            COALESCE(p.cost_price, 0)                                               AS cost_price,
            COALESCE(p.unit_price, 0)                                               AS unit_price,
            COALESCE(inv.current_stock, 0)                                          AS current_stock,
            COALESCE(sa.total_qty, 0)                                               AS sales_qty,
            COALESCE(sa.total_amount, 0)                                            AS sales_amount,
            COALESCE(ob.total_qty, 0)                                               AS outbound_qty,
            -- 유효 원가 (원가 없으면 판매단가 × 0.7)
            CASE WHEN COALESCE(p.cost_price, 0) > 0
                 THEN p.cost_price::numeric
                 ELSE p.unit_price::numeric * 0.7
            END                                                                     AS effective_cost,
            -- 연간 판매수량 (salesRecords 우선, fallback: inventoryHistory 출고)
            CASE WHEN COALESCE(sa.total_qty, 0) > 0
                 THEN COALESCE(sa.total_qty, 0)
                 ELSE COALESCE(ob.total_qty, 0)
            END                                                                     AS annual_sales_qty
          FROM products p
          LEFT JOIN inventory inv ON p.id = inv.product_id
          LEFT JOIN sales_agg   sa ON p.id = sa.product_id
          LEFT JOIN outbound_agg ob ON p.id = ob.product_id
          WHERE p.organization_id = ${orgId}
            AND p.is_active IS NOT NULL
        ),
        with_turnover AS (
          SELECT
            id,
            sku,
            name,
            COALESCE(sales_amount, 0)                                               AS annual_revenue,
            -- COGS: 판매수량 × 원가, 원가 없으면 판매액 × 0.7
            CASE WHEN cost_price > 0
                 THEN annual_sales_qty * cost_price::numeric
                 ELSE sales_amount * 0.7
            END                                                                     AS cogs,
            -- 평균재고금액
            current_stock * effective_cost                                          AS avg_inventory_value,
            -- 회전율
            CASE
              WHEN current_stock * effective_cost > 0
               AND (CASE WHEN cost_price > 0
                         THEN annual_sales_qty * cost_price::numeric
                         ELSE sales_amount * 0.7 END) > 0
              THEN (CASE WHEN cost_price > 0
                         THEN annual_sales_qty * cost_price::numeric
                         ELSE sales_amount * 0.7 END)
                   / (current_stock * effective_cost)
              ELSE 0
            END                                                                     AS turnover_rate
          FROM turnover_calc
        )
        SELECT
          id,
          sku,
          name,
          ROUND(annual_revenue)                                          AS annual_revenue,
          ROUND(cogs)                                                    AS cogs,
          ROUND(avg_inventory_value)                                     AS avg_inventory_value,
          ROUND((turnover_rate * 10)::numeric) / 10                     AS turnover_rate,
          CASE WHEN turnover_rate > 0
               THEN ROUND(365 / turnover_rate)
               ELSE 999
          END                                                            AS days_of_inventory
        FROM with_turnover
        WHERE turnover_rate > 0
      `;

      function rowToTurnoverData(r: Record<string, unknown>): TurnoverData {
        const rate = Number(r.turnover_rate) || 0;
        const doi = Number(r.days_of_inventory) || 999;
        return {
          id: String(r.id),
          sku: String(r.sku),
          name: String(r.name),
          annualRevenue: Number(r.annual_revenue) || 0,
          cogs: Number(r.cogs) || 0,
          avgInventoryValue: Number(r.avg_inventory_value) || 0,
          turnoverRate: rate,
          daysOfInventory: doi,
          status: classifyTurnoverStatus(rate),
        };
      }

      // TOP5 빠름/느림: DB에서 회전율 계산 후 LIMIT 5 — 전체 정렬 비용 제거
      // postgres-js RowList는 배열 자체이므로 Array.from()으로 변환
      const [top5FastestRaw, top5SlowestRaw] = await Promise.all([
        db.execute(sql`${top5Sql} ORDER BY turnover_rate DESC LIMIT 5`),
        db.execute(sql`${top5Sql} ORDER BY turnover_rate ASC  LIMIT 5`),
      ]);

      const top5Fastest = Array.from(top5FastestRaw as unknown as Record<string, unknown>[]).map(rowToTurnoverData);
      const top5Slowest = Array.from(top5SlowestRaw as unknown as Record<string, unknown>[]).map(rowToTurnoverData);

      return {
        items,
        avgTurnoverRate: Math.round(avgTurnoverRate * 10) / 10,
        avgDaysOfInventory: Math.round(avgDOI),
        lowTurnoverCount,
        top5Fastest,
        top5Slowest,
        periodLabel: `${oneYearAgoStr} ~ ${todayStr} (최근 1년)`,
      };
    },
    [`turnover-data-${orgId}`],
    { revalidate: 120, tags: [`turnover-${orgId}`] }
  )();
}
