"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, ChevronRight, Download, Loader2, PackageMinus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OutboundRecordsTable } from "./outbound-records-table";
import { OutboundEditDialog } from "./outbound-edit-dialog";
import { OutboundRequestDialog } from "./outbound-request-dialog";
import { ExcelImportDialog } from "@/components/features/excel/excel-import-dialog";
import { WarehouseOutboundClient } from "@/app/dashboard/warehouse/outbound/_components/warehouse-outbound-client";
import { useToast } from "@/hooks/use-toast";
import { getOutboundRecords, deleteOutboundRecord, type OutboundRecord } from "@/server/actions/outbound";
import { exportInventoryMovementToExcel } from "@/server/actions/excel-export";
import { getOutboundRequests, cancelOutboundRequest, holdOutboundRequest, resumeOutboundRequest } from "@/server/actions/outbound-requests";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * 월의 시작일/종료일 계산
 */
function getMonthRange(date: Date): { startDate: string; endDate: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { startDate, endDate };
}

function formatMonth(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

interface OutboundClientProps {
  initialTab?: "records" | "upload" | "confirm";
  // upload은 records로 리다이렉트됨
}

export function OutboundClient({ initialTab = "records" }: OutboundClientProps) {

  // 출고 현황 상태
  const [outboundMonth, setOutboundMonth] = useState<Date>(() => new Date());
  const [outboundRecords, setOutboundRecords] = useState<OutboundRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isDownloadingMovement, setIsDownloadingMovement] = useState(false);

  // 출고 요청 현황 카운트
  const [pendingCount, setPendingCount] = useState(0);
  const [holdingCount, setHoldingCount] = useState(0);

  // 출고 업로드/요청 상태
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  // 수정/삭제 상태
  const [editRecord, setEditRecord] = useState<OutboundRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutboundRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  // 출고 요청 목록 상태
  const [outboundRequestList, setOutboundRequestList] = useState<Array<{
    id: string;
    requestNumber: string;
    status: string;
    outboundType: string;
    outboundTypeLabel: string;
    requestedByName: string | null;
    itemsCount: number;
    totalQuantity: number;
    createdAt: Date;
  }>>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // 출고 요청 목록 조회
  const loadOutboundRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const result = await getOutboundRequests({ limit: 100 });
      setOutboundRequestList(result.requests);
      const pending = result.requests.filter((r) => r.status === "pending").length;
      const holding = result.requests.filter((r) => r.status === "holding").length;
      setPendingCount(pending);
      setHoldingCount(holding);
    } catch {
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  // 출고 요청 카운트 조회 (호환성 유지)
  const loadRequestCounts = loadOutboundRequests;

  // 출고 기록 조회
  const loadOutboundRecords = useCallback(async (month: Date) => {
    setIsLoadingRecords(true);
    try {
      const { startDate, endDate } = getMonthRange(month);
      const result = await getOutboundRecords({ startDate, endDate, limit: 500 });
      setOutboundRecords(
        result.records.map((r) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }))
      );
    } catch (error) {
      console.error("출고 기록 조회 오류:", error);
    } finally {
      setIsLoadingRecords(false);
    }
  }, []);

  // 월 이동
  const handlePrevMonth = useCallback(() => {
    setOutboundMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      loadOutboundRecords(next);
      return next;
    });
  }, [loadOutboundRecords]);

  const handleNextMonth = useCallback(() => {
    setOutboundMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      loadOutboundRecords(next);
      return next;
    });
  }, [loadOutboundRecords]);

  // 재고 수불부 다운로드
  const handleDownloadMovement = useCallback(async () => {
    setIsDownloadingMovement(true);
    try {
      const { startDate, endDate } = getMonthRange(outboundMonth);
      const result = await exportInventoryMovementToExcel({ startDate, endDate });

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
          title: "다운로드 완료",
          description: `${result.data.filename} 파일이 다운로드되었습니다`,
        });
      } else {
        toast({
          title: "다운로드 실패",
          description: result.error || "재고 수불부 다운로드에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("재고 수불부 다운로드 오류:", error);
      toast({
        title: "오류",
        description: "재고 수불부 다운로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingMovement(false);
    }
  }, [outboundMonth, toast]);

  // 수정 핸들러
  const handleEdit = useCallback((record: OutboundRecord) => {
    setEditRecord(record);
    setEditOpen(true);
  }, []);

  // 삭제 핸들러
  const handleDeleteRequest = useCallback((record: OutboundRecord) => {
    setDeleteTarget(record);
    setDeleteOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const result = await deleteOutboundRecord(deleteTarget.id);
      if (result.success) {
        toast({
          title: "삭제 완료",
          description: `${deleteTarget.productSku} 출고 기록이 삭제되었습니다. 재고가 복원됩니다.`,
        });
        loadOutboundRecords(outboundMonth);
      } else {
        toast({
          title: "삭제 실패",
          description: result.error || "출고 기록 삭제에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("출고 삭제 오류:", error);
      toast({
        title: "오류",
        description: "출고 기록 삭제 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, outboundMonth, loadOutboundRecords, toast]);

  const [activeTab, setActiveTab] = useState<"records" | "confirm">(
    initialTab === "upload" ? "records" : (initialTab as "records" | "confirm")
  );

  // 초기 마운트 시 records 탭 데이터 로드
  useEffect(() => {
    loadOutboundRecords(outboundMonth);
    loadOutboundRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 탭 전환 시 records 탭 데이터 로드
  useEffect(() => {
    if (activeTab === "records") {
      loadOutboundRecords(outboundMonth);
      loadOutboundRequests();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">출고관리</h1>
        <p className="mt-2 text-slate-500">출고 등록 및 현황 관리</p>
      </div>

      {/* 탭 */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6">
          {(["records", "confirm"] as const).map((tab) => {
            const labels = { records: "출고현황", confirm: "출고확정(창고)" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {labels[tab]}
                {tab === "confirm" && pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-xs text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === "confirm" && <WarehouseOutboundClient hideTitle />}

      {activeTab === "records" && (
        <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle>출고 현황</CardTitle>
                  <CardDescription>
                    월별 출고 기록을 확인하고 재고 수불부를 다운로드할 수 있습니다
                  </CardDescription>
                  <div className="flex gap-2 pt-1">
                    {pendingCount > 0 && (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        출고요청중 {pendingCount}건
                      </Badge>
                    )}
                    {holdingCount > 0 && (
                      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                        홀딩 {holdingCount}건
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[120px] text-center font-medium">
                    {formatMonth(outboundMonth)}
                  </span>
                  <Button variant="outline" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    엑셀 업로드
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRequestDialogOpen(true)}
                  >
                    <PackageMinus className="mr-2 h-4 w-4" />
                    출고 요청
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadMovement}
                    disabled={isDownloadingMovement}
                  >
                    {isDownloadingMovement ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    엑셀 다운
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 출고 요청 현황 */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">출고 요청 현황</h3>
                {isLoadingRequests ? (
                  <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                    불러오는 중...
                  </div>
                ) : outboundRequestList.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-slate-400">
                    출고 요청 내역이 없습니다
                  </div>
                ) : (
                  <div className="rounded-lg border bg-white dark:bg-slate-950">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>요청번호</TableHead>
                          <TableHead>유형</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead className="text-right">품목수</TableHead>
                          <TableHead className="text-right">총수량</TableHead>
                          <TableHead>요청자</TableHead>
                          <TableHead>요청일시</TableHead>
                          <TableHead className="w-[160px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outboundRequestList.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-mono text-sm">{req.requestNumber}</TableCell>
                            <TableCell className="text-sm">{req.outboundTypeLabel}</TableCell>
                            <TableCell>
                              {req.status === "pending" && (
                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">출고요청중</Badge>
                              )}
                              {req.status === "holding" && (
                                <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">홀딩</Badge>
                              )}
                              {req.status === "partial" && (
                                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">부분출고(잔량대기)</Badge>
                              )}
                              {req.status === "confirmed" && (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">출고완료</Badge>
                              )}
                              {req.status === "cancelled" && (
                                <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100">취소</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{req.itemsCount}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{req.totalQuantity.toLocaleString()}</TableCell>
                            <TableCell className="text-sm text-slate-500">{req.requestedByName || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {new Date(req.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {req.status === "pending" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={async () => {
                                      await holdOutboundRequest(req.id);
                                      loadOutboundRequests();
                                    }}
                                  >
                                    홀딩
                                  </Button>
                                )}
                                {req.status === "holding" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={async () => {
                                      await resumeOutboundRequest(req.id);
                                      loadOutboundRequests();
                                    }}
                                  >
                                    요청재개
                                  </Button>
                                )}
                                {(req.status === "pending" || req.status === "holding") && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs text-red-600 hover:text-red-700"
                                    onClick={async () => {
                                      await cancelOutboundRequest(req.id);
                                      loadOutboundRequests();
                                    }}
                                  >
                                    취소
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* 구분선 */}
              <div className="mb-6 border-t" />

              {/* 출고 완료 기록 */}
              <h3 className="mb-3 text-sm font-semibold text-slate-700">출고 완료 기록</h3>
              {isLoadingRecords ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  출고 기록을 불러오는 중...
                </div>
              ) : (
                <>
                  <div className="mb-3 text-sm text-slate-500">
                    총 {outboundRecords.length}건
                  </div>
                  <OutboundRecordsTable
                    records={outboundRecords}
                    onEdit={handleEdit}
                    onDelete={handleDeleteRequest}
                  />
                </>
              )}
            </CardContent>
        </Card>
      )}

      {/* 엑셀 임포트 다이얼로그 (기존 재사용) */}
      <ExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importType="sales"
        title="판매/출고 데이터 업로드"
        description="판매(출고) 데이터를 엑셀 파일로 업로드하세요"
        onSuccess={() => {
          toast({
            title: "업로드 완료",
            description: "판매 데이터가 성공적으로 업로드되었습니다",
          });
          loadOutboundRecords(outboundMonth);
        }}
      />

      {/* 출고 요청 다이얼로그 */}
      <OutboundRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSuccess={() => {
          toast({
            title: "출고 요청 생성 완료",
            description: "출고 요청이 생성되었습니다. 창고에서 확인 후 처리됩니다.",
          });
        }}
      />

      {/* 출고 수정 다이얼로그 */}
      <OutboundEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        record={editRecord}
        onSuccess={() => loadOutboundRecords(outboundMonth)}
      />

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>출고 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  <strong>{deleteTarget.productSku}</strong> ({deleteTarget.productName})의{" "}
                  {deleteTarget.date} 출고 기록({Math.abs(deleteTarget.changeAmount)}개)을
                  삭제하시겠습니까?
                  <br />
                  <br />
                  삭제 시 재고가 {Math.abs(deleteTarget.changeAmount)}개 복원됩니다.
                  이 작업은 되돌릴 수 없습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
