import { getReorderItems, getPurchaseOrders } from "@/server/actions/purchase-orders";
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

  const fetchPromises: [
    Promise<Awaited<ReturnType<typeof getReorderItems>> | null>,
    Promise<Awaited<ReturnType<typeof getDeliveryComplianceData>> | null>,
    Promise<Awaited<ReturnType<typeof getPurchaseOrders>> | null>,
  ] = [
    resolvedTab === "reorder" || resolvedTab === "auto-reorder"
      ? getReorderItems()
      : Promise.resolve(null),
    resolvedTab === "delivery"
      ? getDeliveryComplianceData()
      : Promise.resolve(null),
    resolvedTab === "orders"
      ? getPurchaseOrders({ limit: 100 })
      : Promise.resolve(null),
  ];

  const [reorderResult, complianceResult, ordersResult] = await Promise.allSettled(fetchPromises);

  const serverReorderItems =
    reorderResult.status === "fulfilled" && reorderResult.value
      ? reorderResult.value.items
      : [];
  const deliveryComplianceData =
    complianceResult.status === "fulfilled" ? complianceResult.value : null;
  const serverPurchaseOrders =
    ordersResult.status === "fulfilled" && ordersResult.value
      ? ordersResult.value.orders
      : undefined;

  return (
    <OrdersClient
      key={resolvedTab}
      initialTab={resolvedTab}
      serverReorderItems={serverReorderItems}
      deliveryComplianceData={deliveryComplianceData}
      serverPurchaseOrders={serverPurchaseOrders}
    />
  );
}
