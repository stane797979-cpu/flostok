/**
 * AI 도구: 재고 관련 도구
 * Anthropic Claude Tool Calling 형식
 */

import { db } from "@/server/db";
import { inventory, products, salesRecords } from "@/server/db/schema";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { classifyInventoryStatus } from "@/server/services/scm/inventory-status";
import { calculateSafetyStock } from "@/server/services/scm/safety-stock";
import { getAverageDailySales } from "@/server/actions/sales";
import { getCurrentUser } from "@/server/actions/auth-helpers";

/**
 * 재고 상태 조회 도구 정의
 */
export const getInventoryStatusTool = {
  name: "get_inventory_status",
  description: `특정 제품 또는 전체 재고 상태를 조회합니다.
  - productId 제공 시: 해당 제품의 상세 재고 상태 반환
  - productId 미제공 시: 전체 재고 현황 요약 반환

  재고상태 7단계:
  - out_of_stock(품절): 현재고 = 0
  - critical(위험): 0 < 현재고 < 안전재고 x 0.5
  - shortage(부족): 안전재고 x 0.5 <= 현재고 < 안전재고
  - caution(주의): 안전재고 <= 현재고 < 발주점
  - optimal(적정): 발주점 <= 현재고 < 안전재고 x 3
  - excess(과다): 안전재고 x 3 <= 현재고 < 안전재고 x 5
  - overstock(과잉): 현재고 >= 안전재고 x 5`,
  input_schema: {
    type: "object" as const,
    properties: {
      productId: {
        type: "string",
        description: "제품 ID (UUID). 미제공 시 전체 현황 조회",
      },
      sku: {
        type: "string",
        description: "제품 SKU 코드. productId 대신 사용 가능",
      },
      status: {
        type: "string",
        enum: [
          "out_of_stock",
          "critical",
          "shortage",
          "caution",
          "optimal",
          "excess",
          "overstock",
        ],
        description: "특정 상태의 제품만 필터링",
      },
      limit: {
        type: "number",
        description: "반환할 최대 제품 수 (기본값: 20)",
      },
    },
    required: [],
  },
};

/**
 * 재고 상태 조회 실행
 */
export async function executeGetInventoryStatus(input: {
  productId?: string;
  sku?: string;
  status?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: {
    summary?: {
      totalProducts: number;
      outOfStock: number;
      critical: number;
      shortage: number;
      caution: number;
      optimal: number;
      excess: number;
      overstock: number;
      totalValue: number;
      needsReorderCount: number;
    };
    product?: {
      id: string;
      sku: string;
      name: string;
      currentStock: number;
      safetyStock: number;
      reorderPoint: number;
      status: string;
      statusLabel: string;
      recommendation: string;
      daysOfStock: number | null;
      inventoryValue: number;
    };
    products?: Array<{
      id: string;
      sku: string;
      name: string;
      currentStock: number;
      status: string;
      statusLabel: string;
    }>;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "";

    const { productId, sku, status, limit = 20 } = input;

    // SKU로 제품 ID 조회
    let targetProductId = productId;
    if (!targetProductId && sku) {
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.sku, sku), eq(products.organizationId, orgId)))
        .limit(1);
      targetProductId = product?.id;
    }

    // 특정 제품 조회
    if (targetProductId) {
      const [result] = await db
        .select({
          product: products,
          inventory: inventory,
        })
        .from(products)
        .leftJoin(inventory, eq(products.id, inventory.productId))
        .where(and(eq(products.id, targetProductId), eq(products.organizationId, orgId)))
        .limit(1);

      if (!result) {
        return { success: false, error: "제품을 찾을 수 없습니다" };
      }

      const currentStock = result.inventory?.currentStock || 0;
      const safetyStock = result.product.safetyStock || 0;
      const reorderPoint = result.product.reorderPoint || 0;

      const statusResult = classifyInventoryStatus({
        currentStock,
        safetyStock,
        reorderPoint,
      });

      // 일평균 판매량으로 재고일수 계산
      const avgDailySales = await getAverageDailySales(targetProductId, 30);
      const daysOfStock =
        avgDailySales > 0 ? Math.floor(currentStock / avgDailySales) : null;

      const statusLabels: Record<string, string> = {
        out_of_stock: "품절",
        critical: "위험",
        shortage: "부족",
        caution: "주의",
        optimal: "적정",
        excess: "과다",
        overstock: "과잉",
      };

      return {
        success: true,
        data: {
          product: {
            id: result.product.id,
            sku: result.product.sku,
            name: result.product.name,
            currentStock,
            safetyStock,
            reorderPoint,
            status: statusResult.key,
            statusLabel: statusLabels[statusResult.key] || statusResult.key,
            recommendation: statusResult.recommendation,
            daysOfStock,
            inventoryValue: currentStock * (result.product.costPrice || 0),
          },
        },
      };
    }

    // 전체 현황 조회
    const conditions = [eq(inventory.organizationId, orgId)];
    if (status) {
      conditions.push(
        eq(inventory.status, status as (typeof inventory.status.enumValues)[number])
      );
    }

    // 상태별 집계
    const statusAggregation = await db
      .select({
        status: inventory.status,
        count: sql<number>`count(*)`,
        totalValue: sql<number>`sum(${inventory.inventoryValue})`,
      })
      .from(inventory)
      .where(eq(inventory.organizationId, orgId))
      .groupBy(inventory.status);

    const summary = {
      totalProducts: 0,
      outOfStock: 0,
      critical: 0,
      shortage: 0,
      caution: 0,
      optimal: 0,
      excess: 0,
      overstock: 0,
      totalValue: 0,
      needsReorderCount: 0,
    };

    statusAggregation.forEach((row) => {
      const count = Number(row.count);
      summary.totalProducts += count;
      summary.totalValue += Number(row.totalValue || 0);

      switch (row.status) {
        case "out_of_stock":
          summary.outOfStock = count;
          summary.needsReorderCount += count;
          break;
        case "critical":
          summary.critical = count;
          summary.needsReorderCount += count;
          break;
        case "shortage":
          summary.shortage = count;
          summary.needsReorderCount += count;
          break;
        case "caution":
          summary.caution = count;
          summary.needsReorderCount += count;
          break;
        case "optimal":
          summary.optimal = count;
          break;
        case "excess":
          summary.excess = count;
          break;
        case "overstock":
          summary.overstock = count;
          break;
      }
    });

    // 제품 목록 조회 (필터 적용)
    const productList = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        currentStock: inventory.currentStock,
        status: inventory.status,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(inventory.updatedAt))
      .limit(limit);

    const statusLabels: Record<string, string> = {
      out_of_stock: "품절",
      critical: "위험",
      shortage: "부족",
      caution: "주의",
      optimal: "적정",
      excess: "과다",
      overstock: "과잉",
    };

    return {
      success: true,
      data: {
        summary,
        products: productList.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          currentStock: p.currentStock || 0,
          status: p.status || "optimal",
          statusLabel: statusLabels[p.status || "optimal"] || p.status || "적정",
        })),
      },
    };
  } catch (error) {
    console.error("재고 상태 조회 오류:", error);
    return { success: false, error: "재고 상태 조회에 실패했습니다" };
  }
}

/**
 * 안전재고 계산 도구 정의
 */
export const calculateSafetyStockTool = {
  name: "calculate_safety_stock",
  description: `제품의 안전재고를 계산합니다.

  계산 공식:
  - 전체 공식: SS = Z x sqrt(LT x sigma_d^2 + d^2 x sigma_LT^2)
  - 단순화 공식 (리드타임 변동 무시): SS = Z x sigma_d x sqrt(LT)

  여기서:
  - Z: 서비스 레벨에 대응하는 Z값 (95% = 1.65)
  - LT: 평균 리드타임 (일)
  - sigma_d: 일별 수요 표준편차
  - d: 일평균 수요
  - sigma_LT: 리드타임 표준편차`,
  input_schema: {
    type: "object" as const,
    properties: {
      productId: {
        type: "string",
        description: "제품 ID (UUID)",
      },
      sku: {
        type: "string",
        description: "제품 SKU 코드. productId 대신 사용 가능",
      },
      serviceLevel: {
        type: "number",
        description: "서비스 레벨 (0.9 ~ 0.999, 기본값: 0.95)",
      },
      periodDays: {
        type: "number",
        description: "평균 계산에 사용할 기간 (일, 기본값: 90)",
      },
    },
    required: [],
  },
};

/**
 * 안전재고 계산 실행
 */
export async function executeCalculateSafetyStock(input: {
  productId?: string;
  sku?: string;
  serviceLevel?: number;
  periodDays?: number;
}): Promise<{
  success: boolean;
  data?: {
    productId: string;
    sku: string;
    productName: string;
    calculatedSafetyStock: number;
    currentSafetyStock: number;
    serviceLevel: number;
    zScore: number;
    method: string;
    inputs: {
      avgDailySales: number;
      demandStdDev: number;
      leadTimeDays: number;
    };
    recommendation: string;
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || "";

    const { productId: inputProductId, sku, serviceLevel = 0.95, periodDays = 90 } = input;

    // 제품 ID 확인
    let productId = inputProductId;
    if (!productId && sku) {
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.sku, sku), eq(products.organizationId, orgId)))
        .limit(1);
      productId = product?.id;
    }

    if (!productId) {
      return { success: false, error: "제품 ID 또는 SKU가 필요합니다" };
    }

    // 제품 정보 조회
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.organizationId, orgId)))
      .limit(1);

    if (!product) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    // 판매 이력 조회
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const salesData = await db
      .select({
        date: salesRecords.date,
        quantity: sql<number>`sum(${salesRecords.quantity})`,
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          eq(salesRecords.productId, productId),
          gte(salesRecords.date, startDate.toISOString().split("T")[0]),
          lte(salesRecords.date, endDate.toISOString().split("T")[0])
        )
      )
      .groupBy(salesRecords.date);

    // 일별 판매량 배열 생성
    const dailySales = salesData.map((s) => Number(s.quantity));

    // 평균 및 표준편차 계산
    const avgDailySales =
      dailySales.length > 0
        ? dailySales.reduce((sum, v) => sum + v, 0) / periodDays
        : 0;

    const demandStdDev =
      dailySales.length > 1
        ? Math.sqrt(
            dailySales.reduce((sum, v) => sum + Math.pow(v - avgDailySales, 2), 0) /
              dailySales.length
          )
        : avgDailySales * 0.3; // 데이터 부족 시 평균의 30%

    const leadTimeDays = product.leadTime || 7;

    // 안전재고 계산
    const result = calculateSafetyStock({
      averageDailyDemand: avgDailySales,
      demandStdDev,
      leadTimeDays,
      serviceLevel,
    });

    // 권장사항 생성
    let recommendation = "";
    if (result.safetyStock > (product.safetyStock || 0)) {
      recommendation = `현재 안전재고(${product.safetyStock || 0}개)보다 높은 ${result.safetyStock}개를 권장합니다. 서비스 레벨 ${(serviceLevel * 100).toFixed(0)}% 달성을 위해 안전재고 상향 조정을 검토하세요.`;
    } else if (result.safetyStock < (product.safetyStock || 0)) {
      recommendation = `현재 안전재고(${product.safetyStock || 0}개)가 계산값(${result.safetyStock}개)보다 높습니다. 재고 비용 절감을 위해 안전재고 하향 조정을 검토할 수 있습니다.`;
    } else {
      recommendation = "현재 안전재고가 적정 수준입니다.";
    }

    return {
      success: true,
      data: {
        productId,
        sku: product.sku,
        productName: product.name,
        calculatedSafetyStock: result.safetyStock,
        currentSafetyStock: product.safetyStock || 0,
        serviceLevel: result.serviceLevel,
        zScore: result.zScore,
        method: result.method === "full" ? "전체 공식" : "단순화 공식",
        inputs: {
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          demandStdDev: Math.round(demandStdDev * 100) / 100,
          leadTimeDays,
        },
        recommendation,
      },
    };
  } catch (error) {
    console.error("안전재고 계산 오류:", error);
    return { success: false, error: "안전재고 계산에 실패했습니다" };
  }
}
