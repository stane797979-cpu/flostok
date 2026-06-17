"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PSIClient } from "./psi-client";
import { getPSIData } from "@/server/actions/psi";
import type { PSIResult } from "@/server/services/scm/psi-aggregation";

export function PSIWrapper() {
  const [pastMonths, setPastMonths] = useState(6);
  const [data, setData] = useState<PSIResult | null>(null);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const load = (months: number) => {
    startTransition(async () => {
      try {
        const result = await getPSIData(months);
        setData(result);
        setError(false);
      } catch {
        setError(true);
      }
    });
  };

  useEffect(() => {
    load(pastMonths);
  }, []);

  const handlePrev = () => {
    const next = pastMonths + 6;
    setPastMonths(next);
    load(next);
  };

  const handleNext = () => {
    const next = Math.max(0, pastMonths - 6);
    setPastMonths(next);
    load(next);
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PSI 계획</h1>
          <p className="mt-2 text-slate-500">수요 · 공급 · 재고 통합 계획표</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">데이터를 불러올 수 없습니다</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">로그인 후 다시 시도해 주세요.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data && isPending) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 기간 이동 컨트롤 */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handlePrev} disabled={isPending}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          이전 6개월
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          {data ? `${data.periods[0]} ~ ${data.periods[data.periods.length - 1]}` : "로딩 중..."}
          {isPending && <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />}
        </span>
        <Button variant="outline" size="sm" onClick={handleNext} disabled={isPending || pastMonths <= 0}>
          다음 6개월
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {data && <PSIClient data={data} onRefresh={() => load(pastMonths)} />}
    </div>
  );
}
