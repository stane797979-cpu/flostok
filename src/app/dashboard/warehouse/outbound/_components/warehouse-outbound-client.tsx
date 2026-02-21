"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, PackageX, Clock, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { getOutboundRequests, bulkConfirmOutboundRequests } from "@/server/actions/outbound-requests";
import { exportMultiplePickingListsToExcel } from "@/server/actions/excel-export";
import { OutboundConfirmDialog } from "./outbound-confirm-dialog";
import { useToast } from "@/hooks/use-toast";

interface OutboundRequest {
  id: string;
  requestNumber: string;
  status: string;
  outboundType: string;
  outboundTypeLabel: string;
  customerType: string | null;
  requestedByName: string | null;
  sourceWarehouseName: string | null;
  targetWarehouseName: string | null;
  recipientCompany: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  recipientPhone: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  itemsCount: number;
  totalQuantity: number;
  totalCurrentStock: number;
  totalBacklog: number;
  createdAt: Date;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "대기중", className: "bg-orange-600" },
  confirmed: { label: "출고완료", className: "bg-green-600" },
  cancelled: { label: "취소됨", className: "bg-slate-500" },
};

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return d.toLocaleDateString("ko-KR");
}

export function WarehouseOutboundClient() {
  const [requests, setRequests] = useState<OutboundRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkConfirming, setIsBulkConfirming] = useState(false);
  const [isDownloadingPickingList, setIsDownloadingPickingList] = useState(false);

  const { toast } = useToast();

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const allPendingSelected = pendingRequests.length > 0 && pendingRequests.every((r) => selectedIds.has(r.id));
  const somePendingSelected = pendingRequests.some((r) => selectedIds.has(r.id));

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setSelectedIds(new Set());
    try {
      const result = await getOutboundRequests({
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setRequests(result.requests);
    } catch (error) {
      console.error("출고예정 목록 조회 오류:", error);
      toast({
        title: "조회 실패",
        description: "출고예정 목록을 불러오지 못했습니다",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 개별 선택/해제
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // 개별 확정 다이얼로그 (요청번호 클릭 시)
  const handleConfirmClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedRequestId(null);
  };

  const handleConfirmSuccess = () => {
    loadRequests();
    handleDialogClose();
  };

  // 선택 일괄 확정
  const handleBulkConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsBulkConfirming(true);
    try {
      const result = await bulkConfirmOutboundRequests(ids);
      if (result.confirmedCount > 0) {
        toast({
          title: "일괄 출고 확정 완료",
          description: `${result.confirmedCount}건 출고 확정됨${result.errors.length > 0 ? `, ${result.errors.length}건 오류` : ""}`,
        });
      }
      if (result.errors.length > 0) {
        toast({
          title: "일부 오류 발생",
          description: result.errors.slice(0, 3).join("\n"),
          variant: "destructive",
        });
      }
      loadRequests();
    } catch (error) {
      console.error("일괄 확정 오류:", error);
      toast({
        title: "오류",
        description: "일괄 출고 확정 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsBulkConfirming(false);
    }
  };

  // 피킹지 일괄 다운로드
  const handleBulkPickingListDownload = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setIsDownloadingPickingList(true);
    try {
      const result = await exportMultiplePickingListsToExcel(ids);
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

        toast({
          title: "피킹지 다운로드 완료",
          description: `${ids.length}건의 피킹지가 다운로드되었습니다`,
        });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">출고확정(창고)</h1>
        <p className="mt-2 text-slate-500">출고 요청을 선택하고 일괄 확정하세요</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>출고 요청 목록</CardTitle>
              <CardDescription>
                체크박스로 선택 후 일괄 확정하거나, 요청번호를 클릭하여 개별 확정할 수 있습니다
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">대기중</SelectItem>
                  <SelectItem value="confirmed">출고완료</SelectItem>
                  <SelectItem value="cancelled">취소됨</SelectItem>
                  <SelectItem value="all">전체</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={loadRequests}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              로딩 중...
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <PackageX className="mb-4 h-12 w-12" />
              <p className="text-lg font-medium">출고 요청이 없습니다</p>
              <p className="mt-1 text-sm">
                {statusFilter === "pending"
                  ? "대기중인 출고 요청이 없습니다"
                  : "해당 상태의 출고 요청이 없습니다"}
              </p>
            </div>
          ) : (
            <>
              {/* 선택 상태 바 */}
              {selectedIds.size > 0 && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
                  <span className="text-sm font-medium">
                    {selectedIds.size}건 선택됨
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkPickingListDownload}
                      disabled={isDownloadingPickingList}
                    >
                      {isDownloadingPickingList ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                      )}
                      피킹지 다운로드
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleBulkConfirm}
                      disabled={isBulkConfirming}
                    >
                      {isBulkConfirming ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      선택 일괄 확정
                    </Button>
                  </div>
                </div>
              )}

              <div className="mb-3 text-sm text-slate-500">
                총 {requests.length}건
              </div>

              {/* 모바일 카드 뷰 */}
              <div className="space-y-3 md:hidden">
                {requests.map((req) => {
                  const config = statusConfig[req.status] || {
                    label: req.status,
                    className: "bg-slate-600",
                  };
                  const isSelected = selectedIds.has(req.id);
                  return (
                    <div
                      key={req.id}
                      className={`rounded-lg border p-4 space-y-3 transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {req.status === "pending" && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectOne(req.id, !!checked)}
                          />
                        )}
                        <div className="flex-1">
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => req.status === "pending" && handleConfirmClick(req.id)}
                          >
                            {req.requestNumber}
                          </button>
                          <p className="text-sm text-slate-500">{req.requestedByName || "-"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{req.outboundTypeLabel}</Badge>
                          {req.customerType && (
                            <Badge variant="outline" className={req.customerType === "B2B" ? "border-blue-300 text-blue-700" : "border-green-300 text-green-700"}>
                              {req.customerType}
                            </Badge>
                          )}
                          <Badge className={config.className}>{config.label}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm pl-7">
                        <div className="space-y-1">
                          {req.sourceWarehouseName && (
                            <p className="text-slate-600 font-medium">
                              {req.sourceWarehouseName}
                              {req.targetWarehouseName && ` → ${req.targetWarehouseName}`}
                            </p>
                          )}
                          {(req.recipientName || req.recipientCompany) && (
                            <p className="text-slate-600">
                              {req.recipientCompany && <span className="font-medium">{req.recipientCompany} </span>}
                              {req.recipientName}
                            </p>
                          )}
                          <p className="text-slate-500">
                            {req.itemsCount}품목 · {req.totalQuantity.toLocaleString()}개
                            {" · "}
                            <span className={req.totalCurrentStock < req.totalQuantity ? "font-medium text-red-600" : "text-green-600"}>
                              현재고 {req.totalCurrentStock.toLocaleString()}
                            </span>
                            {req.totalBacklog > 0 && (
                              <span className="text-orange-600"> · 대기 {req.totalBacklog.toLocaleString()}</span>
                            )}
                          </p>
                          <div className="flex items-center gap-1 text-slate-400">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(req.createdAt)}
                          </div>
                        </div>
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
                      <TableHead className="w-12">
                        {pendingRequests.length > 0 && (
                          <Checkbox
                            checked={allPendingSelected ? true : somePendingSelected ? "indeterminate" : false}
                            onCheckedChange={(checked) => handleSelectAll(checked === true)}
                          />
                        )}
                      </TableHead>
                      <TableHead>요청번호</TableHead>
                      <TableHead>출고유형</TableHead>
                      <TableHead>B2B/B2C</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>출고 창고</TableHead>
                      <TableHead>수령인</TableHead>
                      <TableHead className="text-center">품목수</TableHead>
                      <TableHead className="text-center">총수량</TableHead>
                      <TableHead className="text-center">현재고</TableHead>
                      <TableHead className="text-center">대기수량</TableHead>
                      <TableHead>요청일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => {
                      const config = statusConfig[req.status] || {
                        label: req.status,
                        className: "bg-slate-600",
                      };
                      const isSelected = selectedIds.has(req.id);

                      return (
                        <TableRow
                          key={req.id}
                          className={`${isSelected ? "bg-primary/5" : ""} ${req.status === "pending" ? "cursor-pointer hover:bg-slate-50" : ""}`}
                        >
                          <TableCell>
                            {req.status === "pending" ? (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectOne(req.id, !!checked)}
                              />
                            ) : (
                              <span className="block w-4" />
                            )}
                          </TableCell>
                          <TableCell>
                            {req.status === "pending" ? (
                              <button
                                type="button"
                                className="font-medium text-primary hover:underline"
                                onClick={() => handleConfirmClick(req.id)}
                              >
                                {req.requestNumber}
                              </button>
                            ) : (
                              <span className="font-medium text-slate-500">
                                {req.requestNumber}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {req.outboundTypeLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {req.customerType ? (
                              <Badge variant="outline" className={req.customerType === "B2B" ? "border-blue-300 text-blue-700" : "border-green-300 text-green-700"}>
                                {req.customerType}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={config.className}>
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {req.sourceWarehouseName || "-"}
                            {req.targetWarehouseName && (
                              <span className="text-xs text-slate-400"> → {req.targetWarehouseName}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {req.recipientName || req.recipientCompany ? (
                              <div className="text-sm">
                                {req.recipientCompany && <p className="font-medium">{req.recipientCompany}</p>}
                                {req.recipientName && <p className="text-slate-500">{req.recipientName}</p>}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {req.itemsCount}개
                          </TableCell>
                          <TableCell className="text-center">
                            {req.totalQuantity.toLocaleString()}개
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-medium ${req.totalCurrentStock < req.totalQuantity ? "text-red-600" : "text-green-600"}`}>
                              {req.totalCurrentStock.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {req.totalBacklog > 0 ? (
                              <span className="font-medium text-orange-600">
                                {req.totalBacklog.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-600">
                              {formatDate(req.createdAt)}
                            </span>
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

      {selectedRequestId && (
        <OutboundConfirmDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          requestId={selectedRequestId}
          onSuccess={handleConfirmSuccess}
        />
      )}
    </div>
  );
}
