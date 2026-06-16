"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSalesTrend, getProductSalesTrend, getProductListForTrend } from "@/server/actions/analytics";

export interface SalesTrendDataPoint {
  date: string;
  sales: number;
  quantity: number;
}

type Period = "7" | "30" | "90";
type ViewMode = "total" | "product";

const salesChartConfig = {
  quantity: { label: "판매수량", color: "#3b82f6" },
} satisfies ChartConfig;

function formatDate(dateStr: string, period: Period): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (period === "7") {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${month}/${day}(${weekdays[date.getDay()]})`;
  }

  return `${month}/${day}`;
}

function SalesSummaryCards({
  statistics,
  period,
}: {
  statistics: NonNullable<ReturnType<typeof calcStatistics>>;
  period: Period;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 판매수량</CardTitle>
          <TrendingUp className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.totalQuantity.toLocaleString("ko-KR")}개</div>
          <p className="text-muted-foreground mt-1 text-xs">최근 {period}일</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">일평균 수량</CardTitle>
          <TrendingUp className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round(statistics.avgDailyQuantity).toLocaleString("ko-KR")}개
          </div>
          <p className="text-muted-foreground mt-1 text-xs">일평균 판매량</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">성장률</CardTitle>
          {statistics.growthRate >= 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-2xl font-bold",
              statistics.growthRate >= 0 ? "text-green-600" : "text-red-600"
            )}
          >
            {statistics.growthRate >= 0 ? "+" : ""}
            {statistics.growthRate.toFixed(1)}%
          </div>
          <p className="text-muted-foreground mt-1 text-xs">전기 대비</p>
        </CardContent>
      </Card>
    </div>
  );
}

function calcStatistics(data: SalesTrendDataPoint[]) {
  if (data.length === 0) return null;

  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
  const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);
  const avgDailySales = totalSales / data.length;
  const avgDailyQuantity = totalQuantity / data.length;

  const compareLength = Math.max(1, Math.floor(data.length * 0.3));
  const previousPeriodQty =
    data.slice(0, compareLength).reduce((sum, item) => sum + item.quantity, 0) / compareLength;
  const currentPeriodQty =
    data.slice(-compareLength).reduce((sum, item) => sum + item.quantity, 0) / compareLength;
  const growthRate =
    previousPeriodQty > 0
      ? ((currentPeriodQty - previousPeriodQty) / previousPeriodQty) * 100
      : 0;

  const maxSalesDay = data.reduce((max, item) => (item.quantity > max.quantity ? item : max), data[0]);
  const minSalesDay = data.reduce((min, item) => (item.quantity < min.quantity ? item : min), data[0]);

  return { totalSales, totalQuantity, avgDailySales, avgDailyQuantity, growthRate, maxSalesDay, minSalesDay };
}

function TrendChart({
  data,
  period,
  title,
  description,
}: {
  data: SalesTrendDataPoint[];
  period: Period;
  title: string;
  description: string;
}) {
  const statistics = useMemo(() => calcStatistics(data), [data]);

  const tickInterval = useMemo(() => {
    if (data.length === 0) return 0;
    if (period === "7") return 0;
    if (period === "30") return Math.floor(data.length / 6);
    return Math.floor(data.length / 9);
  }, [period, data.length]);

  return (
    <div className="space-y-4">
      {statistics && <SalesSummaryCards statistics={statistics} period={period} />}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={salesChartConfig} className="h-[180px] w-full">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="qtyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-quantity)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-quantity)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatDate(d, period)}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={tickInterval}
              />
              <YAxis
                tickFormatter={(v) => `${Number(v).toLocaleString("ko-KR")}개`}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => formatDate(label as string, period)}
                    formatter={(value) => [`${Number(value).toLocaleString("ko-KR")}개`, "판매수량"]}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="quantity"
                stroke="var(--color-quantity)"
                fill="url(#qtyFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>

          {statistics && (
            <div className="mt-4 grid gap-4 border-t pt-3 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">최고 판매일</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {formatDate(statistics.maxSalesDay.date, period)} -{" "}
                  {statistics.maxSalesDay.quantity.toLocaleString("ko-KR")}개
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">최저 판매일</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {formatDate(statistics.minSalesDay.date, period)} -{" "}
                  {statistics.minSalesDay.quantity.toLocaleString("ko-KR")}개
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NoDataCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold text-muted-foreground">판매 데이터 없음</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
          판매 기록을 등록하면 일별 판매 추이가 표시됩니다.
          설정 &gt; 데이터 관리에서 Excel로 데이터를 일괄 등록할 수 있습니다.
        </p>
      </CardContent>
    </Card>
  );
}

export function SalesTrendChart({ className }: { className?: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>("total");
  const [period, setPeriod] = useState<Period>("30");
  const [, startTransition] = useTransition();

  // 전체 추이
  const [totalData, setTotalData] = useState<SalesTrendDataPoint[]>([]);
  const [totalHasData, setTotalHasData] = useState(true);
  const [totalLoading, setTotalLoading] = useState(true);

  // 제품별 추이
  const [productList, setProductList] = useState<Array<{ id: string; sku: string; name: string }>>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productData, setProductData] = useState<SalesTrendDataPoint[]>([]);
  const [productHasData, setProductHasData] = useState(true);
  const [productLoading, setProductLoading] = useState(false);

  // 전체 데이터 로드
  useEffect(() => {
    setTotalLoading(true);
    getSalesTrend(Number(period))
      .then((result) => {
        setTotalData(result.data);
        setTotalHasData(result.hasData);
      })
      .catch(() => {
        setTotalData([]);
        setTotalHasData(false);
      })
      .finally(() => setTotalLoading(false));
  }, [period]);

  // 제품 목록 로드 (최초 1회)
  useEffect(() => {
    getProductListForTrend().then((list) => {
      setProductList(list);
      if (list.length > 0 && !selectedProductId) {
        setSelectedProductId(list[0].id);
      }
    });
  }, []);

  // 제품별 데이터 로드
  useEffect(() => {
    if (viewMode !== "product" || !selectedProductId) return;
    setProductLoading(true);
    getProductSalesTrend(selectedProductId, Number(period))
      .then((result) => {
        setProductData(result.data);
        setProductHasData(result.hasData);
      })
      .catch(() => {
        setProductData([]);
        setProductHasData(false);
      })
      .finally(() => setProductLoading(false));
  }, [viewMode, selectedProductId, period]);

  const handlePeriodChange = (newPeriod: Period) => {
    startTransition(() => setPeriod(newPeriod));
  };

  const selectedProduct = productList.find((p) => p.id === selectedProductId);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 상단 컨트롤 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="total">전체</TabsTrigger>
            <TabsTrigger value="product">제품별</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {viewMode === "product" && (
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="제품 선택" />
              </SelectTrigger>
              <SelectContent>
                {productList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.sku} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex gap-2">
            {(["7", "30", "90"] as Period[]).map((p) => (
              <Button
                key={p}
                variant={period === p ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange(p)}
              >
                {p}일
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 전체 추이 */}
      {viewMode === "total" && (
        <>
          {totalLoading ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              판매 추이 데이터를 불러오는 중...
            </div>
          ) : !totalHasData || totalData.length === 0 ? (
            <NoDataCard />
          ) : (
            <TrendChart
              data={totalData}
              period={period}
              title="전체 판매 추이"
              description="일별 전체 제품 합산 판매액"
            />
          )}
        </>
      )}

      {/* 제품별 추이 */}
      {viewMode === "product" && (
        <>
          {productLoading ? (
            <div className="flex h-96 items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              제품 데이터를 불러오는 중...
            </div>
          ) : !selectedProductId ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">제품을 선택하세요.</p>
              </CardContent>
            </Card>
          ) : !productHasData || productData.length === 0 ? (
            <NoDataCard />
          ) : (
            <TrendChart
              data={productData}
              period={period}
              title={`${selectedProduct?.name ?? ""} 판매 추이`}
              description={`SKU: ${selectedProduct?.sku ?? ""} · 일별 판매액`}
            />
          )}
        </>
      )}
    </div>
  );
}
