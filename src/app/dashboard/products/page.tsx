import { ProductsPageClient } from "@/components/features/products/products-page-client";
import { getProducts, getCategories } from "@/server/actions/products";
import { getInventoryList } from "@/server/actions/inventory";
import { getInventoryStatus } from "@/lib/constants/inventory-status";

const VALID_PAGE_SIZES = [50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

interface ProductsPageProps {
  searchParams: Promise<{ page?: string; size?: string }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  try {
    const params = await searchParams;
    const pageSize = VALID_PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : DEFAULT_PAGE_SIZE;
    const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
    const offset = (currentPage - 1) * pageSize;

    // 1단계: 제품 목록 + 카테고리 병렬 조회
    const [productsResult, categoriesResult] = await Promise.all([
      getProducts({ limit: pageSize, offset }),
      getCategories(),
    ]);

    const totalPages = Math.max(1, Math.ceil(productsResult.total / pageSize));

    // 2단계: 현재 페이지 제품 ID들로만 재고 조회 (1000건 하드코딩 제거)
    const productIds = productsResult.products.map((p) => p.id);
    const inventoryResult = productIds.length > 0
      ? await getInventoryList({ productIds })
      : { items: [] };

    // 재고 데이터를 productId 기준으로 맵핑
    const inventoryMap = new Map(
      inventoryResult.items.map((item) => [item.productId, item.currentStock])
    );

    // 제품별 재고 상태 계산
    const products = productsResult.products.map((p) => {
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

    return (
      <ProductsPageClient
        initialProducts={products}
        categories={categoriesResult}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={productsResult.total}
        pageSize={pageSize}
      />
    );
  } catch (error) {
    console.error("제품 목록 조회 오류:", error);
    return (
      <ProductsPageClient
        initialProducts={[]}
        categories={[]}
        currentPage={1}
        totalPages={1}
        totalItems={0}
        pageSize={DEFAULT_PAGE_SIZE}
      />
    );
  }
}
