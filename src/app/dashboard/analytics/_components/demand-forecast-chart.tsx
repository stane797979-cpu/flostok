"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, BarChart3, Target, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDemandForecast } from "@/server/actions/analytics";

interface ForecastData {
  productId: string;
  productName: string;
  method: string;
  confidence: string;
  mape: number;
  history: Array<{ month: string; value: number }>;
  predicted: Array<{ month: string; value: number }>;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
}

const METHOD_LABELS: Record<string, string> = {
  SMA: "단순이동평균 (SMA)",
  SES: "지수평활법 (SES)",
  Holts: "이중지수평활 (Holt's)",
};

const CONFIDENCE_MAP: Record<string, { label: string; color: string }> = {
  high: { label: "높음", color: "bg-green-100 text-green-700" },
  medium: { label: "보통", color: "bg-yellow-100 text-yellow-700" },
  low: { label: "낮음", color: "bg-red-100 text-red-700" },
};

export function DemandForecastChart() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const loadForecast = useCallback(async (productId?: string) => {
    setIsLoading(true);
    try {
      const result = await getDemandForecast(productId);
      setProducts(result.products);
      setForecast(result.forecast);
      if (result.forecast) {
        setSelectedProductId(result.forecast.productId);
      }
    } catch {
      setForecast(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    loadForecast(productId);
  };

  // 차트 데이터 통합 (과거 + 예측)
  const chartData = useMemo(() => {
    if (!forecast) return [];
    return [
      ...forecast.history.map((h) => ({ month: h.month, value: h.value, type: "history" as const })),
      ...forecast.predicted.map((p) => ({ month: p.month, value: p.value, type: "predicted" as const })),
    ];
  }, [forecast]);

  // 통계
  const stats = useMemo(() => {
    if (!forecast) return null;
    const historyValues = forecast.history.map((h) => h.value);
    const avgHistory = historyValues.length > 0
      ? Math.round(historyValues.reduce((a, b) => a + b, 0) / historyValues.length)
      : 0;
    const avgPredicted = forecast.predicted.length > 0
      ? Math.round(forecast.predicted.reduce((a, b) => a + b.value, 0) / forecast.predicted.length)
      : 0;
    const trend = avgHistory > 0 ? ((avgPredicted - avgHistory) / avgHistory) * 100 : 0;
    return { avgHistory, avgPredicted, trend };
  }, [forecast]);

  // SVG 차트 계산
  const chart = useMemo(() => {
    if (chartData.length === 0) return null;
    const width = 800;
    const height = 240;
    const pad = { top: 16, right: 20, bottom: 36, left: 60 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const values = chartData.map((d) => d.value);
    const maxVal = Math.max(...values) * 1.15;
    const minVal = Math.max(0, Math.min(...values) * 0.85);
    const xDivisor = chartData.length > 1 ? chartData.length - 1 : 1;
    const yRange = maxVal - minVal || 1; // 모든 값이 같을 때 0 나누기 방어

    const xScale = (i: number) => pad.left + (i / xDivisor) * innerW;
    const yScale = (v: number) =>
      pad.top + innerH - ((v - minVal) / yRange) * innerH;

    // 과거 실적 라인
    const historyCount = forecast!.history.length;
    const historyPath = chartData
      .slice(0, historyCount)
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)},${yScale(d.value)}`)
      .join(" ");

    // 예측 라인 (마지막 실적 포인트부터 시작)
    const predictedPath = chartData
      .slice(historyCount - 1)
      .map((d, i) => {
        const idx = historyCount - 1 + i;
        return `${i === 0 ? "M" : "L"} ${xScale(idx)},${yScale(d.value)}`;
      })
      .join(" ");

    // Y축 레이블
    const yLabelCount = 5;
    const yStep = yRange / (yLabelCount - 1);
    const yLabels = Array.from({ length: yLabelCount }, (_, i) => {
      const value = minVal + yStep * i;
      return { value, y: yScale(value) };
    });

    // X축 레이블 (간격 조정)
    const step = Math.max(1, Math.floor(chartData.length / 6));
    const xLabels = chartData
      .map((d, i) => ({ ...d, index: i }))
      .filter((_, i) => i % step === 0 || i === chartData.length - 1);

    return {
      width, height, pad, xScale, yScale,
      historyPath, predictedPath, historyCount,
      yLabels, xLabels, maxVal, minVal,
    };
  }, [chartData, forecast]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        수요예측 데이터를 분석 중...
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">수요예측 데이터 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            제품을 등록하고 판매 데이터를 입력하면 수요예측 결과가 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 제품 선택 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">제품 선택</CardTitle>
          <CardDescription>수요예측을 확인할 제품을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={selectedProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                [{p.sku}] {p.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {!forecast ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">예측 불가</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
              최소 2개월 이상의 판매 데이터가 필요합니다. 판매 데이터를 등록하면 자동으로 수요예측이 실행됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예측 방법</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{METHOD_LABELS[forecast.method] || forecast.method}</div>
                <p className="mt-1 text-xs text-muted-foreground">자동 선택됨</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예측 정확도</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">MAPE {forecast.mape}%</span>
                  <Badge className={cn("text-xs", CONFIDENCE_MAP[forecast.confidence]?.color)}>
                    {CONFIDENCE_MAP[forecast.confidence]?.label || forecast.confidence}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {forecast.mape < 15 ? "매우 정확한 예측입니다" : forecast.mape < 30 ? "양호한 예측 수준입니다" : "변동성이 큰 제품입니다"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 실적</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{stats?.avgHistory.toLocaleString("ko-KR")}개/월</div>
                <p className="mt-1 text-xs text-muted-foreground">과거 {forecast.history.length}개월 평균</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예측 추세</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-lg font-bold", (stats?.trend ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                  {(stats?.trend ?? 0) >= 0 ? "+" : ""}
                  {stats?.trend.toFixed(1)}%
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  예측 평균: {stats?.avgPredicted.toLocaleString("ko-KR")}개/월
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 차트 */}
          {chart && (
            <Card>
              <CardHeader>
                <CardTitle>수요예측 차트</CardTitle>
                <CardDescription>
                  [{forecast.productName}] 과거 실적(실선) + 미래 예측(점선)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative w-full overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    className="w-full"
                  >
                    {/* Y축 그리드 */}
                    {chart.yLabels.map((label, i) => (
                      <g key={i}>
                        <line
                          x1={chart.pad.left}
                          y1={label.y}
                          x2={chart.width - chart.pad.right}
                          y2={label.y}
                          stroke="#e5e7eb"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={chart.pad.left - 10}
                          y={label.y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          className="fill-slate-500" fontSize="11"
                        >
                          {Math.round(label.value).toLocaleString("ko-KR")}
                        </text>
                      </g>
                    ))}

                    {/* 예측 영역 배경 */}
                    <rect
                      x={chart.xScale(chart.historyCount - 1)}
                      y={chart.pad.top}
                      width={chart.width - chart.pad.right - chart.xScale(chart.historyCount - 1)}
                      height={chart.height - chart.pad.top - chart.pad.bottom}
                      fill="#f0f9ff"
                      opacity="0.5"
                    />

                    {/* 구분선 (과거/예측 경계) */}
                    <line
                      x1={chart.xScale(chart.historyCount - 1)}
                      y1={chart.pad.top}
                      x2={chart.xScale(chart.historyCount - 1)}
                      y2={chart.height - chart.pad.bottom}
                      stroke="#93c5fd"
                      strokeWidth="1"
                      strokeDasharray="6 3"
                    />

                    {/* 과거 실적 라인 */}
                    <path d={chart.historyPath} stroke="#3b82f6" strokeWidth="2.5" fill="none" />

                    {/* 예측 라인 */}
                    <path
                      d={chart.predictedPath}
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeDasharray="8 4"
                      fill="none"
                    />

                    {/* 데이터 포인트 */}
                    {chartData.map((point, index) => (
                      <circle
                        key={index}
                        cx={chart.xScale(index)}
                        cy={chart.yScale(point.value)}
                        r={hoveredPoint === index ? 5 : 4}
                        fill={point.type === "history" ? "#3b82f6" : "#f59e0b"}
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPoint(index)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    ))}

                    {/* X축 레이블 */}
                    {chart.xLabels.map((label) => (
                      <text
                        key={label.index}
                        x={chart.xScale(label.index)}
                        y={chart.height - chart.pad.bottom + 20}
                        textAnchor="middle"
                        className="fill-slate-500" fontSize="11"
                      >
                        {label.month.slice(2).replace("-", "/")}
                      </text>
                    ))}

                    {/* 호버 툴팁 */}
                    {hoveredPoint !== null && chartData[hoveredPoint] && (
                      <g>
                        <rect
                          x={chart.xScale(hoveredPoint) - 60}
                          y={chart.yScale(chartData[hoveredPoint].value) - 45}
                          width="120"
                          height="38"
                          rx="6"
                          className="fill-slate-800"
                          opacity="0.95"
                        />
                        <text
                          x={chart.xScale(hoveredPoint)}
                          y={chart.yScale(chartData[hoveredPoint].value) - 30}
                          textAnchor="middle"
                          className="fill-white font-medium" fontSize="10"
                        >
                          {chartData[hoveredPoint].month} ({chartData[hoveredPoint].type === "history" ? "실적" : "예측"})
                        </text>
                        <text
                          x={chart.xScale(hoveredPoint)}
                          y={chart.yScale(chartData[hoveredPoint].value) - 15}
                          textAnchor="middle"
                          className="fill-white font-bold" fontSize="10"
                        >
                          {chartData[hoveredPoint].value.toLocaleString("ko-KR")}개
                        </text>
                      </g>
                    )}

                    {/* 범례 라벨 */}
                    <text
                      x={chart.xScale(Math.floor(chart.historyCount / 2))}
                      y={chart.pad.top + 10}
                      textAnchor="middle"
                      className="fill-blue-600" fontSize="10"
                    >
                      과거 실적
                    </text>
                    <text
                      x={chart.xScale(chart.historyCount + Math.floor((chartData.length - chart.historyCount) / 2))}
                      y={chart.pad.top + 10}
                      textAnchor="middle"
                      className="fill-amber-600" fontSize="10"
                    >
                      수요 예측
                    </text>
                  </svg>
                </div>

                {/* 범례 */}
                <div className="mt-4 flex items-center gap-6 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-6 bg-blue-500" />
                    <span className="text-xs text-slate-600">과거 실적</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-6 border-b-2 border-dashed border-amber-500" />
                    <span className="text-xs text-slate-600">수요 예측</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-blue-50 ring-1 ring-blue-200" />
                    <span className="text-xs text-slate-600">예측 구간</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 상세 데이터 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">월별 상세 데이터</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-slate-500">월</th>
                      <th className="pb-2 pr-4 text-right font-medium text-slate-500">수량</th>
                      <th className="pb-2 font-medium text-slate-500">구분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.history.map((h) => (
                      <tr key={h.month} className="border-b">
                        <td className="py-2 pr-4">{h.month}</td>
                        <td className="py-2 pr-4 text-right font-medium">{h.value.toLocaleString("ko-KR")}개</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">실적</Badge>
                        </td>
                      </tr>
                    ))}
                    {forecast.predicted.map((p) => (
                      <tr key={p.month} className="border-b bg-amber-50/50">
                        <td className="py-2 pr-4">{p.month}</td>
                        <td className="py-2 pr-4 text-right font-medium text-amber-700">{p.value.toLocaleString("ko-KR")}개</td>
                        <td className="py-2">
                          <Badge className="bg-amber-100 text-xs text-amber-700">예측</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
