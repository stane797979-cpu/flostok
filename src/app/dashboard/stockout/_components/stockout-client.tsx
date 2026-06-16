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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertOctagon, Clock, CheckCircle, Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateStockoutRecord } from "@/server/actions/stockout";
import type { StockoutSummary } from "@/server/actions/stockout";
import { cn } from "@/lib/utils";

interface StockoutClientProps {
  data: StockoutSummary;
}

type SortField = "productSku" | "productName" | "currentStock" | "stockoutStartDate" | "stockoutEndDate" | "durationDays";
type SortDirection = "asc" | "desc" | null;

interface SortIconProps {
  field: SortField;
  currentField: SortField | null;
  direction: SortDirection;
}

function SortIcon({ field, currentField, direction }: SortIconProps) {
  if (currentField !== field) {
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />;
  }
  if (direction === "asc") {
    return <ArrowUp className="ml-1 h-3.5 w-3.5 text-slate-700" />;
  }
  if (direction === "desc") {
    return <ArrowDown className="ml-1 h-3.5 w-3.5 text-slate-700" />;
  }
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-slate-400" />;
}

const CAUSE_LABELS: Record<string, string> = {
  delivery_delay: "납기지연",
  demand_surge: "수요급증",
  supply_shortage: "공급부족",
  forecast_error: "예측오류",
  quality_issue: "품질이슈",
  other: "기타",
};

const ACTION_LABELS: Record<string, string> = {
  normalized: "정상화",
  inbound_waiting: "입고대기",
  order_in_progress: "발주진행",
  no_action: "미조치",
};

export function StockoutClient({ data }: StockoutClientProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showNormalized, setShowNormalized] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>("stockoutStartDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleCauseChange = (recordId: string, cause: string) => {
    startTransition(async () => {
      const result = await updateStockoutRecord(recordId, { cause });
      if (result.success) {
        toast({ title: "원인 업데이트 완료" });
      } else {
        toast({ title: "업데이트 실패", description: result.message, variant: "destructive" });
      }
    });
  };

  const handleActionChange = (recordId: string, actionStatus: string) => {
    startTransition(async () => {
      const result = await updateStockoutRecord(recordId, { actionStatus });
      if (result.success) {
        toast({ title: "조치 상태 업데이트 완료" });
      } else {
        toast({ title: "업데이트 실패", description: result.message, variant: "destructive" });
      }
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 3-state toggle: asc → desc → null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // 필터링: 정상화 완료 건 숨기기/보기
  const filteredRecords = showNormalized
    ? data.records
    : data.records.filter((r) => r.actionStatus !== "normalized");

  // 정렬
  const sortedRecords = useMemo(() => {
    if (!sortField || !sortDirection) return filteredRecords;

    return [...filteredRecords].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case "productSku":
          aVal = a.productSku;
          bVal = b.productSku;
          break;
        case "productName":
          aVal = a.productName;
          bVal = b.productName;
          break;
        case "currentStock":
          aVal = a.currentStock;
          bVal = b.currentStock;
          break;
        case "stockoutStartDate":
          aVal = a.stockoutStartDate;
          bVal = b.stockoutStartDate;
          break;
        case "stockoutEndDate":
          aVal = a.stockoutEndDate;
          bVal = b.stockoutEndDate;
          break;
        case "durationDays":
          aVal = a.durationDays;
          bVal = b.durationDays;
          break;
      }

      // null은 맨 뒤로
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      // 정렬
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal, "ko");
        return sortDirection === "asc" ? cmp : -cmp;
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }, [filteredRecords, sortField, sortDirection]);

  const normalizedCount = data.records.filter((r) => r.actionStatus === "normalized").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">결품관리</h1>
        <p className="mt-2 text-slate-500">품절/결품 현황 감지, 원인 분석 및 조치 추적</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 제품</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalProducts}개</div>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">현재 결품</CardTitle>
            <AlertOctagon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.stockoutCount}개</div>
            <p className="text-xs text-muted-foreground">결품률 {data.stockoutRate.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 결품일수</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.avgDurationDays > 0 ? `${data.avgDurationDays.toFixed(1)}일` : "-"}
            </div>
          </CardContent>
        </Card>
        <Card className={normalizedCount > 0 ? "border-green-200" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">정상화 완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{normalizedCount}건</div>
            <p className="text-xs text-muted-foreground">재고 회복 확인됨</p>
          </CardContent>
        </Card>
      </div>

      {/* 원인 분포 (있을 때만) */}
      {data.causeDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>결품 원인 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {data.causeDistribution.map(({ cause, count }) => (
                <div
                  key={cause}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <span className="text-sm font-medium">{CAUSE_LABELS[cause] || cause}</span>
                  <Badge variant="secondary">{count}건</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 결품 상세 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>결품 상세 현황</CardTitle>
              <CardDescription>
                {showNormalized
                  ? `전체 ${data.records.length}건 (진행 ${data.stockoutCount} + 정상화 ${normalizedCount})`
                  : `진행 중 ${filteredRecords.length}건`}
                {normalizedCount > 0 && !showNormalized && (
                  <span className="text-green-600"> · 정상화 {normalizedCount}건 숨김</span>
                )}
              </CardDescription>
            </div>
            {normalizedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNormalized(!showNormalized)}
              >
                {showNormalized ? (
                  <>
                    <EyeOff className="mr-1 h-4 w-4" />
                    정상화 숨기기
                  </>
                ) : (
                  <>
                    <Eye className="mr-1 h-4 w-4" />
                    정상화 보기
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="h-12 w-12 text-green-500/50 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">결품 없음</h3>
              <p className="mt-2 text-sm text-muted-foreground/70">
                현재 모든 제품의 재고가 정상입니다.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        onClick={() => handleSort("productSku")}
                        className="flex items-center font-medium hover:text-slate-900 transition-colors"
                      >
                        SKU
                        <SortIcon field="productSku" currentField={sortField} direction={sortDirection} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("productName")}
                        className="flex items-center font-medium hover:text-slate-900 transition-colors"
                      >
                        제품명
                        <SortIcon field="productName" currentField={sortField} direction={sortDirection} />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button
                        onClick={() => handleSort("currentStock")}
                        className="flex items-center justify-center w-full font-medium hover:text-slate-900 transition-colors"
                      >
                        현재 재고
                        <SortIcon field="currentStock" currentField={sortField} direction={sortDirection} />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button
                        onClick={() => handleSort("stockoutStartDate")}
                        className="flex items-center justify-center w-full font-medium hover:text-slate-900 transition-colors"
                      >
                        결품시작
                        <SortIcon field="stockoutStartDate" currentField={sortField} direction={sortDirection} />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button
                        onClick={() => handleSort("stockoutEndDate")}
                        className="flex items-center justify-center w-full font-medium hover:text-slate-900 transition-colors"
                      >
                        결품종료
                        <SortIcon field="stockoutEndDate" currentField={sortField} direction={sortDirection} />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button
                        onClick={() => handleSort("durationDays")}
                        className="flex items-center justify-center w-full font-medium hover:text-slate-900 transition-colors"
                      >
                        지속일수
                        <SortIcon field="durationDays" currentField={sortField} direction={sortDirection} />
                      </button>
                    </TableHead>
                    <TableHead className="w-[140px]">원인</TableHead>
                    <TableHead className="w-[140px]">조치</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRecords.map((record) => {
                    const isNormalized = record.actionStatus === "normalized";
                    return (
                      <TableRow
                        key={record.id}
                        className={cn(isNormalized && "opacity-60 bg-green-50/50")}
                      >
                        <TableCell className="font-mono text-xs">{record.productSku}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-sm">{record.productName}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-bold tabular-nums",
                              record.currentStock === 0 ? "text-red-600" : "text-green-600"
                            )}
                          >
                            {record.currentStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {record.stockoutStartDate || "-"}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {record.stockoutEndDate ? (
                            <span className="text-green-600 font-medium">{record.stockoutEndDate}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isNormalized && record.durationDays !== null ? (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700 bg-green-50">
                              {record.durationDays}일 (해소)
                            </Badge>
                          ) : record.durationDays !== null ? (
                            <Badge
                              variant={record.durationDays >= 7 ? "destructive" : "outline"}
                              className="text-xs"
                            >
                              {record.durationDays}일 진행중
                            </Badge>
                          ) : record.isStockout && !record.stockoutEndDate ? (
                            <Badge variant="destructive" className="text-xs">
                              1일 미만
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={record.cause || ""}
                            onValueChange={(v) => handleCauseChange(record.id, v)}
                            disabled={isPending || isNormalized}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CAUSE_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {isNormalized ? (
                            <Badge className="bg-green-500 hover:bg-green-600 text-xs">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              정상화
                            </Badge>
                          ) : (
                            <Select
                              value={record.actionStatus || "no_action"}
                              onValueChange={(v) => handleActionChange(record.id, v)}
                              disabled={isPending}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(ACTION_LABELS)
                                  .filter(([key]) => key !== "normalized")
                                  .map(([key, label]) => (
                                    <SelectItem key={key} value={key} className="text-xs">
                                      {label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
