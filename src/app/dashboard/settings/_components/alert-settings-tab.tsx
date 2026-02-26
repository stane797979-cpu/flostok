"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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
import {
  Bell,
  BellOff,
  Info,
  Loader2,
  RotateCcw,
  Save,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Package,
  PackageCheck,
  PackageX,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getAlertSettings,
  saveAlertSettings,
  resetAlertSettings,
} from "@/server/actions/alert-settings";
import type { AlertSettings } from "@/types/organization-settings";
import { DEFAULT_ALERT_SETTINGS } from "@/types/organization-settings";

// ============================================================
// 알림 유형 설명 데이터
// ============================================================

interface AlertTypeConfig {
  key: keyof Pick<
    AlertSettings,
    "stockCritical" | "stockShortage" | "stockExcess" | "orderDelay" | "demandSurge" | "demandDrop"
  >;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  severity: "critical" | "warning" | "info";
}

const ALERT_TYPE_CONFIGS: AlertTypeConfig[] = [
  {
    key: "stockCritical",
    label: "재고 위험 알림",
    description: "현재고가 안전재고의 50% 미만이거나 품절 상태일 때 알림을 발송합니다",
    icon: PackageX,
    severity: "critical",
  },
  {
    key: "stockShortage",
    label: "재고 부족 알림",
    description: "현재고가 안전재고 임계값 이하로 떨어졌을 때 알림을 발송합니다",
    icon: Package,
    severity: "warning",
  },
  {
    key: "stockExcess",
    label: "재고 과다 알림",
    description: "현재고가 안전재고의 3배 이상 쌓일 때 알림을 발송합니다",
    icon: PackageCheck,
    severity: "info",
  },
  {
    key: "orderDelay",
    label: "발주 지연 알림",
    description: "납기 예정일 N일 전에 아직 입고되지 않은 발주건에 대해 알림을 발송합니다",
    icon: ShoppingCart,
    severity: "warning",
  },
  {
    key: "demandSurge",
    label: "수요 급증 알림",
    description: "전월 대비 판매량이 기준치 이상 급증했을 때 알림을 발송합니다",
    icon: TrendingUp,
    severity: "warning",
  },
  {
    key: "demandDrop",
    label: "수요 급감 알림",
    description: "전월 대비 판매량이 기준치 이상 급감했을 때 알림을 발송합니다",
    icon: TrendingDown,
    severity: "info",
  },
];

const SEVERITY_STYLES = {
  critical: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30",
  warning: "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
  info: "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30",
};

const SEVERITY_ICON_STYLES = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
};

// ============================================================
// 메인 컴포넌트
// ============================================================

export function AlertSettingsTab() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [settings, setSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);

  // 설정 불러오기
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getAlertSettings();
        setSettings(data);
      } catch (error) {
        console.error("알림 설정 불러오기 실패:", error);
        toast({
          title: "오류",
          description: "알림 설정을 불러오는 중 오류가 발생했습니다",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [toast]);

  // Boolean 토글
  const handleToggle = (
    key: keyof Pick<
      AlertSettings,
      "stockCritical" | "stockShortage" | "stockExcess" | "orderDelay" | "demandSurge" | "demandDrop"
    >,
    value: boolean
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // 숫자 슬라이더 변경
  const handleSliderChange = (
    key: "stockThresholdPercent" | "orderDelayDays" | "demandChangePercent",
    value: number[]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value[0] }));
  };

  // 숫자 Input 직접 입력
  const handleInputChange = (
    key: "stockThresholdPercent" | "orderDelayDays" | "demandChangePercent",
    rawValue: string,
    min: number,
    max: number
  ) => {
    const parsed = parseInt(rawValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(Math.max(parsed, min), max);
      setSettings((prev) => ({ ...prev, [key]: clamped }));
    }
  };

  // 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await saveAlertSettings(settings);
      if (result.success) {
        toast({ title: "저장 완료", description: result.message });
      } else {
        toast({ title: "저장 실패", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      console.error("저장 실패:", error);
      toast({ title: "오류", description: "설정 저장 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // 초기화 확인 후 실행
  const handleResetConfirmed = async () => {
    setIsResetting(true);
    try {
      const result = await resetAlertSettings();
      if (result.success) {
        setSettings(DEFAULT_ALERT_SETTINGS);
        toast({ title: "초기화 완료", description: result.message });
      } else {
        toast({ title: "초기화 실패", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      console.error("초기화 실패:", error);
      toast({ title: "오류", description: "설정 초기화 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  // 활성화된 알림 수 계산
  const activeCount = [
    settings.stockCritical,
    settings.stockShortage,
    settings.stockExcess,
    settings.orderDelay,
    settings.demandSurge,
    settings.demandDrop,
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            알림 임계값 설정
          </CardTitle>
          <CardDescription>
            어떤 상황에서 알림을 받을지, 그리고 알림 발송 기준값을 설정합니다.
            현재 <span className="font-semibold text-foreground">{activeCount}개</span>의 알림 유형이 활성화되어 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              여기서 설정한 임계값은 시스템이 알림을 자동 생성할 때 기준으로 사용됩니다.
              알림 채널(이메일/SMS) 설정은 <strong>알림 테스트</strong> 탭에서 확인할 수 있습니다.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 알림 유형 ON/OFF */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">알림 유형별 활성화</CardTitle>
          <CardDescription>받고 싶은 알림 유형을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ALERT_TYPE_CONFIGS.map((config) => {
            const IconComponent = config.icon;
            const isEnabled = settings[config.key];
            return (
              <div
                key={config.key}
                className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                  isEnabled
                    ? SEVERITY_STYLES[config.severity]
                    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/30"
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${isEnabled ? SEVERITY_ICON_STYLES[config.severity] : "text-slate-400 dark:text-slate-500"}`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <Label
                      htmlFor={`toggle-${config.key}`}
                      className={`font-medium cursor-pointer ${
                        isEnabled ? "text-foreground" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {config.label}
                    </Label>
                    <Switch
                      id={`toggle-${config.key}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggle(config.key, checked)}
                    />
                  </div>
                  <p className={`mt-1 text-sm ${isEnabled ? "text-muted-foreground" : "text-slate-400 dark:text-slate-500"}`}>
                    {config.description}
                  </p>
                  {!isEnabled && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <BellOff className="h-3 w-3" />
                      <span>비활성화됨</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 임계값 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">임계값 세부 설정</CardTitle>
          <CardDescription>각 알림의 발송 기준이 되는 수치를 조정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* 재고 알림 기준 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-500" />
              <h3 className="font-medium text-sm">재고 알림 기준</h3>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">안전재고 대비 임계값</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    value={settings.stockThresholdPercent}
                    onChange={(e) =>
                      handleInputChange("stockThresholdPercent", e.target.value, 0, 200)
                    }
                    className="h-8 w-20 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                min={0}
                max={200}
                step={5}
                value={[settings.stockThresholdPercent]}
                onValueChange={(val) => handleSliderChange("stockThresholdPercent", val)}
                disabled={!settings.stockShortage && !settings.stockCritical && !settings.stockExcess}
                className="py-1"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>0% (항상 알림)</span>
                <span className="font-medium text-foreground">
                  현재: 안전재고의 {settings.stockThresholdPercent}% 이하 시 알림
                </span>
                <span>200%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                100% = 현재고가 안전재고 이하가 되면 알림 · 50% = 안전재고 절반 이하일 때만 알림
              </p>
            </div>
          </div>

          <Separator />

          {/* 납기 알림 기준 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h3 className="font-medium text-sm">납기 알림 기준</h3>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">납기 예정일 기준</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={14}
                    value={settings.orderDelayDays}
                    onChange={(e) =>
                      handleInputChange("orderDelayDays", e.target.value, 1, 14)
                    }
                    className="h-8 w-20 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">일 전</span>
                </div>
              </div>
              <Slider
                min={1}
                max={14}
                step={1}
                value={[settings.orderDelayDays]}
                onValueChange={(val) => handleSliderChange("orderDelayDays", val)}
                disabled={!settings.orderDelay}
                className="py-1"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>1일 전</span>
                <span className="font-medium text-foreground">
                  현재: 납기 {settings.orderDelayDays}일 전 미입고 시 알림
                </span>
                <span>14일 전</span>
              </div>
              <p className="text-xs text-muted-foreground">
                납기 예정일 N일 전에도 입고 처리되지 않은 발주건에 대해 알림을 발송합니다
              </p>
            </div>
          </div>

          <Separator />

          {/* 수요 변동 기준 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-slate-500" />
              <h3 className="font-medium text-sm">수요 변동 기준</h3>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">전월 대비 변동 기준</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10}
                    max={100}
                    value={settings.demandChangePercent}
                    onChange={(e) =>
                      handleInputChange("demandChangePercent", e.target.value, 10, 100)
                    }
                    className="h-8 w-20 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <Slider
                min={10}
                max={100}
                step={5}
                value={[settings.demandChangePercent]}
                onValueChange={(val) => handleSliderChange("demandChangePercent", val)}
                disabled={!settings.demandSurge && !settings.demandDrop}
                className="py-1"
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>10% (민감)</span>
                <span className="font-medium text-foreground">
                  현재: 전월 대비 ±{settings.demandChangePercent}% 초과 시 알림
                </span>
                <span>100% (둔감)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                전월 동기 대비 판매량이 이 수치 이상 급증하거나 급감했을 때 알림을 발송합니다
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => setResetConfirmOpen(true)}
          disabled={isResetting || isSaving}
        >
          {isResetting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              초기화 중...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              기본값으로 초기화
            </>
          )}
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isResetting}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              저장
            </>
          )}
        </Button>
      </div>

      {/* 초기화 확인 다이얼로그 */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>알림 설정 초기화</AlertDialogTitle>
            <AlertDialogDescription>
              알림 설정을 기본값으로 초기화하시겠습니까?
              현재 설정된 모든 임계값과 활성화 상태가 기본값으로 변경됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfirmed}>
              초기화
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
