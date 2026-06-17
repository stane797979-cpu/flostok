/**
 * 재고 분석 Server Actions
 * - ABC-XYZ 분석
 * - 재고회전율
 * - 판매 추이
 */

'use server'

import { unstable_cache } from 'next/cache'
import { requireAuth } from './auth-helpers'
import { db } from '@/server/db'
import { products, salesRecords, inventory, demandForecasts } from '@/server/db/schema'
import { eq, and, gte, sql, desc } from 'drizzle-orm'
import {
  performABCAnalysis,
  performXYZAnalysis,
  performFMRAnalysis,
  combineABCXYZ,
  combineABCXYZFMR,
  type ABCAnalysisItem,
  type XYZAnalysisItem,
  type FMRAnalysisItem,
} from '@/server/services/scm/abc-xyz-analysis'
import {
  forecastDemand,
  forecastDemandWithMethod,
  backtestForecast,
  type TimeSeriesDataPoint,
  type ForecastMethodType,
} from '@/server/services/scm/demand-forecast'

/**
 * ABC-XYZ 분석 데이터 조회 내부 로직 (캐싱 대상)
 */
async function _getABCXYZAnalysisInternal(orgId: string) {
  // 최근 6개월 시작일
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const startDate = sixMonthsAgo.toISOString().split('T')[0]

  // 병렬 데이터 로드
  const [allProducts, salesByProduct, monthlySales, monthlyOutboundCounts] = await Promise.all([
    // 1. 전체 제품 목록 조회
    db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(eq(products.organizationId, orgId)),

    // 2. 제품별 매출 합계 (ABC용)
    db
      .select({
        productId: salesRecords.productId,
        totalRevenue: sql<number>`COALESCE(SUM(${salesRecords.totalAmount}), 0)`,
      })
      .from(salesRecords)
      .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
      .groupBy(salesRecords.productId),

    // 3. 제품별 월별 판매량 (XYZ용)
    db
      .select({
        productId: salesRecords.productId,
        month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
        totalQuantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
      .groupBy(salesRecords.productId, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`),

    // 4. 제품별 월별 출고 건수 (FMR용 — 건수 기준)
    db
      .select({
        productId: salesRecords.productId,
        month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
        outboundCount: sql<number>`COUNT(*)`,
      })
      .from(salesRecords)
      .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
      .groupBy(salesRecords.productId, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`),
  ])

  if (allProducts.length === 0) {
    return {
      products: [],
      matrixData: [],
      summary: {
        totalCount: 0,
        aCount: 0,
        aPercentage: 0,
        bCount: 0,
        bPercentage: 0,
        cCount: 0,
        cPercentage: 0,
        xCount: 0,
        xPercentage: 0,
        yCount: 0,
        yPercentage: 0,
        zCount: 0,
        zPercentage: 0,
        fCount: 0,
        fPercentage: 0,
        mCount: 0,
        mPercentage: 0,
        rCount: 0,
        rPercentage: 0,
        period: '최근 6개월',
      },
      fmrProducts: [],
      insights: {
        totalRevenue: 0,
        aRevenuePercent: 0,
        axCount: 0,
        axRevenuePercent: 0,
        azCount: 0,
        bzCount: 0,
        riskCount: 0,
        avgCV: 0,
      },
    }
  }

  const revenueMap = new Map(salesByProduct.map((s) => [s.productId, Number(s.totalRevenue)]))

  // 월별 판매량 데이터를 제품별로 그룹핑 (XYZ용)
  const monthlyMap = new Map<string, number[]>()
  for (const row of monthlySales) {
    const arr = monthlyMap.get(row.productId) || []
    arr.push(Number(row.totalQuantity))
    monthlyMap.set(row.productId, arr)
  }

  // 월별 출고 건수를 제품별로 그룹핑 (FMR용)
  const outboundMap = new Map<string, number[]>()
  for (const row of monthlyOutboundCounts) {
    const arr = outboundMap.get(row.productId) || []
    arr.push(Number(row.outboundCount))
    outboundMap.set(row.productId, arr)
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

  // 5-1. FMR 분석 입력 데이터 생성
  const fmrItems: FMRAnalysisItem[] = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    monthlyOutboundCounts: outboundMap.get(p.id) || [0],
  }))

  // 6. 분석 수행
  const abcResults = performABCAnalysis(abcItems)
  const xyzResults = performXYZAnalysis(xyzItems)
  const fmrResults = performFMRAnalysis(fmrItems)
  const combined = combineABCXYZ(abcResults, xyzResults)
  const combinedFMR = combineABCXYZFMR(abcResults, xyzResults, fmrResults)

  // 7. UI에 전달할 형태로 변환
  const skuMap = new Map(allProducts.map((p) => [p.id, p.sku]))
  const fmrMap2 = new Map(fmrResults.map((r) => [r.id, r]))

  const analysisProducts = combined.map((item) => {
    const xyzResult = xyzResults.find((x) => x.id === item.id)
    const fmrResult = fmrMap2.get(item.id)
    return {
      id: item.id,
      sku: skuMap.get(item.id) || '',
      name: item.name,
      abcGrade: item.abcGrade,
      xyzGrade: item.xyzGrade,
      fmrGrade: fmrResult?.grade || null,
      combinedGrade: item.combinedGrade,
      combinedGradeFMR: fmrResult ? `${item.combinedGrade}${fmrResult.grade}` : item.combinedGrade,
      revenue: revenueMap.get(item.id) || 0,
      variationRate: xyzResult?.coefficientOfVariation || 0,
      avgMonthlyCount: fmrResult?.avgMonthlyCount || 0,
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
  const xCount = combined.filter((c) => c.xyzGrade === 'X').length
  const yCount = combined.filter((c) => c.xyzGrade === 'Y').length
  const zCount = combined.filter((c) => c.xyzGrade === 'Z').length
  const fCount = fmrResults.filter((r) => r.grade === 'F').length
  const mCount = fmrResults.filter((r) => r.grade === 'M').length
  const rCount = fmrResults.filter((r) => r.grade === 'R').length

  // 10. 인사이트 데이터
  const totalRevenue = analysisProducts.reduce((s, p) => s + p.revenue, 0)
  const aRevenue = analysisProducts
    .filter((p) => p.abcGrade === 'A')
    .reduce((s, p) => s + p.revenue, 0)
  const aRevenuePercent = totalRevenue > 0 ? (aRevenue / totalRevenue) * 100 : 0

  // 위험 등급: A등급인데 수요 불안정(Z) = 핵심 불안정
  const azCount = combined.filter((c) => c.combinedGrade === 'AZ').length
  const bzCount = combined.filter((c) => c.combinedGrade === 'BZ').length
  // 핵심 안정: AX
  const axCount = combined.filter((c) => c.combinedGrade === 'AX').length
  const axRevenue = analysisProducts
    .filter((p) => p.combinedGrade === 'AX')
    .reduce((s, p) => s + p.revenue, 0)
  const axRevenuePercent = totalRevenue > 0 ? (axRevenue / totalRevenue) * 100 : 0
  // 평균 변동계수
  const allCvs = analysisProducts.map((p) => p.variationRate).filter((v) => v > 0)
  const avgCV = allCvs.length > 0 ? allCvs.reduce((s, v) => s + v, 0) / allCvs.length : 0

  // 계산된 등급을 DB에 즉시 저장 (분석 탭 = PSI = 제품목록 모두 동일한 등급 사용)
  const fmrMap3 = new Map(fmrResults.map((r) => [r.id, r.grade]))
  await Promise.all(
    combined.map((item) =>
      db.update(products)
        .set({
          abcGrade: item.abcGrade as "A" | "B" | "C",
          xyzGrade: item.xyzGrade as "X" | "Y" | "Z",
          fmrGrade: (fmrMap3.get(item.id) ?? null) as "F" | "M" | "R" | null,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, item.id), eq(products.organizationId, orgId)))
    )
  )

  return {
    products: analysisProducts,
    matrixData,
    summary: {
      totalCount: total,
      aCount,
      aPercentage: total > 0 ? (aCount / total) * 100 : 0,
      bCount,
      bPercentage: total > 0 ? (bCount / total) * 100 : 0,
      cCount,
      cPercentage: total > 0 ? (cCount / total) * 100 : 0,
      xCount,
      xPercentage: total > 0 ? (xCount / total) * 100 : 0,
      yCount,
      yPercentage: total > 0 ? (yCount / total) * 100 : 0,
      zCount,
      zPercentage: total > 0 ? (zCount / total) * 100 : 0,
      fCount,
      fPercentage: total > 0 ? (fCount / total) * 100 : 0,
      mCount,
      mPercentage: total > 0 ? (mCount / total) * 100 : 0,
      rCount,
      rPercentage: total > 0 ? (rCount / total) * 100 : 0,
      period: '최근 6개월',
    },
    fmrProducts: combinedFMR,
    insights: {
      totalRevenue,
      aRevenuePercent: Math.round(aRevenuePercent * 10) / 10,
      axCount,
      axRevenuePercent: Math.round(axRevenuePercent * 10) / 10,
      azCount,
      bzCount,
      riskCount: azCount + bzCount,
      avgCV: Math.round(avgCV * 100) / 100,
    },
  }
}

/**
 * ABC-XYZ 분석 데이터 조회 (실제 DB 데이터)
 * - 최근 6개월 판매 데이터 기반
 * - 제품별 매출 합계 → ABC 분석
 * - 제품별 월별 판매량 변동 → XYZ 분석
 * - 결합하여 9등급 매트릭스 생성
 * unstable_cache로 60초간 캐싱
 */
export async function getABCXYZAnalysis() {
  const user = await requireAuth()
  const orgId = user.organizationId
  return _getABCXYZAnalysisInternal(orgId)
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

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const startDate = twelveMonthsAgo.toISOString().split('T')[0]

    // 1단계: 제품 목록 + 탑 제품(필요시) 병렬 조회
    const [allProducts, topProduct] = await Promise.all([
      db
        .select({ id: products.id, sku: products.sku, name: products.name, abcGrade: products.abcGrade, xyzGrade: products.xyzGrade })
        .from(products)
        .where(eq(products.organizationId, orgId)),
      !productId
        ? db
            .select({ productId: salesRecords.productId, totalSales: sql<number>`COUNT(*)` })
            .from(salesRecords)
            .where(eq(salesRecords.organizationId, orgId))
            .groupBy(salesRecords.productId)
            .orderBy(sql`COUNT(*) DESC`)
            .limit(1)
        : Promise.resolve(null),
    ])

    if (allProducts.length === 0) {
      return { products: [], forecast: null }
    }

    const selectedProductId = productId || topProduct?.[0]?.productId
    if (!selectedProductId) {
      return { products: allProducts, forecast: null }
    }

    // 2단계: 제품상세 + 재고 + 월별판매량 병렬 조회
    const [productDetail, inventoryRow, monthlySales] = await Promise.all([
      db
        .select({ id: products.id, name: products.name, abcGrade: products.abcGrade, xyzGrade: products.xyzGrade, safetyStock: products.safetyStock })
        .from(products)
        .where(eq(products.id, selectedProductId))
        .limit(1),
      db
        .select({ currentStock: inventory.currentStock })
        .from(inventory)
        .where(and(eq(inventory.organizationId, orgId), eq(inventory.productId, selectedProductId)))
        .limit(1),
      db
        .select({
          month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
          totalQuantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
        })
        .from(salesRecords)
        .where(and(eq(salesRecords.organizationId, orgId), eq(salesRecords.productId, selectedProductId), gte(salesRecords.date, startDate)))
        .groupBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`),
    ])

    if (productDetail.length === 0) {
      return { products: allProducts, forecast: null }
    }

    const product = productDetail[0]
    const currentStock = inventoryRow[0]?.currentStock ?? 0
    const safetyStock = product.safetyStock ?? 0
    const isOverstock = safetyStock > 0 && currentStock >= safetyStock * 3

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

    // 13. 예측 결과를 demand_forecasts 테이블에 저장 (비동기 배치 UPSERT)
    const methodDbMap: Record<string, string> = {
      SMA: 'sma_3',
      SES: 'ses',
      Holts: 'holt',
    }
    const dbMethod = methodDbMap[forecastResult.method] || 'sma_3'
    const mapeValue = Math.round((forecastResult.mape ?? backtestResult.mape) * 10) / 10
    const noteText = isManual ? `수동 선택: ${forecastResult.method}` : `자동 선택: ${forecastResult.method}`

    // 저장은 응답 반환에 영향을 주지 않으므로 비동기로 처리
    void (async () => {
      try {
        const periods = predictedMonths.map((pm) => `${pm.month}-01`)
        // 기존 예측 한 번에 조회
        const existingRows = await db
          .select({ id: demandForecasts.id, period: demandForecasts.period })
          .from(demandForecasts)
          .where(
            and(
              eq(demandForecasts.organizationId, orgId),
              eq(demandForecasts.productId, selectedProductId),
              sql`${demandForecasts.period} IN (${sql.join(periods.map(p => sql`${p}`), sql`, `)})`
            )
          )
        const existingMap = new Map(existingRows.map((r) => [r.period, r.id]))

        // UPDATE와 INSERT를 병렬 처리
        const ops: Promise<unknown>[] = []
        for (const pm of predictedMonths) {
          const periodDate = `${pm.month}-01`
          const existId = existingMap.get(periodDate)
          if (existId) {
            ops.push(
              db.update(demandForecasts).set({
                method: dbMethod as typeof demandForecasts.method.enumValues[number],
                forecastQuantity: pm.value,
                mape: String(mapeValue),
                notes: noteText,
                updatedAt: new Date(),
              }).where(eq(demandForecasts.id, existId))
            )
          } else {
            ops.push(
              db.insert(demandForecasts).values({
                organizationId: orgId,
                productId: selectedProductId,
                period: periodDate,
                method: dbMethod as typeof demandForecasts.method.enumValues[number],
                forecastQuantity: pm.value,
                mape: String(mapeValue),
                notes: noteText,
              })
            )
          }
        }
        await Promise.all(ops)
      } catch (saveError) {
        console.error('수요예측 결과 DB 저장 오류:', saveError)
      }
    })()

    return {
      products: allProducts,
      forecast: {
        productId: selectedProductId,
        productName: selectedProduct.name,
        method: forecastResult.method,
        confidence: forecastResult.confidence ?? backtestResult.confidence,
        mape: mapeValue,
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

/**
 * 집계 수요예측: 전체 / ABC등급별 / XYZ등급별 집계 판매량으로 예측
 */
export async function getAggregateForecast(options?: {
  /** 'all' | 'A' | 'B' | 'C' | 'X' | 'Y' | 'Z' */
  groupBy?: string
  manualMethod?: ForecastMethodType
  manualParams?: Record<string, number>
}): Promise<{
  groups: Array<{
    key: string
    label: string
    productCount: number
    history: Array<{ month: string; value: number }>
    predicted: Array<{ month: string; value: number }>
    method: string
    mape: number
    confidence: string
  }>
}> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId
    const groupBy = options?.groupBy ?? 'all'
    const manualMethod = options?.manualMethod
    const manualParams = options?.manualParams

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
    const startDate = twelveMonthsAgo.toISOString().split('T')[0]

    // 월별 + 그룹별 판매 집계
    let rows: Array<{ groupKey: string; month: string; qty: number }>

    if (groupBy === 'all') {
      const raw = await db
        .select({
          month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
          qty: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
        })
        .from(salesRecords)
        .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
        .groupBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
      rows = raw.map((r) => ({ groupKey: 'all', month: r.month, qty: Number(r.qty) }))
    } else if (['A', 'B', 'C'].includes(groupBy)) {
      const raw = await db
        .select({
          abcGrade: products.abcGrade,
          month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
          qty: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
        })
        .from(salesRecords)
        .innerJoin(products, eq(salesRecords.productId, products.id))
        .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
        .groupBy(products.abcGrade, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
        .orderBy(products.abcGrade, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
      rows = raw
        .filter((r) => r.abcGrade)
        .map((r) => ({ groupKey: r.abcGrade!, month: r.month, qty: Number(r.qty) }))
    } else {
      // X, Y, Z
      const raw = await db
        .select({
          xyzGrade: products.xyzGrade,
          month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
          qty: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
        })
        .from(salesRecords)
        .innerJoin(products, eq(salesRecords.productId, products.id))
        .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDate)))
        .groupBy(products.xyzGrade, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
        .orderBy(products.xyzGrade, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
      rows = raw
        .filter((r) => r.xyzGrade)
        .map((r) => ({ groupKey: r.xyzGrade!, month: r.month, qty: Number(r.qty) }))
    }

    // 제품 수 집계
    const productCountRaw = await db
      .select({ abcGrade: products.abcGrade, xyzGrade: products.xyzGrade, cnt: sql<number>`COUNT(*)` })
      .from(products)
      .where(eq(products.organizationId, orgId))
      .groupBy(products.abcGrade, products.xyzGrade)

    function getProductCount(key: string): number {
      if (key === 'all') return productCountRaw.reduce((s, r) => s + Number(r.cnt), 0)
      if (['A', 'B', 'C'].includes(key)) return productCountRaw.filter(r => r.abcGrade === key).reduce((s, r) => s + Number(r.cnt), 0)
      return productCountRaw.filter(r => r.xyzGrade === key).reduce((s, r) => s + Number(r.cnt), 0)
    }

    // 그룹별로 묶어 예측
    const groupMap = new Map<string, Array<{ month: string; qty: number }>>()
    for (const r of rows) {
      if (!groupMap.has(r.groupKey)) groupMap.set(r.groupKey, [])
      groupMap.get(r.groupKey)!.push({ month: r.month, qty: r.qty })
    }

    const GROUP_LABELS: Record<string, string> = {
      all: '전체',
      A: 'ABC: A등급 (핵심)',
      B: 'ABC: B등급 (일반)',
      C: 'ABC: C등급 (저매출)',
      X: 'XYZ: X등급 (안정)',
      Y: 'XYZ: Y등급 (변동)',
      Z: 'XYZ: Z등급 (불규칙)',
    }

    // 표시 순서
    const ORDER = groupBy === 'all' ? ['all'] : ['A', 'B', 'C'].includes(groupBy) ? ['A', 'B', 'C'] : ['X', 'Y', 'Z']

    const groups = ORDER.filter((k) => groupMap.has(k)).map((key) => {
      const monthData = groupMap.get(key)!
      const historyValues = monthData.map((d) => d.qty)

      let forecastResult
      if (manualMethod) {
        forecastResult = forecastDemandWithMethod(historyValues, 3, manualMethod, manualParams)
      } else {
        forecastResult = forecastDemand({
          history: monthData.map((d) => ({ date: new Date(`${d.month}-01`), value: d.qty })),
          periods: 3,
        })
      }

      const backtestResult = backtestForecast(historyValues, 3, forecastResult.method)
      const mapeValue = Math.round((forecastResult.mape ?? backtestResult.mape) * 10) / 10

      const lastMonth = monthData[monthData.length - 1].month
      const predicted = forecastResult.forecast.map((value, i) => {
        const d = new Date(`${lastMonth}-01`)
        d.setMonth(d.getMonth() + i + 1)
        return {
          month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          value: Math.round(value),
        }
      })

      return {
        key,
        label: GROUP_LABELS[key] ?? key,
        productCount: getProductCount(key),
        history: monthData.map((d) => ({ month: d.month, value: d.qty })),
        predicted,
        method: forecastResult.method,
        mape: mapeValue,
        confidence: forecastResult.confidence ?? backtestResult.confidence,
      }
    })

    return { groups }
  } catch (error) {
    console.error('집계 수요예측 조회 오류:', error)
    return { groups: [] }
  }
}

/**
 * 판매 추이 조회
 * - 최근 N일 일별 판매액 + 판매 수량 반환
 */
export async function getSalesTrend(days: number = 30): Promise<{
  data: Array<{ date: string; sales: number; quantity: number }>;
  hasData: boolean;
}> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const rows = await db
      .select({
        date: salesRecords.date,
        sales: sql<number>`COALESCE(SUM(${salesRecords.totalAmount}), 0)`,
        quantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDateStr)))
      .groupBy(salesRecords.date)
      .orderBy(salesRecords.date)

    if (rows.length === 0) {
      return { data: [], hasData: false }
    }

    // 날짜 공백 채우기 (판매 없는 날 = 0)
    const dataMap = new Map(rows.map((r) => [r.date, { sales: Number(r.sales), quantity: Number(r.quantity) }]))
    const data: Array<{ date: string; sales: number; quantity: number }> = []

    for (let i = days; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry = dataMap.get(dateStr) ?? { sales: 0, quantity: 0 }
      data.push({ date: dateStr, ...entry })
    }

    return { data, hasData: true }
  } catch (error) {
    console.error('판매 추이 조회 오류:', error)
    return { data: [], hasData: false }
  }
}

/**
 * 제품별 판매 추이 조회
 * - 조직 내 제품 목록 반환
 * - 특정 productId 지정 시 해당 제품의 일별 판매액 + 수량 반환
 */
export async function getProductSalesTrend(
  productId: string,
  days: number = 30
): Promise<{
  data: Array<{ date: string; sales: number; quantity: number }>;
  hasData: boolean;
}> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const rows = await db
      .select({
        date: salesRecords.date,
        sales: sql<number>`COALESCE(SUM(${salesRecords.totalAmount}), 0)`,
        quantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          eq(salesRecords.productId, productId),
          gte(salesRecords.date, startDateStr)
        )
      )
      .groupBy(salesRecords.date)
      .orderBy(salesRecords.date)

    if (rows.length === 0) {
      return { data: [], hasData: false }
    }

    const dataMap = new Map(rows.map((r) => [r.date, { sales: Number(r.sales), quantity: Number(r.quantity) }]))
    const data: Array<{ date: string; sales: number; quantity: number }> = []

    for (let i = days; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry = dataMap.get(dateStr) ?? { sales: 0, quantity: 0 }
      data.push({ date: dateStr, ...entry })
    }

    return { data, hasData: true }
  } catch (error) {
    console.error('제품별 판매 추이 조회 오류:', error)
    return { data: [], hasData: false }
  }
}

/**
 * 판매 추이용 제품 목록 조회 (id + sku + name만)
 */
export async function getProductListForTrend(): Promise<
  Array<{ id: string; sku: string; name: string }>
> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    return await db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(eq(products.organizationId, orgId))
      .orderBy(products.name)
  } catch (error) {
    console.error('제품 목록 조회 오류:', error)
    return []
  }
}

/**
 * 카테고리별 판매 추이 조회
 * - 날짜 × 카테고리 조합으로 일별 판매수량 반환
 */
export async function getCategoryTrend(days: number = 30): Promise<{
  data: Array<{ date: string; [category: string]: number | string }>
  categories: string[]
  hasData: boolean
}> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const rows = await db
      .select({
        date: salesRecords.date,
        category: products.category,
        quantity: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .innerJoin(products, eq(salesRecords.productId, products.id))
      .where(and(eq(salesRecords.organizationId, orgId), gte(salesRecords.date, startDateStr)))
      .groupBy(salesRecords.date, products.category)
      .orderBy(salesRecords.date)

    if (rows.length === 0) return { data: [], categories: [], hasData: false }

    // 카테고리 목록 추출 (null → '미분류')
    const categorySet = new Set<string>()
    rows.forEach((r) => categorySet.add(r.category ?? '미분류'))
    const categories = Array.from(categorySet).sort()

    // 날짜 × 카테고리 매핑
    const dateMap = new Map<string, Record<string, number>>()
    rows.forEach((r) => {
      const cat = r.category ?? '미분류'
      if (!dateMap.has(r.date)) dateMap.set(r.date, {})
      dateMap.get(r.date)![cat] = (dateMap.get(r.date)![cat] ?? 0) + Number(r.quantity)
    })

    // 날짜 공백 채우기
    const data: Array<{ date: string; [key: string]: number | string }> = []
    for (let i = days; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry: { date: string; [key: string]: number | string } = { date: dateStr }
      categories.forEach((cat) => {
        entry[cat] = dateMap.get(dateStr)?.[cat] ?? 0
      })
      data.push(entry)
    }

    return { data, categories, hasData: true }
  } catch (error) {
    console.error('카테고리별 판매 추이 조회 오류:', error)
    return { data: [], categories: [], hasData: false }
  }
}

/**
 * 카테고리별 수요 동향 (대시보드용)
 * - 당월 vs 전월 판매수량 증감
 * - 카테고리 내 재고 위험 품목 수 (품절+위험+부족)
 */
export async function getCategoryDemandSummary(): Promise<{
  rows: Array<{
    category: string
    currentQty: number
    prevQty: number
    changeRate: number       // % (양수=증가, 음수=감소)
    riskCount: number        // 품절+위험 품목 수
    shortageCount: number    // 부족 품목 수
    excessCount: number      // 과재고 품목 수
  }>
  hasData: boolean
}> {
  try {
    const user = await requireAuth()
    const orgId = user.organizationId

    const now = new Date()
    // 당월 1일 ~ 오늘
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    // 전월 1일 ~ 전월 말일
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
    const today = now.toISOString().split('T')[0]

    // 당월 카테고리별 판매수량
    const curRows = await db
      .select({
        category: products.category,
        qty: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .innerJoin(products, eq(salesRecords.productId, products.id))
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          gte(salesRecords.date, curStart),
          sql`${salesRecords.date} <= ${today}`
        )
      )
      .groupBy(products.category)

    // 전월 카테고리별 판매수량
    const prevRows = await db
      .select({
        category: products.category,
        qty: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
      })
      .from(salesRecords)
      .innerJoin(products, eq(salesRecords.productId, products.id))
      .where(
        and(
          eq(salesRecords.organizationId, orgId),
          gte(salesRecords.date, prevStart),
          sql`${salesRecords.date} <= ${prevEnd}`
        )
      )
      .groupBy(products.category)

    // 카테고리별 재고 현황 (현재고 vs 안전재고/발주점 기준)
    const invRows = await db
      .select({
        category: products.category,
        currentStock: inventory.currentStock,
        safetyStock: products.safetyStock,
        reorderPoint: products.reorderPoint,
      })
      .from(inventory)
      .innerJoin(products, eq(inventory.productId, products.id))
      .where(eq(inventory.organizationId, orgId))

    if (curRows.length === 0 && prevRows.length === 0) {
      return { rows: [], hasData: false }
    }

    // 카테고리 목록 합산
    const allCategories = new Set<string>()
    curRows.forEach((r) => allCategories.add(r.category ?? '미분류'))
    prevRows.forEach((r) => allCategories.add(r.category ?? '미분류'))

    const curMap = new Map(curRows.map((r) => [r.category ?? '미분류', Number(r.qty)]))
    const prevMap = new Map(prevRows.map((r) => [r.category ?? '미분류', Number(r.qty)]))

    // 카테고리별 재고 위험 집계
    const riskMap = new Map<string, { risk: number; shortage: number; excess: number }>()
    invRows.forEach((r) => {
      const cat = r.category ?? '미분류'
      if (!riskMap.has(cat)) riskMap.set(cat, { risk: 0, shortage: 0, excess: 0 })
      const entry = riskMap.get(cat)!
      const cur = r.currentStock ?? 0
      const safety = r.safetyStock ?? 0
      const reorder = r.reorderPoint ?? 0
      if (cur === 0 || cur <= safety * 0.5) {
        entry.risk++
      } else if (cur <= reorder || cur <= safety) {
        entry.shortage++
      } else if (safety > 0 && cur > safety * 3) {
        entry.excess++
      }
    })

    const rows = Array.from(allCategories)
      .map((cat) => {
        const cur = curMap.get(cat) ?? 0
        const prev = prevMap.get(cat) ?? 0
        const changeRate = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0
        const inv = riskMap.get(cat) ?? { risk: 0, shortage: 0, excess: 0 }
        return {
          category: cat,
          currentQty: cur,
          prevQty: prev,
          changeRate: Math.round(changeRate * 10) / 10,
          riskCount: inv.risk,
          shortageCount: inv.shortage,
          excessCount: inv.excess,
        }
      })
      .sort((a, b) => b.currentQty - a.currentQty)

    return { rows, hasData: true }
  } catch (error) {
    console.error('카테고리 수요 동향 조회 오류:', error)
    return { rows: [], hasData: false }
  }
}
