import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getInventoryListByStatuses } from "@/server/actions/inventory";
import { getInventoryStatus } from "@/lib/constants/inventory-status";

export async function DashboardOrderItems() {
  const criticalItems = await getInventoryListByStatuses({
    statuses: ["out_of_stock", "critical"],
    limit: 10,
  }).catch(() => [] as Awaited<ReturnType<typeof getInventoryListByStatuses>>);

  const needsOrderProducts = criticalItems.slice(0, 10).map((item) => ({
    id: item.productId,
    sku: item.product.sku,
    name: item.product.name,
    currentStock: item.currentStock,
    safetyStock: item.product.safetyStock ?? 0,
    status: getInventoryStatus(
      item.currentStock,
      item.product.safetyStock ?? 0,
      item.product.reorderPoint ?? 0
    ),
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>발주 필요 품목</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/orders">전체 보기</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {needsOrderProducts.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-slate-400">
              발주가 필요한 품목이 없습니다
            </div>
          ) : (
            needsOrderProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-medium">{product.name}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-sm",
                        product.status.bgClass,
                        product.status.textClass
                      )}
                    >
                      {product.status.label}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    현재고: {product.currentStock} / 안전재고: {product.safetyStock}
                  </div>
                </div>
                <Button size="sm" className="ml-4" asChild>
                  <Link href={`/dashboard/orders?action=new&sku=${product.sku}`}>
                    <ShoppingCart className="mr-1 h-4 w-4" />
                    발주
                  </Link>
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
