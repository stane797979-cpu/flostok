import { WarehouseInboundClient } from "./_components/warehouse-inbound-client";
import { getWarehouseInboundOrders } from "@/server/actions/inbound";
import { getWarehouses } from "@/server/actions/warehouses";

export const metadata = {
  title: "입고예정 - Stock & Logis",
  description: "창고 입고예정 목록 및 입고 처리",
};

export default async function WarehouseInboundPage() {
  const [ordersResult, warehousesResult] = await Promise.all([
    getWarehouseInboundOrders().catch(() => ({ orders: [] })),
    getWarehouses().catch(() => ({ warehouses: [] })),
  ]);

  return (
    <WarehouseInboundClient
      initialOrders={ordersResult.orders}
      warehouses={warehousesResult.warehouses.filter((w) => w.isActive)}
    />
  );
}
