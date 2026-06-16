import { WarehouseInboundClient } from "./_components/warehouse-inbound-client";

export const metadata = {
  title: "입고예정 - Stock & Logis",
  description: "창고 입고예정 목록 및 입고 처리",
};

export default function WarehouseInboundPage() {
  return <WarehouseInboundClient />;
}
