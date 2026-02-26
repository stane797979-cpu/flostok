"use client";

import { useMemo, useState } from "react";
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
import { Target, TrendingUp, TrendingDown, BarChart3, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { FulfillmentRateSummary } from "@/server/actions/fulfillment-rate";

type SortField = "sku" | "name" | "period" | "forecastQty" | "actualQty" | "diff" | "fulfillmentRate";
type SortDirection = "asc" | "desc" | null;

interface FulfillmentRateTableProps {
  data: FulfillmentRateSummary | null;
}

function RateBadge({ rate }: { rate: number }) {
  if (rate >= 95 && rate <= 105) {
    return <Badge className="bg-green-500 hover:bg-green-600">{rate}%</Badge>;
  }
  if (rate >= 90 && rate <= 110) {
    return (
      <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 text-white">
        {rate}%
      </Badge>
    );
  }
  if (rate > 110) {
    return (
      <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400">
        {rate}%
      </Badge>
    );
  }
  return <Badge variant="destructive">{rate}%</Badge>;
}

function SortIcon({ field, currentField, direction }: { field: SortField; currentField: SortField | null; direction: SortDirection }) {
  if (currentField !== field) {
    return <ArrowUpDown className="ml-1 h-3.5 w-3.5" />;
  }
  if (direction === "asc") {
    return <ArrowUp className="ml-1 h-3.5 w-3.5" />;
  }
  if (direction === "desc") {
    return <ArrowDown className="ml-1 h-3.5 w-3.5" />;
  }
  return <ArrowUpDown className="ml-1 h-3.5 w-3.5" />;
}

export function FulfillmentRateTable({ data }: FulfillmentRateTableProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>("sku");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (selectedPeriod === "all") return data.items;
    return data.items.filter((i) => i.period === selectedPeriod);
  }, [data, selectedPeriod]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 3-state toggle: asc → desc → null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortField || !sortDirection) return filteredItems;

    return [...filteredItems].sort((a, b) => {
      let compareA: string | number;
      let compareB: string | number;

      if (sortField === "sku") {
        compareA = a.sku;
        compareB = b.sku;
      } else if (sortField === "name") {
        compareA = a.name;
        compareB = b.name;
      } else if (sortField === "period") {
        compareA = a.period;
        compareB = b.period;
      } else if (sortField === "forecastQty") {
        compareA = a.forecastQty;
        compareB = b.forecastQty;
      } else if (sortField === "actualQty") {
        compareA = a.actualQty;
        compareB = b.actualQty;
      } else if (sortField === "diff") {
        compareA = a.actualQty - a.forecastQty;
        compareB = b.actualQty - b.forecastQty;
      } else if (sortField === "fulfillmentRate") {
        compareA = a.fulfillmentRate;
        compareB = b.fulfillmentRate;
      } else {
        return 0;
      }

      // 한국어 문자열 비교
      if (typeof compareA === "string" && typeof compareB === "string") {
        const result = compareA.localeCompare(compareB, "ko");
        return sortDirection === "asc" ? result : -result;
      }

      // 숫자 비교
      if (compareA < compareB) return sortDirection === "asc" ? -1 : 1;
      if (compareA > compareB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  if (!data || data.items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">실출고율 데이터 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            수요예측 및 판매 데이터가 축적되면 실출고율 분석이 가능합니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 기준 기간 */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs px-2.5 py-1">
          기준: {data.periodLabel}
        </Badge>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 실출고율</CardTitle>
            <Target className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.avgFulfillmentRate}%</div>
            <p className="text-muted-foreground mt-1 text-xs">목표: 95~105%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예측 초과</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overForecastCount}건</div>
            <p className="text-muted-foreground mt-1 text-xs">출고율 110% 초과</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예측 미달</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.underForecastCount}건</div>
            <p className="text-muted-foreground mt-1 text-xs">출고율 90% 미만</p>
          </CardContent>
        </Card>
      </div>

      {/* 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SKU별 실출고율</CardTitle>
              <CardDescription>Forecast 대비 실제 출고량 비교</CardDescription>
            </div>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="기간 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                {data.periods.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p.substring(0, 7)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort("sku")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    SKU
                    <SortIcon field="sku" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center hover:text-foreground transition-colors"
                  >
                    제품명
                    <SortIcon field="name" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort("period")}
                    className="flex items-center mx-auto hover:text-foreground transition-colors"
                  >
                    기간
                    <SortIcon field="period" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("forecastQty")}
                    className="flex items-center ml-auto hover:text-foreground transition-colors"
                  >
                    예측수량
                    <SortIcon field="forecastQty" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("actualQty")}
                    className="flex items-center ml-auto hover:text-foreground transition-colors"
                  >
                    실출고량
                    <SortIcon field="actualQty" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("diff")}
                    className="flex items-center ml-auto hover:text-foreground transition-colors"
                  >
                    차이
                    <SortIcon field="diff" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort("fulfillmentRate")}
                    className="flex items-center mx-auto hover:text-foreground transition-colors"
                  >
                    출고율
                    <SortIcon field="fulfillmentRate" currentField={sortField} direction={sortDirection} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item, idx) => (
                <TableRow key={`${item.productId}-${item.period}-${idx}`}>
                  <TableCell className="font-medium text-xs">{item.sku}</TableCell>
                  <TableCell className="max-w-[120px] truncate">{item.name}</TableCell>
                  <TableCell className="text-center text-xs">{item.period.substring(0, 7)}</TableCell>
                  <TableCell className="text-right">
                    {item.forecastQty.toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.actualQty.toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        item.actualQty - item.forecastQty >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {item.actualQty - item.forecastQty >= 0 ? "+" : ""}
                      {(item.actualQty - item.forecastQty).toLocaleString("ko-KR")}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <RateBadge rate={item.fulfillmentRate} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* 기준 설명 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">실출고율 기준</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500">95-105%</Badge>
              <span className="text-sm">정확</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500 text-white">90-110%</Badge>
              <span className="text-sm">양호</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:border-yellow-600 dark:text-yellow-400">
                110%+
              </Badge>
              <span className="text-sm">예측 초과</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive">90% 미만</Badge>
              <span className="text-sm">예측 미달</span>
            </div>
          </div>
          <p className="text-muted-foreground mt-4 text-xs">
            실출고율 = (실제출고량 / 예측수량) × 100
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
