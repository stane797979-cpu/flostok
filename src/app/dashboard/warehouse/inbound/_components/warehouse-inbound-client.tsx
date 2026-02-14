"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, Package } from "lucide-react";
import { getWarehouseInboundOrders } from "@/server/actions/inbound";
import { InboundConfirmDialog } from "./inbound-confirm-dialog";
import { useToast } from "@/hooks/use-toast";

interface WarehouseOrder {
  id: string;
  orderNumber: string;
  supplierName: string | null;
  destinationWarehouseName: string | null;
  status: string;
  expectedDate: string | null;
  orderDate: string | null;
  itemsCount: number;
  totalQuantity: number;
  receivedQuantity: number;
}

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  ordered: { label: "발주완료", className: "bg-orange-600" },
  confirmed: { label: "공급자확인", className: "bg-blue-600" },
  shipped: { label: "출하됨", className: "bg-indigo-600" },
  partially_received: { label: "부분입고", className: "bg-purple-600" },
};

interface Warehouse {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

interface WarehouseInboundClientProps {
  initialOrders?: WarehouseOrder[];
  warehouses: Warehouse[];
}

export function WarehouseInboundClient({ initialOrders, warehouses }: WarehouseInboundClientProps) {
  const [orders, setOrders] = useState<WarehouseOrder[]>(initialOrders ?? []);
  const [isLoading, setIsLoading] = useState(!initialOrders || initialOrders.length === 0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getWarehouseInboundOrders();
      setOrders(result.orders);
    } catch (error) {
      console.error("입고예정 목록 조회 오류:", error);
      toast({
        title: "조회 실패",
        description: "입고예정 목록을 불러오지 못했습니다",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setIsLoading(false);
      return;
    }
    loadOrders();
  }, [loadOrders, initialOrders]);

  const handleInboundClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedOrderId(null);
  };

  const handleInboundSuccess = () => {
    loadOrders();
    handleDialogClose();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">입고예정</h1>
        <p className="mt-2 text-slate-500">입고 대기중인 발주서 목록입니다</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>입고 대기 목록</CardTitle>
              <CardDescription>
                발주완료, 공급자확인, 출하됨, 부분입고 상태의 발주서
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadOrders}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              로딩 중...
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Package className="mb-4 h-12 w-12" />
              <p className="text-lg font-medium">입고 대기중인 발주서가 없습니다</p>
            </div>
          ) : (
            <>
              <div className="mb-3 text-sm text-slate-500">
                총 {orders.length}건
              </div>

              {/* 모바일 카드 뷰 */}
              <div className="space-y-3 md:hidden">
                {orders.map((order) => {
                  const progress = order.totalQuantity > 0
                    ? Math.round((order.receivedQuantity / order.totalQuantity) * 100)
                    : 0;
                  const config = statusConfig[order.status] || {
                    label: order.status,
                    className: "bg-slate-600",
                  };
                  return (
                    <div key={order.id} className="rounded-lg border bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-sm text-slate-500">{order.supplierName || "-"}</p>
                        </div>
                        <Badge className={config.className}>{config.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="space-y-1">
                          {order.destinationWarehouseName && (
                            <p className="text-slate-600 font-medium">{order.destinationWarehouseName}</p>
                          )}
                          <p className="text-slate-500">예상입고: {order.expectedDate || "-"}</p>
                          <p className="text-slate-500">
                            {order.itemsCount}품목 · {order.receivedQuantity}/{order.totalQuantity} ({progress}%)
                          </p>
                        </div>
                        <Button size="sm" onClick={() => handleInboundClick(order.id)}>
                          입고 처리
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 데스크톱 테이블 뷰 */}
              <div className="hidden rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>발주번호</TableHead>
                      <TableHead>공급업체</TableHead>
                      <TableHead>입고 창고</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>예상입고일</TableHead>
                      <TableHead className="text-center">품목수</TableHead>
                      <TableHead className="text-center">진행률</TableHead>
                      <TableHead className="text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const progress = order.totalQuantity > 0
                        ? Math.round((order.receivedQuantity / order.totalQuantity) * 100)
                        : 0;
                      const config = statusConfig[order.status] || {
                        label: order.status,
                        className: "bg-slate-600",
                      };

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.orderNumber}
                            <div className="text-xs text-slate-500">
                              발주일: {order.orderDate || "-"}
                            </div>
                          </TableCell>
                          <TableCell>{order.supplierName || "-"}</TableCell>
                          <TableCell>{order.destinationWarehouseName || "-"}</TableCell>
                          <TableCell>
                            <Badge className={config.className}>
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {order.expectedDate || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {order.itemsCount}개
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {order.receivedQuantity} / {order.totalQuantity}
                              </div>
                              <div className="text-xs text-slate-500">
                                ({progress}%)
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleInboundClick(order.id)}
                            >
                              입고 처리
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selectedOrderId && (
        <InboundConfirmDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          orderId={selectedOrderId}
          warehouses={warehouses}
          onSuccess={handleInboundSuccess}
        />
      )}
    </div>
  );
}
