"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Calendar, Building2, FileText, Download, ChevronRight, XCircle, Ship, Plus, Pencil, Check, X, History, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPurchaseOrderById, updatePurchaseOrderStatus, updatePurchaseOrderExpectedDate } from "@/server/actions/purchase-orders";
import { createImportShipment } from "@/server/actions/import-shipments";
import { getInboundRecords } from "@/server/actions/inbound";
import { getEntityActivityLogs } from "@/server/actions/activity-logs";
import type { ActivityLog } from "@/server/actions/activity-logs";
import { InboundDialog, type InboundDialogItem } from "./inbound-dialog";
import { useToast } from "@/hooks/use-toast";
import { exportPurchaseOrderToExcel } from "@/server/actions/excel-export";

// 상태별 다음 단계 정의 (단순화: 발주확정 → 입고 → 완료)
const nextStatusActions: Record<string, { label: string; status: string; variant?: "default" | "outline" }[]> = {
  draft: [
    { label: "발주 확정", status: "ordered" },
    { label: "취소", status: "cancelled", variant: "outline" },
  ],
  ordered: [
    { label: "취소", status: "cancelled", variant: "outline" },
  ],
  confirmed: [],
  shipped: [],
  partially_received: [],
  received: [
    { label: "완료 처리", status: "completed" },
  ],
};

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  onStatusChange?: () => void;
}

export function OrderDetailDialog({ open, onOpenChange, orderId, onStatusChange }: OrderDetailDialogProps) {
  const [orderData, setOrderData] = useState<Awaited<ReturnType<typeof getPurchaseOrderById>>>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [inboundDialogOpen, setInboundDialogOpen] = useState(false);
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    blNumber: "",
    containerNumber: "",
    invoiceNumber: "",
    quantity: "",
    unitPriceUsd: "",
    etaDate: "",
    warehouseEtaDate: "",
    notes: "",
  });
  const [isEditingExpectedDate, setIsEditingExpectedDate] = useState(false);
  const [editExpectedDate, setEditExpectedDate] = useState("");
  const [isSavingExpectedDate, setIsSavingExpectedDate] = useState(false);
  // 입고 기록 + 변경 이력
  const [inboundRecordsList, setInboundRecordsList] = useState<Array<{
    id: string;
    date: string;
    productName: string;
    productSku: string;
    receivedQuantity: number;
    qualityResult: string | null;
  }>>([]);
  const [activityLogsList, setActivityLogsList] = useState<ActivityLog[]>([]);
  const { toast } = useToast();

  // 발주서 데이터 로드
  useEffect(() => {
    if (open && orderId) {
      loadOrderData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderId]);

  const loadOrderData = async () => {
    setIsLoading(true);
    try {
      const [data, inboundResult, logs] = await Promise.all([
        getPurchaseOrderById(orderId),
        getInboundRecords({ orderId, limit: 100 }),
        getEntityActivityLogs(orderId, 30),
      ]);
      setOrderData(data);
      setInboundRecordsList(
        inboundResult.records.map((r) => ({
          id: r.id,
          date: r.date,
          productName: r.productName,
          productSku: r.productSku,
          receivedQuantity: r.receivedQuantity,
          qualityResult: r.qualityResult,
        }))
      );
      setActivityLogsList(logs);
    } catch (error) {
      console.error("발주서 조회 오류:", error);
      toast({
        title: "오류",
        description: "발주서를 불러오는데 실패했습니다",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const result = await updatePurchaseOrderStatus(orderId, newStatus);
      if (result.success) {
        const statusLabels: Record<string, string> = {
          ordered: "발주 확정", confirmed: "공급자 확인",
          shipped: "출하 처리", received: "입고 완료",
          completed: "완료", cancelled: "취소",
        };
        toast({
          title: "상태 변경 완료",
          description: `${statusLabels[newStatus] || newStatus}(으)로 변경되었습니다`,
        });
        loadOrderData();
        onStatusChange?.();
      } else {
        toast({
          title: "상태 변경 실패",
          description: result.error || "상태를 변경할 수 없습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("상태 변경 오류:", error);
      toast({
        title: "오류",
        description: "상태 변경 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!orderData || !orderData.items.length) return;

    const qty = parseInt(shipmentForm.quantity) || 0;
    if (qty <= 0) {
      toast({ title: "수량 오류", description: "수량을 입력해주세요", variant: "destructive" });
      return;
    }

    setIsCreatingShipment(true);
    try {
      // 첫 번째 항목의 productId 사용 (복수 품목인 경우 가장 첫 품목 기준)
      const result = await createImportShipment({
        productId: orderData.items[0].productId,
        purchaseOrderId: orderId,
        blNumber: shipmentForm.blNumber || undefined,
        containerNumber: shipmentForm.containerNumber || undefined,
        invoiceNumber: shipmentForm.invoiceNumber || undefined,
        quantity: qty,
        unitPriceUsd: shipmentForm.unitPriceUsd ? parseFloat(shipmentForm.unitPriceUsd) : undefined,
        etaDate: shipmentForm.etaDate || undefined,
        warehouseEtaDate: shipmentForm.warehouseEtaDate || undefined,
        notes: shipmentForm.notes || undefined,
      });

      if (result.success) {
        toast({ title: "등록 완료", description: result.message });
        setShowShipmentForm(false);
        setShipmentForm({ blNumber: "", containerNumber: "", invoiceNumber: "", quantity: "", unitPriceUsd: "", etaDate: "", warehouseEtaDate: "", notes: "" });
      } else {
        toast({ title: "등록 실패", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "입항스케줄 등록 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsCreatingShipment(false);
    }
  };

  const handleEditExpectedDate = () => {
    const displayDate = orderData?.shipmentEta || orderData?.expectedDate || "";
    setEditExpectedDate(displayDate);
    setIsEditingExpectedDate(true);
  };

  const handleSaveExpectedDate = async () => {
    if (!editExpectedDate) return;
    setIsSavingExpectedDate(true);
    try {
      const result = await updatePurchaseOrderExpectedDate(orderId, editExpectedDate);
      if (result.success) {
        toast({ title: "변경 완료", description: "예상입고일이 변경되었습니다" });
        setIsEditingExpectedDate(false);
        loadOrderData();
        onStatusChange?.();
      } else {
        toast({ title: "변경 실패", description: result.error || "변경에 실패했습니다", variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "예상입고일 변경 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsSavingExpectedDate(false);
    }
  };

  const handleInboundClick = () => {
    setInboundDialogOpen(true);
  };

  const handleInboundClose = (success?: boolean) => {
    setInboundDialogOpen(false);
    if (success) {
      loadOrderData();
      onStatusChange?.();
    }
  };

  const handleDownloadClick = async () => {
    try {
      const result = await exportPurchaseOrderToExcel(orderId);

      if (result.success && result.data) {
        // Base64 디코딩 후 Blob 생성
        const binaryString = atob(result.data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        // 다운로드 링크 생성 및 클릭
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "다운로드 완료",
          description: `${result.data.filename} 파일이 다운로드되었습니다`,
        });
      } else {
        toast({
          title: "다운로드 실패",
          description: result.error || "Excel 다운로드에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Excel 다운로드 오류:", error);
      toast({
        title: "다운로드 실패",
        description: "Excel 다운로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: "초안", className: "bg-slate-500" },
      pending: { label: "검토대기", className: "bg-yellow-600" },
      approved: { label: "승인됨", className: "bg-blue-600" },
      ordered: { label: "발주완료", className: "bg-indigo-600" },
      confirmed: { label: "공급자확인", className: "bg-purple-600" },
      shipped: { label: "출하됨", className: "bg-orange-600" },
      partially_received: { label: "부분입고", className: "bg-amber-600" },
      received: { label: "입고완료", className: "bg-green-600" },
      completed: { label: "완료", className: "bg-emerald-600" },
      cancelled: { label: "취소", className: "bg-red-600" },
    };

    const info = statusMap[status] || { label: status, className: "bg-slate-500" };
    return <Badge className={info.className}>{info.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    }).format(amount);
  };

  // 입고 가능 여부 확인
  const canReceive =
    orderData &&
    ["ordered", "confirmed", "shipped", "partially_received"].includes(orderData.status);

  // 입고 다이얼로그용 데이터 변환
  const inboundItems: InboundDialogItem[] =
    orderData?.items.map((item) => ({
      orderItemId: item.id,
      productId: item.productId,
      productSku: item.product.sku,
      productName: item.product.name,
      orderedQuantity: item.quantity,
      receivedQuantity: item.receivedQuantity || 0,
      unitPrice: item.unitPrice,
    })) || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>발주서 상세</DialogTitle>
            <DialogDescription>발주서 정보 및 항목 목록</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-slate-500">로딩 중...</div>
            </div>
          ) : !orderData ? (
            <div className="flex h-96 items-center justify-center">
              <div className="text-slate-500">발주서를 찾을 수 없습니다</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 발주서 헤더 */}
              <div className="rounded-lg border bg-slate-50 p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">{orderData.orderNumber}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {orderData.orderDate && formatDate(orderData.orderDate)}
                    </p>
                  </div>
                  {getStatusBadge(orderData.status)}
                </div>

                <Separator className="my-4" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-1 h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-500">공급자</p>
                      <p className="mt-1 font-semibold">
                        {orderData.supplier?.name || "미지정"}
                      </p>
                      {orderData.supplier?.contactPhone && (
                        <p className="mt-1 text-sm text-slate-600">
                          {orderData.supplier.contactPhone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="mt-1 h-5 w-5 text-slate-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-500">예상입고일</p>
                      {isEditingExpectedDate ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <Input
                            type="date"
                            value={editExpectedDate}
                            onChange={(e) => setEditExpectedDate(e.target.value)}
                            className="h-8 w-40 text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleSaveExpectedDate}
                            disabled={isSavingExpectedDate}
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setIsEditingExpectedDate(false)}
                          >
                            <X className="h-3.5 w-3.5 text-slate-400" />
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-1 flex items-center gap-1.5">
                          <p className="font-semibold">
                            {orderData.shipmentEta
                              ? formatDate(orderData.shipmentEta)
                              : orderData.expectedDate
                                ? formatDate(orderData.expectedDate)
                                : "미정"}
                          </p>
                          {orderData.shipmentEta && orderData.expectedDate && orderData.shipmentEta !== orderData.expectedDate && (
                            <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200">
                              입항스케줄
                            </Badge>
                          )}
                          {canReceive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={handleEditExpectedDate}
                            >
                              <Pencil className="h-3 w-3 text-slate-400" />
                            </Button>
                          )}
                        </div>
                      )}
                      {orderData.actualDate && (
                        <p className="mt-1 text-sm text-green-600">
                          실제: {formatDate(orderData.actualDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {orderData.notes && (
                  <>
                    <Separator className="my-4" />
                    <div className="flex items-start gap-3">
                      <FileText className="mt-1 h-5 w-5 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">메모</p>
                        <p className="mt-1 text-sm text-slate-700">{orderData.notes}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 발주 항목 */}
              <div>
                <h4 className="mb-3 font-semibold">발주 항목</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">SKU</TableHead>
                        <TableHead>제품명</TableHead>
                        <TableHead className="w-[80px] text-center">단위</TableHead>
                        <TableHead className="w-[100px] text-right">발주수량</TableHead>
                        <TableHead className="w-[100px] text-right">입고수량</TableHead>
                        <TableHead className="w-[120px] text-right">단가</TableHead>
                        <TableHead className="w-[140px] text-right">합계</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderData.items.map((item) => {
                        const receivedQty = item.receivedQuantity || 0;
                        const isFullyReceived = receivedQty >= item.quantity;
                        const isPartiallyReceived = receivedQty > 0 && receivedQty < item.quantity;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">
                              {item.product.sku}
                            </TableCell>
                            <TableCell className="font-medium">{item.product.name}</TableCell>
                            <TableCell className="text-center text-sm text-slate-600">
                              {item.product.unit || "-"}
                            </TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  isFullyReceived
                                    ? "text-green-600 font-semibold"
                                    : isPartiallyReceived
                                      ? "text-yellow-600 font-semibold"
                                      : "text-slate-600"
                                }
                              >
                                {receivedQty}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(item.totalPrice)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* 합계 */}
                <div className="mt-4 flex justify-end">
                  <div className="w-64 rounded-lg border bg-slate-50 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">품목 수</span>
                      <span className="font-medium">{orderData.items.length}개</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between text-lg font-bold">
                      <span>총 금액</span>
                      <span>{formatCurrency(orderData.totalAmount || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 입항스케줄 등록 */}
              {canReceive && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Ship className="h-4 w-4" />
                      입항스케줄
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowShipmentForm(!showShipmentForm)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {showShipmentForm ? "접기" : "등록"}
                    </Button>
                  </div>
                  {showShipmentForm && (
                    <div className="rounded-lg border p-4 space-y-3 bg-slate-50/50">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">B/L 번호</Label>
                          <Input
                            placeholder="KOSU1234567"
                            value={shipmentForm.blNumber}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, blNumber: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">컨테이너 번호</Label>
                          <Input
                            placeholder="CNTR-001"
                            value={shipmentForm.containerNumber}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, containerNumber: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Invoice 번호</Label>
                          <Input
                            placeholder="INV-2025-001"
                            value={shipmentForm.invoiceNumber}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">수량</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={shipmentForm.quantity}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, quantity: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">단가 (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={shipmentForm.unitPriceUsd}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, unitPriceUsd: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">메모</Label>
                          <Input
                            placeholder="비고"
                            value={shipmentForm.notes}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, notes: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">입항예정일 (ETA)</Label>
                          <Input
                            type="date"
                            value={shipmentForm.etaDate}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, etaDate: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">창고입고예정일</Label>
                          <Input
                            type="date"
                            value={shipmentForm.warehouseEtaDate}
                            onChange={(e) => setShipmentForm((f) => ({ ...f, warehouseEtaDate: e.target.value }))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleCreateShipment}
                          disabled={isCreatingShipment}
                        >
                          {isCreatingShipment ? "등록 중..." : "입항스케줄 등록"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 입고 기록 */}
              {inboundRecordsList.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    입고 기록
                  </h4>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">입고일</TableHead>
                          <TableHead className="whitespace-nowrap">SKU</TableHead>
                          <TableHead className="whitespace-nowrap">제품명</TableHead>
                          <TableHead className="whitespace-nowrap text-right">수량</TableHead>
                          <TableHead className="whitespace-nowrap">품질</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inboundRecordsList.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {rec.date}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs">{rec.productSku}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{rec.productName}</TableCell>
                            <TableCell className="whitespace-nowrap text-right font-semibold">{rec.receivedQuantity}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {rec.qualityResult === "pass" ? (
                                <Badge className="bg-green-600">합격</Badge>
                              ) : rec.qualityResult === "fail" ? (
                                <Badge variant="destructive">불합격</Badge>
                              ) : rec.qualityResult === "partial" ? (
                                <Badge variant="destructive" className="bg-orange-600">부분합격</Badge>
                              ) : rec.qualityResult === "pending" ? (
                                <Badge variant="secondary">검수대기</Badge>
                              ) : (
                                <Badge variant="outline">-</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* 변경 이력 */}
              {activityLogsList.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <History className="h-4 w-4" />
                    변경 이력
                  </h4>
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    <div className="divide-y">
                      {activityLogsList.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                          <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-700">{log.description}</p>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                              <span>{log.userName || "시스템"}</span>
                              <span>·</span>
                              <span>
                                {new Date(log.createdAt).toLocaleString("ko-KR", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span>·</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {log.action}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 상태 변경 + 액션 버튼 */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* 상태 변경 버튼 */}
                <div className="flex gap-2">
                  {(nextStatusActions[orderData.status] || []).map((action) => (
                    <Button
                      key={action.status}
                      variant={action.variant || "default"}
                      size="sm"
                      onClick={() => handleStatusChange(action.status)}
                      disabled={isUpdatingStatus}
                    >
                      {action.status === "cancelled" ? (
                        <XCircle className="mr-1 h-4 w-4" />
                      ) : (
                        <ChevronRight className="mr-1 h-4 w-4" />
                      )}
                      {action.label}
                    </Button>
                  ))}
                </div>

                {/* 기존 액션 버튼 */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadClick}>
                    <Download className="mr-2 h-4 w-4" />
                    Excel 다운로드
                  </Button>
                  {canReceive && (
                    <Button size="sm" onClick={handleInboundClick}>
                      <Package className="mr-2 h-4 w-4" />
                      입고 확인
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 입고 확인 다이얼로그 */}
      {orderData && (
        <InboundDialog
          open={inboundDialogOpen}
          onOpenChange={(open) => handleInboundClose(!open)}
          orderId={orderId}
          orderNumber={orderData.orderNumber}
          items={inboundItems}
        />
      )}
    </>
  );
}
