import { getInventoryTurnoverData } from "@/server/actions/turnover";
import { InventoryTurnover } from "./inventory-turnover";

export async function AnalyticsTurnover() {
  const data = await getInventoryTurnoverData().catch(() => null);
  return <InventoryTurnover data={data} />;
}
