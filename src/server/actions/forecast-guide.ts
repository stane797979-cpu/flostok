'use server'

/**
 * 수요예측 가이드 Server Actions
 *
 * 사용자가 간단한 질문에 답변하면 최적의 예측 방법과 공급 전략을 추천합니다.
 * 기존 demand-forecast 서비스의 selectMethodByRules()를 재활용합니다.
 */

import { db } from '@/server/db'
import { products } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from './auth-helpers'
import { selectMethodByRules } from '@/server/services/scm/demand-forecast/selector'
import type { ForecastMetadata, ForecastMethodType } from '@/server/services/scm/demand-forecast/types'
import type { ABCGrade, XYZGrade } from '@/server/services/scm/abc-xyz-analysis'

// ===== 타입 =====

export interface GuideAnswers {
  productId?: string
  salesPattern: 'stable' | 'variable' | 'irregular'
  trend: 'growing' | 'declining' | 'stable' | 'unknown'
  importance: 'core' | 'important' | 'auxiliary'
  dataPeriod: 'less_3m' | '3_6m' | '6_12m' | 'over_12m'
  inventoryStatus: 'excess' | 'adequate' | 'shortage'
}

export interface SupplyStrategy {
  name: string
  orderType: string
  safetyLevel: string
  reviewCycle: string
  tip: string
}

export interface GuideRecommendation {
  method: ForecastMethodType
  businessName: string
  description: string
  reasons: string[]
  confidence: 'high' | 'medium' | 'low'
  confidenceLabel: string
  confidenceDescription: string
  supplyStrategy: SupplyStrategy
  combinedGrade: string
  warnings: string[]
}

export interface ProductOption {
  id: string
  sku: string
  name: string
  abcGrade: string | null
  xyzGrade: string | null
}

// ===== 비즈니스 언어 상수 =====

const METHOD_BUSINESS_NAMES: Record<ForecastMethodType, string> = {
  SMA: '과거 평균 기반 예측',
  SES: '최근 변화 반영 예측',
  Holts: '성장/감소 추세 반영 예측',
}

const METHOD_DESCRIPTIONS: Record<ForecastMethodType, string> = {
  SMA: '최근 몇 개월의 판매량을 단순 평균하여 다음 달을 예측합니다. 직관적이고 안정적인 방법으로, 판매가 일정한 제품에 가장 적합합니다.',
  SES: '모든 과거 데이터를 활용하되, 최근 판매 변화에 더 높은 비중을 둡니다. 변동이 있지만 큰 추세는 없는 제품에 적합합니다.',
  Holts: '판매량의 수준과 증감 추세를 동시에 추적합니다. 꾸준히 성장하거나 감소하는 제품의 미래를 더 정확하게 예측합니다.',
}

const SUPPLY_STRATEGIES: Record<string, SupplyStrategy> = {
  AX: { name: '자동 발주 최적', orderType: 'JIT(적시) 자동 발주', safetyLevel: '최소', reviewCycle: '월 1회', tip: '예측 정확도가 높아 자동화에 최적입니다' },
  AY: { name: '정기 발주 + 안전재고', orderType: '정기 발주', safetyLevel: '표준', reviewCycle: '격주', tip: '수요예측 정교화로 재고 비용 절감이 가능합니다' },
  AZ: { name: '수시 발주 + 높은 안전재고', orderType: '수시 발주', safetyLevel: '높음', reviewCycle: '주 1회', tip: '핵심 제품이므로 품절 방지가 최우선입니다' },
  BX: { name: '정기 발주', orderType: '정기 발주', safetyLevel: '표준', reviewCycle: '월 1회', tip: '안정적이므로 효율적 관리가 가능합니다' },
  BY: { name: '혼합 발주', orderType: '정기 + 수시', safetyLevel: '표준', reviewCycle: '격주', tip: '상황에 따라 유연하게 대응하세요' },
  BZ: { name: '수시 발주', orderType: '수시 발주', safetyLevel: '약간 높음', reviewCycle: '주 1회', tip: '수요 패턴 분석으로 예측력 개선이 가능합니다' },
  CX: { name: '대량 발주 (연 1~2회)', orderType: '대량 일괄', safetyLevel: '최소', reviewCycle: '분기', tip: '발주 비용 절감을 위해 한 번에 많이 주문하세요' },
  CY: { name: '필요시 발주', orderType: '필요시', safetyLevel: '최소', reviewCycle: '분기', tip: '재고 최소화, 필요할 때만 발주하세요' },
  CZ: { name: '최소 재고 + 수시 발주', orderType: '주문 시 발주', safetyLevel: '없음', reviewCycle: '수시', tip: '주문생산(MTO) 방식 검토를 권장합니다' },
}

const DEFAULT_STRATEGY: SupplyStrategy = {
  name: '표준 발주',
  orderType: '정기 발주',
  safetyLevel: '표준',
  reviewCycle: '월 1회',
  tip: '기본 발주 전략을 적용합니다',
}

// ===== 변환 함수 =====

const XYZ_MAP: Record<GuideAnswers['salesPattern'], XYZGrade> = {
  stable: 'X',
  variable: 'Y',
  irregular: 'Z',
}

const ABC_MAP: Record<GuideAnswers['importance'], ABCGrade> = {
  core: 'A',
  important: 'B',
  auxiliary: 'C',
}

const MONTHS_MAP: Record<GuideAnswers['dataPeriod'], number> = {
  less_3m: 2,
  '3_6m': 4,
  '6_12m': 9,
  over_12m: 18,
}

function mapAnswersToMetadata(answers: GuideAnswers): ForecastMetadata {
  const trendMap: Record<GuideAnswers['trend'], { hasTrend: boolean; yoyGrowthRate?: number }> = {
    growing: { hasTrend: true, yoyGrowthRate: 25 },
    declining: { hasTrend: true, yoyGrowthRate: -25 },
    stable: { hasTrend: false, yoyGrowthRate: 0 },
    unknown: { hasTrend: false },
  }

  return {
    dataMonths: MONTHS_MAP[answers.dataPeriod],
    xyzGrade: XYZ_MAP[answers.salesPattern],
    abcGrade: ABC_MAP[answers.importance],
    hasTrend: trendMap[answers.trend].hasTrend,
    yoyGrowthRate: trendMap[answers.trend].yoyGrowthRate,
    isOverstock: answers.inventoryStatus === 'excess',
  }
}

function estimateConfidence(metadata: ForecastMetadata): 'high' | 'medium' | 'low' {
  let score = 0

  // 데이터 기간
  if (metadata.dataMonths >= 12) score += 3
  else if (metadata.dataMonths >= 6) score += 2
  else if (metadata.dataMonths >= 3) score += 1

  // XYZ 등급
  if (metadata.xyzGrade === 'X') score += 3
  else if (metadata.xyzGrade === 'Y') score += 2
  else score += 0

  // ABC+XYZ 조합
  if (metadata.abcGrade === 'A' && metadata.xyzGrade === 'X') score += 1

  if (score >= 5) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

const CONFIDENCE_LABELS: Record<string, { label: string; description: string }> = {
  high: { label: '높음', description: '이 조합에서는 높은 정확도가 기대됩니다. 예측 결과를 발주에 적극 활용하세요.' },
  medium: { label: '보통', description: '어느 정도의 오차가 있을 수 있습니다. 안전재고를 약간 여유 있게 설정하세요.' },
  low: { label: '낮음', description: '예측이 어려운 유형입니다. 담당자 경험을 병행하여 판단하세요.' },
}

function buildReasons(metadata: ForecastMetadata, answers: GuideAnswers): string[] {
  const reasons: string[] = []

  const patternLabels: Record<string, string> = {
    stable: '안정적 (매달 비슷)',
    variable: '변동적 (오르내림 있음)',
    irregular: '불규칙 (예측 어려움)',
  }
  reasons.push(`판매 패턴: ${patternLabels[answers.salesPattern]}`)

  const importanceLabels: Record<string, string> = {
    core: '핵심 매출 제품 (A등급)',
    important: '중간 비중 제품 (B등급)',
    auxiliary: '보조 제품 (C등급)',
  }
  reasons.push(`매출 비중: ${importanceLabels[answers.importance]}`)

  const trendLabels: Record<string, string> = {
    growing: '꾸준히 성장 중',
    declining: '감소 추세',
    stable: '변화 없음',
    unknown: '판단 보류 (시스템 자동 판단)',
  }
  reasons.push(`판매 추세: ${trendLabels[answers.trend]}`)

  const periodLabels: Record<string, string> = {
    less_3m: '3개월 미만 (부족)',
    '3_6m': '3~6개월 (최소)',
    '6_12m': '6~12개월 (충분)',
    over_12m: '1년 이상 (풍부)',
  }
  reasons.push(`데이터 기간: ${periodLabels[answers.dataPeriod]}`)

  if (metadata.isOverstock) {
    reasons.push('재고 상태: 과다 (보수적 예측 적용)')
  }

  return reasons
}

function buildWarnings(metadata: ForecastMetadata, answers: GuideAnswers): string[] {
  const warnings: string[] = []

  if (metadata.dataMonths < 3) {
    warnings.push('판매 데이터가 3개월 미만이면 예측 정확도가 낮습니다. 데이터가 쌓일 때까지 담당자 경험 기반 발주를 권장합니다.')
  }

  if (metadata.xyzGrade === 'Z' && metadata.abcGrade === 'A') {
    warnings.push('핵심 제품인데 수요가 불안정합니다. 안전재고를 높게 설정하고 공급자와 긴밀히 협력하세요.')
  }

  if (metadata.isOverstock) {
    warnings.push('재고가 과다한 상태입니다. 예측값이 보수적으로 조정됩니다 (약 10% 감소).')
  }

  if (answers.inventoryStatus === 'shortage') {
    warnings.push('재고 부족이 잦다면 안전재고 수준을 재검토하세요. 서비스 수준을 95%에서 99%로 올리는 것을 고려해보세요.')
  }

  if (metadata.dataMonths >= 3 && metadata.dataMonths < 6 && metadata.abcGrade === 'A') {
    warnings.push('핵심 제품의 데이터가 6개월 미만입니다. 더 정교한 예측을 위해 데이터가 쌓이면 재분석을 권장합니다.')
  }

  return warnings
}

// ===== Server Actions =====

/**
 * 제품 목록 조회 (경량)
 */
export async function getProductListForGuide(): Promise<ProductOption[]> {
  const user = await requireAuth()

  const items = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      abcGrade: products.abcGrade,
      xyzGrade: products.xyzGrade,
    })
    .from(products)
    .where(eq(products.organizationId, user.organizationId))

  return items
}

/**
 * 규칙 기반 추천 (답변만으로 추천, 실제 데이터 불필요)
 */
export async function getGuideRecommendation(answers: GuideAnswers): Promise<GuideRecommendation> {
  const metadata = mapAnswersToMetadata(answers)
  const method = selectMethodByRules(metadata)
  const combinedGrade = `${metadata.abcGrade || 'B'}${metadata.xyzGrade || 'Y'}`
  const confidence = estimateConfidence(metadata)

  return {
    method: method.name,
    businessName: METHOD_BUSINESS_NAMES[method.name],
    description: METHOD_DESCRIPTIONS[method.name],
    reasons: buildReasons(metadata, answers),
    confidence,
    confidenceLabel: CONFIDENCE_LABELS[confidence].label,
    confidenceDescription: CONFIDENCE_LABELS[confidence].description,
    supplyStrategy: SUPPLY_STRATEGIES[combinedGrade] || DEFAULT_STRATEGY,
    combinedGrade,
    warnings: buildWarnings(metadata, answers),
  }
}
