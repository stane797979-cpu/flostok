import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, TrendingDown, Archive, ShoppingCart, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { PeriodBadge } from "@/components/features/dashboard/period-badge";
import { InventoryStatusChart } from "@/components/features/dashboard/inventory-status-chart";
import { RecentActivityFeed } from "@/components/features/dashboard/recent-activity-feed";
import { QuickActions } from "@/components/features/dashboard/quick-actions";
import { KPICard } from "@/components/features/dashboard/kpi-card";
import { TurnoverTop5Card } from "@/components/features/dashboard/turnover-top5-card";
import { ABCXYZMiniMatrix } from "@/components/features/dashboard/abc-xyz-mini-matrix";
import { getInventoryStats, getInventoryListByStatuses } from "@/server/actions/inventory";
import { getInventoryStatus } from "@/lib/constants/inventory-status";
import { getKPISummary } from "@/server/actions/kpi";
import { getInventoryTurnoverData } from "@/server/actions/turnover";
import { getABCXYZAnalysis } from "@/server/actions/analytics";

const KPI_TARGETS = {
  inventoryTurnoverRate: 10,   // 재고회전율 목표: 10회/년
  averageInventoryDays: 40,    // 평균 재고일수 목표: 40일
  onTimeOrderRate: 90,         // 적시 발주율 목표: 90%
} as const;
/** 안전하게 대시보드 데이터를 로드 (인증 실패 시 빈 데이터) */
async function loadDashboardData() {
  const errors: string[] = [];
  try {
    // 병렬 로드: 개별 .catch()로 부분 실패 시에도 나머지 정상 표시
    const [stats, criticalItems, kpiSummary, turnoverResult, abcResult] = await Promise.all([
      getInventoryStats().catch((err) => {
        console.error("[대시보드] getInventoryStats 실패:", err);
        errors.push(`Stats: ${err instanceof Error ? err.message : String(err)}`);
        return { totalProducts: 0, outOfStock: 0, critical: 0, shortage: 0, optimal: 0, excess: 0, totalValue: 0 };
      }),
      getInventoryListByStatuses({ statuses: ["out_of_stock", "critical"], limit: 10 }).catch((err) => {
        console.error("[대시보드] getInventoryListByStatuses 실패:", err);
        errors.push(`Items: ${err instanceof Error ? err.message : String(err)}`);
        return [] as Awaited<ReturnType<typeof getInventoryListByStatuses>>;
      }),
      getKPISummary().catch((err) => {
        console.error("[대시보드] getKPISummary 실패:", err);
        errors.push(`KPI: ${err instanceof Error ? err.message : String(err)}`);
        return { inventoryTurnoverRate: 0, averageInventoryDays: 0, onTimeOrderRate: 0, stockoutRate: 0 };
      }),
      getInventoryTurnoverData().catch((err) => {
        console.error("[대시보드] getInventoryTurnoverData 실패:", err);
        errors.push(`Turnover: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }),
      getABCXYZAnalysis().catch((err) => {
        console.error("[대시보드] getABCXYZAnalysis 실패:", err);
        errors.push(`ABC: ${err instanceof Error ? err.message : String(err)}`);
        return { products: [], matrixData: [], summary: { aCount: 0, aPercentage: 0, bCount: 0, bPercentage: 0, cCount: 0, cPercentage: 0, period: "" } };
      }),
    ]);

    // 발주 필요 품목 매핑 (TOP10)
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

    // 재고상태 분포: getInventoryStats()에서 이미 계산된 데이터 활용
    const statusDistribution: Record<string, number> = {};
    if (stats.outOfStock > 0) statusDistribution["out_of_stock"] = stats.outOfStock;
    if (stats.critical > 0) statusDistribution["critical"] = stats.critical;
    if (stats.shortage > 0) statusDistribution["shortage"] = stats.shortage;
    if (stats.optimal > 0) statusDistribution["optimal"] = stats.optimal;
    if (stats.excess > 0) statusDistribution["excess"] = stats.excess;
    // 나머지 = 적정 이상 (주의 + 과다)
    const accounted = stats.outOfStock + stats.critical + stats.shortage + stats.optimal + stats.excess;
    const remaining = stats.totalProducts - accounted;
    if (remaining > 0) statusDistribution["caution"] = remaining;

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

    return {
      stats: {
        totalSku: stats.totalProducts,
        outOfStock: stats.outOfStock,
        critical: stats.critical,
        needsOrder: stats.outOfStock + stats.critical + stats.shortage,
        excess: stats.excess,
        totalValue: stats.totalValue,
      },
      needsOrderProducts,
      statusDistribution,
      totalSku: stats.totalProducts,
      kpi: kpiSummary,
      turnoverTop5,
      matrixData: abcResult.matrixData,
    };
  } catch (error) {
    console.error("대시보드 데이터 로드 실패:", error);
    return {
      stats: { totalSku: 0, outOfStock: 0, critical: 0, needsOrder: 0, excess: 0, totalValue: 0 },
      needsOrderProducts: [],
      statusDistribution: {},
      totalSku: 0,
      kpi: { inventoryTurnoverRate: 0, averageInventoryDays: 0, onTimeOrderRate: 0, stockoutRate: 0 },
      turnoverTop5: { fastest: [], slowest: [] },
      matrixData: [],
    };
  }
}

export default async function DashboardPage() {
  const dashData = await loadDashboardData();
  const { stats, needsOrderProducts, statusDistribution, totalSku, kpi, turnoverTop5, matrixData } = dashData;

  return (
    <div className="space-y-6">
      {/* 재고 현황 요약 */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-700">재고 현황 요약</h2>
        <PeriodBadge
          period="실시간"
          description="현재 재고 상태 기준 집계"
          formula="현재고 vs 안전재고 비교"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-slate-500">총 SKU</CardTitle>
            <Package className="h-5 w-5 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalSku}</div>
            <p className="text-sm text-slate-500">등록된 제품</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-red-600">발주 필요</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.needsOrder}</div>
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

        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-medium text-green-600">재고총금액</CardTitle>
            <Banknote className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("ko-KR", {
                style: "currency",
                currency: "KRW",
                maximumFractionDigits: 0,
              }).format(stats.totalValue || 0)}
            </div>
            <p className="text-sm text-green-500">현재 재고 평가액</p>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 액션 */}
      <QuickActions />

      {/* 주요 KPI 요약 */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">주요 성과 지표</h2>
            <PeriodBadge
              period="최근 12개월"
              description="판매·재고·발주 데이터 기반 산출"
              formula="회전율=COGS÷평균재고 | 적시발주율=정시입고÷총입고"
            />
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/kpi">전체 KPI 보기</Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard
            name="재고회전율"
            value={kpi.inventoryTurnoverRate}
            unit="회/년"
            target={KPI_TARGETS.inventoryTurnoverRate}
            status={kpi.inventoryTurnoverRate >= KPI_TARGETS.inventoryTurnoverRate ? "success" : kpi.inventoryTurnoverRate >= 8 ? "warning" : "danger"}
            iconName="bar-chart"
          />
          <KPICard
            name="평균 재고일수"
            value={kpi.averageInventoryDays}
            unit="일"
            target={KPI_TARGETS.averageInventoryDays}
            status={kpi.averageInventoryDays <= KPI_TARGETS.averageInventoryDays ? "success" : kpi.averageInventoryDays <= 50 ? "warning" : "danger"}
            iconName="calendar"
          />
          <KPICard
            name="적시 발주율"
            value={kpi.onTimeOrderRate}
            unit="%"
            target={KPI_TARGETS.onTimeOrderRate}
            status={kpi.onTimeOrderRate >= KPI_TARGETS.onTimeOrderRate ? "success" : kpi.onTimeOrderRate >= 72 ? "warning" : "danger"}
            iconName="check-circle"
          />
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 재고상태 분포 차트 */}
        <InventoryStatusChart distribution={statusDistribution} totalSku={totalSku} />

        {/* 발주 필요 품목 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>발주 필요 품목</CardTitle>
              <PeriodBadge
                period="실시간"
                description="안전재고 이하 품목 TOP10"
                formula="품절(0) + 위험(<50%) + 부족(<100%)"
              />
            </div>
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
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-semibold">재고 회전율 TOP5</h2>
          <PeriodBadge
            period="최근 12개월"
            description="판매·재고 데이터 기반 회전율 순위"
            formula="회전율 = COGS ÷ 평균재고금액"
          />
        </div>
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
