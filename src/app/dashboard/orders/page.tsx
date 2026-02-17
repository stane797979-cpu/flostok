import { getReorderItems, getPurchaseOrders } from "@/server/actions/purchase-orders";
import { getDeliveryComplianceData } from "@/server/actions/delivery-compliance";
import { getInboundRecords } from "@/server/actions/inbound";
import { getWarehouses } from "@/server/actions/warehouses";
import { OrdersClient } from "./_components/orders-client";

const VALID_TABS = ["reorder", "auto-reorder", "orders", "inbound", "delivery", "import-shipment"] as const;
type OrderTab = (typeof VALID_TABS)[number];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; productIds?: string }>;
}) {
  const { tab, productIds } = await searchParams;
  const resolvedTab: OrderTab = tab && VALID_TABS.includes(tab as OrderTab) ? (tab as OrderTab) : "reorder";
  const preselectedProductIds = productIds ? productIds.split(",").filter(Boolean) : undefined;

  // 탭에 따라 필요한 데이터만 프리페치
  const promises: Promise<unknown>[] = [];
  const keys: string[] = [];

  // reorder/auto-reorder 탭: 발주 필요 품목 (productIds가 있으면 reorder 탭도 로드)
  if (resolvedTab === "reorder" || resolvedTab === "auto-reorder" || preselectedProductIds) {
    keys.push("reorder");
    promises.push(getReorderItems().catch(() => ({ items: [], total: 0 })));
  }

  // delivery 탭: 납기 분석
  if (resolvedTab === "delivery") {
    keys.push("compliance");
    promises.push(getDeliveryComplianceData().catch(() => null));
  }

  // orders 탭: 발주 현황
  if (resolvedTab === "orders") {
    keys.push("orders");
    promises.push(getPurchaseOrders({ limit: 50 }).catch(() => ({ orders: [], total: 0 })));
  }

  // inbound 탭: 입고 현황 (현재 월)
  if (resolvedTab === "inbound") {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
    keys.push("inbound");
    promises.push(getInboundRecords({ startDate, endDate, limit: 50 }).catch(() => ({ records: [], total: 0 })));
  }

  // 창고 목록은 항상 로드 (발주 시 창고 선택 필요)
  keys.push("warehouses");
  promises.push(getWarehouses().catch(() => ({ warehouses: [] })));

  const results = await Promise.all(promises);
  const dataMap = Object.fromEntries(keys.map((k, i) => [k, results[i]]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverReorderItems = (dataMap.reorder as any)?.items ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverReorderTotal = (dataMap.reorder as any)?.total ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deliveryComplianceData = (dataMap.compliance as any) ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverPurchaseOrders = (dataMap.orders as any)?.orders ?? undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverPurchaseOrdersTotal = (dataMap.orders as any)?.total ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverInboundRecords = (dataMap.inbound as any)?.records ?? undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverInboundTotal = (dataMap.inbound as any)?.total ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const warehousesList = (dataMap.warehouses as any)?.warehouses ?? [];

  return (
    <OrdersClient
      key={resolvedTab}
      initialTab={preselectedProductIds ? "reorder" : resolvedTab}
      serverReorderItems={serverReorderItems}
      serverReorderTotal={serverReorderTotal}
      deliveryComplianceData={deliveryComplianceData}
      serverPurchaseOrders={serverPurchaseOrders}
      serverPurchaseOrdersTotal={serverPurchaseOrdersTotal}
      serverInboundRecords={serverInboundRecords}
      serverInboundTotal={serverInboundTotal}
      warehouses={warehousesList}
      preselectedProductIds={preselectedProductIds}
    />
  );
}
