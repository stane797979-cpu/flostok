"use client";

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, MessageSquare, TrendingUp, TrendingDown, Minus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { updateKpiComment } from "@/server/actions/kpi-snapshots";
import type { KpiSnapshot } from "@/server/actions/kpi-snapshots";
import { cn } from "@/lib/utils";

interface KpiMonthlyTrendTableProps {
  snapshots: KpiSnapshot[];
}

type SortField = "period" | "turnoverRate" | "stockoutRate" | "onTimeDeliveryRate" | "fulfillmentRate" | "actualShipmentRate";
type SortDirection = "asc" | "desc" | null;

interface SortIconProps {
  field: SortField;
  currentField: SortField | null;
  currentDirection: SortDirection;
}

function SortIcon({ field, currentField, currentDirection }: SortIconProps) {
  if (field !== currentField || currentDirection === null) {
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/40" />;
  }
  if (currentDirection === "asc") {
    return <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" />;
  }
  return <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />;
}

function formatRate(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}%`;
}

function RateBadge({ value, target, lowerIsBetter = false }: { value: number | null; target: number; lowerIsBetter?: boolean }) {
  if (value === null) return <span className="text-muted-foreground">-</span>;

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
            : "text-red-600"
      )}
    >
      {value.toFixed(1)}%
    </span>
  );
}

function TrendIcon({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.1) return <Minus className="h-3 w-3 text-slate-400" />;
  if (diff > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

export function KpiMonthlyTrendTable({ snapshots }: KpiMonthlyTrendTableProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isPending, startTransition] = useTransition();

  // 정렬 state - 기본: period desc
  const [sortField, setSortField] = useState<SortField | null>("period");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // 정렬 핸들러 (3-state toggle: asc → desc → null)
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

  // 정렬된 스냅샷
  const sortedSnapshots = useMemo(() => {
    if (!sortField || !sortDirection) return snapshots;

    return [...snapshots].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // null은 맨 뒤로
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // string (period)
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal, "ko");
        return sortDirection === "asc" ? cmp : -cmp;
      }

      // number
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [snapshots, sortField, sortDirection]);

  const handleSaveComment = (snapshotId: string) => {
    startTransition(async () => {
      const result = await updateKpiComment(snapshotId, commentText);
      if (result.success) {
        toast({ title: "코멘트 저장 완료" });
        setEditingId(null);
        setCommentText("");
      } else {
        toast({ title: "저장 실패", description: result.message, variant: "destructive" });
      }
    });
  };

  if (snapshots.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">월별 KPI 데이터 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            KPI 스냅샷이 저장되면 월별 추이가 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  // KPI 목표값 (기본)
  const targets = {
    turnover: 10,
    stockout: 2,
    onTimeDelivery: 90,
    fulfillment: 95,
    actualShipment: 95,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>월별 KPI 추이</CardTitle>
        <CardDescription>
          최근 {snapshots.length}개월 핵심 성과 지표 추이 (클릭하여 코멘트 입력)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <button
                    className="flex items-center justify-start hover:text-foreground transition-colors"
                    onClick={() => handleSort("period")}
                  >
                    기간
                    <SortIcon field="period" currentField={sortField} currentDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("turnoverRate")}
                  >
                    재고회전율
                    <SortIcon field="turnoverRate" currentField={sortField} currentDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("stockoutRate")}
                  >
                    품절률
                    <SortIcon field="stockoutRate" currentField={sortField} currentDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("onTimeDeliveryRate")}
                  >
                    납기준수율
                    <SortIcon field="onTimeDeliveryRate" currentField={sortField} currentDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("fulfillmentRate")}
                  >
                    발주충족률
                    <SortIcon field="fulfillmentRate" currentField={sortField} currentDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                    onClick={() => handleSort("actualShipmentRate")}
                  >
                    실출고율
                    <SortIcon field="actualShipmentRate" currentField={sortField} currentDirection={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="min-w-[200px]">코멘트</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSnapshots.map((snap, idx) => {
                const prev = idx > 0 ? sortedSnapshots[idx - 1] : null;
                const isEditing = editingId === snap.id;

                return (
                  <TableRow key={snap.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Badge variant="outline" className="font-mono">
                        {snap.period}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge value={snap.turnoverRate} target={targets.turnover} />
                        <TrendIcon current={snap.turnoverRate} previous={prev?.turnoverRate ?? null} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge value={snap.stockoutRate} target={targets.stockout} lowerIsBetter />
                        <TrendIcon current={snap.stockoutRate ? -snap.stockoutRate : null} previous={prev?.stockoutRate ? -prev.stockoutRate : null} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge value={snap.onTimeDeliveryRate} target={targets.onTimeDelivery} />
                        <TrendIcon current={snap.onTimeDeliveryRate} previous={prev?.onTimeDeliveryRate ?? null} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge value={snap.fulfillmentRate} target={targets.fulfillment} />
                        <TrendIcon current={snap.fulfillmentRate} previous={prev?.fulfillmentRate ?? null} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RateBadge value={snap.actualShipmentRate} target={targets.actualShipment} />
                        <TrendIcon current={snap.actualShipmentRate} previous={prev?.actualShipmentRate ?? null} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="코멘트 입력..."
                            className="h-8 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveComment(snap.id);
                              if (e.key === "Escape") {
                                setEditingId(null);
                                setCommentText("");
                              }
                            }}
                            autoFocus
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0"
                            onClick={() => handleSaveComment(snap.id)}
                            disabled={isPending}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 text-xs text-left w-full rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => {
                            setEditingId(snap.id);
                            setCommentText(snap.comment || "");
                          }}
                        >
                          {snap.comment ? (
                            <span className="text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                              {snap.comment}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              클릭하여 입력
                            </span>
                          )}
                        </button>
                      )}
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
