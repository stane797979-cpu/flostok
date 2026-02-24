"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Checkbox 미사용 — 텍스트 확인만으로 충분
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, Upload, Download, Package, ShoppingCart, Loader2, RotateCcw, AlertTriangle, CheckCircle } from "lucide-react";
import { ExcelImportDialog } from "@/components/features/excel";
import type { ImportType } from "@/server/actions/excel-import";
import { exportProductsToExcel, exportSalesToExcel } from "@/server/actions/data-export";
import { resetOrganizationData } from "@/server/actions/data-reset";
import { useToast } from "@/hooks/use-toast";

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

interface DataManagementProps {
  isAdmin?: boolean;
}

export function DataManagement({ isAdmin }: DataManagementProps) {
  const { toast } = useToast();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportType, setSelectedImportType] = useState<ImportType>("sales");
  const [exportingProducts, setExportingProducts] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);

  // 리셋 관련 상태
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<Record<string, number> | null>(null);

  const handleReset = async () => {
    if (resetConfirmText !== "리셋합니다") return;
    setIsResetting(true);
    setResetResult(null);
    try {
      const result = await resetOrganizationData();
      if (result.success) {
        setResetResult(result.deletedCounts ?? {});
        setResetConfirmText("");
        toast({
          title: "리셋 완료",
          description: "모든 조직 데이터가 삭제되었습니다.",
        });
      } else {
        toast({
          title: "리셋 실패",
          description: result.error || "데이터 리셋에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "오류",
        description: err instanceof Error ? err.message : "리셋 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

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
        toast({ title: "다운로드 실패", description: result.error || "다운로드에 실패했습니다", variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "다운로드 중 오류가 발생했습니다", variant: "destructive" });
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
        toast({ title: "다운로드 실패", description: result.error || "다운로드에 실패했습니다", variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "다운로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setExportingSales(false);
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

      {/* 데이터 전체 리셋 */}
      {isAdmin && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <RotateCcw className="h-5 w-5" />
              데이터 전체 리셋
            </CardTitle>
            <CardDescription>
              조직의 모든 비즈니스 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 삭제 대상 안내 */}
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                다음 데이터가 모두 삭제됩니다
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>제품 마스터 및 공급업체 정보</li>
                <li>현재 재고 및 재고 변동 이력</li>
                <li>발주서 및 발주 항목</li>
                <li>입고/출고 기록</li>
                <li>판매 기록 및 수요 예측</li>
                <li>알림, KPI 스냅샷, PSI 계획</li>
                <li>창고 정보</li>
              </ul>
              <p className="mt-2 font-medium">
                ※ 사용자 계정, 조직 정보, 결제 내역은 유지됩니다.
              </p>
            </div>

            {/* 리셋 결과 표시 */}
            {resetResult && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <p className="font-medium mb-2">리셋 완료</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    {Object.entries(resetResult)
                      .filter(([, count]) => count > 0)
                      .map(([name, count]) => (
                        <div key={name} className="flex justify-between">
                          <span>{name}</span>
                          <span className="font-mono">{count}건</span>
                        </div>
                      ))}
                  </div>
                  {Object.values(resetResult).every((c) => c === 0) && (
                    <p className="text-xs">삭제할 데이터가 없었습니다.</p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* 확인 입력 */}
            <div className="space-y-2">
              <Label htmlFor="resetConfirm" className="text-sm font-medium">
                확인: 아래에 &quot;리셋합니다&quot;를 정확히 입력하세요
              </Label>
              <Input
                id="resetConfirm"
                placeholder="리셋합니다"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                disabled={isResetting}
              />
            </div>

            {/* 리셋 버튼 */}
            <Button
              variant="destructive"
              disabled={resetConfirmText !== "리셋합니다" || isResetting}
              onClick={handleReset}
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  리셋 처리 중...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  전체 데이터 리셋
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 임포트 다이얼로그 */}
      <ExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importType={selectedImportType}
        onSuccess={(result) => {
          console.log("Import success:", result);
        }}
      />
    </div>
  );
}
