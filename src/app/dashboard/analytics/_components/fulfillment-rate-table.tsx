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
import { Target, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import type { FulfillmentRateSummary } from "@/server/actions/fulfillment-rate";

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
      <Badge variant="outline" className="border-yellow-500 text-yellow-700">
        {rate}%
      </Badge>
    );
  }
  return <Badge variant="destructive">{rate}%</Badge>;
}

export function FulfillmentRateTable({ data }: FulfillmentRateTableProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (selectedPeriod === "all") return data.items;
    return data.items.filter((i) => i.period === selectedPeriod);
  }, [data, selectedPeriod]);

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>제품명</TableHead>
                <TableHead className="text-center">기간</TableHead>
                <TableHead className="text-right">예측수량</TableHead>
                <TableHead className="text-right">실출고량</TableHead>
                <TableHead className="text-right">차이</TableHead>
                <TableHead className="text-center">출고율</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item, idx) => (
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
              <Badge variant="outline" className="border-yellow-500 text-yellow-700">
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
