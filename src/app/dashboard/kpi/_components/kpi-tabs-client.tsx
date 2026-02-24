"use client";

import { useState, useTransition, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KPIGrid } from "@/components/features/dashboard/kpi-grid";
import { KPIImprovementSuggestions } from "@/components/features/dashboard/kpi-improvement-suggestions";
import { KpiMonthlyTrendTable } from "./kpi-monthly-trend-table";
import { KPIFilters } from "./kpi-filters";
import { getKPIDashboardData } from "@/server/actions/kpi";
import type { KPIMetrics, KPITarget } from "@/server/services/scm/kpi-improvement";
import type { KPITrend } from "@/server/services/scm/kpi-measurement";

interface KpiTabsClientProps {
  metrics: KPIMetrics;
  trends: KPITrend[];
  targets: KPITarget;
}

export function KpiTabsClient({
  metrics: initialMetrics,
  trends: initialTrends,
  targets,
}: KpiTabsClientProps) {
  const [abcFilter, setAbcFilter] = useState("all");
  const [xyzFilter, setXyzFilter] = useState("all");

  const [metrics, setMetrics] = useState(initialMetrics);
  const [trends, setTrends] = useState(initialTrends);

  const [isPending, startTransition] = useTransition();

  const isFiltered = abcFilter !== "all" || xyzFilter !== "all";

  const handleFilterChange = useCallback((newAbc: string, newXyz: string) => {
    startTransition(async () => {
      const filters: Record<string, string> = {};
      if (newAbc !== "all") filters.abcGrade = newAbc;
      if (newXyz !== "all") filters.xyzGrade = newXyz;

      const hasFilters = Object.keys(filters).length > 0;
      const data = await getKPIDashboardData(
        hasFilters
          ? (filters as { abcGrade?: "A" | "B" | "C"; xyzGrade?: "X" | "Y" | "Z" })
          : undefined
      );
      setMetrics(data.metrics);
      setTrends(data.trends);
    });
  }, []);

  const handleAbcChange = (v: string) => {
    setAbcFilter(v);
    handleFilterChange(v, xyzFilter);
  };

  const handleXyzChange = (v: string) => {
    setXyzFilter(v);
    handleFilterChange(abcFilter, v);
  };

  return (
    <Tabs defaultValue="status" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <TabsList>
          <TabsTrigger value="status">현황</TabsTrigger>
          <TabsTrigger value="monthly-trend">월별 추이</TabsTrigger>
          <TabsTrigger value="improvement">개선 제안</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-3">
          <KPIFilters
            abcFilter={abcFilter}
            onAbcFilterChange={handleAbcChange}
            xyzFilter={xyzFilter}
            onXyzFilterChange={handleXyzChange}
            isLoading={isPending}
          />
          {isFiltered && (
            <Badge variant="secondary" className="text-xs">
              {abcFilter !== "all" ? `${abcFilter}등급` : ""}
              {abcFilter !== "all" && xyzFilter !== "all" ? " + " : ""}
              {xyzFilter !== "all" ? `${xyzFilter}등급` : ""}
            </Badge>
          )}
        </div>
      </div>

      <TabsContent value="status">
        <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : ""}>
          <KPIGrid metrics={metrics} trends={trends} targets={targets} />
        </div>
      </TabsContent>

      <TabsContent value="monthly-trend">
        <KpiMonthlyTrendTable trends={initialTrends} />
      </TabsContent>

      <TabsContent value="improvement">
        <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : ""}>
          <KPIImprovementSuggestions metrics={metrics} targets={targets} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
