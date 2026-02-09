/**
 * 재고 분석 Server Actions
 * - ABC-XYZ 분석
 * - 재고회전율
 * - 판매 추이
 */

'use server'

import { requireAuth } from './auth-helpers'
import { db } from '@/server/db'
import { products, salesRecords, inventory } from '@/server/db/schema'
import { eq, and, gte, sql } from 'drizzle-orm'
import {
  performABCAnalysis,
  performXYZAnalysis,
  combineABCXYZ,
  type ABCAnalysisItem,
  type XYZAnalysisItem,
} from '@/server/services/scm/abc-xyz-analysis'
import {
  forecastDemand,
  forecastDemandWithMethod,
  backtestForecast,
  type TimeSeriesDataPoint,
  type ForecastMethodType,
} from '@/server/services/scm/demand-forecast'

/**
 * ABC-XYZ 분석 데이터 조회 (실제 DB 데이터)
 * - 최근 6개월 판매 데이터 기반
 * - 제품별 매출 합계 → ABC 분석
 * - 제품별 월별 판매량 변동 → XYZ 분석
 * - 결합하여 9등급 매트릭스 생성
 */
export async function getABCXYZAnalysis() {
  const user = await requireAuth()
  const orgId = user.organizationId

  // 최근 6개월 시작일
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const startDate = sixMonthsAgo.toISOString().split('T')[0]

  // 1. 전체 제품 목록 조회
  const allProducts = await db
    .select({ id: products.id, sku: products.sku, name: products.name })
    .from(products)
    .where(eq(products.organizationId, orgId))

  if (allProducts.length === 0) {
    return {
      products: [],
      matrixData: [],
      summary: {
        aCount: 0,
        aPercentage: 0,
        bCount: 0,
        bPercentage: 0,
        cCount: 0,
        cPercentage: 0,
        period: '최근 6개월',
      },
    }
  }

  // 2. 제품별 매출 합계 (ABC용)
  const salesByProduct = await db
    .select({
      productId: salesRecords.productId,
      totalRevenue: sql<number>`COALESCE(SUM(${salesRecords.totalAmount}), 0)`,
    })
    .from(salesRecords)
    .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
    .groupBy(salesRecords.productId)

  const revenueMap = new Map(salesByProduct.map((s) => [s.productId, Number(s.totalRevenue)]))

  // 3. 제품별 월별 판매량 (XYZ용)
  const monthlySales = await db
    .select({
      productId: salesRecords.productId,
      month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
      totalQuantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
    })
    .from(salesRecords)
    .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
    .groupBy(salesRecords.productId, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)

  // 월별 데이터를 제품별로 그룹핑
  const monthlyMap = new Map<string, number[]>()
  for (const row of monthlySales) {
    const arr = monthlyMap.get(row.productId) || []
    arr.push(Number(row.totalQuantity))
    monthlyMap.set(row.productId, arr)
  }

  // 4. ABC 분석 입력 데이터 생성
  const abcItems: ABCAnalysisItem[] = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    value: revenueMap.get(p.id) || 0,
  }))

  // 5. XYZ 분석 입력 데이터 생성
  const xyzItems: XYZAnalysisItem[] = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    demandHistory: monthlyMap.get(p.id) || [0],
  }))

  // 6. 분석 수행
  const abcResults = performABCAnalysis(abcItems)
  const xyzResults = performXYZAnalysis(xyzItems)
  const combined = combineABCXYZ(abcResults, xyzResults)

  // 7. UI에 전달할 형태로 변환
  const skuMap = new Map(allProducts.map((p) => [p.id, p.sku]))

  const analysisProducts = combined.map((item) => {
    const xyzResult = xyzResults.find((x) => x.id === item.id)
    return {
      id: item.id,
      sku: skuMap.get(item.id) || '',
      name: item.name,
      abcGrade: item.abcGrade,
      xyzGrade: item.xyzGrade,
      combinedGrade: item.combinedGrade,
      revenue: revenueMap.get(item.id) || 0,
      variationRate: xyzResult?.coefficientOfVariation || 0,
      strategy: item.strategy,
    }
  })

  // 8. 매트릭스 데이터
  const grades = ['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ']
  const matrixData = grades.map((grade) => ({
    grade,
    count: combined.filter((c) => c.combinedGrade === grade).length,
  }))

  // 9. 요약 데이터
  const total = combined.length
  const aCount = combined.filter((c) => c.abcGrade === 'A').length
  const bCount = combined.filter((c) => c.abcGrade === 'B').length
  const cCount = combined.filter((c) => c.abcGrade === 'C').length

  return {
    products: analysisProducts,
    matrixData,
    summary: {
      aCount,
      aPercentage: total > 0 ? (aCount / total) * 100 : 0,
      bCount,
      bPercentage: total > 0 ? (bCount / total) * 100 : 0,
      cCount,
      cPercentage: total > 0 ? (cCount / total) * 100 : 0,
      period: '최근 6개월',
    },
  }
}

/**
 * 수요예측 데이터 조회
 * - 특정 제품 또는 전체 상위 제품의 과거 판매 이력 + 예측 결과 반환
 * - forecastDemand() 서비스 사용 (자동 방법 선택)
 * - 수동 방법 지정 시 forecastDemandWithMethod() 사용
 */
export async function getDemandForecast(options?: {
  productId?: string
  /** 수동 방법 선택 시 */
  manualMethod?: ForecastMethodType
  /** 수동 파라미터 (α, β, windowSize 등) */
  manualParams?: Record<string, number>
}): Promise<{
  products: Array<{
    id: string
    sku: string
    name: string
    abcGrade: string | null
    xyzGrade: string | null
  }>
  forecast: {
    productId: string
    productName: string
    method: string
    confidence: string
    mape: number
    selectionReason: string
    seasonallyAdjusted: boolean
    isManual: boolean
    /** 제품 메타 정보 */
    meta: {
      abcGrade: string | null
      xyzGrade: string | null
      turnoverRate: number | null
      yoyGrowthRate: number | null
      isOverstock: boolean
      dataMonths: number
    }
    history: Array<{ month: string; value: number }>
    predicted: Array<{ month: string; value: number }>
  } | null
}> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId
    const productId = options?.productId
    const manualMethod = options?.manualMethod
    const manualParams = options?.manualParams

    // 1. 조직의 전체 제품 목록 조회 (등급 포함)
    const allProducts = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        abcGrade: products.abcGrade,
        xyzGrade: products.xyzGrade,
      })
      .from(products)
      .where(eq(products.organizationId, orgId))

    if (allProducts.length === 0) {
      return { products: [], forecast: null }
    }

    // 2. productId가 없으면 판매 데이터가 가장 많은 상위 1개 제품 자동 선택
    let selectedProductId = productId
    if (!selectedProductId) {
      const topProduct = await db
        .select({
          productId: salesRecords.productId,
          totalSales: sql<number>`COUNT(*)`,
        })
        .from(salesRecords)
        .where(eq(salesRecords.organizationId, orgId))
        .groupBy(salesRecords.productId)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(1)

      if (topProduct.length === 0) {
        return { products: allProducts, forecast: null }
      }
      selectedProductId = topProduct[0].productId
    }

    // 3. 제품 상세 정보 조회 (ABC, XYZ, 안전재고 등)
    const productDetail = await db
      .select({
        id: products.id,
        name: products.name,
        abcGrade: products.abcGrade,
        xyzGrade: products.xyzGrade,
        safetyStock: products.safetyStock,
      })
      .from(products)
      .where(eq(products.id, selectedProductId))
      .limit(1)

    if (productDetail.length === 0) {
      return { products: allProducts, forecast: null }
    }

    const product = productDetail[0]

    // 4. 현재 재고 조회 (과다재고 판정용)
    const inventoryRow = await db
      .select({ currentStock: inventory.currentStock })
      .from(inventory)
      .where(
        and(
          eq(inventory.organizationId, orgId),
          eq(inventory.productId, selectedProductId)
        )
      )
      .limit(1)

    const currentStock = inventoryRow[0]?.currentStock ?? 0
    const safetyStock = product.safetyStock ?? 0
    const isOverstock = safetyStock > 0 && currentStock >= safetyStock * 3

    // 5. 최근 12개월 월별 판매량 조회
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const startDate = twelveMonthsAgo.toISOString().split('T')[0]

    const monthlySales = await db
      .select({
        month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
        totalQuantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          eq(salesRecords.productId, selectedProductId),
          gte(salesRecords.date, startDate)
        )
      )
      .groupBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)

    if (monthlySales.length < 2) {
      return { products: allProducts, forecast: null }
    }

    // 6. 회전율 계산 (연간 판매량 / 현재 재고)
    const totalSalesQty = monthlySales.reduce((sum, r) => sum + Number(r.totalQuantity), 0)
    const annualizedSales = (totalSalesQty / monthlySales.length) * 12
    const turnoverRate = currentStock > 0 ? annualizedSales / currentStock : undefined

    // 7. 전년 대비 성장률 계산 (6개월 이상 데이터 필요)
    let yoyGrowthRate: number | undefined
    if (monthlySales.length >= 6) {
      const halfLen = Math.floor(monthlySales.length / 2)
      const firstHalf = monthlySales.slice(0, halfLen)
      const secondHalf = monthlySales.slice(halfLen)
      const firstAvg = firstHalf.reduce((s, r) => s + Number(r.totalQuantity), 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((s, r) => s + Number(r.totalQuantity), 0) / secondHalf.length
      if (firstAvg > 0) {
        yoyGrowthRate = ((secondAvg - firstAvg) / firstAvg) * 100
      }
    }

    // 8. TimeSeriesDataPoint 형식으로 변환
    const historyPoints: TimeSeriesDataPoint[] = monthlySales.map((row) => ({
      date: new Date(`${row.month}-01`),
      value: Number(row.totalQuantity),
    }))
    const historyValues = historyPoints.map((h) => h.value)

    // 9. 예측 실행 (자동 or 수동)
    let forecastResult
    const isManual = !!manualMethod

    if (manualMethod) {
      // 수동 방법 지정
      forecastResult = forecastDemandWithMethod(historyValues, 3, manualMethod, manualParams)
      forecastResult.selectionReason = `수동 선택: ${manualMethod}`
    } else {
      // 자동 방법 선택 (확장된 입력)
      forecastResult = forecastDemand({
        history: historyPoints,
        periods: 3,
        abcGrade: product.abcGrade as "A" | "B" | "C" | undefined,
        xyzGrade: product.xyzGrade as "X" | "Y" | "Z" | undefined,
        turnoverRate,
        yoyGrowthRate,
        isOverstock,
      })
    }

    // 10. 백테스트 정확도
    const backtestResult = backtestForecast(historyValues, 3, forecastResult.method)

    // 11. 제품 정보 확인
    const selectedProduct = allProducts.find((p) => p.id === selectedProductId)
    if (!selectedProduct) {
      return { products: allProducts, forecast: null }
    }

    // 12. 예측 결과에 날짜 매핑
    const lastHistoryDate = historyPoints[historyPoints.length - 1].date
    const predictedMonths = forecastResult.forecast.map((value, i) => {
      const d = new Date(lastHistoryDate)
      d.setMonth(d.getMonth() + i + 1)
      return {
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        value: Math.round(value),
      }
    })

    return {
      products: allProducts,
      forecast: {
        productId: selectedProductId,
        productName: selectedProduct.name,
        method: forecastResult.method,
        confidence: forecastResult.confidence ?? backtestResult.confidence,
        mape: Math.round((forecastResult.mape ?? backtestResult.mape) * 10) / 10,
        selectionReason: forecastResult.selectionReason ?? '자동 선택',
        seasonallyAdjusted: forecastResult.seasonallyAdjusted ?? false,
        isManual,
        meta: {
          abcGrade: product.abcGrade,
          xyzGrade: product.xyzGrade,
          turnoverRate: turnoverRate ? Math.round(turnoverRate * 10) / 10 : null,
          yoyGrowthRate: yoyGrowthRate ? Math.round(yoyGrowthRate * 10) / 10 : null,
          isOverstock,
          dataMonths: monthlySales.length,
        },
        history: historyPoints.map((h) => ({
          month: `${h.date.getFullYear()}-${String(h.date.getMonth() + 1).padStart(2, '0')}`,
          value: h.value,
        })),
        predicted: predictedMonths,
      },
    }
  } catch (error) {
    console.error('수요예측 조회 오류:', error)
    return { products: [], forecast: null }
  }
}
