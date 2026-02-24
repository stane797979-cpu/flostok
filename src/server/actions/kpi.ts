/**
 * KPI 서버 액션
 * KPI 실측 데이터를 조회하여 프론트엔드에 전달합니다.
 */

"use server";

import { unstable_cache } from "next/cache";
import { requireAuth } from "./auth-helpers";
import { measureKPIMetrics, getKPITrendData } from "@/server/services/scm/kpi-measurement";
import type { KPIMetrics, KPITarget } from "@/server/services/scm/kpi-improvement";
import type { KPITrend, KPIFilterOptions } from "@/server/services/scm/kpi-measurement";

export type { KPIFilterOptions };

/** KPI 대시보드용 전체 데이터 */
export interface KPIDashboardData {
  metrics: KPIMetrics;
  trends: KPITrend[];
  targets: KPITarget;
}

/** 기본 목표값 (추후 조직별 설정 가능하도록) */
const DEFAULT_TARGETS: KPITarget = {
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
 * @param filters - ABC/XYZ 등급 또는 제품 ID 필터 (선택)
 * @returns KPI 실측값, 트렌드, 목표값
 */
export async function getKPIDashboardData(
  filters?: KPIFilterOptions
): Promise<KPIDashboardData> {
  const user = await requireAuth();
  const filterKey = filters ? JSON.stringify(filters) : "all";

  return unstable_cache(
    async () => {
      const [metrics, trends] = await Promise.all([
        measureKPIMetrics(user.organizationId, filters),
        getKPITrendData(user.organizationId, 6, filters),
      ]);

      return {
        metrics,
        trends,
        targets: DEFAULT_TARGETS,
      };
    },
    [`kpi-data-${user.organizationId}-${filterKey}`],
    { revalidate: 60, tags: [`kpi-${user.organizationId}`] }
  )();
}

/**
 * KPI 요약 데이터 (대시보드 메인용, 3개 KPI만)
 */
export async function getKPISummary(): Promise<{
  inventoryTurnoverRate: number;
  averageInventoryDays: number;
  onTimeOrderRate: number;
  stockoutRate: number;
}> {
  const user = await requireAuth();

  return unstable_cache(
    async () => {
      const metrics = await measureKPIMetrics(user.organizationId);

      return {
        inventoryTurnoverRate: Number(metrics.inventoryTurnoverRate.toFixed(1)),
        averageInventoryDays: Number(metrics.averageInventoryDays.toFixed(1)),
        onTimeOrderRate: Number(metrics.onTimeOrderRate.toFixed(1)),
        stockoutRate: Number(metrics.stockoutRate.toFixed(1)),
      };
    },
    [`kpi-summary-${user.organizationId}`],
    { revalidate: 60, tags: [`kpi-${user.organizationId}`] }
  )();
}
