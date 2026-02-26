"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, AlertCircle, Loader2 } from "lucide-react";
import { cn, formatCompactKRW } from "@/lib/utils";
import { getSalesTrend } from "@/server/actions/analytics";

// 판매 추이 데이터 타입 정의
export interface SalesTrendDataPoint {
  date: string; // YYYY-MM-DD
  sales: number; // 판매액
  quantity: number; // 판매 수량
}

type Period = "7" | "30" | "90";

const salesChartConfig = {
  sales: { label: "판매액", color: "#3b82f6" },
} satisfies ChartConfig;

// 날짜 포맷 함수
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


export function SalesTrendChart({ className }: { className?: string }) {
  const [period, setPeriod] = useState<Period>("30");
  const [data, setData] = useState<SalesTrendDataPoint[]>([]);
  const [hasData, setHasData] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 데이터 로드
  useEffect(() => {
    setIsLoading(true);
    getSalesTrend(Number(period))
      .then((result) => {
        setData(result.data);
        setHasData(result.hasData);
      })
      .catch(() => {
        setData([]);
        setHasData(false);
      })
      .finally(() => setIsLoading(false));
  }, [period]);

  const handlePeriodChange = (newPeriod: Period) => {
    startTransition(() => {
      setPeriod(newPeriod);
    });
  };

  // 통계 계산
  const statistics = useMemo(() => {
    if (data.length === 0) return null;

    const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
    const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);
    const avgDailySales = totalSales / data.length;
    const avgDailyQuantity = totalQuantity / data.length;

    const compareLength = Math.max(1, Math.floor(data.length * 0.3));
    const previousPeriodSales =
      data.slice(0, compareLength).reduce((sum, item) => sum + item.sales, 0) / compareLength;
    const currentPeriodSales =
      data.slice(-compareLength).reduce((sum, item) => sum + item.sales, 0) / compareLength;
    const growthRate = previousPeriodSales > 0
      ? ((currentPeriodSales - previousPeriodSales) / previousPeriodSales) * 100
      : 0;

    const maxSalesDay = data.reduce((max, item) => (item.sales > max.sales ? item : max), data[0]);
    const minSalesDay = data.reduce((min, item) => (item.sales < min.sales ? item : min), data[0]);

    return {
      totalSales,
      totalQuantity,
      avgDailySales,
      avgDailyQuantity,
      growthRate,
      maxSalesDay,
      minSalesDay,
    };
  }, [data]);

  // X축 tick 간격 계산
  const tickInterval = useMemo(() => {
    if (data.length === 0) return 0;
    if (period === "7") return 0;
    if (period === "30") return Math.floor(data.length / 6);
    return Math.floor(data.length / 9);
  }, [period, data.length]);

  if (isLoading) {
    return (
      <div className={cn("flex h-96 items-center justify-center text-slate-400", className)}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        판매 추이 데이터를 불러오는 중...
      </div>
    );
  }

  if (!hasData || data.length === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
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

  return (
    <div className={cn("space-y-4", className, isPending && "opacity-50 pointer-events-none")}>
      {/* 요약 카드 */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 판매액</CardTitle>
              <TrendingUp className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCompactKRW(statistics.totalSales)}원</div>
              <p className="text-muted-foreground mt-1 text-xs">최근 {period}일</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">일평균 판매액</CardTitle>
              <TrendingUp className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCompactKRW(statistics.avgDailySales)}원
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                총 판매 수량: {statistics.totalQuantity.toLocaleString("ko-KR")}개
              </p>
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
        </div>
      )}

      {/* 차트 카드 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>판매 추이</CardTitle>
              <CardDescription>일별 판매액 변화 추이</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={period === "7" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("7")}
              >
                7일
              </Button>
              <Button
                variant={period === "30" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("30")}
              >
                30일
              </Button>
              <Button
                variant={period === "90" ? "default" : "outline"}
                size="sm"
                onClick={() => handlePeriodChange("90")}
              >
                90일
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={salesChartConfig} className="h-[180px] w-full">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-sales)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0.05} />
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
                tickFormatter={formatCompactKRW}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => formatDate(label as string, period)}
                    formatter={(value) => [`${Number(value).toLocaleString("ko-KR")}원`, "판매액"]}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="var(--color-sales)"
                fill="url(#salesFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>

          {/* 범례 및 통계 */}
          {statistics && (
            <div className="mt-4 grid gap-4 border-t pt-3 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">최고 판매일</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {formatDate(statistics.maxSalesDay.date, period)} -{" "}
                  {statistics.maxSalesDay.sales.toLocaleString("ko-KR")}원
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">최저 판매일</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {formatDate(statistics.minSalesDay.date, period)} -{" "}
                  {statistics.minSalesDay.sales.toLocaleString("ko-KR")}원
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
