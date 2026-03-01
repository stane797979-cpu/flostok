"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { products, inventory, inventoryHistory } from "@/server/db/schema";
import { eq, and, sql, isNotNull, isNull, gt, gte } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";

export interface AgingProduct {
  productId: string;
  sku: string;
  name: string;
  currentStock: number;
  unitPrice: number;
  inventoryValue: number;
  lastOutboundDate: string | null;  // 마지막 출고일
  daysSinceLastOutbound: number;    // 마지막 출고 이후 일수
  isDeadStock: boolean;             // 180일+ = 사장재고
  recommendation: string;           // "할인 판매", "반품 검토", "폐기 검토"
}

export interface AgingCohort {
  label: string;           // "0~30일", "31~60일", "61~90일", "91~180일", "180일+"
  productCount: number;
  totalValue: number;      // 재고 금액
  products: AgingProduct[];
}

export interface AgingSummary {
  cohorts: AgingCohort[];
  totalDeadStockCount: number;
  totalDeadStockValue: number;
  averageDaysHeld: number;
  periodLabel: string;
}

function getRecommendation(days: number): string {
  if (days >= 365) return "반품/폐기 검토";
  if (days >= 180) return "할인 판매 검토";
  if (days >= 91) return "판매 촉진 검토";
  return "정상 관리";
}

function classifyToCohort(days: number): string {
  if (days <= 30) return "0~30일";
  if (days <= 60) return "31~60일";
  if (days <= 90) return "61~90일";
  if (days <= 180) return "91~180일";
  return "180일+";
}

async function _getInventoryAgingInternal(orgId: string): Promise<AgingSummary> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 1. 현재 재고가 있는 모든 활성 제품 조회
  const productRows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
      createdAt: products.createdAt,
      currentStock: inventory.currentStock,
    })
    .from(products)
    .innerJoin(inventory, eq(products.id, inventory.productId))
    .where(
      and(
        eq(products.organizationId, orgId),
        isNotNull(products.isActive),
        isNull(products.deletedAt),
        gt(inventory.currentStock, 0)
      )
    );

  if (productRows.length === 0) {
    return {
      cohorts: [],
      totalDeadStockCount: 0,
      totalDeadStockValue: 0,
      averageDaysHeld: 0,
      periodLabel: `${todayStr} 기준`,
    };
  }

  // 2. 각 제품의 마지막 출고일 조회 (change_amount < 0)
  //    불필요한 풀스캔 방지: 최근 2년 데이터만 조회
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const twoYearsAgoStr = twoYearsAgo.toISOString().split("T")[0];

  const lastOutboundRows = await db
    .select({
      productId: inventoryHistory.productId,
      lastOutboundDate: sql<string>`max(${inventoryHistory.date})`.as("last_outbound_date"),
    })
    .from(inventoryHistory)
    .where(
      and(
        eq(inventoryHistory.organizationId, orgId),
        sql`${inventoryHistory.changeAmount} < 0`,
        gte(inventoryHistory.date, twoYearsAgoStr)
      )
    )
    .groupBy(inventoryHistory.productId);

  // productId → lastOutboundDate 맵
  const lastOutboundMap = new Map<string, string>();
  for (const row of lastOutboundRows) {
    lastOutboundMap.set(row.productId, row.lastOutboundDate as string);
  }

  // 3. 에이징 계산
  const agingProducts: AgingProduct[] = [];

  for (const row of productRows) {
    const currentStock = row.currentStock ?? 0;
    if (currentStock <= 0) continue;

    const unitPrice = row.unitPrice ?? 0;
    const costPrice = row.costPrice ?? 0;
    const effectivePrice = costPrice > 0 ? costPrice : unitPrice;
    const inventoryValue = currentStock * effectivePrice;

    const lastOutboundDate = lastOutboundMap.get(row.productId) ?? null;

    let daysSinceLastOutbound: number;
    if (lastOutboundDate) {
      const lastDate = new Date(lastOutboundDate);
      const diff = today.getTime() - lastDate.getTime();
      daysSinceLastOutbound = Math.floor(diff / (1000 * 60 * 60 * 24));
    } else {
      // 출고 이력이 없는 경우 제품 생성일 기준
      const createdDate = new Date(row.createdAt);
      const diff = today.getTime() - createdDate.getTime();
      daysSinceLastOutbound = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    const isDeadStock = daysSinceLastOutbound >= 180;

    agingProducts.push({
      productId: row.productId,
      sku: row.sku,
      name: row.name,
      currentStock,
      unitPrice,
      inventoryValue,
      lastOutboundDate,
      daysSinceLastOutbound,
      isDeadStock,
      recommendation: getRecommendation(daysSinceLastOutbound),
    });
  }

  // 4. 코호트 분류
  const cohortMap = new Map<string, AgingCohort>([
    ["0~30일",   { label: "0~30일",   productCount: 0, totalValue: 0, products: [] }],
    ["31~60일",  { label: "31~60일",  productCount: 0, totalValue: 0, products: [] }],
    ["61~90일",  { label: "61~90일",  productCount: 0, totalValue: 0, products: [] }],
    ["91~180일", { label: "91~180일", productCount: 0, totalValue: 0, products: [] }],
    ["180일+",   { label: "180일+",   productCount: 0, totalValue: 0, products: [] }],
  ]);

  for (const ap of agingProducts) {
    const label = classifyToCohort(ap.daysSinceLastOutbound);
    const cohort = cohortMap.get(label)!;
    cohort.productCount += 1;
    cohort.totalValue += ap.inventoryValue;
    cohort.products.push(ap);
  }

  // 각 코호트 내 제품 정렬 (경과일 내림차순)
  for (const cohort of cohortMap.values()) {
    cohort.products.sort((a, b) => b.daysSinceLastOutbound - a.daysSinceLastOutbound);
  }

  const cohorts = Array.from(cohortMap.values());

  // 5. 요약 통계
  const deadStockProducts = agingProducts.filter((p) => p.isDeadStock);
  const totalDeadStockCount = deadStockProducts.length;
  const totalDeadStockValue = deadStockProducts.reduce((s, p) => s + p.inventoryValue, 0);

  const averageDaysHeld =
    agingProducts.length > 0
      ? Math.round(
          agingProducts.reduce((s, p) => s + p.daysSinceLastOutbound, 0) / agingProducts.length
        )
      : 0;

  return {
    cohorts,
    totalDeadStockCount,
    totalDeadStockValue,
    averageDaysHeld,
    periodLabel: `${todayStr} 기준`,
  };
}

/**
 * 재고 에이징/사장재고 분석 데이터 조회 (120초 캐시)
 */
export async function getInventoryAgingData(): Promise<AgingSummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) {
    return {
      cohorts: [],
      totalDeadStockCount: 0,
      totalDeadStockValue: 0,
      averageDaysHeld: 0,
      periodLabel: "데이터 없음",
    };
  }

  return unstable_cache(
    () => _getInventoryAgingInternal(orgId),
    [`inventory-aging-${orgId}`],
    { revalidate: 120, tags: [`analytics-${orgId}`, `aging-${orgId}`] }
  )();
}
