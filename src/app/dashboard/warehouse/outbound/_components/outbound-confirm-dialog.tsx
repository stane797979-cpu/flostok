"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getOutboundRequestById,
  confirmOutboundRequest,
} from "@/server/actions/outbound-requests";
import { exportPickingListToExcel } from "@/server/actions/excel-export";

interface OutboundConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  onSuccess: () => void;
}

interface RequestDetail {
  id: string;
  requestNumber: string;
  status: string;
  outboundType: string;
  outboundTypeLabel: string;
  customerType: string | null;
  requestedByName: string | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;
  sourceWarehouseName: string | null;
  targetWarehouseName: string | null;
  recipientCompany: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  recipientPhone: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: Date;
  items: Array<{
    id: string;
    productId: string;
    productSku: string;
    productName: string;
    requestedQuantity: number;
    confirmedQuantity: number | null;
    currentStock: number;
    notes: string | null;
  }>;
}

export function OutboundConfirmDialog({
  open,
  onOpenChange,
  requestId,
  onSuccess,
}: OutboundConfirmDialogProps) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedQuantities, setConfirmedQuantities] = useState<
    Record<string, number>
  >({});
  const [notes, setNotes] = useState("");
  const [isDownloadingPickingList, setIsDownloadingPickingList] = useState(false);

  const { toast } = useToast();

  // 요청 상세 정보 로드
  useEffect(() => {
    if (!open || !requestId) return;

    setIsLoading(true);
    getOutboundRequestById(requestId)
      .then((result) => {
        if (result.success && result.request) {
          setRequest(result.request);
          // 초기 확정 수량 설정 (요청 수량으로)
          const initialQuantities: Record<string, number> = {};
          result.request.items.forEach((item) => {
            initialQuantities[item.id] = item.requestedQuantity;
          });
          setConfirmedQuantities(initialQuantities);
        } else {
          toast({
            title: "오류",
            description: result.error || "출고 요청 정보를 불러오지 못했습니다",
            variant: "destructive",
          });
          onOpenChange(false);
        }
      })
      .catch((error) => {
        console.error("출고 요청 조회 오류:", error);
        toast({
          title: "오류",
          description: "출고 요청 정보를 불러오지 못했습니다",
          variant: "destructive",
        });
        onOpenChange(false);
      })
      .finally(() => setIsLoading(false));
  }, [open, requestId, onOpenChange, toast]);

  // 확정 수량 변경
  const handleQuantityChange = (itemId: string, value: string) => {
    const quantity = Math.max(0, parseInt(value) || 0);
    setConfirmedQuantities((prev) => ({ ...prev, [itemId]: quantity }));
  };

  // 전체 확인 (모든 항목을 요청 수량으로 설정)
  const handleConfirmAll = () => {
    if (!request) return;
    const allQuantities: Record<string, number> = {};
    request.items.forEach((item) => {
      allQuantities[item.id] = item.requestedQuantity;
    });
    setConfirmedQuantities(allQuantities);
    toast({
      title: "전체 확인",
      description: "모든 항목이 요청 수량으로 설정되었습니다",
    });
  };

  // 재고 부족 항목 체크
  const hasStockIssues = request?.items.some((item) => {
    const confirmed = confirmedQuantities[item.id] || 0;
    return confirmed > item.currentStock;
  });

  // 출고 확정 제출
  const handleSubmit = async () => {
    if (!request) return;

    if (hasStockIssues) {
      toast({
        title: "재고 부족",
        description: "재고가 부족한 항목이 있습니다. 수량을 조정하세요.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmOutboundRequest({
        requestId: request.id,
        items: request.items.map((item) => ({
          itemId: item.id,
          confirmedQuantity: confirmedQuantities[item.id] || 0,
        })),
        notes: notes || undefined,
      });

      if (result.success) {
        toast({
          title: "출고 확정 완료",
          description: "출고가 확정되었습니다. 재고가 차감되었습니다.",
        });
        handleClose();
        onSuccess();
      } else {
        toast({
          title: "출고 확정 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("출고 확정 오류:", error);
      toast({
        title: "오류",
        description: "출고 확정 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 피킹지 다운로드
  const handlePickingListDownload = async () => {
    if (!request) return;
    setIsDownloadingPickingList(true);
    try {
      const result = await exportPickingListToExcel(request.id);
      if (result.success && result.data) {
        const binaryString = atob(result.data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({ title: "피킹지 다운로드 완료" });
      } else {
        toast({
          title: "다운로드 실패",
          description: result.error || "피킹지 다운로드에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("피킹지 다운로드 오류:", error);
      toast({
        title: "오류",
        description: "피킹지 다운로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingPickingList(false);
    }
  };

  const handleClose = () => {
    setRequest(null);
    setConfirmedQuantities({});
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>출고 확정</DialogTitle>
          <DialogDescription>
            각 항목의 실제 출고 수량을 확인하고 출고를 확정하세요
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            불러오는 중...
          </div>
        ) : request ? (
          <div className="space-y-4 py-4">
            {/* 요청 정보 */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border bg-slate-50 p-4 dark:bg-slate-900">
              <div>
                <p className="text-sm font-medium text-slate-500">요청번호</p>
                <p className="mt-1 font-medium">{request.requestNumber}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">출고유형</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline">
                    {request.outboundTypeLabel}
                  </Badge>
                  {request.customerType && (
                    <Badge variant="outline" className={request.customerType === "B2B" ? "border-blue-300 text-blue-700" : "border-green-300 text-green-700"}>
                      {request.customerType}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">출고 창고</p>
                <p className="mt-1">
                  {request.sourceWarehouseName || "-"}
                  {request.targetWarehouseName && (
                    <span className="text-xs text-slate-400"> → {request.targetWarehouseName}</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">요청일</p>
                <p className="mt-1">
                  {new Date(request.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })}
                </p>
              </div>
              {(request.recipientName || request.recipientCompany) && (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-500">수령인</p>
                    <p className="mt-1">
                      {request.recipientCompany && <span className="font-medium">{request.recipientCompany} </span>}
                      {request.recipientName || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">연락처</p>
                    <p className="mt-1">{request.recipientPhone || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-slate-500">주소</p>
                    <p className="mt-1 text-sm">{request.recipientAddress || "-"}</p>
                  </div>
                </>
              )}
              {(request.courierName || request.trackingNumber) && (
                <>
                  <div>
                    <p className="text-sm font-medium text-slate-500">택배사</p>
                    <p className="mt-1">{request.courierName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">송장번호</p>
                    <p className="mt-1">{request.trackingNumber || "-"}</p>
                  </div>
                </>
              )}
              {request.notes && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-slate-500">요청 메모</p>
                  <p className="mt-1 text-sm">{request.notes}</p>
                </div>
              )}
            </div>

            {/* 항목 목록 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>출고 항목</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleConfirmAll}
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  전체 확인
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제품</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">요청수량</TableHead>
                      <TableHead className="text-right">현재고</TableHead>
                      <TableHead className="text-right">확인수량</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {request.items.map((item) => {
                      const confirmed = confirmedQuantities[item.id] || 0;
                      const isInsufficient = confirmed > item.currentStock;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.productName}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {item.productSku}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.requestedQuantity.toLocaleString()}개
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              isInsufficient
                                ? "font-medium text-red-600"
                                : ""
                            }`}
                          >
                            {item.currentStock.toLocaleString()}개
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              max={item.currentStock}
                              value={confirmed}
                              onChange={(e) =>
                                handleQuantityChange(item.id, e.target.value)
                              }
                              className={`w-24 text-right ${
                                isInsufficient ? "border-red-600" : ""
                              }`}
                              disabled={isSubmitting}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 재고 부족 경고 */}
            {hasStockIssues && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  재고가 부족한 항목이 있습니다. 확인 수량을 조정하세요.
                </AlertDescription>
              </Alert>
            )}

            {/* 확인 메모 */}
            <div className="space-y-2">
              <Label htmlFor="confirm-notes">확인 메모 (선택)</Label>
              <Textarea
                id="confirm-notes"
                placeholder="출고 처리 시 특이사항을 입력하세요"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <div className="flex-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePickingListDownload}
              disabled={isDownloadingPickingList || !request}
            >
              {isDownloadingPickingList ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              피킹지
            </Button>
          </div>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || hasStockIssues || !request}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            출고 확정
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
