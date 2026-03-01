"use client";

import { useState, useMemo, useCallback } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BarChart2, Calendar, Package, PackageX, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgingSummary, AgingProduct } from "@/server/actions/inventory-aging";

// ─── 정렬 ────────────────────────────────────────────────────────────────────

type SortKey = "sku" | "name" | "currentStock" | "inventoryValue" | "lastOutboundDate" | "daysSinceLastOutbound";
type SortDir = "asc" | "desc";

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만원`;
  return `${value.toLocaleString("ko-KR")}원`;
}

function getRecommendationBadge(recommendation: string) {
  if (recommendation === "반품/폐기 검토") {
    return (
      <Badge variant="destructive" className="whitespace-nowrap text-xs">
        {recommendation}
      </Badge>
    );
  }
  if (recommendation === "할인 판매 검토") {
    return (
      <Badge
        variant="outline"
        className="whitespace-nowrap border-orange-500 text-xs text-orange-700 dark:border-orange-600 dark:text-orange-400"
      >
        {recommendation}
      </Badge>
    );
  }
  if (recommendation === "판매 촉진 검토") {
    return (
      <Badge
        variant="outline"
        className="whitespace-nowrap border-yellow-500 text-xs text-yellow-700 dark:border-yellow-600 dark:text-yellow-400"
      >
        {recommendation}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="whitespace-nowrap text-xs">
      {recommendation}
    </Badge>
  );
}

// ─── 차트 설정 ────────────────────────────────────────────────────────────────

const agingChartConfig = {
  productCount: {
    label: "제품 수",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

const COHORT_COLORS: Record<string, string> = {
  "0~30일":   "#22c55e",
  "31~60일":  "#3b82f6",
  "61~90일":  "#eab308",
  "91~180일": "#f97316",
  "180일+":   "#ef4444",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface InventoryAgingProps {
  data: AgingSummary | null;
  className?: string;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function InventoryAging({ data, className }: InventoryAgingProps) {
  const [selectedCohort, setSelectedCohort] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 inline h-3 w-3" />
      : <ArrowDown className="ml-1 inline h-3 w-3" />;
  };

  // 차트 데이터
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.cohorts.map((c) => ({
      label: c.label,
      productCount: c.productCount,
      totalValue: c.totalValue,
      fill: COHORT_COLORS[c.label] ?? "#94a3b8",
    }));
  }, [data]);

  // 테이블에 표시할 제품 목록
  const tableProducts = useMemo<AgingProduct[]>(() => {
    if (!data) return [];
    let items: AgingProduct[];
    if (selectedCohort) {
      items = [...(data.cohorts.find((c) => c.label === selectedCohort)?.products ?? [])];
    } else {
      // 전체: 사장재고(180일+) 먼저 → 나머지 경과일 내림차순
      items = data.cohorts.flatMap((c) => c.products).sort((a, b) => {
        if (a.isDeadStock !== b.isDeadStock) return a.isDeadStock ? -1 : 1;
        return b.daysSinceLastOutbound - a.daysSinceLastOutbound;
      });
    }
    // 사용자 정렬 적용
    if (sortKey) {
      items.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "sku": cmp = a.sku.localeCompare(b.sku); break;
          case "name": cmp = a.name.localeCompare(b.name); break;
          case "currentStock": cmp = a.currentStock - b.currentStock; break;
          case "inventoryValue": cmp = a.inventoryValue - b.inventoryValue; break;
          case "lastOutboundDate": cmp = (a.lastOutboundDate ?? "").localeCompare(b.lastOutboundDate ?? ""); break;
          case "daysSinceLastOutbound": cmp = a.daysSinceLastOutbound - b.daysSinceLastOutbound; break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return items;
  }, [data, selectedCohort, sortKey, sortDir]);

  const totalProducts = useMemo(
    () => data?.cohorts.reduce((s, c) => s + c.productCount, 0) ?? 0,
    [data]
  );

  // 데이터 없음
  if (!data || data.cohorts.length === 0 || totalProducts === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <PackageX className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">재고 에이징 데이터 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            현재 재고가 있는 제품이 없거나 데이터를 불러오지 못했습니다.
            제품을 등록하고 재고를 입력하면 에이징 분석 결과가 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* 기준일 */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="px-2.5 py-1 text-xs">
          {data.periodLabel}
        </Badge>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">사장재고 품목 수</CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">
              {data.totalDeadStockCount}개
            </div>
            <p className="mt-1 text-xs text-muted-foreground">180일 이상 미출고</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">사장재고 금액</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">
              {formatCurrency(data.totalDeadStockValue)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">묶여있는 자금</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 체류일수</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.averageDaysHeld}일</div>
            <p className="mt-1 text-xs text-muted-foreground">마지막 출고 이후 경과</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">분석 대상 제품</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}개</div>
            <p className="mt-1 text-xs text-muted-foreground">현재 재고 보유 품목</p>
          </CardContent>
        </Card>
      </div>

      {/* 에이징 분포 차트 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle>에이징 코호트 분포</CardTitle>
          </div>
          <CardDescription>
            마지막 출고 이후 경과일 기준 제품 분포. 바를 클릭하면 해당 구간 제품만 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={agingChartConfig} className="h-[200px] w-full !aspect-auto">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
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
                    formatter={(value, name) =>
                      name === "productCount" ? [`${value}개`, "제품 수"] : [value, name]
                    }
                  />
                }
              />
              <Bar
                dataKey="productCount"
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  const label = entry.label as string;
                  setSelectedCohort((prev) => (prev === label ? null : label));
                }}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.label}
                    fill={entry.fill}
                    opacity={selectedCohort && selectedCohort !== entry.label ? 0.35 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>

          {/* 범례 */}
          <div className="mt-4 flex flex-wrap gap-3">
            {data.cohorts.map((c) => (
              <button
                key={c.label}
                onClick={() => setSelectedCohort((prev) => (prev === c.label ? null : c.label))}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-opacity",
                  selectedCohort && selectedCohort !== c.label && "opacity-40"
                )}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: COHORT_COLORS[c.label] ?? "#94a3b8" }}
                />
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground">({c.productCount}개)</span>
              </button>
            ))}
            {selectedCohort && (
              <button
                onClick={() => setSelectedCohort(null)}
                className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                필터 해제
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 사장재고/에이징 제품 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedCohort ? `${selectedCohort} 제품 목록` : "전체 에이징 제품 목록"}
          </CardTitle>
          <CardDescription>
            {selectedCohort
              ? `${selectedCohort} 구간에 속하는 제품 (${tableProducts.length}개)`
              : `현재 재고 보유 품목 전체 (${tableProducts.length}개) — 사장재고 우선 표시`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tableProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              해당 구간에 제품이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[90px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("sku")}>SKU<SortIcon column="sku" /></TableHead>
                    <TableHead className="min-w-[140px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("name")}>제품명<SortIcon column="name" /></TableHead>
                    <TableHead className="text-right min-w-[80px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("currentStock")}>현재고<SortIcon column="currentStock" /></TableHead>
                    <TableHead className="text-right min-w-[100px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("inventoryValue")}>재고금액<SortIcon column="inventoryValue" /></TableHead>
                    <TableHead className="min-w-[110px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("lastOutboundDate")}>마지막 출고일<SortIcon column="lastOutboundDate" /></TableHead>
                    <TableHead className="text-right min-w-[90px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("daysSinceLastOutbound")}>경과일수<SortIcon column="daysSinceLastOutbound" /></TableHead>
                    <TableHead className="min-w-[130px]">추천 조치</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableProducts.map((product) => (
                    <TableRow
                      key={product.productId}
                      className={cn(
                        product.isDeadStock &&
                          "bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                      )}
                    >
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {product.isDeadStock && (
                            <span
                              className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500"
                              title="사장재고"
                            />
                          )}
                          <span className="truncate max-w-[200px]">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.currentStock.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.inventoryValue)}
                      </TableCell>
                      <TableCell>
                        {product.lastOutboundDate ?? (
                          <span className="text-muted-foreground text-xs">출고 이력 없음</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-semibold",
                            product.daysSinceLastOutbound >= 180
                              ? "text-red-600 dark:text-red-500"
                              : product.daysSinceLastOutbound >= 91
                                ? "text-orange-600 dark:text-orange-400"
                                : product.daysSinceLastOutbound >= 61
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-foreground"
                          )}
                        >
                          {product.daysSinceLastOutbound}일
                        </span>
                      </TableCell>
                      <TableCell>{getRecommendationBadge(product.recommendation)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 기준 안내 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">에이징 기준 안내</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.cohorts.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: COHORT_COLORS[c.label] ?? "#94a3b8" }}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(c.totalValue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            경과일수는 마지막 출고(changeAmount &lt; 0) 이후 오늘까지의 일수입니다.
            출고 이력이 없는 제품은 제품 등록일 기준으로 계산됩니다.
            재고금액은 원가(없는 경우 판매단가) 기준입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
