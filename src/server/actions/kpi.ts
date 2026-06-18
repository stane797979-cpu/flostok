/**
 * KPI 서버 액션
 * KPI 실측 데이터를 조회하여 프론트엔드에 전달합니다.
 */

"use server";

import { requireAuth } from "./auth-helpers";
import { measureKPIMetrics, getKPITrendData } from "@/server/services/scm/kpi-measurement";
import type { KPIMetrics } from "@/server/services/scm/kpi-improvement";
import type { KPITrend, KPIFilterOptions } from "@/server/services/scm/kpi-measurement";
import { getPSIData } from "./psi";

export type { KPIFilterOptions };

/** KPI 대시보드용 전체 데이터 */
export interface KPIDashboardData {
  metrics: KPIMetrics;
  trends: KPITrend[];
  targets: KPIMetrics;
}

/** 기본 목표값 (추후 조직별 설정 가능하도록) */
const DEFAULT_TARGETS: KPIMetrics = {
  inventoryTurnoverRate: 10,
  averageInventoryDays: 40,
  inventoryAccuracy: 98,
  stockoutRate: 2,
  onTimeOrderRate: 90,
  averageLeadTime: 5,
  orderFulfillmentRate: 95,
};

/**
 * KPI 대시보드 데이터 조회
 */
export async function getKPIDashboardData(
  filters?: KPIFilterOptions
): Promise<KPIDashboardData> {
  const user = await requireAuth();

  const [metrics, trends] = await Promise.all([
    measureKPIMetrics(user.organizationId, filters),
    getKPITrendData(user.organizationId, 6, filters),
  ]);

  return {
    metrics,
    trends,
    targets: DEFAULT_TARGETS,
  };
}

/**
 * KPI 요약 데이터 (대시보드 메인용)
 */
export async function getKPISummary(): Promise<{
  inventoryTurnoverRate: number;
  averageInventoryDays: number;
  onTimeOrderRate: number;
  stockoutRate: number;
  forecastAccuracy: number;
}> {
  const user = await requireAuth();
  const [metrics, psiResult] = await Promise.all([
    measureKPIMetrics(user.organizationId),
    getPSIData(3).catch(() => null),
  ]);

  // FA = 100 - MAPE (PSI 판매계획 vs 실적 기반, 최근 3개월)
  let forecastAccuracy = 0;
  if (psiResult && psiResult.periods.length > 0) {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const pastPeriods = psiResult.periods.filter((p) => p < currentPeriod).slice(-3);
    let totalMAPE = 0;
    let validCount = 0;
    for (const p of psiResult.products) {
      for (const period of pastPeriods) {
        const m = p.months.find((mo) => mo.period === period);
        if (m && m.outboundPlan > 0) {
          totalMAPE += Math.abs(m.outbound - m.outboundPlan) / m.outboundPlan;
          validCount++;
        }
      }
    }
    forecastAccuracy = validCount > 0
      ? Math.max(0, Number((100 - (totalMAPE / validCount) * 100).toFixed(1)))
      : 0;
  }

  return {
    inventoryTurnoverRate: Number(metrics.inventoryTurnoverRate.toFixed(1)),
    averageInventoryDays: Number(metrics.averageInventoryDays.toFixed(1)),
    onTimeOrderRate: Number(metrics.onTimeOrderRate.toFixed(1)),
    stockoutRate: Number(metrics.stockoutRate.toFixed(1)),
    forecastAccuracy,
  };
}
