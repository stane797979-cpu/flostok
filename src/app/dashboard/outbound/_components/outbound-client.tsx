"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { OutboundRecordsTable } from "./outbound-records-table";
import { OutboundEditDialog } from "./outbound-edit-dialog";
import { OutboundRegisterDialog } from "./outbound-register-dialog";
import { OutboundRequestDialog } from "./outbound-request-dialog";
import { ExcelImportDialog } from "@/components/features/excel/excel-import-dialog";
import { useToast } from "@/hooks/use-toast";
import { getOutboundRecords, deleteOutboundRecord, type OutboundRecord } from "@/server/actions/outbound";
import { exportInventoryMovementToExcel } from "@/server/actions/excel-export";

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
  initialTab?: "records" | "upload";
}

export function OutboundClient({ initialTab = "records" }: OutboundClientProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // 출고 현황 상태
  const [outboundMonth, setOutboundMonth] = useState<Date>(() => new Date());
  const [outboundRecords, setOutboundRecords] = useState<OutboundRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isDownloadingMovement, setIsDownloadingMovement] = useState(false);

  // 출고 업로드/등록 상태
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  // 수정/삭제 상태
  const [editRecord, setEditRecord] = useState<OutboundRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OutboundRecord | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">출고 관리</h1>
        <p className="mt-2 text-slate-500">출고 데이터를 업로드하고 월별 출고 현황을 확인하세요</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">출고 업로드</TabsTrigger>
          <TabsTrigger value="records" onClick={() => loadOutboundRecords(outboundMonth)}>
            출고 현황
          </TabsTrigger>
        </TabsList>

        {/* 출고 업로드 탭 */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>판매/출고 데이터 업로드</CardTitle>
              <CardDescription>
                판매(출고) 데이터를 엑셀로 업로드하세요. 업로드된 데이터는 판매 기록에 저장됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="rounded-full bg-slate-100 p-6 dark:bg-slate-800">
                  <Upload className="h-10 w-10 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium">엑셀 파일로 판매 데이터를 업로드합니다</p>
                  <p className="mt-1 text-sm text-slate-500">
                    필수 컬럼: SKU, 날짜, 판매수량
                  </p>
                </div>
                <Button onClick={() => setImportDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  파일 업로드
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 출고 현황 탭 */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>출고 현황</CardTitle>
                  <CardDescription>
                    월별 출고 기록을 확인하고 재고 수불부를 다운로드할 수 있습니다
                  </CardDescription>
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
                    onClick={() => setRequestDialogOpen(true)}
                  >
                    <PackageMinus className="mr-2 h-4 w-4" />
                    출고 요청
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRegisterDialogOpen(true)}
                  >
                    <PackageMinus className="mr-2 h-4 w-4" />
                    출고 등록
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
        </TabsContent>
      </Tabs>

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

      {/* 출고 직접 등록 다이얼로그 */}
      <OutboundRegisterDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
        onSuccess={() => loadOutboundRecords(outboundMonth)}
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
