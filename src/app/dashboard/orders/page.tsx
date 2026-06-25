import { getReorderItems, getPurchaseOrders } from "@/server/actions/purchase-orders";
import { OrdersClient } from "./_components/orders-client";

const VALID_TABS = ["order", "orders", "inbound", "delivery", "import-shipment"] as const;
type OrderTab = (typeof VALID_TABS)[number];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const resolvedTab: OrderTab = tab && VALID_TABS.includes(tab as OrderTab) ? (tab as OrderTab) : "order";

  const [reorderResult, ordersResult] = await Promise.allSettled([
    getReorderItems(),
    resolvedTab === "orders" ? getPurchaseOrders({ limit: 100 }) : Promise.resolve(null),
  ]);

  const serverReorderItems =
    reorderResult.status === "fulfilled" && reorderResult.value
      ? reorderResult.value.items
      : [];
  const serverPurchaseOrders =
    ordersResult.status === "fulfilled" && ordersResult.value
      ? ordersResult.value.orders
      : undefined;

  return (
    <OrdersClient
      key={resolvedTab}
      initialTab={resolvedTab}
      serverReorderItems={serverReorderItems}
      serverPurchaseOrders={serverPurchaseOrders}
    />
  );
}
