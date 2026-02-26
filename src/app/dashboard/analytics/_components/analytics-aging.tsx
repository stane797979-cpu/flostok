import { getInventoryAgingData } from "@/server/actions/inventory-aging";
import { InventoryAging } from "./inventory-aging";

export async function AnalyticsAging() {
  const data = await getInventoryAgingData().catch(() => null);
  return <InventoryAging data={data} />;
}
