import { ProductsPageClient } from "@/components/features/products/products-page-client";
import { getProducts, getCategories } from "@/server/actions/products";
import { getInventoryList } from "@/server/actions/inventory";
import { getInventoryStatus } from "@/lib/constants/inventory-status";
import { getSuppliers } from "@/server/actions/suppliers";

/**
 * 제품 관리 페이지
 *
 * DB에서 제품 목록 + 재고 현황을 조회하여 표시
 */
export default async function ProductsPage() {
  let products: Parameters<typeof ProductsPageClient>[0]["initialProducts"] = [];
  let categories: string[] = [];
  let suppliers: { id: string; name: string }[] = [];

  try {
    const [productsResult, categoriesResult, inventoryResult, suppliersResult] = await Promise.all([
      getProducts({ limit: 500 }),
      getCategories(),
      getInventoryList({ limit: 1000 }),
      getSuppliers({ limit: 500 }),
    ]);

    categories = categoriesResult;
    suppliers = suppliersResult.suppliers.map((s) => ({ id: s.id, name: s.name }));

    // 재고 데이터를 productId 기준으로 맵핑
    const inventoryMap = new Map(
      inventoryResult.items.map((item) => [item.productId, item.currentStock])
    );

    // 제품별 재고 상태 계산
    products = productsResult.products.map((p) => {
      const currentStock = inventoryMap.get(p.id) ?? 0;
      const safetyStock = p.safetyStock ?? 0;
      const reorderPoint = p.reorderPoint ?? 0;
      const status = getInventoryStatus(currentStock, safetyStock, reorderPoint);

      return {
        ...p,
        currentStock,
        status: {
          key: status.key,
          label: status.label,
          bgClass: status.bgClass,
          textClass: status.textClass,
          borderClass: status.borderClass,
        },
      };
    });
  } catch (error) {
    console.error("제품 목록 조회 오류:", error);
  }

  return <ProductsPageClient initialProducts={products} categories={categories} suppliers={suppliers} />;
}
