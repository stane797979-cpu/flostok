/**
 * AI 도구: 분석 관련 도구
 * Anthropic Claude Tool Calling 형식
 */

import { db } from "@/server/db";
import { products, salesRecords } from "@/server/db/schema";
import { eq, and, sql, gte, lte, asc } from "drizzle-orm";
import {
  performABCAnalysis,
  performXYZAnalysis,
  combineABCXYZ,
  type ABCAnalysisItem,
  type XYZAnalysisItem,
} from "@/server/services/scm/abc-xyz-analysis";
import { simpleForecast, backtestForecast } from "@/server/services/scm/demand-forecast";

// TODO: 인증 구현 후 실제 organizationId로 교체
const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * ABC-XYZ 분석 결과 조회 도구 정의
 */
export const getABCXYZAnalysisTool = {
  name: "get_abcxyz_analysis",
  description: `제품의 ABC-XYZ 분석 결과를 조회합니다.

  ABC 등급 (매출 기여도):
  - A등급: 상위 80% 매출 (핵심 품목, 집중 관리)
  - B등급: 80-95% 매출 (중요 품목, 표준 관리)
  - C등급: 95-100% 매출 (일반 품목, 최소 관리)

  XYZ 등급 (수요 변동성, CV = 변동계수):
  - X등급: CV < 0.5 (안정적, 예측 쉬움)
  - Y등급: 0.5 <= CV < 1.0 (변동적)
  - Z등급: CV >= 1.0 (불규칙, 예측 어려움)

  복합 등급 (9가지):
  - AX: 고가치 + 안정 -> JIT 공급, 자동 발주
  - AY: 고가치 + 변동 -> 정기 발주, 수요예측 정교화
  - AZ: 고가치 + 불안정 -> 높은 안전재고, 공급자 협력
  - BX, BY, BZ: 중가치 품목별 전략
  - CX, CY, CZ: 저가치 품목 최소 관리`,
  input_schema: {
    type: "object" as const,
    properties: {
      periodMonths: {
        type: "number",
        description: "분석 기간 (개월, 기본값: 6)",
      },
      abcGrade: {
        type: "string",
        enum: ["A", "B", "C"],
        description: "특정 ABC 등급만 필터링",
      },
      xyzGrade: {
        type: "string",
        enum: ["X", "Y", "Z"],
        description: "특정 XYZ 등급만 필터링",
      },
      combinedGrade: {
        type: "string",
        description: "특정 복합 등급만 필터링 (예: AX, BY, CZ)",
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
 * ABC-XYZ 분석 결과 조회 실행
 */
export async function executeGetABCXYZAnalysis(input: {
  periodMonths?: number;
  abcGrade?: "A" | "B" | "C";
  xyzGrade?: "X" | "Y" | "Z";
  combinedGrade?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  data?: {
    summary: {
      totalProducts: number;
      byABC: Record<string, number>;
      byXYZ: Record<string, number>;
      matrix: Array<{
        grade: string;
        count: number;
        percentage: number;
        strategy: string;
      }>;
    };
    products: Array<{
      id: string;
      sku: string;
      name: string;
      abcGrade: string;
      xyzGrade: string;
      combinedGrade: string;
      totalSales: number;
      avgMonthlySales: number;
      cv: number;
      priority: number;
      strategy: string;
    }>;
    recommendations: string[];
  };
  error?: string;
}> {
  try {
    const { periodMonths = 6, abcGrade, xyzGrade, combinedGrade, limit = 20 } = input;

    // 분석 기간 계산
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodMonths);

    // 제품별 월별 판매 데이터 조회
    const salesData = await db
      .select({
        productId: salesRecords.productId,
        sku: products.sku,
        name: products.name,
        month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
        totalAmount: sql<number>`sum(${salesRecords.totalAmount})`,
        totalQuantity: sql<number>`sum(${salesRecords.quantity})`,
      })
      .from(salesRecords)
      .innerJoin(products, eq(salesRecords.productId, products.id))
      .where(
        and(
          eq(salesRecords.organizationId, TEMP_ORG_ID),
          gte(salesRecords.date, startDate.toISOString().split("T")[0]),
          lte(salesRecords.date, endDate.toISOString().split("T")[0])
        )
      )
      .groupBy(salesRecords.productId, products.sku, products.name, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
      .orderBy(salesRecords.productId, asc(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`));

    // 제품별 데이터 집계
    const productDataMap = new Map<
      string,
      {
        id: string;
        sku: string;
        name: string;
        totalSales: number;
        monthlyQuantities: number[];
      }
    >();

    salesData.forEach((row) => {
      const existing = productDataMap.get(row.productId);
      if (existing) {
        existing.totalSales += Number(row.totalAmount || 0);
        existing.monthlyQuantities.push(Number(row.totalQuantity || 0));
      } else {
        productDataMap.set(row.productId, {
          id: row.productId,
          sku: row.sku,
          name: row.name,
          totalSales: Number(row.totalAmount || 0),
          monthlyQuantities: [Number(row.totalQuantity || 0)],
        });
      }
    });

    // 판매 데이터 없는 제품도 포함 (판매 0)
    const allProducts = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
      })
      .from(products)
      .where(
        and(eq(products.organizationId, TEMP_ORG_ID), sql`${products.isActive} IS NOT NULL`)
      );

    allProducts.forEach((p) => {
      if (!productDataMap.has(p.id)) {
        productDataMap.set(p.id, {
          id: p.id,
          sku: p.sku,
          name: p.name,
          totalSales: 0,
          monthlyQuantities: [],
        });
      }
    });

    const productDataArray = Array.from(productDataMap.values());

    // ABC 분석 수행
    const abcItems: ABCAnalysisItem[] = productDataArray.map((p) => ({
      id: p.id,
      name: p.name,
      value: p.totalSales,
    }));
    const abcResults = performABCAnalysis(abcItems);

    // XYZ 분석 수행
    const xyzItems: XYZAnalysisItem[] = productDataArray.map((p) => ({
      id: p.id,
      name: p.name,
      demandHistory: p.monthlyQuantities.length > 0 ? p.monthlyQuantities : [0],
    }));
    const xyzResults = performXYZAnalysis(xyzItems);

    // ABC-XYZ 결합
    const combinedResults = combineABCXYZ(abcResults, xyzResults);

    // 필터링
    let filteredResults = combinedResults;
    if (abcGrade) {
      filteredResults = filteredResults.filter((r) => r.abcGrade === abcGrade);
    }
    if (xyzGrade) {
      filteredResults = filteredResults.filter((r) => r.xyzGrade === xyzGrade);
    }
    if (combinedGrade) {
      filteredResults = filteredResults.filter((r) => r.combinedGrade === combinedGrade);
    }

    // 우선순위 정렬
    filteredResults.sort((a, b) => a.priority - b.priority);

    // 집계
    const byABC: Record<string, number> = { A: 0, B: 0, C: 0 };
    const byXYZ: Record<string, number> = { X: 0, Y: 0, Z: 0 };
    const matrixCount: Record<string, number> = {};

    combinedResults.forEach((r) => {
      byABC[r.abcGrade] = (byABC[r.abcGrade] || 0) + 1;
      byXYZ[r.xyzGrade] = (byXYZ[r.xyzGrade] || 0) + 1;
      matrixCount[r.combinedGrade] = (matrixCount[r.combinedGrade] || 0) + 1;
    });

    const totalProducts = combinedResults.length;
    const matrixStrategies: Record<string, string> = {
      AX: "JIT 공급, 자동 발주, 높은 서비스레벨 유지",
      AY: "정기 발주, 수요예측 정교화, 안전재고 확보",
      AZ: "수요예측 개선, 공급자 협력, 높은 안전재고",
      BX: "정기 발주, 적정 재고 유지",
      BY: "주기적 검토, 표준 안전재고",
      BZ: "수요패턴 분석, 발주 주기 조정",
      CX: "대량 발주, 낮은 발주빈도",
      CY: "간헐적 검토, 최소 재고 유지",
      CZ: "주문생산 검토, 재고 최소화 또는 폐기",
    };

    // XYZ CV 값 매핑
    const xyzCVMap = new Map(xyzResults.map((r) => [r.id, r.coefficientOfVariation]));
    const productSalesMap = new Map(
      productDataArray.map((p) => [p.id, { totalSales: p.totalSales, avgMonthly: p.totalSales / periodMonths }])
    );

    // 권장사항 생성
    const recommendations: string[] = [];
    const azCount = matrixCount["AZ"] || 0;
    const axCount = matrixCount["AX"] || 0;

    if (azCount > 0) {
      recommendations.push(
        `AZ등급 품목이 ${azCount}개 있습니다. 이는 고가치이지만 수요가 불안정한 품목으로, 공급자와 긴밀한 협력 및 높은 안전재고가 필요합니다.`
      );
    }
    if (axCount > 0) {
      recommendations.push(
        `AX등급 품목 ${axCount}개는 JIT 공급 및 자동 발주 시스템 도입을 권장합니다.`
      );
    }
    if (byABC["C"] > totalProducts * 0.5) {
      recommendations.push(
        `C등급 품목이 전체의 ${Math.round((byABC["C"] / totalProducts) * 100)}%를 차지합니다. 재고 최적화를 위해 저성과 품목 정리를 검토하세요.`
      );
    }

    return {
      success: true,
      data: {
        summary: {
          totalProducts,
          byABC,
          byXYZ,
          matrix: Object.entries(matrixCount)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([grade, count]) => ({
              grade,
              count,
              percentage: Math.round((count / totalProducts) * 100),
              strategy: matrixStrategies[grade] || "전략 미정의",
            })),
        },
        products: filteredResults.slice(0, limit).map((r) => ({
          id: r.id,
          sku: productDataMap.get(r.id)?.sku || "",
          name: r.name,
          abcGrade: r.abcGrade,
          xyzGrade: r.xyzGrade,
          combinedGrade: r.combinedGrade,
          totalSales: productSalesMap.get(r.id)?.totalSales || 0,
          avgMonthlySales: Math.round((productSalesMap.get(r.id)?.avgMonthly || 0) * 100) / 100,
          cv: xyzCVMap.get(r.id) || 0,
          priority: r.priority,
          strategy: r.strategy,
        })),
        recommendations,
      },
    };
  } catch (error) {
    console.error("ABC-XYZ 분석 오류:", error);
    return { success: false, error: "ABC-XYZ 분석에 실패했습니다" };
  }
}

/**
 * 수요 예측 도구 정의
 */
export const getDemandForecastTool = {
  name: "get_demand_forecast",
  description: `제품의 미래 수요를 예측합니다.

  예측 방법:
  - SMA (단순이동평균): 단기 예측에 적합, 안정적인 수요 패턴
  - SES (단순지수평활): 중기 예측, 최근 데이터에 가중치
  - Holt's Method: 트렌드가 있는 데이터에 적합

  정확도 지표:
  - MAPE (Mean Absolute Percentage Error): < 10% 우수, 10-20% 양호, > 20% 보통
  - MAE (Mean Absolute Error): 절대 오차 평균
  - RMSE (Root Mean Square Error): 큰 오차에 민감`,
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
      periods: {
        type: "number",
        description: "예측할 기간 수 (기본값: 3개월)",
      },
      historyMonths: {
        type: "number",
        description: "사용할 과거 데이터 개월 수 (기본값: 12)",
      },
    },
    required: [],
  },
};

/**
 * 수요 예측 실행
 */
export async function executeGetDemandForecast(input: {
  productId?: string;
  sku?: string;
  periods?: number;
  historyMonths?: number;
}): Promise<{
  success: boolean;
  data?: {
    productId: string;
    sku: string;
    productName: string;
    forecast: {
      method: string;
      methodDescription: string;
      periods: Array<{
        period: number;
        label: string;
        predictedQuantity: number;
      }>;
      totalForecast: number;
      avgMonthlyForecast: number;
    };
    accuracy: {
      mape: number;
      mapeLabel: string;
      mae: number;
      confidence: string;
    };
    historicalData: {
      avgMonthlySales: number;
      trend: "increasing" | "decreasing" | "stable";
      seasonality: boolean;
    };
    recommendation: string;
  };
  error?: string;
}> {
  try {
    const { productId: inputProductId, sku, periods = 3, historyMonths = 12 } = input;

    // 제품 ID 확인
    let productId = inputProductId;
    if (!productId && sku) {
      const [product] = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.sku, sku), eq(products.organizationId, TEMP_ORG_ID)))
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
      .where(and(eq(products.id, productId), eq(products.organizationId, TEMP_ORG_ID)))
      .limit(1);

    if (!product) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    // 월별 판매 이력 조회
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - historyMonths);

    const monthlySales = await db
      .select({
        month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
        totalQuantity: sql<number>`sum(${salesRecords.quantity})`,
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, TEMP_ORG_ID),
          eq(salesRecords.productId, productId),
          gte(salesRecords.date, startDate.toISOString().split("T")[0]),
          lte(salesRecords.date, endDate.toISOString().split("T")[0])
        )
      )
      .groupBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
      .orderBy(asc(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`));

    if (monthlySales.length < 3) {
      return {
        success: false,
        error: "수요 예측에 필요한 충분한 판매 이력이 없습니다 (최소 3개월 필요)",
      };
    }

    const history = monthlySales.map((row) => Number(row.totalQuantity || 0));

    // 예측 실행
    const forecastValues = simpleForecast(history, periods, product.xyzGrade || undefined);

    // 백테스팅으로 정확도 측정
    const accuracy = backtestForecast(history, Math.min(3, Math.floor(history.length / 2)));

    // 트렌드 분석
    let trend: "increasing" | "decreasing" | "stable" = "stable";
    if (history.length >= 3) {
      const firstHalf = history.slice(0, Math.floor(history.length / 2));
      const secondHalf = history.slice(Math.floor(history.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (secondAvg > firstAvg * 1.1) {
        trend = "increasing";
      } else if (secondAvg < firstAvg * 0.9) {
        trend = "decreasing";
      }
    }

    const avgMonthlySales =
      history.reduce((a, b) => a + b, 0) / history.length;
    const totalForecast = forecastValues.reduce((a, b) => a + b, 0);

    // MAPE 라벨
    let mapeLabel = "보통";
    if (accuracy.mape < 10) {
      mapeLabel = "매우 우수";
    } else if (accuracy.mape < 20) {
      mapeLabel = "양호";
    } else if (accuracy.mape < 50) {
      mapeLabel = "보통";
    } else {
      mapeLabel = "부적합";
    }

    // 권장사항 생성
    let recommendation = "";
    if (trend === "increasing") {
      recommendation = `판매량이 증가 추세입니다. 향후 ${periods}개월간 총 ${Math.round(totalForecast)}개의 수요가 예상됩니다. 안전재고 및 발주점 상향 조정을 검토하세요.`;
    } else if (trend === "decreasing") {
      recommendation = `판매량이 감소 추세입니다. 재고 과잉에 주의하고, 안전재고 하향 조정을 검토하세요.`;
    } else {
      recommendation = `판매량이 안정적입니다. 현재 재고 정책을 유지하되, 정기적인 모니터링을 권장합니다.`;
    }

    // 예측 기간 라벨 생성
    const forecastPeriods = forecastValues.map((value, index) => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + index + 1);
      return {
        period: index + 1,
        label: `${futureDate.getFullYear()}년 ${futureDate.getMonth() + 1}월`,
        predictedQuantity: Math.round(value),
      };
    });

    // 예측 방법 설명
    const methodDescriptions: Record<string, string> = {
      SMA: "단순이동평균 - 과거 데이터의 평균으로 예측",
      SES: "단순지수평활 - 최근 데이터에 가중치를 두어 예측",
      Holts: "Holt의 이중지수평활 - 트렌드를 반영하여 예측",
    };

    return {
      success: true,
      data: {
        productId,
        sku: product.sku,
        productName: product.name,
        forecast: {
          method: "SMA", // simpleForecast 기본값
          methodDescription: methodDescriptions["SMA"],
          periods: forecastPeriods,
          totalForecast: Math.round(totalForecast),
          avgMonthlyForecast: Math.round(totalForecast / periods),
        },
        accuracy: {
          mape: Math.round(accuracy.mape * 100) / 100,
          mapeLabel,
          mae: Math.round(accuracy.mae * 100) / 100,
          confidence: accuracy.confidence,
        },
        historicalData: {
          avgMonthlySales: Math.round(avgMonthlySales * 100) / 100,
          trend,
          seasonality: false, // TODO: 계절성 분석 추가
        },
        recommendation,
      },
    };
  } catch (error) {
    console.error("수요 예측 오류:", error);
    return { success: false, error: "수요 예측에 실패했습니다" };
  }
}
