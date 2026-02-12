export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { QuickActions } from "@/components/features/dashboard/quick-actions";
import { RecentActivityFeed } from "@/components/features/dashboard/recent-activity-feed";
import { DashboardStatsCards } from "./_components/dashboard-stats-cards";
import { DashboardKPIMetrics } from "./_components/dashboard-kpi-metrics";
import { DashboardStatusChart } from "./_components/dashboard-status-chart";
import { DashboardOrderItems } from "./_components/dashboard-order-items";
import { DashboardTurnover } from "./_components/dashboard-turnover";
import { DashboardABCMatrix } from "./_components/dashboard-abc-matrix";
import {
  StatsCardsSkeleton,
  KPIMetricsSkeleton,
  ChartSkeleton,
  ListSkeleton,
  MatrixSkeleton,
} from "./_components/dashboard-skeletons";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* 통계 카드 — 가장 빠른 쿼리, 즉시 스트리밍 */}
      <Suspense fallback={<StatsCardsSkeleton />}>
        <DashboardStatsCards />
      </Suspense>

      {/* 빠른 액션 — 정적 컴포넌트, 즉시 표시 */}
      <QuickActions />

      {/* 주요 KPI 요약 */}
      <Suspense fallback={<KPIMetricsSkeleton />}>
        <DashboardKPIMetrics />
      </Suspense>

      {/* 재고상태 분포 차트 + 발주 필요 품목 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          <DashboardStatusChart />
        </Suspense>
        <Suspense fallback={<ListSkeleton />}>
          <DashboardOrderItems />
        </Suspense>
      </div>

      {/* 회전율 TOP5 */}
      <Suspense fallback={<ListSkeleton />}>
        <DashboardTurnover />
      </Suspense>

      {/* ABC-XYZ 미니매트릭스 + 최근 활동 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<MatrixSkeleton />}>
          <DashboardABCMatrix />
        </Suspense>
        <RecentActivityFeed />
      </div>
    </div>
  );
}
