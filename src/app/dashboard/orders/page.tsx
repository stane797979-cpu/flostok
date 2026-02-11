import { getReorderItems } from "@/server/actions/purchase-orders";
import { getDeliveryComplianceData } from "@/server/actions/delivery-compliance";
import { OrdersClient } from "./_components/orders-client";

const VALID_TABS = ["reorder", "auto-reorder", "orders", "inbound", "delivery", "import-shipment"] as const;
type OrderTab = (typeof VALID_TABS)[number];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const resolvedTab: OrderTab = tab && VALID_TABS.includes(tab as OrderTab) ? (tab as OrderTab) : "reorder";

  const [reorderResult, complianceResult] = await Promise.allSettled([
    getReorderItems(),
    getDeliveryComplianceData(),
  ]);

  const serverReorderItems =
    reorderResult.status === "fulfilled" ? reorderResult.value.items : [];
  const deliveryComplianceData =
    complianceResult.status === "fulfilled" ? complianceResult.value : null;

  return (
    <OrdersClient
      key={resolvedTab}
      initialTab={resolvedTab}
      serverReorderItems={serverReorderItems}
      deliveryComplianceData={deliveryComplianceData}
    />
  );
}
