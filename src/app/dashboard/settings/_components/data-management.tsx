"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Upload, Download, Package, ShoppingCart, Loader2 } from "lucide-react";
import { ExcelImportDialog } from "@/components/features/excel";
import type { ImportType } from "@/server/actions/excel-import";
import { exportProductsToExcel, exportSalesToExcel } from "@/server/actions/data-export";

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

export function DataManagement() {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedImportType, setSelectedImportType] = useState<ImportType>("sales");
  const [exportingProducts, setExportingProducts] = useState(false);
  const [exportingSales, setExportingSales] = useState(false);

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
