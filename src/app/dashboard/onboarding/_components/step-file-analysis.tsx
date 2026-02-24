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
import { Skeleton } from "@/components/ui/skeleton";
import { FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import type { UploadedFileInfo, AnalyzedHeader } from "@/types/onboarding";
import { DATA_TYPE_LABELS } from "@/types/onboarding";
import { analyzeOnboardingFile } from "@/server/actions/onboarding";
import { useToast } from "@/hooks/use-toast";

interface StepFileAnalysisProps {
  files: UploadedFileInfo[];
  onFilesChange: (files: UploadedFileInfo[]) => void;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  text: "bg-slate-100 text-slate-700",
  number: "bg-blue-100 text-blue-700",
  date: "bg-green-100 text-green-700",
  unknown: "bg-yellow-100 text-yellow-700",
};

const TYPE_LABELS: Record<string, string> = {
  text: "텍스트",
  number: "숫자",
  date: "날짜",
  unknown: "알 수 없음",
};

export function StepFileAnalysis({
  files,
  onFilesChange,
}: StepFileAnalysisProps) {
  const { toast } = useToast();
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [analyzing, setAnalyzing] = useState<Record<number, boolean>>({});
  const [sampleData, setSampleData] = useState<
    Record<string, Record<string, unknown>[]>
  >({});

  // 페이지 진입 시 자동 분석
  useEffect(() => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "uploaded" && files[i].id) {
        handleAnalyze(i);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnalyze = async (fileIndex: number, sheetName?: string) => {
    const file = files[fileIndex];
    if (!file.id) return;

    setAnalyzing((prev) => ({ ...prev, [fileIndex]: true }));

    try {
      const result = await analyzeOnboardingFile(file.id, sheetName);

      if (result.success && result.data) {
        const updatedFiles = [...files];
        updatedFiles[fileIndex] = {
          ...updatedFiles[fileIndex],
          sheetNames: result.data.sheetNames,
          selectedSheet: result.data.selectedSheet,
          analyzedHeaders: result.data.headers as AnalyzedHeader[],
          rowCount: result.data.rowCount,
          status: "analyzed",
        };
        onFilesChange(updatedFiles);

        if (result.data.sampleData) {
          setSampleData((prev) => ({
            ...prev,
            [file.id!]: result.data!.sampleData,
          }));
        }
      } else {
        toast({
          title: "분석 실패",
          description: result.error || "파일 분석 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "분석 오류",
        description: "파일 분석 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing((prev) => ({ ...prev, [fileIndex]: false }));
    }
  };

  const activeFile = files[activeFileIndex];
  const activeSamples = activeFile?.id ? sampleData[activeFile.id] : [];

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
            {file.status === "analyzed" && (
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
                  {activeFile.fileName}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {DATA_TYPE_LABELS[activeFile.dataType]} &middot;{" "}
                  {activeFile.rowCount !== undefined
                    ? `${activeFile.rowCount}행`
                    : "분석 대기 중"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={!!analyzing[activeFileIndex]}
                onClick={() => handleAnalyze(activeFileIndex)}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${
                    analyzing[activeFileIndex] ? "animate-spin" : ""
                  }`}
                />
                {analyzing[activeFileIndex] ? "분석 중..." : "재분석"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {analyzing[activeFileIndex] ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-[200px] w-full" />
              </div>
            ) : activeFile.status === "analyzed" ? (
              <>
                {/* 시트 선택 */}
                {activeFile.sheetNames && activeFile.sheetNames.length > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">시트 선택:</span>
                    <Select
                      value={activeFile.selectedSheet}
                      onValueChange={(value) => {
                        handleAnalyze(activeFileIndex, value);
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {activeFile.sheetNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 헤더 분석 결과 */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">
                    컬럼 분석 ({activeFile.analyzedHeaders?.length || 0}개)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {activeFile.analyzedHeaders?.map((header) => (
                      <div
                        key={header.name}
                        className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-white dark:bg-slate-800"
                      >
                        <span className="text-sm font-medium">
                          {header.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            TYPE_BADGE_COLORS[header.inferredType] || ""
                          }`}
                        >
                          {TYPE_LABELS[header.inferredType] || header.inferredType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 샘플 데이터 */}
                {activeSamples && activeSamples.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">
                      샘플 데이터 (처음 {activeSamples.length}행)
                    </h4>
                    <div className="overflow-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">
                              #
                            </TableHead>
                            {activeFile.analyzedHeaders?.map((h) => (
                              <TableHead key={h.name} className="min-w-[120px]">
                                {h.name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeSamples.map((row, rowIdx) => (
                            <TableRow key={rowIdx}>
                              <TableCell className="text-center text-slate-500">
                                {rowIdx + 1}
                              </TableCell>
                              {activeFile.analyzedHeaders?.map((h) => (
                                <TableCell key={h.name} className="text-sm">
                                  {row[h.name] != null
                                    ? String(row[h.name])
                                    : <span className="text-slate-300">-</span>}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* 통계 요약 */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {activeFile.rowCount?.toLocaleString() || 0}
                    </div>
                    <div className="text-xs text-slate-500">데이터 행</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {activeFile.analyzedHeaders?.length || 0}
                    </div>
                    <div className="text-xs text-slate-500">컬럼 수</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-900">
                      {activeFile.sheetNames?.length || 0}
                    </div>
                    <div className="text-xs text-slate-500">시트 수</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>파일이 아직 분석되지 않았습니다.</p>
                <Button
                  className="mt-4"
                  onClick={() => handleAnalyze(activeFileIndex)}
                >
                  분석 시작
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
