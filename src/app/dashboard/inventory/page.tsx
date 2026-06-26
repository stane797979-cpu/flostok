import { getInventoryList, getInventoryStats } from "@/server/actions/inventory";
import { InventoryPageClient } from "@/components/features/inventory/inventory-page-client";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  try {
    const [{ items }, stats] = await Promise.all([
      getInventoryList({ limit: 500 }),
      getInventoryStats(),
    ]);

    const inventoryItems = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      currentStock: item.currentStock,
      allocatedStock: item.allocatedStock,
      availableStock: item.availableStock,
      daysOfInventory: item.daysOfInventory,
      avgDailySales: item.avgDailySales ?? null,
      location: item.location,
      product: {
        sku: item.product.sku,
        name: item.product.name,
        safetyStock: item.product.safetyStock,
        reorderPoint: item.product.reorderPoint,
        abcGrade: item.product.abcGrade as "A" | "B" | "C" | null,
        xyzGrade: item.product.xyzGrade as "X" | "Y" | "Z" | null,
      },
    }));

    const clientStats = {
      totalProducts: stats.totalProducts,
      needsOrder: stats.needsOrder,
      outOfStockAndCritical: stats.urgent,
      excess: stats.excess,
    };

    return (
      <InventoryPageClient
        items={inventoryItems}
        stats={clientStats}
      />
    );
  } catch (error) {
    console.error("재고 현황 데이터 로드 실패:", error);
    return (
      <InventoryPageClient
        items={[]}
        stats={{ totalProducts: 0, needsOrder: 0, outOfStockAndCritical: 0, excess: 0 }}
      />
    );
  }
}
