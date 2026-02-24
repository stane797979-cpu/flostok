"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSpreadsheet,
  Wand2,
  RotateCcw,
  Save,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type {
  UploadedFileInfo,
  MappingEntry,
  OnboardingDataType,
  FlowStokField,
} from "@/types/onboarding";
import { DATA_TYPE_LABELS } from "@/types/onboarding";
import {
  generateAutoMapping,
  saveFileMappings,
  validateFileMappings,
} from "@/server/actions/onboarding";
import { FIELD_DEFINITIONS } from "@/server/services/onboarding/field-definitions";
import { useToast } from "@/hooks/use-toast";
import { SaveProfileDialog } from "./save-profile-dialog";
import { LoadProfileDialog } from "./load-profile-dialog";

interface StepColumnMappingProps {
  files: UploadedFileInfo[];
  mappings: Record<string, MappingEntry[]>;
  onMappingsChange: (mappings: Record<string, MappingEntry[]>) => void;
  onFilesChange: (files: UploadedFileInfo[]) => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-700 border-green-300",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  low: "bg-slate-100 text-slate-500 border-slate-300",
  none: "bg-slate-50 text-slate-400 border-slate-200",
};

function getConfidenceLevel(confidence: number) {
  if (confidence >= 80) return "high";
  if (confidence >= 60) return "medium";
  if (confidence > 0) return "low";
  return "none";
}

export function StepColumnMapping({
  files,
  mappings,
  onMappingsChange,
  onFilesChange,
}: StepColumnMappingProps) {
  const { toast } = useToast();
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<{
    valid: boolean;
    missingFields: FlowStokField[];
  } | null>(null);
  const [saveProfileOpen, setSaveProfileOpen] = useState(false);
  const [loadProfileOpen, setLoadProfileOpen] = useState(false);

  const activeFile = files[activeFileIndex];
  const activeFileId = activeFile?.id || "";
  const activeMappings = mappings[activeFileId] || [];
  const activeDataType = activeFile?.dataType as OnboardingDataType;
  const targetFields = activeDataType
    ? FIELD_DEFINITIONS[activeDataType] || []
    : [];

  // 매핑 검증
  const runValidation = useCallback(async () => {
    if (!activeFileId || activeMappings.length === 0) {
      setValidation(null);
      return;
    }
    const result = await validateFileMappings(activeFileId, activeMappings);
    if (result.success && result.data) {
      setValidation(result.data);
    }
  }, [activeFileId, activeMappings]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  // 자동 매핑
  const handleAutoMap = async () => {
    if (!activeFileId) return;
    setLoading(true);
    try {
      const result = await generateAutoMapping(activeFileId);
      if (result.success && result.data) {
        onMappingsChange({
          ...mappings,
          [activeFileId]: result.data as MappingEntry[],
        });
        toast({
          title: "자동 매핑 완료",
          description: `${
            (result.data as MappingEntry[]).filter((m) => m.dbField).length
          }개 컬럼이 자동 매핑되었습니다.`,
        });
      } else {
        toast({
          title: "자동 매핑 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // 매핑 초기화
  const handleReset = () => {
    if (!activeFileId) return;
    const resetMappings = activeMappings.map((m) => ({
      ...m,
      dbField: "",
      confidence: 0,
      isAutoMapped: false,
    }));
    onMappingsChange({
      ...mappings,
      [activeFileId]: resetMappings,
    });
  };

  // 개별 매핑 변경
  const handleMappingChange = (excelColumn: string, dbField: string) => {
    const updated = activeMappings.map((m) => {
      if (m.excelColumn === excelColumn) {
        const field = targetFields.find((f) => f.dbField === dbField);
        return {
          ...m,
          dbField,
          confidence: dbField ? 100 : 0,
          isAutoMapped: false,
          required: field?.required || false,
          defaultValue: field?.defaultValue,
        };
      }
      return m;
    });
    onMappingsChange({
      ...mappings,
      [activeFileId]: updated,
    });
  };

  // 매핑 저장
  const handleSaveMappings = async () => {
    if (!activeFileId) return;
    setLoading(true);
    try {
      const result = await saveFileMappings(activeFileId, activeMappings);
      if (result.success) {
        // 파일 상태 업데이트
        const updatedFiles = [...files];
        updatedFiles[activeFileIndex] = {
          ...updatedFiles[activeFileIndex],
          status: "mapped",
        };
        onFilesChange(updatedFiles);

        toast({ title: "매핑 저장 완료" });
      } else {
        toast({
          title: "매핑 저장 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // 이미 매핑된 dbField 목록 (중복 방지)
  const usedDbFields = new Set(
    activeMappings.filter((m) => m.dbField).map((m) => m.dbField)
  );

  // 매핑 통계
  const mappedCount = activeMappings.filter((m) => m.dbField).length;
  const requiredTotal = targetFields.filter((f) => f.required).length;
  const requiredMapped = activeMappings.filter(
    (m) => m.dbField && m.required
  ).length;

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
            {file.status === "mapped" && (
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
                  컬럼 매핑 - {activeFile.fileName}
                </CardTitle>
                <p className="text-sm text-slate-500 mt-1">
                  {DATA_TYPE_LABELS[activeFile.dataType]} &middot;{" "}
                  {mappedCount}/{activeMappings.length}개 매핑됨 &middot;{" "}
                  필수 {requiredMapped}/{requiredTotal}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLoadProfileOpen(true)}
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  프로필
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoMap}
                  disabled={loading}
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  자동 매핑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  초기화
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : activeMappings.length > 0 ? (
              <>
                {/* 검증 경고 (안내용 — 진행 가능) */}
                {validation && !validation.valid && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      다음 필수 필드가 매핑되지 않았습니다:{" "}
                      {validation.missingFields
                        .map((f) => f.label)
                        .join(", ")}
                      <span className="block text-xs mt-1 text-slate-500">
                        원본 데이터에 해당 컬럼이 없으면 건너뛰고 진행할 수 있습니다.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* 매핑 목록 */}
                <div className="space-y-2">
                  {activeMappings.map((mapping) => {
                    const level = getConfidenceLevel(mapping.confidence);
                    const header = activeFile.analyzedHeaders?.find(
                      (h) => h.name === mapping.excelColumn
                    );

                    return (
                      <div
                        key={mapping.excelColumn}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${CONFIDENCE_COLORS[level]}`}
                      >
                        {/* 원본 컬럼 */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {mapping.excelColumn}
                          </div>
                          {header && (
                            <div className="text-xs text-slate-500 truncate mt-0.5">
                              {header.sampleValues
                                .slice(0, 2)
                                .map((v) =>
                                  v != null ? String(v) : "-"
                                )
                                .join(", ")}
                            </div>
                          )}
                        </div>

                        {/* 화살표 */}
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />

                        {/* 대상 필드 선택 */}
                        <div className="w-[240px] shrink-0">
                          <Select
                            value={mapping.dbField || "__none__"}
                            onValueChange={(val) =>
                              handleMappingChange(
                                mapping.excelColumn,
                                val === "__none__" ? "" : val
                              )
                            }
                          >
                            <SelectTrigger className="bg-white dark:bg-slate-800">
                              <SelectValue placeholder="매핑 안함" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                (매핑 안함)
                              </SelectItem>
                              {targetFields.map((field) => (
                                <SelectItem
                                  key={field.dbField}
                                  value={field.dbField}
                                  disabled={
                                    usedDbFields.has(field.dbField) &&
                                    mapping.dbField !== field.dbField
                                  }
                                >
                                  {field.label}
                                  {field.required ? " *" : ""}
                                  {usedDbFields.has(field.dbField) &&
                                  mapping.dbField !== field.dbField
                                    ? " (사용중)"
                                    : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 신뢰도 배지 */}
                        <div className="w-16 text-right shrink-0">
                          {mapping.confidence > 0 && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${CONFIDENCE_COLORS[level]}`}
                            >
                              {mapping.confidence}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 매핑 저장 */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSaveProfileOpen(true)}
                    disabled={mappedCount === 0}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    프로필로 저장
                  </Button>
                  <Button
                    onClick={handleSaveMappings}
                    disabled={loading || mappedCount === 0}
                  >
                    매핑 확정
                    <CheckCircle2 className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Wand2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 mb-4">
                  &ldquo;자동 매핑&rdquo; 버튼을 클릭하여 매핑을 시작하세요.
                </p>
                <Button onClick={handleAutoMap}>
                  <Wand2 className="h-4 w-4 mr-2" />
                  자동 매핑 시작
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 프로필 다이얼로그 */}
      <SaveProfileDialog
        open={saveProfileOpen}
        onOpenChange={setSaveProfileOpen}
        dataType={activeDataType}
        mappings={activeMappings}
        sourceHeaders={
          activeFile?.analyzedHeaders?.map((h) => h.name) || []
        }
      />
      <LoadProfileDialog
        open={loadProfileOpen}
        onOpenChange={setLoadProfileOpen}
        dataType={activeDataType}
        currentHeaders={
          activeFile?.analyzedHeaders?.map((h) => h.name) || []
        }
        onProfileLoaded={(loadedMappings) => {
          onMappingsChange({
            ...mappings,
            [activeFileId]: loadedMappings,
          });
        }}
      />
    </div>
  );
}
