import { InventoryStatusChart } from "@/components/features/dashboard/inventory-status-chart";
import { getInventoryStats } from "@/server/actions/inventory";

export async function DashboardStatusChart() {
  const stats = await getInventoryStats();

  // 재고상태 분포 계산
  const statusDistribution: Record<string, number> = {};
  if (stats.outOfStock > 0) statusDistribution["out_of_stock"] = stats.outOfStock;
  if (stats.critical > 0) statusDistribution["critical"] = stats.critical;
  if (stats.shortage > 0) statusDistribution["shortage"] = stats.shortage;
  if (stats.optimal > 0) statusDistribution["optimal"] = stats.optimal;
  if (stats.excess > 0) statusDistribution["excess"] = stats.excess;
  const accounted = stats.outOfStock + stats.critical + stats.shortage + stats.optimal + stats.excess;
  const remaining = stats.totalProducts - accounted;
  if (remaining > 0) statusDistribution["caution"] = remaining;

  return (
    <InventoryStatusChart distribution={statusDistribution} totalSku={stats.totalProducts} />
  );
}
