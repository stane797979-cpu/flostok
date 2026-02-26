"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, PackageX, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WarehouseComparisonSummary } from "@/server/actions/warehouse-analytics";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function getWarehouseTypeLabel(type: string): string {
  switch (type) {
    case "MAIN":       return "본사";
    case "REGIONAL":   return "지역";
    case "VIRTUAL":    return "가상";
    case "THIRD_PARTY": return "3PL";
    default:           return type;
  }
}

function formatCurrency(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만원`;
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}

// ─── 건전성 점수 색상 ─────────────────────────────────────────────────────────

function getHealthScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-blue-600 dark:text-blue-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getHealthScoreProgressColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function getHealthScoreBadge(score: number) {
  if (score >= 80) {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0 text-xs">
        양호
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0 text-xs">
        보통
      </Badge>
    );
  }
  if (score >= 40) {
    return (
      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0 text-xs">
        주의
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0 text-xs">
      위험
    </Badge>
  );
}

// ─── 상태 분포 차트 설정 ──────────────────────────────────────────────────────

const statusChartConfig = {
  outOfStock: { label: "품절",  color: "#1e293b" },
  critical:   { label: "위험",  color: "#ef4444" },
  shortage:   { label: "부족",  color: "#f97316" },
  caution:    { label: "주의",  color: "#eab308" },
  optimal:    { label: "적정",  color: "#22c55e" },
  excess:     { label: "과다",  color: "#3b82f6" },
  overstock:  { label: "과잉",  color: "#a855f7" },
} satisfies ChartConfig;

// ─── Props ───────────────────────────────────────────────────────────────────

interface WarehouseComparisonProps {
  data: WarehouseComparisonSummary | null;
  className?: string;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function WarehouseComparison({ data, className }: WarehouseComparisonProps) {
  // 스택드 바 차트 데이터 변환
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.warehouses.map((w) => ({
      name: w.warehouseName,
      품절: w.statusDistribution.outOfStock,
      위험: w.statusDistribution.critical,
      부족: w.statusDistribution.shortage,
      주의: w.statusDistribution.caution,
      적정: w.statusDistribution.optimal,
      과다: w.statusDistribution.excess,
      과잉: w.statusDistribution.overstock,
    }));
  }, [data]);

  // 데이터 없음 — 창고 자체가 없는 경우
  if (!data || data.warehouses.length === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">창고가 등록되지 않았습니다</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            설정에서 창고를 등록하면 창고별 재고 건전성 비교 분석이 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const warehousesWithData = data.warehouses.filter((w) => w.totalSKUs > 0);

  return (
    <div className={cn("space-y-6", className)}>
      {/* 기준일 뱃지 */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="px-2.5 py-1 text-xs">
          {data.periodLabel}
        </Badge>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 창고 수</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.warehouses.length}개</div>
            <p className="mt-1 text-xs text-muted-foreground">
              재고 보유: {warehousesWithData.length}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 재고 금액</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalOrganizationValue)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">전 창고 합산</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">최고/최저 건전성</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                <span className="text-sm font-semibold truncate">{data.bestWarehouse}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">{data.worstWarehouse}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 창고 비교 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>창고별 재고 현황 비교</CardTitle>
          <CardDescription>
            건전성 점수는 전체 SKU 중 적정 상태 비율을 기준으로 산정됩니다 (0~100점).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.warehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PackageX className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">등록된 창고가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[130px]">창고명</TableHead>
                    <TableHead className="min-w-[60px]">유형</TableHead>
                    <TableHead className="text-right min-w-[70px]">SKU수</TableHead>
                    <TableHead className="text-right min-w-[80px]">총수량</TableHead>
                    <TableHead className="text-right min-w-[110px]">재고금액</TableHead>
                    <TableHead className="text-right min-w-[60px]">품절</TableHead>
                    <TableHead className="text-right min-w-[60px]">위험</TableHead>
                    <TableHead className="text-right min-w-[60px]">적정</TableHead>
                    <TableHead className="text-right min-w-[60px]">과다</TableHead>
                    <TableHead className="min-w-[160px]">건전성 점수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.warehouses.map((w) => (
                    <TableRow key={w.warehouseId}>
                      <TableCell>
                        <div className="font-medium">{w.warehouseName}</div>
                        <div className="text-xs text-muted-foreground">{w.warehouseCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {getWarehouseTypeLabel(w.warehouseType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(w.totalSKUs)}</TableCell>
                      <TableCell className="text-right">{formatNumber(w.totalStock)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(w.totalValue)}</TableCell>
                      <TableCell className="text-right">
                        {w.outOfStockCount > 0 ? (
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {w.outOfStockCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.criticalCount > 0 ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {w.criticalCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.optimalCount > 0 ? (
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {w.optimalCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {w.excessCount + w.overstockCount > 0 ? (
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {w.excessCount + w.overstockCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {w.totalSKUs > 0 ? (
                          <div className="flex items-center gap-2 min-w-[130px]">
                            <div className="flex-1">
                              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    getHealthScoreProgressColor(w.healthScore)
                                  )}
                                  style={{ width: `${w.healthScore}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={cn("text-sm font-bold", getHealthScoreColor(w.healthScore))}>
                                {w.healthScore}
                              </span>
                              {getHealthScoreBadge(w.healthScore)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">재고 없음</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 재고 상태 분포 스택드 바 차트 */}
      {chartData.length > 0 && warehousesWithData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>창고별 재고 상태 분포</CardTitle>
            <CardDescription>
              각 창고의 SKU를 7단계 재고 상태(품절~과잉)로 분류하여 비교합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={statusChartConfig}
              className="h-[250px] w-full !aspect-auto"
            >
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => [`${value}개`, name]}
                    />
                  }
                />
                <Bar dataKey="품절"  stackId="a" fill={statusChartConfig.outOfStock.color} radius={0} />
                <Bar dataKey="위험"  stackId="a" fill={statusChartConfig.critical.color}   radius={0} />
                <Bar dataKey="부족"  stackId="a" fill={statusChartConfig.shortage.color}   radius={0} />
                <Bar dataKey="주의"  stackId="a" fill={statusChartConfig.caution.color}    radius={0} />
                <Bar dataKey="적정"  stackId="a" fill={statusChartConfig.optimal.color}    radius={0} />
                <Bar dataKey="과다"  stackId="a" fill={statusChartConfig.excess.color}     radius={0} />
                <Bar
                  dataKey="과잉"
                  stackId="a"
                  fill={statusChartConfig.overstock.color}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>

            {/* 상태 범례 */}
            <div className="mt-4 flex flex-wrap gap-3">
              {(
                [
                  { key: "outOfStock", label: "품절" },
                  { key: "critical",   label: "위험" },
                  { key: "shortage",   label: "부족" },
                  { key: "caution",    label: "주의" },
                  { key: "optimal",    label: "적정" },
                  { key: "excess",     label: "과다" },
                  { key: "overstock",  label: "과잉" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: statusChartConfig[key].color }}
                  />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 창고가 있지만 재고가 없는 경우 안내 */}
      {warehousesWithData.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <PackageX className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              등록된 창고에 재고 데이터가 없습니다. 재고를 입력하면 비교 차트가 표시됩니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 건전성 점수 기준 안내 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">건전성 점수 기준</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { range: "80점 이상", label: "양호", colorClass: "bg-green-500" },
              { range: "60~79점",   label: "보통", colorClass: "bg-blue-500" },
              { range: "40~59점",   label: "주의", colorClass: "bg-orange-500" },
              { range: "40점 미만", label: "위험", colorClass: "bg-red-500" },
            ].map(({ range, label, colorClass }) => (
              <div key={range} className="flex items-center gap-2">
                <span className={cn("inline-block h-3 w-3 rounded-sm flex-shrink-0", colorClass)} />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{range}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            건전성 점수 = 적정 상태(optimal) SKU 수 ÷ 전체 보유 SKU 수 × 100.
            품절, 위험, 부족, 과다, 과잉 제품이 많을수록 점수가 낮아집니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
