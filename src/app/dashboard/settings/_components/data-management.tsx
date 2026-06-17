"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { FileSpreadsheet, Upload, Download, Package, ShoppingCart, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { ExcelImportDialog } from "@/components/features/excel";
import type { ImportType } from "@/server/actions/excel-import";
import { exportProductsToExcel, exportSalesToExcel } from "@/server/actions/data-export";
import { resetInventoryData, resetInboundData, resetSalesData, resetSuppliersData, resetAllData } from "@/server/actions/data-reset";

interface ImportOption {
  type: ImportType;
  title: string;
  description: string;
  icon: typeof Package;
  badge?: string;
}

const IMPORT_OPTIONS: ImportOption[] = [
  {
    type: "products",
    title: "제품 마스터",
    description: "제품 정보(SKU, 제품명, 카테고리, 단가 등)를 일괄 등록/수정합니다.",
    icon: Package,
  },
  {
    type: "sales",
    title: "판매(출고) 데이터",
    description: "일별 판매/출고 데이터를 업로드하여 수요 예측에 활용합니다.",
    icon: ShoppingCart,
    badge: "수요예측 필수",
  },
];

function downloadBase64File(base64: string, filename: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type ResetTarget = "inventory" | "inbound" | "sales" | "suppliers" | "all";

const RESET_OPTIONS: {
  target: ResetTarget;
  title: string;
  description: string;
  detail: string;
}[] = [
  {
    target: "inventory",
    title: "재고",
    description: "현재 재고, 재고 이력, LOT 정보를 모두 삭제합니다.",
    detail: "inventory / inventory_history / inventory_lots 테이블",
  },
  {
    target: "inbound",
    title: "입고",
    description: "모든 입고 기록을 삭제합니다.",
    detail: "inbound_records 테이블",
  },
  {
    target: "sales",
    title: "출고/판매",
    description: "모든 판매(출고) 기록과 출고 요청을 삭제합니다.",
    detail: "sales_records / outbound_requests 테이블",
  },
  {
    target: "suppliers",
    title: "공급업체",
    description: "등록된 모든 공급업체 정보를 삭제합니다.",
    detail: "suppliers 테이블",
  },
  {
    target: "all",
    title: "전체",
    description: "재고, 입고, 출고/판매, 공급업체 데이터를 모두 삭제합니다.",
    detail: "위 항목 전체",
  },
];

export function DataManagement() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportType, setSelectedImportType] = useState<ImportType>("sales");
  const [exportingProducts, setExportingProducts] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<ResetTarget | null>(null);
  const [resetting, setResetting] = useState<ResetTarget | null>(null);
  const [resetResult, setResetResult] = useState<{ target: ResetTarget; success: boolean; error?: string } | null>(null);

  const handleImportClick = (type: ImportType) => {
    setSelectedImportType(type);
    setImportDialogOpen(true);
  };

  const handleExportProducts = async () => {
    setExportingProducts(true);
    try {
      const result = await exportProductsToExcel();
      if (result.success && result.data) {
        downloadBase64File(result.data.buffer, result.data.filename);
      } else {
        alert(result.error || "다운로드에 실패했습니다");
      }
    } catch {
      alert("다운로드 중 오류가 발생했습니다");
    } finally {
      setExportingProducts(false);
    }
  };

  const handleExportSales = async () => {
    setExportingSales(true);
    try {
      const result = await exportSalesToExcel();
      if (result.success && result.data) {
        downloadBase64File(result.data.buffer, result.data.filename);
      } else {
        alert(result.error || "다운로드에 실패했습니다");
      }
    } catch {
      alert("다운로드 중 오류가 발생했습니다");
    } finally {
      setExportingSales(false);
    }
  };

  const handleResetConfirm = async () => {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirmTarget(null);
    setResetting(target);
    setResetResult(null);

    const actionMap: Record<ResetTarget, () => Promise<{ success: boolean; error?: string }>> = {
      inventory: resetInventoryData,
      inbound: resetInboundData,
      sales: resetSalesData,
      suppliers: resetSuppliersData,
      all: resetAllData,
    };

    try {
      const result = await actionMap[target]();
      setResetResult({ target, ...result });
    } catch {
      setResetResult({ target, success: false, error: "삭제 중 오류가 발생했습니다." });
    } finally {
      setResetting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 데이터 임포트 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            데이터 임포트
          </CardTitle>
          <CardDescription>
            Excel 파일(.xlsx)을 업로드하여 데이터를 일괄 등록합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {IMPORT_OPTIONS.map((option) => (
              <div
                key={option.type}
                className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50"
              >
                <div className="flex gap-3">
                  <div className="rounded-lg bg-slate-100 p-2">
                    <option.icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{option.title}</h4>
                      {option.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {option.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{option.description}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImportClick(option.type)}
                  className="shrink-0"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  임포트
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 데이터 익스포트 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-blue-600" />
            데이터 익스포트
          </CardTitle>
          <CardDescription>
            현재 데이터를 Excel 파일로 다운로드합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50">
              <div className="flex gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <Package className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h4 className="font-medium">제품 목록</h4>
                  <p className="mt-1 text-sm text-slate-500">전체 제품 마스터 데이터 다운로드</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportProducts}
                disabled={exportingProducts}
                className="shrink-0"
              >
                {exportingProducts ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                다운로드
              </Button>
            </div>

            <div className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50">
              <div className="flex gap-3">
                <div className="rounded-lg bg-slate-100 p-2">
                  <ShoppingCart className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h4 className="font-medium">판매 데이터</h4>
                  <p className="mt-1 text-sm text-slate-500">기간별 판매 데이터 다운로드</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportSales}
                disabled={exportingSales}
                className="shrink-0"
              >
                {exportingSales ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                다운로드
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 초기화 섹션 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            데이터 초기화
          </CardTitle>
          <CardDescription>
            선택한 데이터를 영구 삭제합니다. 삭제 후 복구할 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {resetResult && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                resetResult.success
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {resetResult.success
                ? `${RESET_OPTIONS.find((o) => o.target === resetResult.target)?.title} 데이터가 삭제되었습니다.`
                : resetResult.error}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {RESET_OPTIONS.map((option) => (
              <div
                key={option.target}
                className={`flex items-start justify-between rounded-lg border p-4 ${
                  option.target === "all" ? "border-red-300 bg-red-50/50 md:col-span-2" : ""
                }`}
              >
                <div className="flex gap-3">
                  <div className={`rounded-lg p-2 ${option.target === "all" ? "bg-red-100" : "bg-slate-100"}`}>
                    <AlertTriangle className={`h-5 w-5 ${option.target === "all" ? "text-red-600" : "text-slate-500"}`} />
                  </div>
                  <div>
                    <h4 className="font-medium">{option.title} 데이터 삭제</h4>
                    <p className="mt-1 text-sm text-slate-500">{option.description}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{option.detail}</p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  disabled={resetting !== null}
                  onClick={() => {
                    setResetResult(null);
                    setConfirmTarget(option.target);
                  }}
                >
                  {resetting === option.target ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  삭제
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 임포트 다이얼로그 */}
      <ExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importType={selectedImportType}
        onSuccess={(result) => {
          console.log("Import success:", result);
        }}
      />

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={confirmTarget !== null} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {RESET_OPTIONS.find((o) => o.target === confirmTarget)?.title} 데이터 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {RESET_OPTIONS.find((o) => o.target === confirmTarget)?.description}
              </span>
              <span className="block font-semibold text-red-600">
                삭제된 데이터는 복구할 수 없습니다. 계속하시겠습니까?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleResetConfirm}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
