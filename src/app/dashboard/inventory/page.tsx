import { getInventoryList, getInventoryStats } from "@/server/actions/inventory";
import { getWarehouses } from "@/server/actions/warehouses";
import { InventoryPageClient } from "@/components/features/inventory/inventory-page-client";

const VALID_PAGE_SIZES = [50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

interface InventoryPageProps {
  searchParams: Promise<{ warehouseId?: string; page?: string; size?: string }>;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  try {
    const params = await searchParams;
    const warehouseId = params.warehouseId;
    const pageSize = VALID_PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : DEFAULT_PAGE_SIZE;
    const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
    const offset = (currentPage - 1) * pageSize;

    const [{ items, total }, stats, { warehouses }] = await Promise.all([
      getInventoryList({ limit: pageSize, offset, warehouseId }),
      getInventoryStats(warehouseId),
      getWarehouses(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // InventoryItem 형태로 매핑
    const inventoryItems = items.map((item) => ({
      id: item.id,
      productId: item.productId,
      warehouseId: item.warehouseId,
      currentStock: item.currentStock,
      availableStock: item.availableStock,
      daysOfInventory: item.daysOfInventory,
      location: item.location,
      product: {
        sku: item.product.sku,
        name: item.product.name,
        safetyStock: item.product.safetyStock,
        reorderPoint: item.product.reorderPoint,
        abcGrade: item.product.abcGrade as "A" | "B" | "C" | null,
        xyzGrade: item.product.xyzGrade as "X" | "Y" | "Z" | null,
      },
      warehouse: item.warehouse
        ? {
            id: item.warehouse.id,
            name: item.warehouse.name,
            code: item.warehouse.code,
          }
        : null,
    }));

    // 통계 계산
    const clientStats = {
      totalProducts: stats.totalProducts,
      needsOrder: stats.outOfStock + stats.critical + stats.shortage,
      outOfStockAndCritical: stats.outOfStock + stats.critical,
      excess: stats.excess,
    };

    return (
      <InventoryPageClient
        items={inventoryItems}
        stats={clientStats}
        warehouses={warehouses}
        selectedWarehouseId={warehouseId}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
      />
    );
  } catch (error) {
    console.error("재고 현황 데이터 로드 실패:", error);
    return (
      <InventoryPageClient
        items={[]}
        stats={{ totalProducts: 0, needsOrder: 0, outOfStockAndCritical: 0, excess: 0 }}
        warehouses={[]}
        selectedWarehouseId={undefined}
        currentPage={1}
        totalPages={1}
        totalItems={0}
        pageSize={DEFAULT_PAGE_SIZE}
      />
    );
  }
}
