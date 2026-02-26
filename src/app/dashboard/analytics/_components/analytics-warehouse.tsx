import { getWarehouseComparisonData } from "@/server/actions/warehouse-analytics";
import { WarehouseComparison } from "./warehouse-comparison";

export async function AnalyticsWarehouse() {
  const data = await getWarehouseComparisonData().catch(() => null);
  return <WarehouseComparison data={data} />;
}
