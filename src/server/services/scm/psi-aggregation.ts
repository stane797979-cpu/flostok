/**
 * PSI (Purchase-Sales-Inventory) 통합 집계 서비스
 * 13개월분 데이터를 SKU별로 집계하여 PSI 테이블 데이터를 생성
 */

export interface PSIMonthData {
  /** YYYY-MM */
  period: string;
  /** 기초재고 */
  beginningStock: number;
  /** 입고(공급) */
  inbound: number;
  /** 출고(수요/판매) */
  outbound: number;
  /** 기말재고 */
  endingStock: number;
  /** 수요예측 (F/C) */
  forecast: number | null;
  /** 수동 F/C (MD 조정) */
  manualForecast: number | null;
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
  }>;
  /** 월별 판매량 { productId -> { YYYY-MM -> qty } } */
  salesByMonth: Map<string, Map<string, number>>;
  /** 월별 입고량 { productId -> { YYYY-MM -> qty } } */
  inboundByMonth: Map<string, Map<string, number>>;
  /** 월별 예측량 { productId -> { YYYY-MM -> qty } } */
  forecastByMonth: Map<string, Map<string, number>>;
  /** 월별 수동F/C { productId -> { YYYY-MM -> qty } } */
  manualForecastByMonth: Map<string, Map<string, number>>;
  periods: string[];
}): PSIResult {
  const { products, salesByMonth, inboundByMonth, forecastByMonth, manualForecastByMonth, periods } = input;

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
      const sales = salesByMonth.get(product.id)?.get(period) || 0;
      const inbound = inboundByMonth.get(product.id)?.get(period) || 0;
      // 이전 기말 = 이번달 기말 + 이번달 출고 - 이번달 입고
      pastStocks[i] = Math.max(0, pastStocks[i + 1] + sales - inbound);
    }

    // 미래 예측 (현재 → 미래)
    for (let i = midIdx + 1; i < periods.length; i++) {
      const period = periods[i];
      const forecast = (manualForecastByMonth.get(product.id)?.get(period)
        ?? forecastByMonth.get(product.id)?.get(period)) || 0;
      const inbound = inboundByMonth.get(product.id)?.get(period) || 0;
      pastStocks[i] = Math.max(0, pastStocks[i - 1] - forecast + inbound);
    }

    // 월별 데이터 생성
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const sales = salesByMonth.get(product.id)?.get(period) || 0;
      const inbound = inboundByMonth.get(product.id)?.get(period) || 0;
      const forecast = forecastByMonth.get(product.id)?.get(period) ?? null;
      const manualFC = manualForecastByMonth.get(product.id)?.get(period) ?? null;

      const beginningStock = i === 0 ? pastStocks[0] : pastStocks[i - 1];
      const endingStock = pastStocks[i];

      monthData.push({
        period,
        beginningStock: Math.round(beginningStock),
        inbound,
        outbound: sales,
        endingStock: Math.round(endingStock),
        forecast,
        manualForecast: manualFC,
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
      months: monthData,
    });
  }

  return {
    products: rows,
    periods,
    totalProducts: rows.length,
  };
}
