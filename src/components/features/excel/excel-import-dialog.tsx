"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { importExcelFile, getExcelTemplateBase64, type ImportType, type ImportExcelResult } from "@/server/actions/excel-import";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importType: ImportType;
  title?: string;
  description?: string;
  onSuccess?: (result: ImportExcelResult) => void;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  importType,
  title,
  description,
  onSuccess,
}: ExcelImportDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [duplicateHandling, setDuplicateHandling] = useState<"skip" | "update" | "error">("skip");
  const [result, setResult] = useState<ImportExcelResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const typeLabel = importType === "sales" ? "판매 데이터" : "제품 데이터";
  const displayTitle = title || `${typeLabel} 임포트`;
  const displayDescription = description || `Excel 파일(.xlsx)을 업로드하여 ${typeLabel}를 일괄 등록합니다.`;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      setFile(droppedFile);
      setResult(null);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const MAX_ROWS = 500;

  const handleImport = async () => {
    if (!file) return;

    setIsPending(true);
    try {
      // File -> Base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // 행 수 체크 (500행 제한)
      const { read, utils } = await import("xlsx");
      const workbook = read(buffer, { type: "array", sheetRows: MAX_ROWS + 2 });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = utils.sheet_to_json(sheet);
      if (rows.length > MAX_ROWS) {
        setResult({
          success: false,
          message: `한 번에 최대 ${MAX_ROWS}행까지 업로드 가능합니다. 현재 파일의 데이터 행 수가 ${MAX_ROWS}행을 초과합니다. 파일을 나누어 업로드해 주세요.`,
          totalRows: rows.length,
          successCount: 0,
          errorCount: 0,
          errors: [],
        });
        setIsPending(false);
        return;
      }

      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const importResult = await importExcelFile({
        type: importType,
        fileBase64: base64,
        fileName: file.name,
        duplicateHandling,
      });

      setResult(importResult);

      if (importResult.success && onSuccess) {
        onSuccess(importResult);
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "알 수 없는 오류",
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [],
      });
    } finally {
      setIsPending(false);
    }
  };

  const [templateDownloading, setTemplateDownloading] = useState(false);

  const handleDownloadTemplate = async () => {
    setTemplateDownloading(true);
    try {
      const base64 = await getExcelTemplateBase64(importType);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${importType === "sales" ? "판매데이터" : "제품마스터"}_템플릿.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Template download error:", error);
      alert("양식 다운로드에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setTemplateDownloading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            {displayTitle}
          </DialogTitle>
          <DialogDescription>{displayDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 템플릿 다운로드 */}
          <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            <div className="text-sm">
              <p className="font-medium text-slate-700">템플릿 다운로드</p>
              <p className="text-slate-500">올바른 형식으로 데이터를 준비하세요</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} disabled={templateDownloading}>
              <Download className="mr-2 h-4 w-4" />
              {templateDownloading ? "다운로드 중..." : "다운로드"}
            </Button>
          </div>

          {/* 파일 업로드 */}
          <div
            className={cn(
              "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
              isDragOver ? "border-primary bg-primary/5" : "border-slate-300 hover:border-primary/50",
              file && "border-green-500 bg-green-50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-10 w-10 text-green-600" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setFile(null);
                    setResult(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 h-10 w-10 text-slate-400" />
                <p className="text-sm text-slate-600">파일을 드래그하거나 클릭하여 업로드</p>
                <p className="text-xs text-slate-400">.xlsx 파일만 지원</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </>
            )}
          </div>

          {/* 중복 처리 옵션 */}
          <div className="space-y-2">
            <Label>중복 데이터 처리</Label>
            <Select value={duplicateHandling} onValueChange={(v) => setDuplicateHandling(v as typeof duplicateHandling)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">무시 (기존 데이터 유지)</SelectItem>
                <SelectItem value="update">덮어쓰기 (새 데이터로 업데이트)</SelectItem>
                <SelectItem value="error">오류 처리 (중복 시 중단)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 결과 표시 */}
          {result && (
            <div
              className={cn(
                "rounded-lg border p-4",
                result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
                <p className={cn("font-medium", result.success ? "text-green-700" : "text-red-700")}>
                  {result.message}
                </p>
              </div>

              <div className="flex gap-4 text-sm">
                <Badge variant="outline">전체: {result.totalRows}건</Badge>
                <Badge variant="outline" className="border-green-300 text-green-700">
                  성공: {result.successCount}건
                </Badge>
                {result.errorCount > 0 && (
                  <Badge variant="outline" className="border-red-300 text-red-700">
                    오류: {result.errorCount}건
                  </Badge>
                )}
              </div>

              {result.errors.length > 0 && result.errors.length <= 5 && (
                <div className="mt-3 max-h-32 overflow-y-auto text-sm text-red-600">
                  {result.errors.map((err, idx) => (
                    <p key={idx}>
                      행 {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {result?.success ? "닫기" : "취소"}
          </Button>
          {!result?.success && (
            <Button onClick={handleImport} disabled={!file || isPending}>
              {isPending ? "처리 중..." : "임포트"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
