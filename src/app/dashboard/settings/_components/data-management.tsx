"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { FileSpreadsheet, Upload, Download, Package, ShoppingCart, Loader2, RotateCcw, AlertTriangle, CheckCircle, Trash2, Clock, Eye, Save } from "lucide-react";
import { ExcelImportDialog } from "@/components/features/excel";
import type { ImportType } from "@/server/actions/excel-import";
import { exportProductsToExcel, exportSalesToExcel } from "@/server/actions/data-export";
import { resetOrganizationData } from "@/server/actions/data-reset";
import { getRetentionPolicy, saveRetentionPolicy, previewDataCleanup, executeDataCleanup } from "@/server/actions/data-retention";
import type { RetentionPolicySettings } from "@/types/organization-settings";
import { DEFAULT_RETENTION_POLICY } from "@/types/organization-settings";
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
                className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <div className="flex gap-3">
                  <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                    <option.icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
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
            <div className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
              <div className="flex gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <Package className="h-5 w-5 text-slate-600 dark:text-slate-300" />
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

            <div className="flex items-start justify-between rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
              <div className="flex gap-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <ShoppingCart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
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

      {/* 데이터 보관 정책 */}
      {isAdmin && (
        <RetentionPolicySection />
      )}

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
        onSuccess={() => {
          // 임포트 완료 후 추가 처리 필요 시 여기서 수행
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────
// 데이터 보관 정책 섹션
// ────────────────────────────────────────

/** 보관 기간 선택 옵션 */
const RETENTION_OPTIONS = [
  { value: "0", label: "영구 보관" },
  { value: "1", label: "1개월" },
  { value: "3", label: "3개월" },
  { value: "6", label: "6개월" },
  { value: "12", label: "12개월 (1년)" },
  { value: "24", label: "24개월 (2년)" },
  { value: "36", label: "36개월 (3년)" },
  { value: "60", label: "60개월 (5년)" },
];

/** 각 항목별 설명 */
const RETENTION_FIELDS: Array<{
  key: keyof RetentionPolicySettings;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    key: "purchaseOrdersMonths",
    label: "발주서 (취소/완료)",
    description:
      "취소 또는 입고완료된 발주서를 보관합니다. 진행 중인 발주는 삭제되지 않습니다.",
    icon: "📦",
  },
  {
    key: "inboundRecordsMonths",
    label: "입고 기록",
    description:
      "입고 확인 이력입니다. 삭제해도 현재 재고 수량에는 영향 없습니다.",
    icon: "📥",
  },
  {
    key: "inventoryHistoryMonths",
    label: "재고 변동 이력",
    description:
      "입출고에 의한 재고 변동 기록입니다. 삭제 시 과거 이력 조회가 불가합니다.",
    icon: "📊",
  },
  {
    key: "salesRecordsMonths",
    label: "판매 기록",
    description:
      "일별 판매/출고 데이터입니다. 수요 예측의 기초 데이터이므로 충분한 기간 보관을 권장합니다.",
    icon: "💰",
  },
  {
    key: "demandForecastsMonths",
    label: "수요 예측",
    description:
      "과거 수요 예측 결과입니다. 예측 정확도 분석에 활용됩니다.",
    icon: "📈",
  },
  {
    key: "alertsMonths",
    label: "읽은 알림",
    description:
      "이미 읽은 알림만 삭제됩니다. 읽지 않은 알림은 보관 기간과 관계없이 유지됩니다.",
    icon: "🔔",
  },
  {
    key: "activityLogMonths",
    label: "활동 로그",
    description:
      "사용자 작업 기록(로그인, 데이터 변경 등)입니다.",
    icon: "📝",
  },
];

function RetentionPolicySection() {
  const { toast } = useToast();
  const [policy, setPolicy] = useState<RetentionPolicySettings>(DEFAULT_RETENTION_POLICY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<Record<string, number> | null>(null);
  const [cleanupResult, setCleanupResult] = useState<Record<string, number> | null>(null);
  const [cleanupConfirmText, setCleanupConfirmText] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // 초기 로드
  useEffect(() => {
    getRetentionPolicy()
      .then((p) => {
        setPolicy(p);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = useCallback((key: keyof RetentionPolicySettings, value: string) => {
    setPolicy((prev) => ({ ...prev, [key]: Number(value) }));
    setHasChanges(true);
    setPreviewCounts(null);
    setCleanupResult(null);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveRetentionPolicy(policy);
      if (result.success) {
        toast({ title: "저장 완료", description: result.message });
        setHasChanges(false);
      } else {
        toast({ title: "저장 실패", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "저장 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    setIsPreviewing(true);
    setPreviewCounts(null);
    try {
      const result = await previewDataCleanup();
      if (result.success && result.counts) {
        setPreviewCounts(result.counts);
      } else {
        toast({ title: "미리보기 실패", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "미리보기 중 오류 발생", variant: "destructive" });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCleanup = async () => {
    if (cleanupConfirmText !== "정리합니다") return;
    setIsCleaning(true);
    setCleanupResult(null);
    try {
      const result = await executeDataCleanup();
      if (result.success && result.deletedCounts) {
        setCleanupResult(result.deletedCounts);
        setCleanupConfirmText("");
        setPreviewCounts(null);
        toast({ title: "정리 완료", description: "보관 기간이 지난 데이터가 정리되었습니다." });
      } else {
        toast({ title: "정리 실패", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "정리 실행 중 오류 발생", variant: "destructive" });
    } finally {
      setIsCleaning(false);
    }
  };

  const totalPreview = previewCounts
    ? Object.values(previewCounts).reduce((sum, n) => sum + n, 0)
    : 0;

  const totalCleaned = cleanupResult
    ? Object.values(cleanupResult).reduce((sum, n) => sum + n, 0)
    : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">보관 정책 불러오는 중...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-600" />
          데이터 보관 정책
        </CardTitle>
        <CardDescription>
          각 데이터 유형별 보관 기간을 설정합니다. 보관 기간이 지난 데이터는 &quot;정리 실행&quot; 시 삭제됩니다.
          <br />
          <span className="text-xs text-muted-foreground">
            ※ &quot;영구 보관&quot;을 선택하면 해당 데이터는 자동 정리 대상에서 제외됩니다.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 보관 기간 설정 */}
        <div className="space-y-4">
          {RETENTION_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span>{field.icon}</span>
                  <Label className="font-medium">{field.label}</Label>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {field.description}
                </p>
              </div>
              <div className="shrink-0 w-full sm:w-[180px]">
                <Select
                  value={String(policy[field.key])}
                  onValueChange={(v) => handleChange(field.key, v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETENTION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>

        {/* 저장 버튼 */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            정책 저장
          </Button>
          {hasChanges && (
            <span className="text-xs text-amber-600">변경사항이 있습니다. 저장해주세요.</span>
          )}
        </div>

        <Separator />

        {/* 정리 실행 영역 */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            데이터 정리 실행
          </h4>
          <p className="text-sm text-muted-foreground">
            위에서 설정한 보관 기간을 기준으로 만료된 데이터를 삭제합니다.
            먼저 &quot;미리보기&quot;로 삭제 대상 건수를 확인한 후 실행하세요.
          </p>

          {/* 미리보기 버튼 */}
          <Button variant="outline" onClick={handlePreview} disabled={isPreviewing || hasChanges}>
            {isPreviewing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            삭제 대상 미리보기
          </Button>
          {hasChanges && (
            <p className="text-xs text-amber-600">
              정책을 먼저 저장해야 미리보기를 실행할 수 있습니다.
            </p>
          )}

          {/* 미리보기 결과 */}
          {previewCounts && (
            <Alert className="border-blue-200 bg-blue-50">
              <Eye className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <p className="font-medium mb-2">
                  삭제 대상: 총 {totalPreview.toLocaleString()}건
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {Object.entries(previewCounts).map(([name, count]) => (
                    <div key={name} className="flex justify-between">
                      <span>{name}</span>
                      <span className="font-mono tabular-nums">
                        {count.toLocaleString()}건
                      </span>
                    </div>
                  ))}
                </div>
                {totalPreview === 0 && (
                  <p className="text-sm mt-1">보관 기간 내 데이터만 존재합니다. 삭제할 항목이 없습니다.</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* 정리 실행 결과 */}
          {cleanupResult && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <p className="font-medium mb-2">
                  정리 완료: 총 {totalCleaned.toLocaleString()}건 삭제
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {Object.entries(cleanupResult)
                    .filter(([, count]) => count > 0)
                    .map(([name, count]) => (
                      <div key={name} className="flex justify-between">
                        <span>{name}</span>
                        <span className="font-mono tabular-nums">{count.toLocaleString()}건</span>
                      </div>
                    ))}
                </div>
                {totalCleaned === 0 && (
                  <p className="text-sm">삭제할 데이터가 없었습니다.</p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* 정리 실행 확인 */}
          {totalPreview > 0 && !cleanupResult && (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-red-800">
                <AlertTriangle className="h-4 w-4" />
                정리를 실행하면 위 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.
              </div>
              <div className="space-y-2">
                <Label htmlFor="cleanupConfirm" className="text-sm text-red-700">
                  아래에 &quot;정리합니다&quot;를 정확히 입력하세요
                </Label>
                <Input
                  id="cleanupConfirm"
                  placeholder="정리합니다"
                  value={cleanupConfirmText}
                  onChange={(e) => setCleanupConfirmText(e.target.value)}
                  disabled={isCleaning}
                  className="max-w-xs"
                />
              </div>
              <Button
                variant="destructive"
                disabled={cleanupConfirmText !== "정리합니다" || isCleaning}
                onClick={handleCleanup}
              >
                {isCleaning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    정리 처리 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    정리 실행
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
