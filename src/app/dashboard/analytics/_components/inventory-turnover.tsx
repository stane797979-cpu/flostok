"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TurnoverData, TurnoverSummary } from "@/server/actions/turnover";

// 상태 Badge 컴포넌트
function TurnoverStatusBadge({ status }: { status: TurnoverData["status"] }) {
  const config = {
    high: {
      label: "고회전",
      variant: "default" as const,
      className: "bg-green-500 hover:bg-green-600",
    },
    normal: {
      label: "정상",
      variant: "secondary" as const,
      className: "bg-blue-500 hover:bg-blue-600 text-white",
    },
    low: {
      label: "저회전",
      variant: "outline" as const,
      className: "border-orange-500 text-orange-700 dark:border-orange-600 dark:text-orange-400",
    },
    critical: { label: "위험", variant: "destructive" as const, className: "" },
  };

  const { label, variant, className } = config[status];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

type SortKey =
  | "sku"
  | "name"
  | "annualRevenue"
  | "avgInventoryValue"
  | "turnoverRate"
  | "daysOfInventory"
  | "status";
type SortOrder = "asc" | "desc";

interface InventoryTurnoverProps {
  data?: TurnoverSummary | null;
  className?: string;
}

export function InventoryTurnover({ data, className }: InventoryTurnoverProps) {
  const [sortKey, setSortKey] = useState<SortKey>("turnoverRate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const items = useMemo(() => data?.items || [], [data]);

  // 요약 통계
  const summary = useMemo(() => {
    if (data) {
      return {
        avgTurnoverRate: data.avgTurnoverRate.toFixed(1),
        avgDOI: data.avgDaysOfInventory,
        lowTurnoverCount: data.lowTurnoverCount,
      };
    }
    return { avgTurnoverRate: "0", avgDOI: 0, lowTurnoverCount: 0 };
  }, [data]);

  // 정렬 처리
  const sortedData = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal, "ko")
          : bVal.localeCompare(aVal, "ko");
      }

      return sortOrder === "asc"
        ? Number(aVal) - Number(bVal)
        : Number(bVal) - Number(aVal);
    });
  }, [items, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // 재고일수 분포 계산 (차트용)
  const doiDistribution = useMemo(() => {
    const ranges = [
      { label: "0-30일", min: 0, max: 30, count: 0 },
      { label: "31-60일", min: 31, max: 60, count: 0 },
      { label: "61-90일", min: 61, max: 90, count: 0 },
      { label: "91-120일", min: 91, max: 120, count: 0 },
      { label: "120일 초과", min: 121, max: Infinity, count: 0 },
    ];

    items.forEach((item) => {
      const range = ranges.find(
        (r) => item.daysOfInventory >= r.min && item.daysOfInventory <= r.max
      );
      if (range) range.count++;
    });

    const maxCount = Math.max(...ranges.map((r) => r.count));
    return ranges.map((r) => ({
      ...r,
      percentage: maxCount > 0 ? (r.count / maxCount) * 100 : 0,
    }));
  }, [items]);

  if (!data || items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">회전율 데이터 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            제품을 등록하고 판매 데이터를 입력하면 재고회전율이 자동 계산됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 재고회전율</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgTurnoverRate}회</div>
            <p className="text-muted-foreground mt-1 text-xs">연간 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 재고일수</CardTitle>
            <Calendar className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgDOI}일</div>
            <p className="text-muted-foreground mt-1 text-xs">재고 보유 기간</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">저회전 품목</CardTitle>
            <AlertTriangle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.lowTurnoverCount}개</div>
            <p className="text-muted-foreground mt-1 text-xs">회전율 6회 미만</p>
          </CardContent>
        </Card>
      </div>

      {/* TOP5 빠름/느림 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm font-medium">TOP5 고회전 (빠름)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {data.top5Fastest.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4">{idx + 1}</span>
                    <span className="font-medium truncate max-w-[140px]">{item.name}</span>
                    <span className="text-muted-foreground text-xs">{item.sku}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-600">{item.turnoverRate}회</span>
                    <span className="text-muted-foreground text-xs">{item.daysOfInventory}일</span>
                  </div>
                </div>
              ))}
              {data.top5Fastest.length === 0 && (
                <p className="text-sm text-muted-foreground">데이터 없음</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <CardTitle className="text-sm font-medium">TOP5 저회전 (느림)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {data.top5Slowest.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4">{idx + 1}</span>
                    <span className="font-medium truncate max-w-[140px]">{item.name}</span>
                    <span className="text-muted-foreground text-xs">{item.sku}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-600">{item.turnoverRate}회</span>
                    <span className="text-muted-foreground text-xs">{item.daysOfInventory}일</span>
                  </div>
                </div>
              ))}
              {data.top5Slowest.length === 0 && (
                <p className="text-sm text-muted-foreground">데이터 없음</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 재고일수 분포 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>재고일수 분포</CardTitle>
          <CardDescription>제품별 재고 보유 기간 분포 현황</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {doiDistribution.map((range) => (
              <div key={range.label} className="flex items-center gap-4">
                <div className="w-24 text-sm font-medium">{range.label}</div>
                <div className="flex-1">
                  <div className="bg-muted h-8 overflow-hidden rounded-md">
                    <div
                      className="flex h-full items-center justify-end bg-blue-500 pr-2 transition-all duration-300"
                      style={{ width: `${Math.max(range.percentage, range.count > 0 ? 8 : 0)}%` }}
                    >
                      {range.count > 0 && (
                        <span className="text-xs font-semibold text-white">{range.count}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 재고회전율 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>재고회전율 상세 현황</CardTitle>
          <CardDescription>
            제품별 재고회전율 및 재고일수 분석 ({items.length}개 제품)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <button
                    onClick={() => handleSort("sku")}
                    className="flex items-center gap-1 hover:text-slate-900"
                  >
                    SKU
                    {sortKey === "sku" ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1 hover:text-slate-900"
                  >
                    제품명
                    {sortKey === "name" ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("annualRevenue")}
                    className="ml-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    연간판매액
                    {sortKey === "annualRevenue" ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("avgInventoryValue")}
                    className="ml-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    평균재고금액
                    {sortKey === "avgInventoryValue" ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("turnoverRate")}
                    className="ml-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    회전율
                    {sortKey === "turnoverRate" ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("daysOfInventory")}
                    className="ml-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    재고일수
                    {sortKey === "daysOfInventory" ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center gap-1 hover:text-slate-900"
                  >
                    상태
                    {sortKey === "status" ? (
                      sortOrder === "desc" ? (
                        <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUp className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.sku}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">
                    {item.annualRevenue.toLocaleString("ko-KR")}원
                  </TableCell>
                  <TableCell className="text-right">
                    {item.avgInventoryValue.toLocaleString("ko-KR")}원
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.turnoverRate >= 999 ? "∞" : `${item.turnoverRate.toFixed(1)}회`}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.daysOfInventory === 0 ? "0일" : `${item.daysOfInventory}일`}
                  </TableCell>
                  <TableCell>
                    <TurnoverStatusBadge status={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* 상태 기준 설명 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">재고회전율 상태 기준</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <TurnoverStatusBadge status="high" />
              <span className="text-sm">회전율 12회 이상</span>
            </div>
            <div className="flex items-center gap-2">
              <TurnoverStatusBadge status="normal" />
              <span className="text-sm">회전율 6-12회</span>
            </div>
            <div className="flex items-center gap-2">
              <TurnoverStatusBadge status="low" />
              <span className="text-sm">회전율 3-6회</span>
            </div>
            <div className="flex items-center gap-2">
              <TurnoverStatusBadge status="critical" />
              <span className="text-sm">회전율 3회 미만</span>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            재고회전율 = 연간판매원가(COGS) / 평균재고금액 | 재고일수 = 365 / 재고회전율
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
