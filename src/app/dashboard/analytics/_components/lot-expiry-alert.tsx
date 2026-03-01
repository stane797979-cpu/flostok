"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CalendarX, Package, PackageX, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LotExpirySummary, ExpiringLot } from "@/server/actions/lot-expiry";

// ─── 정렬 ────────────────────────────────────────────────────────────────────

type LotSortKey = "lotNumber" | "sku" | "productName" | "warehouseName" | "expiryDate" | "daysUntilExpiry" | "remainingQty" | "estimatedLoss";
type SortDir = "asc" | "desc";

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억원`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만원`;
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDaysUntilExpiry(days: number): React.ReactNode {
  if (days < 0) {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">
        D+{Math.abs(days)}일 경과
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">오늘 만료</span>
    );
  }
  return (
    <span
      className={cn(
        "font-semibold",
        days <= 7
          ? "text-orange-600 dark:text-orange-400"
          : days <= 30
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-foreground"
      )}
    >
      D-{days}일
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: ExpiringLot["urgency"] }) {
  switch (urgency) {
    case "expired":
      return (
        <Badge variant="destructive" className="whitespace-nowrap text-xs">
          만료됨
        </Badge>
      );
    case "critical":
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-orange-500 text-xs text-orange-700 dark:border-orange-500 dark:text-orange-400"
        >
          긴급
        </Badge>
      );
    case "warning":
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-yellow-500 text-xs text-yellow-700 dark:border-yellow-500 dark:text-yellow-400"
        >
          주의
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="whitespace-nowrap text-xs">
          안전
        </Badge>
      );
  }
}

// ─── 정렬 아이콘 ──────────────────────────────────────────────────────────────

function SortIcon({
  column,
  sortKey,
  sortDir,
}: {
  column: LotSortKey;
  sortKey: LotSortKey | null;
  sortDir: SortDir;
}) {
  if (sortKey !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3" />
    : <ArrowDown className="ml-1 inline h-3 w-3" />;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface LotExpiryAlertProps {
  data: LotExpirySummary | null;
  className?: string;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function LotExpiryAlert({ data, className }: LotExpiryAlertProps) {
  const [sortKey, setSortKey] = useState<LotSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback((key: LotSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const sortedLots = useMemo<ExpiringLot[]>(() => {
    if (!data) return [];
    const items = [...data.expiringLots];
    if (sortKey) {
      items.sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "lotNumber": cmp = a.lotNumber.localeCompare(b.lotNumber); break;
          case "sku": cmp = a.sku.localeCompare(b.sku); break;
          case "productName": cmp = a.productName.localeCompare(b.productName); break;
          case "warehouseName": cmp = a.warehouseName.localeCompare(b.warehouseName); break;
          case "expiryDate": cmp = a.expiryDate.localeCompare(b.expiryDate); break;
          case "daysUntilExpiry": cmp = a.daysUntilExpiry - b.daysUntilExpiry; break;
          case "remainingQty": cmp = a.remainingQty - b.remainingQty; break;
          case "estimatedLoss": cmp = a.estimatedLoss - b.estimatedLoss; break;
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return items;
  }, [data, sortKey, sortDir]);

  // 유통기한 설정 로트 없음
  if (!data || data.categories.length === 0) {
    return (
      <Card className={cn("border-dashed", className)}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">
            유통기한이 설정된 로트가 없습니다
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            입고 시 유통기한(Lot 만료일)을 입력하면 만료 임박 경고 및 예상 손실액을 확인할 수
            있습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const expiredCat = data.categories.find((c) => c.label === "만료됨");
  const criticalCat = data.categories.find((c) => c.label === "7일 이내");
  const warningCat = data.categories.find((c) => c.label === "30일 이내");

  const expiredCount = expiredCat?.count ?? 0;
  const criticalCount = criticalCat?.count ?? 0;
  const warningCount = warningCat?.count ?? 0;
  const atRiskCount = expiredCount + criticalCount + warningCount;

  return (
    <div className={cn("space-y-6", className)}>
      {/* 기준일 */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="px-2.5 py-1 text-xs">
          {data.periodLabel}
        </Badge>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* 만료된 로트 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">만료된 로트</CardTitle>
            <PackageX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                expiredCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
              )}
            >
              {expiredCount}건
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              즉시 폐기 또는 반품 검토 필요
            </p>
          </CardContent>
        </Card>

        {/* 30일 내 만료 예정 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">30일 내 만료 예정</CardTitle>
            <CalendarX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                criticalCount > 0
                  ? "text-orange-600 dark:text-orange-400"
                  : warningCount > 0
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-foreground"
              )}
            >
              {atRiskCount - expiredCount}건
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              긴급 {criticalCount}건 (7일 이내) + 주의 {warningCount}건 (30일 이내)
            </p>
          </CardContent>
        </Card>

        {/* 예상 폐기 손실액 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예상 폐기 손실액</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                data.totalAtRiskValue > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"
              )}
            >
              {formatCurrency(data.totalAtRiskValue)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              만료됨 + 30일 이내 로트 기준 (원가)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 만료 임박 로트 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <CardTitle>만료 임박 로트 목록</CardTitle>
          </div>
          <CardDescription>
            만료됨 및 30일 이내 만료 예정 로트 ({data.expiringLots.length}건) — 만료일 오름차순
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedLots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              만료됨 또는 30일 이내 만료 예정 로트가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("lotNumber")}>로트번호<SortIcon column="lotNumber" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="min-w-[90px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("sku")}>SKU<SortIcon column="sku" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="min-w-[160px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("productName")}>제품명<SortIcon column="productName" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="min-w-[120px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("warehouseName")}>창고<SortIcon column="warehouseName" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="min-w-[110px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("expiryDate")}>만료일<SortIcon column="expiryDate" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="text-right min-w-[110px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("daysUntilExpiry")}>잔여일수<SortIcon column="daysUntilExpiry" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="text-right min-w-[90px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("remainingQty")}>잔여수량<SortIcon column="remainingQty" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="text-right min-w-[110px] cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("estimatedLoss")}>손실예상액<SortIcon column="estimatedLoss" sortKey={sortKey} sortDir={sortDir} /></TableHead>
                    <TableHead className="min-w-[80px]">긴급도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLots.map((lot) => (
                    <TableRow
                      key={`${lot.lotNumber}-${lot.productId}`}
                      className={cn(
                        lot.urgency === "expired" &&
                          "bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30",
                        lot.urgency === "critical" &&
                          "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/20 dark:hover:bg-orange-950/30"
                      )}
                    >
                      <TableCell className="font-mono text-sm">{lot.lotNumber}</TableCell>
                      <TableCell className="font-medium">{lot.sku}</TableCell>
                      <TableCell>
                        <span className="truncate block max-w-[200px]">{lot.productName}</span>
                      </TableCell>
                      <TableCell>
                        <span className="truncate block max-w-[140px]">{lot.warehouseName}</span>
                      </TableCell>
                      <TableCell>{lot.expiryDate}</TableCell>
                      <TableCell className="text-right">
                        {formatDaysUntilExpiry(lot.daysUntilExpiry)}
                      </TableCell>
                      <TableCell className="text-right">
                        {lot.remainingQty.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {lot.estimatedLoss > 0 ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(lot.estimatedLoss)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <UrgencyBadge urgency={lot.urgency} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 카테고리별 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">카테고리별 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.categories.map((cat) => {
              const colorClass =
                cat.label === "만료됨"
                  ? "bg-red-500"
                  : cat.label === "7일 이내"
                    ? "bg-orange-500"
                    : cat.label === "30일 이내"
                      ? "bg-yellow-500"
                      : "bg-green-500";
              return (
                <div key={cat.label} className="flex items-start gap-2">
                  <span
                    className={cn("mt-1 inline-block h-3 w-3 flex-shrink-0 rounded-sm", colorClass)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {cat.count}건 · {cat.totalQty.toLocaleString("ko-KR")} 단위
                    </div>
                    {cat.estimatedLoss > 0 && (
                      <div className="text-xs text-muted-foreground">
                        손실 {formatCurrency(cat.estimatedLoss)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            손실예상액은 잔여수량 × 원가(원가 미설정 시 판매단가) 기준입니다.
            유통기한 미설정 로트는 이 분석에서 제외됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
