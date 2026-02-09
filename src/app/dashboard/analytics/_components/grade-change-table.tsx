"use client";

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
import { ArrowUp, ArrowDown, Minus, Sparkles, AlertTriangle, TrendingDown } from "lucide-react";
import type { GradeChangeResult } from "@/server/actions/grade-change";

interface GradeChangeTableProps {
  data: GradeChangeResult | null;
}

function ChangeTypeBadge({ type }: { type: string }) {
  switch (type) {
    case "upgrade":
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <ArrowUp className="mr-1 h-3 w-3" />
          상승
        </Badge>
      );
    case "downgrade":
      return (
        <Badge variant="destructive">
          <ArrowDown className="mr-1 h-3 w-3" />
          하락
        </Badge>
      );
    case "new":
      return (
        <Badge variant="secondary">
          <Sparkles className="mr-1 h-3 w-3" />
          신규
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Minus className="mr-1 h-3 w-3" />
          유지
        </Badge>
      );
  }
}

function RiskBadge({ level }: { level: string }) {
  switch (level) {
    case "high":
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="mr-1 h-3 w-3" />
          높음
        </Badge>
      );
    case "medium":
      return (
        <Badge variant="outline" className="border-yellow-500 text-yellow-700 text-xs">
          보통
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          낮음
        </Badge>
      );
  }
}

export function GradeChangeTable({ data }: GradeChangeTableProps) {
  if (!data || data.changes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingDown className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">등급 변동 이력 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            ABC-XYZ 등급이 갱신되면 변동 이력이 여기에 표시됩니다.
            설정에서 등급 갱신을 실행해주세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 등급 보유</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalProducts}개</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">등급 변동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.changedCount}개</div>
            <p className="text-xs text-muted-foreground">전월 대비</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">고위험 변동</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {data.changes.filter((c) => c.riskLevel === "high").length}개
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 변동 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>등급 변동 상세</CardTitle>
          <CardDescription>
            전월 대비 ABC-XYZ 등급 변동 내역 ({data.changes.length}건)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>제품명</TableHead>
                <TableHead className="text-center">이전 등급</TableHead>
                <TableHead className="text-center">현재 등급</TableHead>
                <TableHead className="text-center">변동</TableHead>
                <TableHead className="text-center">리스크</TableHead>
                <TableHead>관리신호</TableHead>
                <TableHead>실행방안</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.changes.map((item) => (
                <TableRow key={item.productId}>
                  <TableCell className="font-medium text-xs">{item.sku}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{item.name}</TableCell>
                  <TableCell className="text-center">
                    {item.prevGrade ? (
                      <Badge variant="outline" className="font-mono">
                        {item.prevGrade}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.currentGrade ? (
                      <Badge variant="secondary" className="font-mono">
                        {item.currentGrade}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <ChangeTypeBadge type={item.changeType} />
                  </TableCell>
                  <TableCell className="text-center">
                    <RiskBadge level={item.riskLevel} />
                  </TableCell>
                  <TableCell className="text-xs">{item.signal}</TableCell>
                  <TableCell className="text-xs max-w-[160px]">{item.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* XYZ 추이 (데이터가 있을 때만) */}
      {data.trend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>월별 XYZ 분포 추이</CardTitle>
            <CardDescription>월별 X(안정)/Y(보통)/Z(불안정) 품목 수 변화</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>기간</TableHead>
                  <TableHead className="text-center text-green-700">X (안정)</TableHead>
                  <TableHead className="text-center text-yellow-700">Y (보통)</TableHead>
                  <TableHead className="text-center text-red-700">Z (불안정)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trend.map((row) => (
                  <TableRow key={row.period}>
                    <TableCell className="font-medium">{row.period}</TableCell>
                    <TableCell className="text-center">{row.xCount}</TableCell>
                    <TableCell className="text-center">{row.yCount}</TableCell>
                    <TableCell className="text-center">{row.zCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
