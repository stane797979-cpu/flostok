import { getInventoryList, getInventoryStats } from "@/server/actions/inventory";
import { InventoryPageClient } from "@/components/features/inventory/inventory-page-client";

export default async function InventoryPage() {
  try {
    const [{ items }, stats] = await Promise.all([
      getInventoryList({ limit: 50 }),
      getInventoryStats(),
    ]);

    // InventoryItem 형태로 매핑
    const inventoryItems = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      currentStock: item.currentStock,
      availableStock: item.availableStock,
      daysOfInventory: item.daysOfInventory,
      location: item.location,
      product: {
        sku: item.product.sku,
        name: item.product.name,
        safetyStock: item.product.safetyStock,
        reorderPoint: item.product.reorderPoint,
        abcGrade: item.product.abcGrade,
        xyzGrade: item.product.xyzGrade,
      },
    }));

    // 통계 계산
    const clientStats = {
      totalProducts: stats.totalProducts,
      needsOrder: stats.outOfStock + stats.critical + stats.shortage,
      outOfStockAndCritical: stats.outOfStock + stats.critical,
      excess: stats.excess,
    };

    return <InventoryPageClient items={inventoryItems} stats={clientStats} />;
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
