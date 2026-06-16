"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "./kpi-card";
import { KPISparkline } from "./kpi-sparkline";
import type { KPIMetrics } from "@/server/services/scm/kpi-improvement";
import type { KPITrend } from "@/server/services/scm/kpi-measurement";

/**
 * KPI 상태를 값과 목표로 판단
 */
function getKPIStatus(
  value: number,
  target: number,
  lowerIsBetter: boolean = false
): "success" | "warning" | "danger" {
  const ratio = lowerIsBetter ? target / value : value / target;
  if (ratio >= 1) return "success";
  if (ratio >= 0.8) return "warning";
  return "danger";
}

interface KPIGridProps {
  metrics: KPIMetrics;
  trends: KPITrend[];
  targets: KPIMetrics;
}

export function KPIGrid({ metrics, trends, targets }: KPIGridProps) {
  // 트렌드에서 각 KPI의 스파크라인 데이터 추출
  const turnoverTrend = trends.map((t) => t.inventoryTurnoverRate);
  const stockoutTrend = trends.map((t) => t.stockoutRate);
  const onTimeTrend = trends.map((t) => t.onTimeOrderRate);

  // 평균 재고일수 트렌드 (회전율에서 역산)
  const avgDaysTrend = turnoverTrend.map((r) => (r > 0 ? 365 / r : 0));

  return (
    <div className="space-y-6">
      {/* 재고 관련 KPI */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">재고 관련 지표</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            name="재고회전율"
            value={Number(metrics.inventoryTurnoverRate.toFixed(1))}
            unit="회/년"
            target={targets.inventoryTurnoverRate}
            status={getKPIStatus(metrics.inventoryTurnoverRate, targets.inventoryTurnoverRate)}
            iconName="bar-chart"
          />
          <KPICard
            name="평균 재고일수"
            value={Number(metrics.averageInventoryDays.toFixed(1))}
            unit="일"
            target={targets.averageInventoryDays}
            status={getKPIStatus(metrics.averageInventoryDays, targets.averageInventoryDays, true)}
            iconName="calendar"
          />
          <KPICard
            name="재고 정확도"
            value={Number(metrics.inventoryAccuracy.toFixed(1))}
            unit="%"
            target={targets.inventoryAccuracy}
            status={getKPIStatus(metrics.inventoryAccuracy, targets.inventoryAccuracy)}
            iconName="percent"
          />
          <KPICard
            name="품절률"
            value={Number(metrics.stockoutRate.toFixed(1))}
            unit="%"
            target={targets.stockoutRate}
            status={getKPIStatus(metrics.stockoutRate, targets.stockoutRate, true)}
            iconName="alert"
          />
        </div>
      </div>

      {/* 발주 관련 KPI */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">발주 관련 지표</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard
            name="적시 발주율"
            value={Number(metrics.onTimeOrderRate.toFixed(1))}
            unit="%"
            target={targets.onTimeOrderRate}
            status={getKPIStatus(metrics.onTimeOrderRate, targets.onTimeOrderRate)}
            iconName="check-circle"
          />
          <KPICard
            name="평균 리드타임"
            value={Number(metrics.averageLeadTime.toFixed(1))}
            unit="일"
            target={targets.averageLeadTime}
            status={getKPIStatus(metrics.averageLeadTime, targets.averageLeadTime, true)}
            iconName="clock"
          />
          <KPICard
            name="발주 충족률"
            value={Number(metrics.orderFulfillmentRate.toFixed(1))}
            unit="%"
            target={targets.orderFulfillmentRate}
            status={getKPIStatus(metrics.orderFulfillmentRate, targets.orderFulfillmentRate)}
            iconName="check-circle"
          />
        </div>
      </div>

      {/* 주요 KPI 트렌드 차트 */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>주요 지표 트렌드 ({trends.length}개월)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* 재고회전율 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">재고회전율</span>
                  <span className="text-xs text-slate-500">회/년</span>
                </div>
                <KPISparkline data={turnoverTrend} color="green" height={40} />
                {turnoverTrend.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>시작: {turnoverTrend[0].toFixed(1)}</span>
                    <span className="font-medium text-green-600">
                      현재: {turnoverTrend[turnoverTrend.length - 1].toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* 평균 재고일수 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">평균 재고일수</span>
                  <span className="text-xs text-slate-500">일</span>
                </div>
                <KPISparkline data={avgDaysTrend} color="blue" height={40} />
                {avgDaysTrend.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>시작: {avgDaysTrend[0] > 500 ? "-" : avgDaysTrend[0].toFixed(0)}</span>
                    <span className="font-medium text-blue-600">
                      현재:{" "}
                      {avgDaysTrend[avgDaysTrend.length - 1] > 500
                        ? "-"
                        : avgDaysTrend[avgDaysTrend.length - 1].toFixed(0)}
                    </span>
                  </div>
                )}
              </div>

              {/* 품절률 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">품절률</span>
                  <span className="text-xs text-slate-500">%</span>
                </div>
                <KPISparkline data={stockoutTrend} color="red" height={40} />
                {stockoutTrend.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>시작: {stockoutTrend[0].toFixed(1)}%</span>
                    <span className="font-medium text-red-600">
                      현재: {stockoutTrend[stockoutTrend.length - 1].toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* 적시 발주율 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">적시 발주율</span>
                  <span className="text-xs text-slate-500">%</span>
                </div>
                <KPISparkline data={onTimeTrend} color="green" height={40} />
                {onTimeTrend.length > 0 && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>시작: {onTimeTrend[0].toFixed(1)}%</span>
                    <span className="font-medium text-green-600">
                      현재: {onTimeTrend[onTimeTrend.length - 1].toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
