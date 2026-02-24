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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliveryComplianceResult } from "@/server/services/scm/delivery-compliance";

interface DeliveryComplianceTabProps {
  data: DeliveryComplianceResult | null;
}

function OnTimeBadge({ isOnTime, delayDays }: { isOnTime: boolean | null; delayDays: number | null }) {
  if (isOnTime === null) {
    return (
      <Badge variant="outline" className="text-xs">
        <Clock className="mr-1 h-3 w-3" />
        진행중
      </Badge>
    );
  }
  if (isOnTime) {
    return (
      <Badge className="bg-green-500 hover:bg-green-600 text-xs">
        <CheckCircle className="mr-1 h-3 w-3" />
        정시
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-xs">
      <XCircle className="mr-1 h-3 w-3" />
      {delayDays !== null ? `+${delayDays}일` : "지연"}
    </Badge>
  );
}

export function DeliveryComplianceTab({ data }: DeliveryComplianceTabProps) {
  const [supplierFilter, setSupplierFilter] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (supplierFilter === "all") return data.items;
    return data.items.filter((item) => item.supplierId === supplierFilter);
  }, [data, supplierFilter]);

  if (!data || data.items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">납기 분석 데이터 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            발주서가 생성되면 납기준수 분석이 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  const uniqueSuppliers = data.supplierSummaries.filter((s) => s.supplierId !== "unknown");

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 발주</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall.totalOrders}건</div>
            <p className="text-xs text-muted-foreground">
              입고완료 {data.overall.completedOrders}건
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">납기준수율</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                data.overall.onTimeRate >= 90
                  ? "text-green-600"
                  : data.overall.onTimeRate >= 70
                    ? "text-yellow-600"
                    : "text-red-600"
              )}
            >
              {data.overall.onTimeRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">목표 90%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 리드타임</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overall.avgLeadTime.toFixed(1)}일</div>
            <p className="text-xs text-muted-foreground">실제 리드타임 평균</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 지연일수</CardTitle>
            <AlertTriangle
              className={cn(
                "h-4 w-4",
                data.overall.avgDelayDays > 0 ? "text-red-500" : "text-green-500"
              )}
            />
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                "text-2xl font-bold",
                data.overall.avgDelayDays > 0 ? "text-red-600" : "text-green-600"
              )}
            >
              {data.overall.avgDelayDays > 0 ? "+" : ""}
              {data.overall.avgDelayDays.toFixed(1)}일
            </div>
            <p className="text-xs text-muted-foreground">
              {data.overall.avgDelayDays > 0 ? "평균 지연" : "평균 조기입고"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 공급자별 납기준수율 */}
      {data.supplierSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>공급자별 납기준수율</CardTitle>
            <CardDescription>공급자별 리드타임 비교 및 납기 준수 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>공급자</TableHead>
                  <TableHead className="text-center">전체</TableHead>
                  <TableHead className="text-center">입고완료</TableHead>
                  <TableHead className="text-center">정시</TableHead>
                  <TableHead className="text-center">지연</TableHead>
                  <TableHead className="text-center">준수율</TableHead>
                  <TableHead className="text-center">기준LT</TableHead>
                  <TableHead className="text-center">실제LT</TableHead>
                  <TableHead className="text-center">최대지연</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.supplierSummaries.map((s) => (
                  <TableRow key={s.supplierId}>
                    <TableCell className="font-medium">{s.supplierName}</TableCell>
                    <TableCell className="text-center">{s.totalOrders}</TableCell>
                    <TableCell className="text-center">{s.completedOrders}</TableCell>
                    <TableCell className="text-center text-green-600">{s.onTimeOrders}</TableCell>
                    <TableCell className="text-center text-red-600">{s.lateOrders}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "font-bold",
                          s.onTimeRate >= 90
                            ? "text-green-600"
                            : s.onTimeRate >= 70
                              ? "text-yellow-600"
                              : "text-red-600"
                        )}
                      >
                        {s.onTimeRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{s.avgStandardLeadTime.toFixed(0)}일</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          s.avgActualLeadTime > s.avgStandardLeadTime ? "text-red-600" : "text-green-600"
                        )}
                      >
                        {s.avgActualLeadTime.toFixed(1)}일
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {s.maxDelayDays > 0 ? (
                        <span className="text-red-600">+{s.maxDelayDays}일</span>
                      ) : (
                        <span className="text-green-600">없음</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 발주별 상세 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>발주별 납기 상세</CardTitle>
              <CardDescription>
                발주별 리드타임 비교 ({filteredItems.length}건)
              </CardDescription>
            </div>
            {uniqueSuppliers.length > 1 && (
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="공급자 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {uniqueSuppliers.map((s) => (
                    <SelectItem key={s.supplierId} value={s.supplierId}>
                      {s.supplierName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>발주번호</TableHead>
                <TableHead>공급자</TableHead>
                <TableHead>제품</TableHead>
                <TableHead className="text-center">발주일</TableHead>
                <TableHead className="text-center">예상입고</TableHead>
                <TableHead className="text-center">실제입고</TableHead>
                <TableHead className="text-center">기준LT</TableHead>
                <TableHead className="text-center">실제LT</TableHead>
                <TableHead className="text-center">납기</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.orderId}>
                  <TableCell className="font-medium text-xs">{item.orderNumber}</TableCell>
                  <TableCell className="text-xs">{item.supplierName}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">
                    {item.productNames.join(", ") || "-"}
                  </TableCell>
                  <TableCell className="text-center text-xs">{item.orderDate}</TableCell>
                  <TableCell className="text-center text-xs">{item.expectedDate || "-"}</TableCell>
                  <TableCell className="text-center text-xs">{item.actualDate || "-"}</TableCell>
                  <TableCell className="text-center text-xs">{item.standardLeadTime}일</TableCell>
                  <TableCell className="text-center text-xs">
                    {item.actualLeadTime !== null ? (
                      <span
                        className={cn(
                          item.actualLeadTime > item.standardLeadTime ? "text-red-600 font-medium" : ""
                        )}
                      >
                        {item.actualLeadTime}일
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <OnTimeBadge isOnTime={item.isOnTime} delayDays={item.delayDays} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
