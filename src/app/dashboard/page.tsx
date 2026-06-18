import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, Archive, ShoppingCart, Brain, CalendarDays, PackageX } from "lucide-react";
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
  const { stats, needsOrderProducts, kpi, turnoverTop5, matrixData, categoryDemandRows, psiStats } =
    await loadDashboardData();

  return (
    <div className="space-y-6">
      {/* KPI 카드 행1: 발주권고 */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-slate-500">발주권고 — 현황대로</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.needsOrder - (stats.outOfStock + stats.critical)}</div>
            <p className="text-sm text-slate-500">정상 범위 내 권고</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-orange-600">발주권고 — 발주필요</CardTitle>
            <TrendingDown className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.needsOrder}</div>
            <p className="text-sm text-orange-500">재발주점 도달 품목</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-red-600">발주권고 — 위험품목</CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.outOfStock + stats.critical}</div>
            <p className="text-sm text-red-500">긴급 대응 필요</p>
          </CardContent>
        </Card>
      </div>

      {/* KPI 카드 행2: 재고금액·FA·DOH */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-red-600">부족재고 금액</CardTitle>
            <PackageX className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.shortageValue >= 1_000_000
                ? `${(stats.shortageValue / 1_000_000).toFixed(1)}백만`
                : stats.shortageValue.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-slate-400">원</span>
            </div>
            <p className="text-sm text-red-500">긴급 발주 필요</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-blue-600">과재고 금액</CardTitle>
            <Archive className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.excessValue >= 1_000_000
                ? `${(stats.excessValue / 1_000_000).toFixed(1)}백만`
                : stats.excessValue.toLocaleString()}
              <span className="ml-1 text-sm font-normal text-slate-400">원</span>
            </div>
            <p className="text-sm text-blue-500">재고 최적화 검토</p>
          </CardContent>
        </Card>

        <Card className={cn(
          kpi.forecastAccuracy >= 85 ? "border-green-200" : kpi.forecastAccuracy >= 70 ? "border-orange-200" : "border-red-200"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={cn(
              "text-base font-medium",
              kpi.forecastAccuracy >= 85 ? "text-green-600" : kpi.forecastAccuracy >= 70 ? "text-orange-600" : "text-red-600"
            )}>FA (Forecast Accuracy)</CardTitle>
            <Brain className={cn(
              "h-5 w-5",
              kpi.forecastAccuracy >= 85 ? "text-green-500" : kpi.forecastAccuracy >= 70 ? "text-orange-500" : "text-red-500"
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-bold",
              kpi.forecastAccuracy >= 85 ? "text-green-600" : kpi.forecastAccuracy >= 70 ? "text-orange-600" : "text-red-600"
            )}>
              {kpi.forecastAccuracy}<span className="ml-1 text-base font-normal text-slate-400">%</span>
            </div>
            <p className="text-sm text-slate-500">목표 85% 이상</p>
          </CardContent>
        </Card>

        <Card className={cn(
          kpi.averageInventoryDays <= 40 ? "border-green-200" : "border-orange-200"
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className={cn(
              "text-base font-medium",
              kpi.averageInventoryDays <= 40 ? "text-green-600" : "text-orange-600"
            )}>평균재고일 (DOH)</CardTitle>
            <CalendarDays className={cn(
              "h-5 w-5",
              kpi.averageInventoryDays <= 40 ? "text-green-500" : "text-orange-500"
            )} />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-bold",
              kpi.averageInventoryDays <= 40 ? "text-green-600" : "text-orange-600"
            )}>
              {kpi.averageInventoryDays}<span className="ml-1 text-base font-normal text-slate-400">일</span>
            </div>
            <p className="text-sm text-slate-500">목표 40일 이하</p>
          </CardContent>
        </Card>
      </div>

      {/* 이번달 진척현황 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">이번달 진척현황</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/psi">PSI 계획 보기</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 dark:border-blue-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">판매계획</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{psiStats.salesPlan.toLocaleString()}</div>
              <p className="text-sm text-slate-500">이번달 출고 계획 (개)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">판매 실적</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{psiStats.salesActual.toLocaleString()}</div>
              <p className="text-sm">
                계획 대비{" "}
                <span className={cn(
                  "font-semibold",
                  psiStats.achieveRate >= 100 ? "text-green-600" : psiStats.achieveRate >= 80 ? "text-orange-500" : "text-red-500"
                )}>
                  {psiStats.achieveRate}%
                </span>
              </p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">발주 계획</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700">{psiStats.inboundPlan.toLocaleString()}</div>
              <p className="text-sm text-slate-500">이번달 입고 계획 (개)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">평균 재고일수</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {psiStats.avgDoi}<span className="text-base text-slate-400 ml-1">일</span>
              </div>
              <p className="text-sm">
                목표 30일 대비{" "}
                <span className={cn(
                  "font-semibold",
                  psiStats.avgDoi <= 30 ? "text-green-600" : "text-orange-500"
                )}>
                  {psiStats.avgDoi > 0 ? Math.round((psiStats.avgDoi / 30) * 100) : 0}%
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 빠른 액션 */}
      <QuickActions />


      {/* 콘텐츠 영역 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 카테고리별 수요 동향 */}
        <CategoryDemandWidget rows={categoryDemandRows} />

        {/* 발주 필요 품목 */}
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
      </div>

      {/* 회전율 TOP5 */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">재고 회전율 TOP5</h2>
        <TurnoverTop5Card fastest={turnoverTop5.fastest} slowest={turnoverTop5.slowest} />
      </div>

      {/* ABC-XYZ 미니매트릭스 + 최근 활동 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ABCXYZMiniMatrix matrixData={matrixData} />
        <RecentActivityFeed />
      </div>
    </div>
  );
}
