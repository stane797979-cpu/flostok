import { TurnoverTop5Card } from "@/components/features/dashboard/turnover-top5-card";
import { getInventoryTurnoverData } from "@/server/actions/turnover";

export async function DashboardTurnover() {
  const turnoverResult = await getInventoryTurnoverData().catch(() => null);

  const turnoverTop5 = turnoverResult
    ? {
        fastest: turnoverResult.top5Fastest.map((t) => ({
          sku: t.sku,
          productName: t.name,
          turnoverRate: t.turnoverRate,
          daysOfInventory: t.daysOfInventory,
        })),
        slowest: turnoverResult.top5Slowest.map((t) => ({
          sku: t.sku,
          productName: t.name,
          turnoverRate: t.turnoverRate,
          daysOfInventory: t.daysOfInventory,
        })),
      }
    : { fastest: [], slowest: [] };

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">재고 회전율 TOP5</h2>
      <TurnoverTop5Card fastest={turnoverTop5.fastest} slowest={turnoverTop5.slowest} />
    </div>
  );
}
