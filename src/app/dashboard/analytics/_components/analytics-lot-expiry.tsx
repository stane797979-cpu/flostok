import { getLotExpirySummary } from "@/server/actions/lot-expiry";
import { LotExpiryAlert } from "./lot-expiry-alert";

export async function AnalyticsLotExpiry() {
  const data = await getLotExpirySummary().catch(() => null);
  return <LotExpiryAlert data={data} />;
}
