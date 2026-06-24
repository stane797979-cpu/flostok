"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { ChevronLeft, ChevronRight, Download, Loader2, Upload } from "lucide-react";
import { OutboundRecordsTable } from "./outbound-records-table";
import { OutboundEditDialog } from "./outbound-edit-dialog";
import { ExcelImportDialog } from "@/components/features/excel/excel-import-dialog";
import { WarehouseOutboundClient } from "@/app/dashboard/warehouse/outbound/_components/warehouse-outbound-client";
import { OutboundRequestsTab } from "./outbound-requests-tab";
import { useToast } from "@/hooks/use-toast";
import { getOutboundRecords, deleteOutboundRecord, type OutboundRecord } from "@/server/actions/outbound";
import { exportInventoryMovementToExcel } from "@/server/actions/excel-export";

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
}

export function OutboundClient({ initialTab = "records" }: OutboundClientProps) {
  const [outboundMonth, setOutboundMonth] = useState<Date>(() => new Date());
  const [outboundRecords, setOutboundRecords] = useState<OutboundRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isDownloadingMovement, setIsDownloadingMovement] = useState(false);

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<OutboundRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutboundRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeTab, setActiveTab] = useState<"records" | "request" | "confirm">(
    initialTab === "upload" ? "records" : (initialTab as "records" | "request" | "confirm")
  );

  const { toast } = useToast();

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
        toast({ title: "다운로드 완료", description: `${result.data.filename} 파일이 다운로드되었습니다` });
      } else {
        toast({ title: "다운로드 실패", description: "수불부 다운로드에 실패했습니다", variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "수불부 다운로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsDownloadingMovement(false);
    }
  }, [outboundMonth, toast]);

  const handleEdit = useCallback((record: OutboundRecord) => {
    setEditRecord(record);
    setEditOpen(true);
  }, []);

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
        toast({ title: "삭제 완료", description: `${deleteTarget.productSku} 출고 기록이 삭제되었습니다. 재고가 복원됩니다.` });
        loadOutboundRecords(outboundMonth);
      } else {
        toast({ title: "삭제 실패", description: result.error || "출고 기록 삭제에 실패했습니다", variant: "destructive" });
      }
    } catch (error) {
      console.error("출고 삭제 오류:", error);
      toast({ title: "오류", description: "출고 기록 삭제 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, outboundMonth, loadOutboundRecords, toast]);

  useEffect(() => {
    loadOutboundRecords(outboundMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "records") {
      loadOutboundRecords(outboundMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 통계 계산
  const todayStr = new Date().toISOString().split("T")[0];
  const todayCount = outboundRecords.filter((r) => r.date === todayStr).length;
  const totalQty = outboundRecords.reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">출고현황</h1>
        <p className="mt-2 text-slate-500">출고 등록 및 현황 관리</p>
      </div>

      {/* 탭 */}
      <div className="border-b">
        <nav className="-mb-px flex gap-6">
          {(["records", "request", "confirm"] as const).map((tab) => {
            const labels = { records: "출고현황", request: "출고요청", confirm: "출고확정(창고)" };
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
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === "request" && <OutboundRequestsTab />}
      {activeTab === "confirm" && <WarehouseOutboundClient hideTitle />}

      {activeTab === "records" && (
        <>
          {/* 상단 KPI 카드 4개 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-blue-600 font-medium">이번달 출고건수</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{outboundRecords.length.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-green-600 font-medium">총 출고수량</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{totalQty.toLocaleString()}</div>
                <p className="text-xs text-slate-400 mt-1">개</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-orange-500 font-medium">당일 출고</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-500">{todayCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="font-medium">월 네비게이션</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-7 w-7">
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-sm font-medium flex-1 text-center">{formatMonth(outboundMonth)}</span>
                  <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-7 w-7">
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 출고 현황 테이블 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>출고 현황</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-1 h-4 w-4" />
                    엑셀 업로드
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadMovement}
                    disabled={isDownloadingMovement}
                  >
                    {isDownloadingMovement ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-4 w-4" />
                    )}
                    엑셀 다운
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
        </>
      )}

      {/* 엑셀 업로드 다이얼로그 */}
      <ExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importType="sales"
        title="판매/출고 데이터 업로드"
        description="판매(출고) 데이터를 엑셀 파일로 업로드하세요"
        onSuccess={() => {
          toast({ title: "업로드 완료", description: "판매 데이터가 성공적으로 업로드되었습니다" });
          loadOutboundRecords(outboundMonth);
        }}
      />

      {/* 수정 다이얼로그 */}
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
                  <br /><br />
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
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
