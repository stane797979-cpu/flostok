import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertTriangle, TrendingDown, Archive } from "lucide-react";
import { getInventoryStats } from "@/server/actions/inventory";

export async function DashboardStatsCards() {
  const stats = await getInventoryStats();

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium text-slate-500">총 SKU</CardTitle>
          <Package className="h-5 w-5 text-slate-400" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.totalProducts}</div>
          <p className="text-sm text-slate-500">등록된 제품</p>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium text-red-600">발주 필요</CardTitle>
          <TrendingDown className="h-5 w-5 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">
            {stats.outOfStock + stats.critical + stats.shortage}
          </div>
          <p className="text-sm text-red-500">품절 + 위험 + 부족</p>
        </CardContent>
      </Card>

      <Card className="border-orange-200 dark:border-orange-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium text-orange-600">위험 품목</CardTitle>
          <AlertTriangle className="h-5 w-5 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600">
            {stats.outOfStock + stats.critical}
          </div>
          <p className="text-sm text-orange-500">긴급 대응 필요</p>
        </CardContent>
      </Card>

      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium text-blue-600">과재고</CardTitle>
          <Archive className="h-5 w-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">{stats.excess}</div>
          <p className="text-sm text-blue-500">재고 최적화 검토</p>
        </CardContent>
      </Card>
    </div>
  );
}
