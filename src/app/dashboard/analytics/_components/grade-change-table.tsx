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
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowUpDown, Minus, Sparkles, AlertTriangle, TrendingDown } from "lucide-react";
import type { GradeChangeResult } from "@/server/actions/grade-change";

interface GradeChangeTableProps {
  data: GradeChangeResult | null;
}

type SortField = "sku" | "name" | "prevGrade" | "currentGrade" | "changeType" | "riskLevel";
type SortDirection = "asc" | "desc" | null;

const CHANGE_ORDER: Record<string, number> = {
  upgrade: 0,
  new: 1,
  downgrade: 2,
};

const RISK_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

interface SortIconProps {
  field: SortField;
  currentField: SortField | null;
  currentDirection: SortDirection;
}

function SortIcon({ field, currentField, currentDirection }: SortIconProps) {
  if (currentField !== field) {
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5" />;
  }
  if (currentDirection === "asc") {
    return <ArrowUp className="ml-1 h-3.5 w-3.5" />;
  }
  if (currentDirection === "desc") {
    return <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  }
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5" />;
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
  const [sortField, setSortField] = useState<SortField>("sku");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 3-state toggle: asc → desc → null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField("sku");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedChanges = useMemo(() => {
    if (!data || data.changes.length === 0) return [];
    if (!sortDirection) return data.changes;

    const changes = [...data.changes];
    changes.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "sku":
          comparison = a.sku.localeCompare(b.sku, "ko");
          break;
        case "name":
          comparison = a.name.localeCompare(b.name, "ko");
          break;
        case "prevGrade":
          if (!a.prevGrade && !b.prevGrade) comparison = 0;
          else if (!a.prevGrade) comparison = 1;
          else if (!b.prevGrade) comparison = -1;
          else comparison = a.prevGrade.localeCompare(b.prevGrade, "ko");
          break;
        case "currentGrade":
          if (!a.currentGrade && !b.currentGrade) comparison = 0;
          else if (!a.currentGrade) comparison = 1;
          else if (!b.currentGrade) comparison = -1;
          else comparison = a.currentGrade.localeCompare(b.currentGrade, "ko");
          break;
        case "changeType": {
          const orderA = CHANGE_ORDER[a.changeType] ?? 3;
          const orderB = CHANGE_ORDER[b.changeType] ?? 3;
          comparison = orderA - orderB;
          break;
        }
        case "riskLevel": {
          const orderA = RISK_ORDER[a.riskLevel] ?? 3;
          const orderB = RISK_ORDER[b.riskLevel] ?? 3;
          comparison = orderA - orderB;
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return changes;
  }, [data, sortField, sortDirection]);

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
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-muted"
                    onClick={() => handleSort("sku")}
                  >
                    SKU
                    <SortIcon field="sku" currentField={sortField} currentDirection={sortDirection} />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-muted"
                    onClick={() => handleSort("name")}
                  >
                    제품명
                    <SortIcon field="name" currentField={sortField} currentDirection={sortDirection} />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-muted"
                    onClick={() => handleSort("prevGrade")}
                  >
                    이전 등급
                    <SortIcon field="prevGrade" currentField={sortField} currentDirection={sortDirection} />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-muted"
                    onClick={() => handleSort("currentGrade")}
                  >
                    현재 등급
                    <SortIcon field="currentGrade" currentField={sortField} currentDirection={sortDirection} />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-muted"
                    onClick={() => handleSort("changeType")}
                  >
                    변동
                    <SortIcon field="changeType" currentField={sortField} currentDirection={sortDirection} />
                  </Button>
                </TableHead>
                <TableHead className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 hover:bg-muted"
                    onClick={() => handleSort("riskLevel")}
                  >
                    리스크
                    <SortIcon field="riskLevel" currentField={sortField} currentDirection={sortDirection} />
                  </Button>
                </TableHead>
                <TableHead>관리신호</TableHead>
                <TableHead>실행방안</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedChanges.map((item) => (
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
