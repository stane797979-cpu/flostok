import { getReorderItems } from "@/server/actions/purchase-orders";
import { getDeliveryComplianceData } from "@/server/actions/delivery-compliance";
import { OrdersClient } from "./_components/orders-client";

export default async function OrdersPage() {
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
      serverReorderItems={serverReorderItems}
      deliveryComplianceData={deliveryComplianceData}
    />
  );
}
