"use client";

import { useState, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

// 판매 추이 데이터 타입 정의
export interface SalesTrendDataPoint {
  date: string; // YYYY-MM-DD
  sales: number; // 판매액
  quantity: number; // 판매 수량
}

interface SalesTrendChartProps {
  className?: string;
  data?: SalesTrendDataPoint[];
}

type Period = "7" | "30" | "90";

const salesChartConfig = {
  sales: { label: "판매액", color: "#3b82f6" },
} satisfies ChartConfig;

// Mock 데이터 생성 함수
function generateMockSalesData(days: number): SalesTrendDataPoint[] {
  const data: SalesTrendDataPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? 0.7 : 1.0;
    const trendFactor = 1 + ((days - i) / days) * 0.3;

    const baseSales = 5000000;
    const randomVariation = 0.8 + Math.random() * 0.4;
    const sales = Math.round(baseSales * trendFactor * weekendFactor * randomVariation);

    const baseQuantity = 150;
    const quantity = Math.round(baseQuantity * trendFactor * weekendFactor * randomVariation);

    data.push({
      date: date.toISOString().split("T")[0],
      sales,
      quantity,
    });
  }

  return data;
}

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

// 금액 포맷 함수
function formatCurrency(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)}억`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}만`;
  }
  return value.toLocaleString("ko-KR");
}

export function SalesTrendChart({ className, data: _data }: SalesTrendChartProps) {
  const [period, setPeriod] = useState<Period>("30");

  // 데이터 생성
  const data = useMemo(() => generateMockSalesData(Number(period)), [period]);

  // 통계 계산
  const statistics = useMemo(() => {
    const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
    const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);
    const avgDailySales = totalSales / data.length;
    const avgDailyQuantity = totalQuantity / data.length;

    const compareLength = Math.floor(data.length * 0.3);
    const previousPeriodSales =
      data.slice(0, compareLength).reduce((sum, item) => sum + item.sales, 0) / compareLength;
    const currentPeriodSales =
      data.slice(-compareLength).reduce((sum, item) => sum + item.sales, 0) / compareLength;
    const growthRate = ((currentPeriodSales - previousPeriodSales) / previousPeriodSales) * 100;

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
    if (period === "7") return 0; // 모두 표시
    if (period === "30") return Math.floor(data.length / 6);
    return Math.floor(data.length / 9);
  }, [period, data.length]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 판매액</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalSales)}원</div>
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
              {formatCurrency(statistics.avgDailySales)}원
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
                onClick={() => setPeriod("7")}
              >
                7일
              </Button>
              <Button
                variant={period === "30" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("30")}
              >
                30일
              </Button>
              <Button
                variant={period === "90" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("90")}
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
                tickFormatter={formatCurrency}
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
        </CardContent>
      </Card>
    </div>
  );
}
