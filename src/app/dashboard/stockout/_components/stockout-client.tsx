"use client";

import { useState, useTransition } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertOctagon, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateStockoutRecord } from "@/server/actions/stockout";
import type { StockoutSummary, StockoutRecordItem } from "@/server/actions/stockout";
import { cn } from "@/lib/utils";

interface StockoutClientProps {
  data: StockoutSummary;
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

function ActionStatusBadge({ status }: { status: string | null }) {
  switch (status) {
    case "normalized":
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-xs">
          <CheckCircle className="mr-1 h-3 w-3" />
          정상화
        </Badge>
      );
    case "inbound_waiting":
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">
          <Clock className="mr-1 h-3 w-3" />
          입고대기
        </Badge>
      );
    case "order_in_progress":
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
          발주진행
        </Badge>
      );
    default:
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="mr-1 h-3 w-3" />
          미조치
        </Badge>
      );
  }
}

export function StockoutClient({ data }: StockoutClientProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">주요 원인</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.causeDistribution.length > 0
                ? CAUSE_LABELS[data.causeDistribution[0].cause] || data.causeDistribution[0].cause
                : "-"}
            </div>
            {data.causeDistribution.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {data.causeDistribution[0].count}건
              </p>
            )}
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
          <CardTitle>결품 상세 현황</CardTitle>
          <CardDescription>
            총 {data.records.length}건 (자동 감지 + 수동 기록)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.records.length === 0 ? (
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
                    <TableHead>SKU</TableHead>
                    <TableHead>제품명</TableHead>
                    <TableHead className="text-center">기준일</TableHead>
                    <TableHead className="text-center">기말재고</TableHead>
                    <TableHead className="text-center">결품시작</TableHead>
                    <TableHead className="text-center">지속일수</TableHead>
                    <TableHead className="w-[140px]">원인</TableHead>
                    <TableHead className="w-[140px]">조치</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs">{record.productSku}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-sm">{record.productName}</TableCell>
                      <TableCell className="text-center text-xs">{record.referenceDate}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "font-medium",
                            record.closingStock === 0 ? "text-red-600" : ""
                          )}
                        >
                          {record.closingStock}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {record.stockoutStartDate || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {record.durationDays !== null ? (
                          <Badge
                            variant={record.durationDays >= 7 ? "destructive" : "outline"}
                            className="text-xs"
                          >
                            {record.durationDays}일
                          </Badge>
                        ) : record.isStockout && !record.stockoutEndDate ? (
                          <Badge variant="destructive" className="text-xs">진행중</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.cause || ""}
                          onValueChange={(v) => handleCauseChange(record.id, v)}
                          disabled={isPending}
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
                        <Select
                          value={record.actionStatus || "no_action"}
                          onValueChange={(v) => handleActionChange(record.id, v)}
                          disabled={isPending}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ACTION_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key} className="text-xs">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
