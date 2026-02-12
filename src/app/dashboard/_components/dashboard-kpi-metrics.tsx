import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/features/dashboard/kpi-card";
import { getKPISummary } from "@/server/actions/kpi";
import Link from "next/link";

export async function DashboardKPIMetrics() {
  const kpi = await getKPISummary();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">주요 성과 지표</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/kpi">전체 KPI 보기</Link>
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard
          name="재고회전율"
          value={kpi.inventoryTurnoverRate}
          unit="회/년"
          target={10}
          status={kpi.inventoryTurnoverRate >= 10 ? "success" : kpi.inventoryTurnoverRate >= 8 ? "warning" : "danger"}
          iconName="bar-chart"
        />
        <KPICard
          name="평균 재고일수"
          value={kpi.averageInventoryDays}
          unit="일"
          target={40}
          status={kpi.averageInventoryDays <= 40 ? "success" : kpi.averageInventoryDays <= 50 ? "warning" : "danger"}
          iconName="calendar"
        />
        <KPICard
          name="적시 발주율"
          value={kpi.onTimeOrderRate}
          unit="%"
          target={90}
          status={kpi.onTimeOrderRate >= 90 ? "success" : kpi.onTimeOrderRate >= 72 ? "warning" : "danger"}
          iconName="check-circle"
        />
      </div>
    </div>
  );
}
