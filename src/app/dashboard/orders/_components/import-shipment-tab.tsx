"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Ship, Loader2 } from "lucide-react";
import { getImportShipments, type ImportShipmentItem } from "@/server/actions/import-shipments";
import { cn } from "@/lib/utils";

function ShipmentStatusBadge({ item }: { item: ImportShipmentItem }) {
  if (item.warehouseActualDate) {
    return (
      <Badge className="bg-green-500 hover:bg-green-600 text-xs">
        입고완료
      </Badge>
    );
  }
  if (item.ataDate) {
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">
        입항완료
      </Badge>
    );
  }
  if (item.etaDate) {
    const eta = new Date(item.etaDate);
    const now = new Date();
    const daysUntil = Math.ceil((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          입항지연
        </Badge>
      );
    }
    if (daysUntil <= 3) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
          입항임박
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        운송중
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      대기
    </Badge>
  );
}

export function ImportShipmentTab() {
  const [items, setItems] = useState<ImportShipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getImportShipments({ limit: 100 });
      setItems(result.items);
    } catch (error) {
      console.error("입항스케줄 조회 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 요약 통계
  const totalCount = items.length;
  const inTransit = items.filter((i) => !i.ataDate && i.etaDate).length;
  const arrivedNotStored = items.filter((i) => i.ataDate && !i.warehouseActualDate).length;
  const completed = items.filter((i) => i.warehouseActualDate).length;
  const totalAmount = items.reduce((sum, i) => {
    return sum + (i.invoiceAmountUsd ? parseFloat(i.invoiceAmountUsd) : 0);
  }, 0);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        입항스케줄을 불러오는 중...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Ship className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">입항스케줄 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            수입 발주의 입항스케줄을 등록하면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">운송중</CardTitle>
            <Ship className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inTransit}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">입항/창고대기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{arrivedNotStored}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>입항스케줄 상세</CardTitle>
          <CardDescription>B/L, 컨테이너, 수량, 금액 및 일정 현황</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상태</TableHead>
                  <TableHead>제품</TableHead>
                  <TableHead>발주번호</TableHead>
                  <TableHead>B/L#</TableHead>
                  <TableHead>CNTR#</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">금액(USD)</TableHead>
                  <TableHead className="text-center">입항예정</TableHead>
                  <TableHead className="text-center">입항실제</TableHead>
                  <TableHead className="text-center">창고입고예정</TableHead>
                  <TableHead className="text-center">창고입고실제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <ShipmentStatusBadge item={item} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[120px]">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.productSku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{item.orderNumber || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{item.blNumber || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{item.containerNumber || "-"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {item.quantity.toLocaleString()}
                      {item.cartonQty && (
                        <span className="text-muted-foreground ml-1">({item.cartonQty}ctn)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {item.invoiceAmountUsd
                        ? `$${parseFloat(item.invoiceAmountUsd).toLocaleString("en-US", { minimumFractionDigits: 0 })}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center text-xs">{item.etaDate || "-"}</TableCell>
                    <TableCell className="text-center text-xs">
                      {item.ataDate || "-"}
                    </TableCell>
                    <TableCell className="text-center text-xs">{item.warehouseEtaDate || "-"}</TableCell>
                    <TableCell className="text-center text-xs">
                      {item.warehouseActualDate || "-"}
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
