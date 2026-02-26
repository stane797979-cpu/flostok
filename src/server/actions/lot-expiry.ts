"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { inventoryLots, products, warehouses } from "@/server/db/schema";
import { eq, and, sql, isNotNull, gt } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";

export interface ExpiryCategory {
  label: string; // "만료됨", "7일 이내", "30일 이내", "안전"
  count: number;
  totalQty: number;
  estimatedLoss: number; // 잔여수량 × 원가
}

export interface ExpiringLot {
  lotNumber: string;
  productId: string;
  sku: string;
  productName: string;
  warehouseName: string;
  expiryDate: string;
  daysUntilExpiry: number; // 음수 = 이미 만료
  remainingQty: number;
  estimatedLoss: number;
  urgency: "expired" | "critical" | "warning" | "safe";
}

export interface LotExpirySummary {
  categories: ExpiryCategory[];
  expiringLots: ExpiringLot[]; // 만료됨 + 30일 이내만
  totalAtRiskValue: number;
  periodLabel: string;
}

function getUrgency(days: number): ExpiringLot["urgency"] {
  if (days < 0) return "expired";
  if (days <= 7) return "critical";
  if (days <= 30) return "warning";
  return "safe";
}

function getCategoryLabel(days: number): string {
  if (days < 0) return "만료됨";
  if (days <= 7) return "7일 이내";
  if (days <= 30) return "30일 이내";
  return "안전";
}

async function _getLotExpirySummaryInternal(orgId: string): Promise<LotExpirySummary> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // inventoryLots에서 expiryDate IS NOT NULL AND remainingQuantity > 0 조회
  // JOIN products (sku, name, unitPrice, costPrice)
  // JOIN warehouses (name)
  const rows = await db
    .select({
      lotNumber: inventoryLots.lotNumber,
      productId: inventoryLots.productId,
      expiryDate: inventoryLots.expiryDate,
      remainingQuantity: inventoryLots.remainingQuantity,
      sku: products.sku,
      productName: products.name,
      unitPrice: products.unitPrice,
      costPrice: products.costPrice,
      warehouseName: warehouses.name,
    })
    .from(inventoryLots)
    .innerJoin(products, eq(inventoryLots.productId, products.id))
    .innerJoin(warehouses, eq(inventoryLots.warehouseId, warehouses.id))
    .where(
      and(
        eq(inventoryLots.organizationId, orgId),
        eq(inventoryLots.status, "active"),
        isNotNull(inventoryLots.expiryDate),
        gt(inventoryLots.remainingQuantity, 0)
      )
    )
    .orderBy(sql`${inventoryLots.expiryDate} ASC`);

  if (rows.length === 0) {
    return {
      categories: [],
      expiringLots: [],
      totalAtRiskValue: 0,
      periodLabel: `${todayStr} 기준`,
    };
  }

  // daysUntilExpiry 계산 + 분류
  const categoryMap = new Map<string, ExpiryCategory>([
    ["만료됨",    { label: "만료됨",    count: 0, totalQty: 0, estimatedLoss: 0 }],
    ["7일 이내",  { label: "7일 이내",  count: 0, totalQty: 0, estimatedLoss: 0 }],
    ["30일 이내", { label: "30일 이내", count: 0, totalQty: 0, estimatedLoss: 0 }],
    ["안전",      { label: "안전",      count: 0, totalQty: 0, estimatedLoss: 0 }],
  ]);

  const allLots: ExpiringLot[] = [];

  for (const row of rows) {
    if (!row.expiryDate) continue;

    const expiryDateObj = new Date(row.expiryDate);
    const diffMs = expiryDateObj.getTime() - today.getTime();
    const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const remainingQty = row.remainingQuantity ?? 0;
    const costPrice = row.costPrice ?? 0;
    const unitPrice = row.unitPrice ?? 0;
    const effectivePrice = costPrice > 0 ? costPrice : unitPrice;
    const estimatedLoss = remainingQty * effectivePrice;

    const urgency = getUrgency(daysUntilExpiry);
    const categoryLabel = getCategoryLabel(daysUntilExpiry);

    const lot: ExpiringLot = {
      lotNumber: row.lotNumber,
      productId: row.productId,
      sku: row.sku,
      productName: row.productName,
      warehouseName: row.warehouseName,
      expiryDate: row.expiryDate,
      daysUntilExpiry,
      remainingQty,
      estimatedLoss,
      urgency,
    };

    allLots.push(lot);

    const cat = categoryMap.get(categoryLabel)!;
    cat.count += 1;
    cat.totalQty += remainingQty;
    cat.estimatedLoss += estimatedLoss;
  }

  // 만료됨 + 30일 이내만 expiringLots에 포함 (만료일 오름차순)
  const expiringLots = allLots.filter((l) => l.urgency !== "safe");

  // 위험 금액 합산 (만료됨 + 7일 이내 + 30일 이내)
  const totalAtRiskValue = expiringLots.reduce((s, l) => s + l.estimatedLoss, 0);

  const categories = Array.from(categoryMap.values());

  return {
    categories,
    expiringLots,
    totalAtRiskValue,
    periodLabel: `${todayStr} 기준`,
  };
}

/**
 * 유통기한 만료 알림 데이터 조회 (60초 캐시)
 */
export async function getLotExpirySummary(): Promise<LotExpirySummary> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;

  if (!orgId) {
    return {
      categories: [],
      expiringLots: [],
      totalAtRiskValue: 0,
      periodLabel: "데이터 없음",
    };
  }

  return unstable_cache(
    () => _getLotExpirySummaryInternal(orgId),
    [`lot-expiry-${orgId}`],
    { revalidate: 60, tags: [`analytics-${orgId}`, `lot-expiry-${orgId}`] }
  )();
}
