import { getKPIDashboardData } from "@/server/actions/kpi";
import { getKpiSnapshots, ensureKpiSnapshots } from "@/server/actions/kpi-snapshots";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { KpiTabsClient } from "./_components/kpi-tabs-client";

export default async function KPIPage() {
  let data;
  let snapshots;
  try {
    [data, snapshots] = await Promise.all([
      getKPIDashboardData(),
      getKpiSnapshots(),
    ]);
  } catch {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">KPI 대시보드</h1>
          <p className="mt-2 text-slate-500">핵심 성과 지표 현황 및 개선 제안</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">KPI 데이터를 불러올 수 없습니다</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
              로그인 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의하세요.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { metrics, trends, targets } = data;

  // 스냅샷이 없으면 trends 데이터로 자동 생성
  if (snapshots.length === 0 && trends.length > 0) {
    await ensureKpiSnapshots(trends);
    snapshots = await getKpiSnapshots();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">KPI 대시보드</h1>
        <p className="mt-2 text-slate-500">핵심 성과 지표 현황 및 개선 제안</p>
      </div>

      <KpiTabsClient
        metrics={metrics}
        trends={trends}
        targets={targets}
        snapshots={snapshots}
      />
    </div>
  );
}
