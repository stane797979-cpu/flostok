"use client";

import { useState, useTransition, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getKPIDashboardData } from "@/server/actions/kpi";
import type { KPITrend } from "@/server/services/scm/kpi-measurement";

/** 합산 등급 목록 */
const COMBINED_GRADES = [
  "all",
  "AX",
  "AY",
  "AZ",
  "BX",
  "BY",
  "BZ",
  "CX",
  "CY",
  "CZ",
] as const;

type CombinedGrade = (typeof COMBINED_GRADES)[number];

/** 등급별 색상/설명 */
const GRADE_META: Record<
  string,
  { color: string; label: string; desc: string }
> = {
  all: {
    color: "bg-slate-100 text-slate-700",
    label: "전체",
    desc: "모든 SKU",
  },
  AX: {
    color: "bg-green-100 text-green-800",
    label: "AX",
    desc: "고매출+안정",
  },
  AY: {
    color: "bg-green-50 text-green-700",
    label: "AY",
    desc: "고매출+변동",
  },
  AZ: {
    color: "bg-yellow-100 text-yellow-800",
    label: "AZ",
    desc: "고매출+불규칙",
  },
  BX: {
    color: "bg-blue-100 text-blue-800",
    label: "BX",
    desc: "중매출+안정",
  },
  BY: {
    color: "bg-blue-50 text-blue-700",
    label: "BY",
    desc: "중매출+변동",
  },
  BZ: {
    color: "bg-orange-100 text-orange-800",
    label: "BZ",
    desc: "중매출+불규칙",
  },
  CX: {
    color: "bg-purple-100 text-purple-800",
    label: "CX",
    desc: "저매출+안정",
  },
  CY: {
    color: "bg-purple-50 text-purple-700",
    label: "CY",
    desc: "저매출+변동",
  },
  CZ: {
    color: "bg-red-100 text-red-800",
    label: "CZ",
    desc: "저매출+불규칙",
  },
};

interface KpiMonthlyTrendTableProps {
  trends: KPITrend[];
}

type SortField =
  | "month"
  | "inventoryTurnoverRate"
  | "stockoutRate"
  | "onTimeOrderRate"
  | "orderFulfillmentRate";
type SortDirection = "asc" | "desc" | null;

function SortIcon({
  field,
  currentField,
  currentDirection,
}: {
  field: SortField;
  currentField: SortField | null;
  currentDirection: SortDirection;
}) {
  if (field !== currentField || currentDirection === null) {
    return (
      <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/40" />
    );
  }
  if (currentDirection === "asc") {
    return <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" />;
  }
  return <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />;
}

function RateBadge({
  value,
  target,
  lowerIsBetter = false,
}: {
  value: number;
  target: number;
  lowerIsBetter?: boolean;
}) {
  if (value === 0)
    return <span className="text-muted-foreground tabular-nums">-</span>;

  const isGood = lowerIsBetter ? value <= target : value >= target;
  const isWarning = lowerIsBetter
    ? value <= target * 1.3
    : value >= target * 0.8;

  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        isGood
          ? "text-green-600"
          : isWarning
            ? "text-yellow-600"
            : "text-red-600",
      )}
    >
      {value.toFixed(1)}
      {lowerIsBetter || target > 50 ? "%" : ""}
    </span>
  );
}

function TrendIcon({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  if (previous === null || previous === 0) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.1)
    return <Minus className="h-3 w-3 text-slate-400" />;
  if (diff > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

export function KpiMonthlyTrendTable({
  trends: initialTrends,
}: KpiMonthlyTrendTableProps) {
  const [grade, setGrade] = useState<CombinedGrade>("all");
  const [trends, setTrends] = useState<KPITrend[]>(initialTrends);
  const [isPending, startTransition] = useTransition();

  // 정렬
  const [sortField, setSortField] = useState<SortField | null>("month");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  const sortedTrends = useMemo(() => {
    if (!sortField || !sortDirection) return trends;

    return [...trends].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal, "ko");
        return sortDirection === "asc" ? cmp : -cmp;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [trends, sortField, sortDirection]);

  const handleGradeChange = (newGrade: string) => {
    const g = newGrade as CombinedGrade;
    setGrade(g);

    startTransition(async () => {
      if (g === "all") {
        const data = await getKPIDashboardData();
        setTrends(data.trends);
      } else {
        const abcGrade = g[0] as "A" | "B" | "C";
        const xyzGrade = g[1] as "X" | "Y" | "Z";
        const data = await getKPIDashboardData({ abcGrade, xyzGrade });
        setTrends(data.trends);
      }
    });
  };

  const gradeMeta = GRADE_META[grade] || GRADE_META.all;

  // KPI 목표값
  const targets = {
    turnover: 10,
    stockout: 2,
    onTimeDelivery: 90,
    fulfillment: 95,
  };

  if (trends.length === 0 && !isPending) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            월별 KPI 데이터 없음
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            판매 데이터가 쌓이면 월별 추이가 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              월별 KPI 추이
              {grade !== "all" && (
                <Badge className={cn("text-xs", gradeMeta.color)}>
                  {gradeMeta.label} — {gradeMeta.desc}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              등급별 핵심 성과 지표 월별 변화
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={grade}
              onValueChange={handleGradeChange}
              disabled={isPending}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="등급 선택" />
              </SelectTrigger>
              <SelectContent>
                {COMBINED_GRADES.map((g) => {
                  const m = GRADE_META[g];
                  return (
                    <SelectItem key={g} value={g}>
                      <div className="flex items-center gap-2">
                        {g !== "all" && (
                          <span
                            className={cn(
                              "inline-block w-6 text-center rounded text-[10px] font-bold leading-4",
                              m.color,
                            )}
                          >
                            {m.label}
                          </span>
                        )}
                        <span>{g === "all" ? "전체 SKU" : m.desc}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {isPending && (
              <span className="text-xs text-muted-foreground animate-pulse">
                조회 중...
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "overflow-x-auto",
            isPending && "opacity-50 pointer-events-none transition-opacity",
          )}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <button
                    className="flex items-center justify-start hover:text-foreground transition-colors"
                    onClick={() => handleSort("month")}
                  >
                    기간
                    <SortIcon
                      field="month"
                      currentField={sortField}
                      currentDirection={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("inventoryTurnoverRate")}
                  >
                    재고회전율
                    <SortIcon
                      field="inventoryTurnoverRate"
                      currentField={sortField}
                      currentDirection={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("stockoutRate")}
                  >
                    품절률
                    <SortIcon
                      field="stockoutRate"
                      currentField={sortField}
                      currentDirection={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("onTimeOrderRate")}
                  >
                    납기준수율
                    <SortIcon
                      field="onTimeOrderRate"
                      currentField={sortField}
                      currentDirection={sortDirection}
                    />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("orderFulfillmentRate")}
                  >
                    발주충족률
                    <SortIcon
                      field="orderFulfillmentRate"
                      currentField={sortField}
                      currentDirection={sortDirection}
                    />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTrends.map((trend, idx) => {
                const prev = idx > 0 ? sortedTrends[idx - 1] : null;

                return (
                  <TableRow key={trend.month}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Badge variant="outline" className="font-mono">
                        {trend.month}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge
                          value={trend.inventoryTurnoverRate}
                          target={targets.turnover}
                        />
                        <TrendIcon
                          current={trend.inventoryTurnoverRate}
                          previous={prev?.inventoryTurnoverRate ?? null}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge
                          value={trend.stockoutRate}
                          target={targets.stockout}
                          lowerIsBetter
                        />
                        <TrendIcon
                          current={-trend.stockoutRate}
                          previous={prev ? -prev.stockoutRate : null}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge
                          value={trend.onTimeOrderRate}
                          target={targets.onTimeDelivery}
                        />
                        <TrendIcon
                          current={trend.onTimeOrderRate}
                          previous={prev?.onTimeOrderRate ?? null}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge
                          value={trend.orderFulfillmentRate}
                          target={targets.fulfillment}
                        />
                        <TrendIcon
                          current={trend.orderFulfillmentRate}
                          previous={prev?.orderFulfillmentRate ?? null}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
