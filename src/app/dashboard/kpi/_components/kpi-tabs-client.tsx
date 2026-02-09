"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPIGrid } from "@/components/features/dashboard/kpi-grid";
import { KPIImprovementSuggestions } from "@/components/features/dashboard/kpi-improvement-suggestions";
import { KpiMonthlyTrendTable } from "./kpi-monthly-trend-table";
import type { KPIMetrics } from "@/server/services/scm/kpi-improvement";
import type { KPITrend } from "@/server/services/scm/kpi-measurement";
import type { KpiSnapshot } from "@/server/actions/kpi-snapshots";

interface KpiTabsClientProps {
  metrics: KPIMetrics;
  trends: KPITrend[];
  targets: KPIMetrics;
  snapshots: KpiSnapshot[];
}

export function KpiTabsClient({ metrics, trends, targets, snapshots }: KpiTabsClientProps) {
  return (
    <Tabs defaultValue="status" className="space-y-6">
      <TabsList>
        <TabsTrigger value="status">현황</TabsTrigger>
        <TabsTrigger value="monthly-trend">월별 추이</TabsTrigger>
        <TabsTrigger value="improvement">개선 제안</TabsTrigger>
      </TabsList>

      <TabsContent value="status">
        <KPIGrid metrics={metrics} trends={trends} targets={targets} />
      </TabsContent>

      <TabsContent value="monthly-trend">
        <KpiMonthlyTrendTable snapshots={snapshots} />
      </TabsContent>

      <TabsContent value="improvement">
        <KPIImprovementSuggestions metrics={metrics} targets={targets} />
      </TabsContent>
    </Tabs>
  );
}
