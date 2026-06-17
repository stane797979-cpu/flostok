"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CategoryDemandRow {
  category: string;
  currentQty: number;
  prevQty: number;
  changeRate: number;
  riskCount: number;
  shortageCount: number;
  excessCount: number;
}

interface CategoryDemandWidgetProps {
  rows: CategoryDemandRow[];
}

export function CategoryDemandWidget({ rows }: CategoryDemandWidgetProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">카테고리별 수요 동향</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            판매 데이터가 없습니다
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">카테고리별 수요 동향</CardTitle>
          <p className="mt-0.5 text-xs text-slate-500">당월 vs 전월 판매수량 비교</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/analytics?tab=sales-trend">추이 보기</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {/* 헤더 */}
          <div className="grid grid-cols-[1fr_72px_80px_auto] items-center gap-2 px-4 py-2 text-xs font-medium text-slate-400">
            <span>카테고리</span>
            <span className="text-right">당월 수량</span>
            <span className="text-right">전월 대비</span>
            <span className="text-right w-20">조치</span>
          </div>

          {rows.map((row) => {
            const hasRisk = row.riskCount > 0;
            const hasShortage = row.shortageCount > 0;
            const hasExcess = row.excessCount > 0;

            return (
              <div
                key={row.category}
                className="grid grid-cols-[1fr_72px_80px_auto] items-center gap-2 px-4 py-3"
              >
                {/* 카테고리 + 재고 상태 배지 */}
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="truncate text-sm font-medium">{row.category}</span>
                  <div className="flex flex-wrap gap-1">
                    {hasRisk && (
                      <Badge className="h-4 px-1.5 text-[10px] bg-red-100 text-red-700 border-0">
                        위험 {row.riskCount}
                      </Badge>
                    )}
                    {hasShortage && (
                      <Badge className="h-4 px-1.5 text-[10px] bg-orange-100 text-orange-700 border-0">
                        부족 {row.shortageCount}
                      </Badge>
                    )}
                    {hasExcess && (
                      <Badge className="h-4 px-1.5 text-[10px] bg-blue-100 text-blue-700 border-0">
                        과재고 {row.excessCount}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 당월 수량 */}
                <span className="text-right text-sm font-semibold">
                  {row.currentQty.toLocaleString("ko-KR")}
                </span>

                {/* 증감률 */}
                <div className="flex items-center justify-end gap-0.5">
                  {row.changeRate > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                  ) : row.changeRate < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  ) : (
                    <Minus className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      row.changeRate > 0
                        ? "text-green-600"
                        : row.changeRate < 0
                          ? "text-red-600"
                          : "text-slate-400"
                    )}
                  >
                    {row.changeRate > 0 ? "+" : ""}
                    {row.changeRate === 0 ? "-" : `${row.changeRate.toFixed(1)}%`}
                  </span>
                </div>

                {/* 조치 버튼 */}
                <div className="flex justify-end w-20">
                  {hasRisk ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 px-2 text-xs"
                      asChild
                    >
                      <Link href="/dashboard/orders?tab=reorder">발주</Link>
                    </Button>
                  ) : hasShortage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                      asChild
                    >
                      <Link href="/dashboard/orders?tab=reorder">발주</Link>
                    </Button>
                  ) : hasExcess ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                      asChild
                    >
                      <Link href="/dashboard/inventory">재고 확인</Link>
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-300">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
