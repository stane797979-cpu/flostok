import { getFulfillmentRateData } from "@/server/actions/fulfillment-rate";
import { FulfillmentRateTable } from "./fulfillment-rate-table";

export async function AnalyticsFulfillment() {
  const data = await getFulfillmentRateData().catch(() => null);
  return <FulfillmentRateTable data={data} />;
}
