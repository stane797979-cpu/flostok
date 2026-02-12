import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ABCXYZSummary } from "./_components/abc-xyz-summary";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { getABCXYZAnalysis } from "@/server/actions/analytics";
import { AnalyticsGradeChange } from "./_components/analytics-grade-change";
import { AnalyticsFulfillment } from "./_components/analytics-fulfillment";
import { AnalyticsTurnover } from "./_components/analytics-turnover";
import type { ProductAnalysis } from "./_components/abc-xyz-table";

const ABCXYZClient = dynamic(
  () => import("./_components/abc-xyz-client").then((mod) => ({ default: mod.ABCXYZClient })),
  {
    loading: () => (
      <div className="h-96 flex items-center justify-center text-slate-400">로딩 중...</div>
    ),
  }
);

const ABCXYZPolicyGuide = dynamic(
  () =>
    import("./_components/abc-xyz-policy-guide").then((mod) => ({
      default: mod.ABCXYZPolicyGuide,
    })),
  {
    loading: () => (
      <div className="h-48 flex items-center justify-center text-slate-400">로딩 중...</div>
    ),
  }
);

const SalesTrendChart = dynamic(
  () =>
    import("./_components/sales-trend-chart").then((mod) => ({ default: mod.SalesTrendChart })),
  {
    loading: () => (
      <div className="h-96 flex items-center justify-center text-slate-400">로딩 중...</div>
    ),
  }
);

const DemandForecastChart = dynamic(
  () =>
    import("./_components/demand-forecast-chart").then((mod) => ({ default: mod.DemandForecastChart })),
  {
    loading: () => (
      <div className="h-96 flex items-center justify-center text-slate-400">수요예측 분석 중...</div>
    ),
  }
);

function TabLoadingSkeleton() {
  return (
    <div className="h-96 flex items-center justify-center text-slate-400">로딩 중...</div>
  );
}

export default async function AnalyticsPage() {
  // 기본 탭(ABC-XYZ) 데이터만 즉시 로드 — 나머지 탭은 Suspense로 독립 스트리밍
  let products: ProductAnalysis[] = [];
  let matrixData: { grade: string; count: number }[] = [];
  type ABCSummary = Awaited<ReturnType<typeof getABCXYZAnalysis>>["summary"];
  type ABCInsights = Awaited<ReturnType<typeof getABCXYZAnalysis>>["insights"];

  let summary: ABCSummary = {
    totalCount: 0,
    aCount: 0,
    aPercentage: 0,
    bCount: 0,
    bPercentage: 0,
    cCount: 0,
    cPercentage: 0,
    xCount: 0,
    xPercentage: 0,
    yCount: 0,
    yPercentage: 0,
    zCount: 0,
    zPercentage: 0,
    period: "최근 6개월",
  };
  let insights: ABCInsights = {
    totalRevenue: 0,
    aRevenuePercent: 0,
    axCount: 0,
    axRevenuePercent: 0,
    azCount: 0,
    bzCount: 0,
    riskCount: 0,
    avgCV: 0,
  };

  try {
    const abcResult = await getABCXYZAnalysis();
    products = abcResult.products;
    matrixData = abcResult.matrixData;
    summary = abcResult.summary;
    insights = abcResult.insights;
  } catch {
    // ABC-XYZ 로드 실패 시 빈 데이터로 표시
  }

  const hasData = products.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">수요·공급 분석</h1>
        <p className="mt-2 text-slate-500">
          제품별 매출 기여도, 수요 변동성, 재고회전율을 분석하여 최적의 재고 관리 전략을 수립하세요
        </p>
      </div>

      <Tabs defaultValue="abc-xyz" className="space-y-6">
        <TabsList>
          <TabsTrigger value="abc-xyz">ABC-XYZ 분석</TabsTrigger>
          <TabsTrigger value="grade-change">등급변동</TabsTrigger>
          <TabsTrigger value="fulfillment">실출고율</TabsTrigger>
          <TabsTrigger value="demand-forecast">수요예측</TabsTrigger>
          <TabsTrigger value="turnover">재고회전율</TabsTrigger>
          <TabsTrigger value="sales-trend">판매 추이</TabsTrigger>
        </TabsList>

        <TabsContent value="abc-xyz" className="space-y-6">
          {hasData ? (
            <>
              <ABCXYZSummary {...summary} insights={insights} />
              <ABCXYZClient matrixData={matrixData} products={products} />
              <ABCXYZPolicyGuide />
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Construction className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">분석 데이터 없음</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
                  제품을 등록하고 판매 데이터를 입력하면 ABC-XYZ 분석 결과가 표시됩니다. 설정
                  &gt; 데이터 관리에서 Excel로 데이터를 일괄 등록할 수 있습니다.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="grade-change">
          <Suspense fallback={<TabLoadingSkeleton />}>
            <AnalyticsGradeChange />
          </Suspense>
        </TabsContent>

        <TabsContent value="fulfillment">
          <Suspense fallback={<TabLoadingSkeleton />}>
            <AnalyticsFulfillment />
          </Suspense>
        </TabsContent>

        <TabsContent value="demand-forecast">
          <DemandForecastChart />
        </TabsContent>

        <TabsContent value="turnover">
          <Suspense fallback={<TabLoadingSkeleton />}>
            <AnalyticsTurnover />
          </Suspense>
        </TabsContent>

        <TabsContent value="sales-trend">
          <SalesTrendChart />
        </TabsContent>
      </Tabs>
    </div>
  );
}
