/**
 * PSI (Purchase-Sales-Inventory) 통합 집계 서비스
 * 13개월분 데이터를 SKU별로 집계하여 PSI 테이블 데이터를 생성
 */

export interface PSIMonthData {
  /** YYYY-MM */
  period: string;
  /** 기초재고 */
  beginningStock: number;
  /** 실제 입고 */
  inbound: number;
  /** 실제 출고(판매) */
  outbound: number;
  /** 실제 기말재고 */
  endingStock: number;
  /** 수요예측 (F/C) */
  forecast: number | null;
  /** 수동 F/C (MD 조정) */
  manualForecast: number | null;
  /** S&OP 물량 (공급계획) */
  sopQuantity: number;
  /** 입고계획 */
  inboundPlan: number;
  /** 출고계획 (수동 엑셀 업로드) */
  outboundPlan: number;
  /** 말재고계획 = 기초 + 입고계획 - 출고계획 */
  plannedEndingStock: number;
}

export interface PSIProductRow {
  productId: string;
  sku: string;
  productName: string;
  category: string | null;
  abcGrade: string | null;
  xyzGrade: string | null;
  currentStock: number;
  safetyStock: number;
  orderMethod: string | null;
  months: PSIMonthData[];
}

export interface PSIResult {
  products: PSIProductRow[];
  periods: string[];
  totalProducts: number;
}

/**
 * 월 목록 생성 (과거 pastMonths ~ 미래 futureMonths)
 */
export function generatePeriods(pastMonths: number = 6, futureMonths: number = 6): string[] {
  const periods: string[] = [];
  const now = new Date();

  for (let i = -pastMonths; i <= futureMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    periods.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  return periods;
}

/**
 * 원시 데이터로부터 PSI 집계 수행
 */
export function aggregatePSI(input: {
  products: Array<{
    id: string;
    sku: string;
    name: string;
    category: string | null;
    abcGrade: string | null;
    xyzGrade: string | null;
    currentStock: number;
    safetyStock: number;
    orderMethod: string | null;
  }>;
  /** 월별 출고실적 { productId -> { YYYY-MM -> qty } } (from inventory_history) */
  outboundByMonth: Map<string, Map<string, number>>;
  /** 월별 입고실적 { productId -> { YYYY-MM -> qty } } */
  inboundByMonth: Map<string, Map<string, number>>;
  /** 월별 예측량 { productId -> { YYYY-MM -> qty } } (참고용) */
  forecastByMonth: Map<string, Map<string, number>>;
  /** 월별 수동F/C { productId -> { YYYY-MM -> qty } } (참고용) */
  manualForecastByMonth: Map<string, Map<string, number>>;
  /** 월별 S&OP 물량 { productId -> { YYYY-MM -> qty } } */
  sopByMonth: Map<string, Map<string, number>>;
  /** 월별 입고계획 { productId -> { YYYY-MM -> qty } } (from purchase_orders) */
  inboundPlanByMonth: Map<string, Map<string, number>>;
  /** 월별 출고계획 { productId -> { YYYY-MM -> qty } } (수동 엑셀 업로드) */
  outboundPlanByMonth: Map<string, Map<string, number>>;
  periods: string[];
}): PSIResult {
  const { products, outboundByMonth, inboundByMonth, forecastByMonth, manualForecastByMonth, sopByMonth, inboundPlanByMonth, outboundPlanByMonth, periods } = input;

  const rows: PSIProductRow[] = [];

  for (const product of products) {
    const monthData: PSIMonthData[] = [];
    const runningStock = product.currentStock;

    // 과거 월의 기말재고를 역산하기 위해, 현재월 기준으로 과거를 추정
    // 단순화: 현재고를 기준으로 과거 출고/입고를 역산
    const currentPeriodIdx = periods.findIndex((p) => {
      const now = new Date();
      const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return p === current;
    });

    // 과거 월 역산 (현재고에서 출고를 더하고 입고를 빼면 이전 기말재고)
    const pastStocks: number[] = new Array(periods.length).fill(0);
    pastStocks[currentPeriodIdx >= 0 ? currentPeriodIdx : Math.floor(periods.length / 2)] = runningStock;

    // 과거 역산 (현재 → 과거)
    const midIdx = currentPeriodIdx >= 0 ? currentPeriodIdx : Math.floor(periods.length / 2);
    for (let i = midIdx - 1; i >= 0; i--) {
      const period = periods[i + 1];
      const outbound = outboundByMonth.get(product.id)?.get(period) || 0;
      const inbound = inboundByMonth.get(product.id)?.get(period) || 0;
      // 이전 기말 = 이번달 기말 + 이번달 출고 - 이번달 입고
      pastStocks[i] = Math.max(0, pastStocks[i + 1] + outbound - inbound);
    }

    // 미래 예측 (현재 → 미래): 출고계획 기반
    for (let i = midIdx + 1; i < periods.length; i++) {
      const period = periods[i];
      const outPlan = outboundPlanByMonth.get(product.id)?.get(period) || 0;
      const inbPlan = inboundPlanByMonth.get(product.id)?.get(period) || 0;
      pastStocks[i] = Math.max(0, pastStocks[i - 1] - outPlan + inbPlan);
    }

    // 말재고계획 계산용 (입고계획 + 출고계획 기반)
    const plannedStocks: number[] = new Array(periods.length).fill(0);
    plannedStocks[midIdx] = runningStock;

    // 미래 말재고계획 (현재 → 미래): 기초 + 입고계획 - 출고계획
    for (let i = midIdx + 1; i < periods.length; i++) {
      const period = periods[i];
      const outPlan = outboundPlanByMonth.get(product.id)?.get(period) || 0;
      const inbPlan = inboundPlanByMonth.get(product.id)?.get(period) || 0;
      plannedStocks[i] = Math.max(0, plannedStocks[i - 1] + inbPlan - outPlan);
    }
    // 과거는 실적과 동일
    for (let i = midIdx - 1; i >= 0; i--) {
      plannedStocks[i] = pastStocks[i];
    }

    // 월별 데이터 생성
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const outboundActual = outboundByMonth.get(product.id)?.get(period) || 0;
      const inbound = inboundByMonth.get(product.id)?.get(period) || 0;
      const forecast = forecastByMonth.get(product.id)?.get(period) ?? null;
      const manualFC = manualForecastByMonth.get(product.id)?.get(period) ?? null;
      const sopQty = sopByMonth.get(product.id)?.get(period) || 0;
      const inbPlan = inboundPlanByMonth.get(product.id)?.get(period) || 0;
      const outPlan = outboundPlanByMonth.get(product.id)?.get(period) || 0;

      const beginningStock = i === 0 ? pastStocks[0] : pastStocks[i - 1];
      const endingStock = pastStocks[i];

      monthData.push({
        period,
        beginningStock: Math.round(beginningStock),
        inbound,
        outbound: outboundActual,
        endingStock: Math.round(endingStock),
        forecast,
        manualForecast: manualFC,
        sopQuantity: sopQty,
        inboundPlan: inbPlan,
        outboundPlan: outPlan,
        plannedEndingStock: Math.round(plannedStocks[i]),
      });
    }

    rows.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      category: product.category,
      abcGrade: product.abcGrade,
      xyzGrade: product.xyzGrade,
      currentStock: product.currentStock,
      safetyStock: product.safetyStock,
      orderMethod: product.orderMethod,
      months: monthData,
    });
  }

  return {
    products: rows,
    periods,
    totalProducts: rows.length,
  };
}
