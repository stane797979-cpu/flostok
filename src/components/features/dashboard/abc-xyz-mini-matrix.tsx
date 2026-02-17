"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PeriodBadge } from "./period-badge";

interface ABCXYZMiniMatrixProps {
  matrixData: { grade: string; count: number }[];
}

const GRADES = ["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"];
const ABC_LABELS = ["A", "B", "C"];
const XYZ_LABELS = ["X", "Y", "Z"];

function getCellColor(count: number, maxCount: number): string {
  if (count === 0) return "bg-slate-50 dark:bg-slate-900 text-slate-400";
  const ratio = count / Math.max(maxCount, 1);
  if (ratio >= 0.6) return "bg-green-500 text-white";
  if (ratio >= 0.3) return "bg-green-300 text-green-900";
  if (ratio >= 0.1) return "bg-green-100 text-green-800";
  return "bg-green-50 text-green-700";
}

export function ABCXYZMiniMatrix({ matrixData }: ABCXYZMiniMatrixProps) {
  // matrixData를 lookup으로 변환
  const countMap = new Map(matrixData.map((d) => [d.grade, d.count]));
  const maxCount = Math.max(...GRADES.map((g) => countMap.get(g) || 0), 1);
  const totalCount = GRADES.reduce((sum, g) => sum + (countMap.get(g) || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">ABC-XYZ 분포</CardTitle>
          <PeriodBadge
            period="최근 6개월"
            description="최근 6개월간 판매 데이터 기반 ABC-XYZ 등급 분류입니다."
            formula="ABC: 매출액 상위 분류 | XYZ: 판매량 변동계수(CV) 기준"
          />
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/analytics">상세 분석</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">데이터 없음</p>
        ) : (
          <div className="space-y-1">
            {/* 헤더 (X, Y, Z) */}
            <div className="grid grid-cols-4 gap-1">
              <div />
              {XYZ_LABELS.map((xyz) => (
                <div
                  key={xyz}
                  className={cn(
                    "text-center text-xs font-bold py-1 rounded",
                    xyz === "X"
                      ? "text-green-700"
                      : xyz === "Y"
                        ? "text-yellow-700"
                        : "text-red-700"
                  )}
                >
                  {xyz}
                </div>
              ))}
            </div>

            {/* 매트릭스 행 */}
            {ABC_LABELS.map((abc) => (
              <div key={abc} className="grid grid-cols-4 gap-1">
                <div className="flex items-center justify-center text-xs font-bold text-slate-600">
                  {abc}
                </div>
                {XYZ_LABELS.map((xyz) => {
                  const grade = `${abc}${xyz}`;
                  const count = countMap.get(grade) || 0;
                  return (
                    <div
                      key={grade}
                      className={cn(
                        "flex items-center justify-center rounded py-2 text-xs font-semibold transition-colors",
                        getCellColor(count, maxCount)
                      )}
                    >
                      {count}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* 범례 */}
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <span>총 {totalCount}개 SKU</span>
              <span>
                A: 매출상위 | X: 안정
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
