"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

// Mock 데이터 생성 함수
function generateMockSalesData(days: number): SalesTrendDataPoint[] {
  const data: SalesTrendDataPoint[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // 기본 트렌드 + 랜덤 변동성 + 주말 효과
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? 0.7 : 1.0;

    // 성장 트렌드 추가 (최근으로 갈수록 증가)
    const trendFactor = 1 + ((days - i) / days) * 0.3;

    const baseSales = 5000000;
    const randomVariation = 0.8 + Math.random() * 0.4; // 0.8 ~ 1.2
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
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // 데이터 생성
  const data = useMemo(() => generateMockSalesData(Number(period)), [period]);

  // 통계 계산
  const statistics = useMemo(() => {
    const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
    const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);
    const avgDailySales = totalSales / data.length;
    const avgDailyQuantity = totalQuantity / data.length;

    // 전기 대비 증감률 계산 (첫 30% vs 마지막 30%)
    const compareLength = Math.floor(data.length * 0.3);
    const previousPeriodSales =
      data.slice(0, compareLength).reduce((sum, item) => sum + item.sales, 0) / compareLength;
    const currentPeriodSales =
      data.slice(-compareLength).reduce((sum, item) => sum + item.sales, 0) / compareLength;
    const growthRate = ((currentPeriodSales - previousPeriodSales) / previousPeriodSales) * 100;

    // 최고/최저 판매일
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

  // 차트 렌더링을 위한 계산
  const chartConfig = useMemo(() => {
    const maxSales = Math.max(...data.map((d) => d.sales));
    const minSales = Math.min(...data.map((d) => d.sales));

    // Y축 범위 설정 (최소값에서 10% 여유, 최대값에서 10% 여유)
    const range = maxSales - minSales;
    const yMin = Math.max(0, minSales - range * 0.1);
    const yMax = maxSales + range * 0.1;

    return { yMin, yMax, maxSales, minSales };
  }, [data]);

  // SVG 좌표 계산 함수들
  const { xScale, yScale, linePath, areaPath, xLabels, yLabels, chartWidth, chartHeight, padding } =
    useMemo((): {
      xScale: (index: number) => number;
      yScale: (value: number) => number;
      linePath: string;
      areaPath: string;
      xLabels: { index: number; date: string; sales: number; quantity: number }[];
      yLabels: { value: number; y: number }[];
      chartWidth: number;
      chartHeight: number;
      padding: { top: number; right: number; bottom: number; left: number };
    } => {
      const width = 800;
      const height = 240;
      const pad = { top: 16, right: 20, bottom: 36, left: 60 };
      const innerWidth = width - pad.left - pad.right;
      const innerHeight = height - pad.top - pad.bottom;
      const xScaleFunc = (index: number) => pad.left + (index / (data.length - 1)) * innerWidth;
      const yScaleFunc = (value: number) =>
        pad.top +
        innerHeight -
        ((value - chartConfig.yMin) / (chartConfig.yMax - chartConfig.yMin)) * innerHeight;

    // 라인 차트 경로 생성
    const line = data
      .map((point, index) => {
        const x = xScaleFunc(index);
        const y = yScaleFunc(point.sales);
        return `${index === 0 ? "M" : "L"} ${x},${y}`;
      })
      .join(" ");

    // 그라데이션 영역 경로 생성
    const area = `${line} L ${xScaleFunc(data.length - 1)},${yScaleFunc(chartConfig.yMin)} L ${xScaleFunc(0)},${yScaleFunc(chartConfig.yMin)} Z`;

    // X축 레이블 선택 (간격 조정)
    const labelCount = period === "7" ? data.length : period === "30" ? 6 : 9;
    const step = Math.floor(data.length / (labelCount - 1));
    const xLabelData = data
      .map((d, i) => ({ ...d, index: i }))
      .filter((_, i) => i % step === 0 || i === data.length - 1);

    // Y축 레이블 생성
    const yLabelCount = 5;
    const yStep = (chartConfig.yMax - chartConfig.yMin) / (yLabelCount - 1);
    const yLabelData = Array.from({ length: yLabelCount }, (_, i) => {
      const value = chartConfig.yMin + yStep * i;
      return { value, y: yScaleFunc(value) };
    });

      return {
        xScale: xScaleFunc,
        yScale: yScaleFunc,
        linePath: line,
        areaPath: area,
        xLabels: xLabelData,
        yLabels: yLabelData,
        chartWidth: width,
        chartHeight: height,
        padding: pad,
      };
    }, [data, chartConfig, period]);

  return (
    <div className={cn("space-y-6", className)}>
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
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full"
              style={{ minWidth: "600px" }}
            >
              {/* 그리드 라인 (Y축) */}
              {yLabels.map((label, i) => (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={label.y}
                    x2={chartWidth - padding.right}
                    y2={label.y}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={label.y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-slate-500 text-xs"
                  >
                    {formatCurrency(label.value)}
                  </text>
                </g>
              ))}

              {/* 그라데이션 정의 */}
              <defs>
                <linearGradient id="salesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* 영역 차트 */}
              <path d={areaPath} fill="url(#salesGradient)" />

              {/* 라인 차트 */}
              <path d={linePath} stroke="#3b82f6" strokeWidth="2.5" fill="none" />

              {/* 데이터 포인트 */}
              {data.map((point, index) => (
                <circle
                  key={index}
                  cx={xScale(index)}
                  cy={yScale(point.sales)}
                  r={hoveredPoint === index ? 5 : 3}
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredPoint(index)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              ))}

              {/* X축 레이블 */}
              {xLabels.map((label) => (
                <text
                  key={label.index}
                  x={xScale(label.index)}
                  y={chartHeight - padding.bottom + 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-xs"
                >
                  {formatDate(label.date, period)}
                </text>
              ))}

              {/* 호버 툴팁 */}
              {hoveredPoint !== null && (
                <g>
                  <rect
                    x={xScale(hoveredPoint) - 70}
                    y={yScale(data[hoveredPoint].sales) - 50}
                    width="140"
                    height="45"
                    rx="6"
                    className="fill-slate-800"
                    opacity="0.95"
                  />
                  <text
                    x={xScale(hoveredPoint)}
                    y={yScale(data[hoveredPoint].sales) - 35}
                    textAnchor="middle"
                    className="fill-white text-xs font-medium"
                  >
                    {formatDate(data[hoveredPoint].date, period)}
                  </text>
                  <text
                    x={xScale(hoveredPoint)}
                    y={yScale(data[hoveredPoint].sales) - 20}
                    textAnchor="middle"
                    className="fill-white text-xs font-bold"
                  >
                    {data[hoveredPoint].sales.toLocaleString("ko-KR")}원
                  </text>
                  <text
                    x={xScale(hoveredPoint)}
                    y={yScale(data[hoveredPoint].sales) - 8}
                    textAnchor="middle"
                    className="fill-white text-xs"
                  >
                    {data[hoveredPoint].quantity.toLocaleString("ko-KR")}개
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* 범례 및 통계 */}
          <div className="mt-6 grid gap-4 border-t pt-4 md:grid-cols-2">
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
