"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSpreadsheet,
  Play,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Download,
} from "lucide-react";
import type { UploadedFileInfo, MappingEntry } from "@/types/onboarding";
import { DATA_TYPE_LABELS } from "@/types/onboarding";
import {
  previewMapping,
  executeImport,
  completeOnboardingSession,
} from "@/server/actions/onboarding";
import { useToast } from "@/hooks/use-toast";

interface StepPreviewImportProps {
  sessionId: string;
  files: UploadedFileInfo[];
  onFilesChange: (files: UploadedFileInfo[]) => void;
  onComplete: () => void;
}

interface PreviewData {
  rows: Record<string, unknown>[];
  errors: Array<{ row: number; column?: string; message: string }>;
  totalRows: number;
  successCount: number;
  errorCount: number;
}

type DuplicateHandling = "skip" | "update" | "error";

export function StepPreviewImport({
  sessionId,
  files,
  onFilesChange,
  onComplete,
}: StepPreviewImportProps) {
  const { toast } = useToast();
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [previews, setPreviews] = useState<Record<string, PreviewData>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [duplicateHandling, setDuplicateHandling] =
    useState<DuplicateHandling>("update");
  const [importResults, setImportResults] = useState<
    Record<string, { success: boolean; totalRows: number; successCount: number; errorCount: number }>
  >({});

  const activeFile = files[activeFileIndex];
  const activePreview = activeFile?.id ? previews[activeFile.id] : null;

  // 미리보기 로드
  useEffect(() => {
    if (activeFile?.id && activeFile.status === "mapped" && !previews[activeFile.id]) {
      loadPreview(activeFile.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileIndex, activeFile?.id]);

  const loadPreview = async (fileId: string) => {
    setLoadingPreview(true);
    try {
      const result = await previewMapping(fileId);
      if (result.success && result.data) {
        setPreviews((prev) => ({
          ...prev,
          [fileId]: result.data as PreviewData,
        }));
      } else {
        toast({
          title: "미리보기 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  // 개별 파일 임포트
  const handleImportFile = async (fileIndex: number) => {
    const file = files[fileIndex];
    if (!file.id) return;

    setImporting(true);
    try {
      const result = await executeImport(
        sessionId,
        file.id,
        duplicateHandling
      );

      if (result.success && result.data) {
        setImportResults((prev) => ({
          ...prev,
          [file.id!]: {
            success: true,
            totalRows: result.data!.totalRows,
            successCount: result.data!.successCount,
            errorCount: result.data!.errorCount,
          },
        }));

        // 파일 상태 업데이트
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          status: "imported",
        };
        onFilesChange(updatedFiles);

        toast({
          title: "임포트 완료",
          description: `${result.data.successCount}/${result.data.totalRows}건 성공`,
        });
      } else {
        toast({
          title: "임포트 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setImporting(false);
    }
  };

  // 전체 파일 일괄 임포트
  const handleImportAll = async () => {
    setImporting(true);
    setImportProgress(0);

    const mappedFiles = files.filter(
      (f) => f.status === "mapped" && f.id
    );

    for (let i = 0; i < mappedFiles.length; i++) {
      const file = mappedFiles[i];
      const fileIndex = files.findIndex((f) => f.id === file.id);

      try {
        const result = await executeImport(
          sessionId,
          file.id!,
          duplicateHandling
        );

        if (result.success && result.data) {
          setImportResults((prev) => ({
            ...prev,
            [file.id!]: {
              success: true,
              totalRows: result.data!.totalRows,
              successCount: result.data!.successCount,
              errorCount: result.data!.errorCount,
            },
          }));

          const updatedFiles = [...files];
          updatedFiles[fileIndex] = {
            ...updatedFiles[fileIndex],
            status: "imported",
          };
          onFilesChange(updatedFiles);
        }
      } catch {
        // 개별 파일 오류는 무시하고 계속 진행
      }

      setImportProgress(((i + 1) / mappedFiles.length) * 100);
    }

    // 세션 완료 처리
    await completeOnboardingSession(sessionId);
    setImporting(false);

    toast({
      title: "전체 임포트 완료",
      description: "온보딩 데이터가 성공적으로 임포트되었습니다.",
    });

    onComplete();
  };

  // 미리보기 컬럼 추출
  const previewColumns = activePreview?.rows[0]
    ? Object.keys(activePreview.rows[0])
    : [];

  const allImported = files.every((f) => f.status === "imported");
  const hasImported = Object.keys(importResults).length > 0;

  return (
    <div className="space-y-6">
      {/* 파일 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {files.map((file, index) => (
          <Button
            key={file.id || index}
            variant={index === activeFileIndex ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFileIndex(index)}
            className="shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            {file.fileName}
            {file.status === "imported" && (
              <CheckCircle2 className="h-3 w-3 ml-1 text-green-500" />
            )}
          </Button>
        ))}
      </div>

      {activeFile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  미리보기 - {activeFile.fileName}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {DATA_TYPE_LABELS[activeFile.dataType]}
                  {activePreview &&
                    ` · 전체 ${activePreview.totalRows}행`}
                </p>
              </div>
              {activeFile.status !== "imported" && (
                <Button
                  size="sm"
                  onClick={() => handleImportFile(activeFileIndex)}
                  disabled={importing || activeFile.status !== "mapped"}
                >
                  <Play className="h-4 w-4 mr-1" />
                  이 파일 임포트
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 임포트 결과 */}
            {activeFile.id && importResults[activeFile.id] && (
              <Alert
                variant={
                  importResults[activeFile.id].errorCount > 0
                    ? "destructive"
                    : "default"
                }
              >
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  임포트 완료: {importResults[activeFile.id].successCount}/
                  {importResults[activeFile.id].totalRows}건 성공
                  {importResults[activeFile.id].errorCount > 0 &&
                    `, ${importResults[activeFile.id].errorCount}건 실패`}
                </AlertDescription>
              </Alert>
            )}

            {loadingPreview ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-[200px] w-full" />
              </div>
            ) : activePreview ? (
              <>
                {/* 검증 요약 */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {activePreview.successCount}
                    </div>
                    <div className="text-xs text-slate-500">
                      변환 성공 (미리보기)
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {activePreview.errorCount}
                    </div>
                    <div className="text-xs text-slate-500">변환 오류</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {activePreview.totalRows}
                    </div>
                    <div className="text-xs text-slate-500">전체 행</div>
                  </div>
                </div>

                {/* 오류 목록 */}
                {activePreview.errors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-red-700">
                      변환 오류 ({activePreview.errors.length}건)
                    </h4>
                    <div className="max-h-[150px] overflow-auto space-y-1">
                      {activePreview.errors.slice(0, 10).map((err, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm p-2 bg-red-50 rounded"
                        >
                          <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          <span>
                            행 {err.row}
                            {err.column ? ` [${err.column}]` : ""}:{" "}
                            {err.message}
                          </span>
                        </div>
                      ))}
                      {activePreview.errors.length > 10 && (
                        <p className="text-xs text-slate-500 pl-6">
                          ... 외 {activePreview.errors.length - 10}건
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 변환 결과 테이블 */}
                {activePreview.rows.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">
                      변환 결과 (처음 {activePreview.rows.length}행)
                    </h4>
                    <div className="overflow-auto border rounded-lg max-h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">
                              #
                            </TableHead>
                            {previewColumns.map((col) => (
                              <TableHead key={col} className="min-w-[100px]">
                                {col}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activePreview.rows.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-center text-slate-500">
                                {i + 1}
                              </TableCell>
                              {previewColumns.map((col) => (
                                <TableCell key={col} className="text-sm">
                                  {row[col] != null ? (
                                    String(row[col])
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>매핑이 확정되면 미리보기가 표시됩니다.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 하단: 중복 처리 옵션 + 일괄 임포트 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">중복 처리:</span>
              <Select
                value={duplicateHandling}
                onValueChange={(v) =>
                  setDuplicateHandling(v as DuplicateHandling)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">덮어쓰기</SelectItem>
                  <SelectItem value="skip">건너뛰기</SelectItem>
                  <SelectItem value="error">오류 처리</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              {hasImported && (
                <Badge variant="outline" className="text-green-700">
                  {Object.values(importResults).reduce(
                    (sum, r) => sum + r.successCount,
                    0
                  )}
                  건 임포트 완료
                </Badge>
              )}
              <Button
                size="lg"
                onClick={handleImportAll}
                disabled={
                  importing ||
                  allImported ||
                  files.filter((f) => f.status === "mapped").length === 0
                }
              >
                <Download className="h-4 w-4 mr-2" />
                {allImported ? "모두 완료" : "전체 임포트 실행"}
              </Button>
            </div>
          </div>

          {/* 진행 표시줄 */}
          {importing && (
            <div className="mt-4 space-y-2">
              <Progress value={importProgress} />
              <p className="text-sm text-center text-slate-500">
                임포트 진행 중... {Math.round(importProgress)}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
