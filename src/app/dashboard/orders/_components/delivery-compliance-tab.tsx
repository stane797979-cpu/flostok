"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, CheckCircle, XCircle, AlertTriangle, Truck, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliveryComplianceResult } from "@/server/services/scm/delivery-compliance";
import { getDeliveryComplianceData, getDeliveryFilterOptions } from "@/server/actions/delivery-compliance";

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

export function DeliveryComplianceTab({ data: initialData }: DeliveryComplianceTabProps) {
  // 필터 옵션
  const [filterOptions, setFilterOptions] = useState<{
    suppliers: Array<{ id: string; name: string }>;
    orderCount: number;
    dateRange: { min: string | null; max: string | null };
  } | null>(null);

  // 필터 상태
  const [supplierId, setSupplierId] = useState<string>("all");
  const [orderNumber, setOrderNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 데이터 상태
  const [data, setData] = useState<DeliveryComplianceResult | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialData?.items.length);

  // 필터 옵션 로드 (탭 진입 시 가볍게 로드)
  useEffect(() => {
    getDeliveryFilterOptions()
      .then(setFilterOptions)
      .catch(console.error);
  }, []);

  // 조회 실행
  const handleSearch = useCallback(async () => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const filters: {
        supplierId?: string;
        orderNumber?: string;
        startDate?: string;
        endDate?: string;
      } = {};
      if (supplierId !== "all") filters.supplierId = supplierId;
      if (orderNumber.trim()) filters.orderNumber = orderNumber.trim();
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;

      const result = await getDeliveryComplianceData(filters);
      setData(result);
    } catch (error) {
      console.error("납기 분석 조회 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId, orderNumber, startDate, endDate]);

  // Enter 키 지원
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  const totalOrders = filterOptions?.orderCount || 0;

  return (
    <div className="space-y-6">
      {/* 검색 필터 카드 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">납기 분석 조회</CardTitle>
          <CardDescription>
            조건을 선택하고 조회 버튼을 클릭하세요 (전체 발주 {totalOrders}건)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* 공급자 선택 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">공급자</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {filterOptions?.suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 발주번호 검색 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">발주번호</Label>
              <Input
                placeholder="PO-20260309-..."
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* 시작일 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">시작일</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* 종료일 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">종료일</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* 조회 버튼 */}
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                조회
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 조회 전 안내 */}
      {!hasSearched && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">조건을 선택하고 조회하세요</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
              공급자, 발주번호, 기간 등 원하는 조건으로 납기 분석을 조회할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 로딩 */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">분석 중...</span>
          </CardContent>
        </Card>
      )}

      {/* 조회 결과 */}
      {hasSearched && !isLoading && data && (
        <>
          {data.items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Truck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">조건에 맞는 데이터 없음</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
                  필터 조건을 변경하거나, 전체를 조회해 보세요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 요약 카드 */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">조회 발주</CardTitle>
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
                  <CardTitle>발주별 납기 상세</CardTitle>
                  <CardDescription>
                    조회 결과 ({data.items.length}건)
                  </CardDescription>
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
                        {data.items.map((item) => (
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
            </>
          )}
        </>
      )}
    </div>
  );
}
