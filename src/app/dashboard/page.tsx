import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, Archive, ShoppingCart, Brain, CalendarDays, PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { CategoryDemandWidget } from "@/components/features/dashboard/category-demand-widget";
import { RecentActivityFeed } from "@/components/features/dashboard/recent-activity-feed";
import { QuickActions } from "@/components/features/dashboard/quick-actions";
import { TurnoverTop5Card } from "@/components/features/dashboard/turnover-top5-card";
import { ABCXYZMiniMatrix } from "@/components/features/dashboard/abc-xyz-mini-matrix";
import { getInventoryStats, getInventoryList } from "@/server/actions/inventory";
import { getInventoryStatus } from "@/lib/constants/inventory-status";
import { getKPISummary } from "@/server/actions/kpi";
import { getInventoryTurnoverData } from "@/server/actions/turnover";
import { getABCXYZAnalysis, getCategoryDemandSummary } from "@/server/actions/analytics";
import { getPSIData } from "@/server/actions/psi";

/** 안전하게 대시보드 데이터를 로드 (인증 실패 시 빈 데이터) */
async function loadDashboardData() {
  try {
    // 병렬 로드: 통계 + 품절/위험 품목 + KPI + 회전율 + ABC-XYZ (모두 병렬)
    const [stats, needsOrderResult, kpiSummary, turnoverResult, abcResult, categoryDemand, psiResult] = await Promise.all([
      getInventoryStats(),
      getInventoryList({ status: ["out_of_stock", "critical", "shortage", "caution"], limit: 10 }),
      getKPISummary(),
      getInventoryTurnoverData().catch(() => null),
      getABCXYZAnalysis().catch(() => ({ products: [], matrixData: [], summary: { aCount: 0, aPercentage: 0, bCount: 0, bPercentage: 0, cCount: 0, cPercentage: 0, period: "" } })),
      getCategoryDemandSummary().catch(() => ({ rows: [], hasData: false })),
      getPSIData(3).catch(() => null),
    ]);

    // 발주 필요 품목 매핑 (TOP10)
    const needsOrderProducts = needsOrderResult.items.slice(0, 10).map((item) => ({
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

    // 회전율 TOP5 데이터
    const turnoverTop5 = turnoverResult
      ? {
          fastest: turnoverResult.top5Fastest.map((t) => ({
            sku: t.sku,
            productName: t.name,
            turnoverRate: t.turnoverRate,
            daysOfInventory: t.daysOfInventory,
          })),
          slowest: turnoverResult.top5Slowest.map((t) => ({
            sku: t.sku,
            productName: t.name,
            turnoverRate: t.turnoverRate,
            daysOfInventory: t.daysOfInventory,
          })),
        }
      : { fastest: [], slowest: [] };

    // 이번달 PSI 진척 집계
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let psiStats = { salesPlan: 0, salesActual: 0, achieveRate: 0, inboundPlan: 0, avgDoi: 0 };
    if (psiResult) {
      let salesPlan = 0, salesActual = 0, inboundPlan = 0;
      let totalStock = 0, totalDailyOut = 0;
      const pastPeriods = psiResult.periods.filter((p) => p < currentPeriod).slice(-3);
      for (const p of psiResult.products) {
        const m = p.months.find((mo) => mo.period === currentPeriod);
        if (m) { salesPlan += m.outboundPlan; salesActual += m.outbound; inboundPlan += m.inboundPlan; }
        if (pastPeriods.length > 0) {
          const pastOut = p.months.filter((mo) => pastPeriods.includes(mo.period)).reduce((s, mo) => s + mo.outbound, 0);
          const dailyOut = pastOut / pastPeriods.length / 30;
          if (dailyOut > 0) { totalStock += p.currentStock; totalDailyOut += dailyOut; }
        }
      }
      psiStats = {
        salesPlan,
        salesActual,
        achieveRate: salesPlan > 0 ? Math.round((salesActual / salesPlan) * 100) : 0,
        inboundPlan,
        avgDoi: totalDailyOut > 0 ? Math.round(totalStock / totalDailyOut) : 0,
      };
    }

    return {
      stats: {
        totalSku: stats.totalProducts,
        outOfStock: stats.outOfStock,
        critical: stats.critical,
        needsOrder: stats.needsOrder,
        excess: stats.excess,
        shortageValue: stats.shortageValue,
        excessValue: stats.excessValue,
      },
      needsOrderProducts,
      totalSku: stats.totalProducts,
      kpi: kpiSummary,
      turnoverTop5,
      matrixData: abcResult.matrixData,
      categoryDemandRows: categoryDemand.rows,
      psiStats,
    };
  } catch (error) {
    console.error("대시보드 데이터 로드 실패:", error);
    return {
      stats: { totalSku: 0, outOfStock: 0, critical: 0, needsOrder: 0, excess: 0, shortageValue: 0, excessValue: 0 },
      needsOrderProducts: [],
      totalSku: 0,
      kpi: { inventoryTurnoverRate: 0, averageInventoryDays: 0, onTimeOrderRate: 0, stockoutRate: 0, forecastAccuracy: 0 },
      turnoverTop5: { fastest: [], slowest: [] },
      matrixData: [],
      categoryDemandRows: [],
      psiStats: { salesPlan: 0, salesActual: 0, achieveRate: 0, inboundPlan: 0, avgDoi: 0 },
    };
  }
}

export default async function DashboardPage() {
  const { stats, needsOrderProducts, kpi, turnoverTop5, matrixData, categoryDemandRows } =
    await loadDashboardData();

  const urgentCount = stats.outOfStock + stats.critical;
  const normalOrderCount = stats.needsOrder - urgentCount;

  return (
    <div className="space-y-5">

      {/* 행1: 발주 필요·긴급발주·서비스수준 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/orders">
          <Card className="cursor-pointer border-orange-200 transition-shadow hover:shadow-md dark:border-orange-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-600">발주 필요 (권고)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {stats.needsOrder}
                <span className="ml-1 text-base font-normal text-slate-400">건</span>
              </div>
              <p className="mt-1 text-xs text-orange-500">재발주점 도달 품목 →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/inventory">
          <Card className="cursor-pointer border-red-200 transition-shadow hover:shadow-md dark:border-red-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> 긴급 발주
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {urgentCount}
                <span className="ml-1 text-base font-normal text-slate-400">건</span>
              </div>
              <p className="mt-1 text-xs text-red-500">
                {stats.shortageValue >= 1_000_000
                  ? `₩${(stats.shortageValue / 1_000_000).toFixed(1)}백만 · 즉시 대응 →`
                  : `₩${stats.shortageValue.toLocaleString()} · 즉시 대응 →`}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-600">서비스 수준 (SL)</CardTitle>
            <PackageSearch className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {kpi.onTimeOrderRate}
              <span className="ml-1 text-base font-normal text-slate-400">%</span>
            </div>
            <p className="mt-1 text-xs text-green-600">당일 출고 기준 · 목표 95% 이상</p>
          </CardContent>
        </Card>
      </div>

      {/* 행2: 과재고·FA·DOH */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/inventory">
          <Card className="cursor-pointer border-blue-200 transition-shadow hover:shadow-md dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-1">
                <Archive className="h-4 w-4" /> 과재고
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {stats.excess}
                <span className="ml-1 text-base font-normal text-slate-400">건</span>
              </div>
              <p className="mt-1 text-xs text-blue-500">
                {stats.excessValue >= 1_000_000
                  ? `₩${(stats.excessValue / 1_000_000).toFixed(1)}백만 · 재고 최적화 →`
                  : `₩${stats.excessValue.toLocaleString()} · 재고 최적화 →`}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className={cn(
          kpi.forecastAccuracy >= 85 ? "border-green-200" : kpi.forecastAccuracy >= 70 ? "border-orange-200" : "border-red-200"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={cn("text-sm font-medium",
              kpi.forecastAccuracy >= 85 ? "text-green-600" : kpi.forecastAccuracy >= 70 ? "text-orange-600" : "text-red-600"
            )}>FA (Forecast Accuracy)</CardTitle>
            <Brain className={cn("h-4 w-4",
              kpi.forecastAccuracy >= 85 ? "text-green-500" : kpi.forecastAccuracy >= 70 ? "text-orange-500" : "text-red-500"
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold",
              kpi.forecastAccuracy >= 85 ? "text-green-600" : kpi.forecastAccuracy >= 70 ? "text-orange-600" : "text-red-600"
            )}>
              {kpi.forecastAccuracy}<span className="ml-1 text-base font-normal text-slate-400">%</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">목표 85% 이상</p>
          </CardContent>
        </Card>

        <Card className={cn(kpi.averageInventoryDays <= 40 ? "border-green-200" : "border-orange-200")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={cn("text-sm font-medium",
              kpi.averageInventoryDays <= 40 ? "text-green-600" : "text-orange-600"
            )}>평균재고일 (DOH)</CardTitle>
            <CalendarDays className={cn("h-4 w-4",
              kpi.averageInventoryDays <= 40 ? "text-green-500" : "text-orange-500"
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-3xl font-bold",
              kpi.averageInventoryDays <= 40 ? "text-green-600" : "text-orange-600"
            )}>
              {kpi.averageInventoryDays}<span className="ml-1 text-base font-normal text-slate-400">일</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">목표 40일 이하</p>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 액션 */}
      <QuickActions />

      {/* 카테고리 수요 동향 + 발주 필요 품목 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CategoryDemandWidget rows={categoryDemandRows} />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">발주 필요 품목</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/orders">전체 보기</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {needsOrderProducts.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-slate-400">
                  발주가 필요한 품목이 없습니다
                </div>
              ) : (
                needsOrderProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{product.name}</span>
                        <Badge variant="outline" className={cn("text-xs shrink-0", product.status.bgClass, product.status.textClass)}>
                          {product.status.label}
                        </Badge>
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        현재고 {product.currentStock} / 안전재고 {product.safetyStock}
                      </div>
                    </div>
                    <Button size="sm" className="ml-3 shrink-0" asChild>
                      <Link href={`/dashboard/orders?action=new&sku=${product.sku}`}>
                        <ShoppingCart className="mr-1 h-3 w-3" />발주
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 회전율 TOP5 */}
      <div>
        <h2 className="mb-3 text-base font-semibold">재고 회전율 TOP5</h2>
        <TurnoverTop5Card fastest={turnoverTop5.fastest} slowest={turnoverTop5.slowest} />
      </div>

      {/* ABC-XYZ + 최근 활동 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ABCXYZMiniMatrix matrixData={matrixData} />
        <RecentActivityFeed />
      </div>

    </div>
  );
}
