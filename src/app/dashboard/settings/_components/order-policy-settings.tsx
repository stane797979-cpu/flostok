"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RotateCcw, Save, Info } from "lucide-react";
import {
  getOrderPolicySettings,
  updateOrderPolicySettings,
  resetOrderPolicySettings,
} from "@/server/actions/organization-settings";
import type { OrderPolicySettings, SupplyAdjustmentCoefficients } from "@/types/organization-settings";
import { DEFAULT_ORDER_POLICY, DEFAULT_SUPPLY_COEFFICIENTS } from "@/types/organization-settings";
import { useToast } from "@/hooks/use-toast";

interface OrderPolicySettingsProps {
  organizationId: string;
}

export function OrderPolicySettingsComponent({ organizationId }: OrderPolicySettingsProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [settings, setSettings] = useState<OrderPolicySettings>(DEFAULT_ORDER_POLICY);
  const [errors, setErrors] = useState<Partial<Record<keyof OrderPolicySettings, string>>>({});

  // 설정 불러오기
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getOrderPolicySettings(organizationId);
        setSettings(data);
      } catch (error) {
        console.error("설정 불러오기 실패:", error);
        toast({
          title: "오류",
          description: "설정을 불러오는 중 오류가 발생했습니다",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, [organizationId, toast]);

  // 필드 업데이트
  const handleChange = (field: keyof OrderPolicySettings, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setSettings((prev) => ({
        ...prev,
        [field]: numValue,
      }));
      // 에러 초기화
      setErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  // 유효성 검증
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof OrderPolicySettings, string>> = {};

    if (settings.serviceLevel < 90 || settings.serviceLevel > 99.9) {
      newErrors.serviceLevel = "서비스 레벨은 90~99.9% 사이여야 합니다";
    }

    if (settings.safetyStockMultiplier < 0.1 || settings.safetyStockMultiplier > 2) {
      newErrors.safetyStockMultiplier = "안전재고 배수는 0.1~2.0 사이여야 합니다";
    }

    if (settings.autoReorderThreshold < 50 || settings.autoReorderThreshold > 150) {
      newErrors.autoReorderThreshold = "자동 발주 임계값은 50~150% 사이여야 합니다";
    }

    if (settings.targetDaysOfInventory < 7 || settings.targetDaysOfInventory > 90) {
      newErrors.targetDaysOfInventory = "목표 재고일수는 7~90일 사이여야 합니다";
    }

    if (settings.defaultLeadTimeDays < 1 || settings.defaultLeadTimeDays > 60) {
      newErrors.defaultLeadTimeDays = "기본 리드타임은 1~60일 사이여야 합니다";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 저장
  const handleSave = async () => {
    if (!validate()) {
      toast({
        title: "입력 오류",
        description: "입력값을 확인해주세요",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateOrderPolicySettings(organizationId, settings);

      if (result.success) {
        toast({
          title: "저장 완료",
          description: result.message,
        });
      } else {
        toast({
          title: "저장 실패",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("저장 실패:", error);
      toast({
        title: "오류",
        description: "설정 저장 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 초기화
  const handleReset = async () => {
    if (!confirm("발주 정책을 기본값으로 초기화하시겠습니까?")) {
      return;
    }

    setIsResetting(true);
    try {
      const result = await resetOrderPolicySettings(organizationId);

      if (result.success) {
        setSettings(DEFAULT_ORDER_POLICY);
        setErrors({});
        toast({
          title: "초기화 완료",
          description: result.message,
        });
      } else {
        toast({
          title: "초기화 실패",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("초기화 실패:", error);
      toast({
        title: "오류",
        description: "설정 초기화 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };

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
      <Card>
        <CardHeader>
          <CardTitle>발주 정책 설정</CardTitle>
          <CardDescription>
            재고 관리 및 자동 발주 기준을 설정합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 안내 메시지 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              이 설정은 안전재고, 발주점 계산 및 자동 발주 추천에 영향을 미칩니다.
              변경 시 기존 데이터가 재계산됩니다.
            </AlertDescription>
          </Alert>

          {/* 서비스 레벨 */}
          <div className="space-y-2">
            <Label htmlFor="serviceLevel">
              서비스 레벨 (%)
              <span className="ml-2 text-xs text-slate-500">
                권장: 95~98%
              </span>
            </Label>
            <Input
              id="serviceLevel"
              type="number"
              min="90"
              max="99.9"
              step="0.1"
              value={settings.serviceLevel}
              onChange={(e) => handleChange("serviceLevel", e.target.value)}
              className={errors.serviceLevel ? "border-red-500" : ""}
            />
            {errors.serviceLevel && (
              <p className="text-sm text-red-500">{errors.serviceLevel}</p>
            )}
            <p className="text-sm text-slate-500">
              재고 부족 확률을 낮추는 수준. 높을수록 안전재고가 증가합니다.
            </p>
          </div>

          {/* 안전재고 배수 */}
          <div className="space-y-2">
            <Label htmlFor="safetyStockMultiplier">
              안전재고 배수
              <span className="ml-2 text-xs text-slate-500">
                권장: 0.3~0.7
              </span>
            </Label>
            <Input
              id="safetyStockMultiplier"
              type="number"
              min="0.1"
              max="2.0"
              step="0.1"
              value={settings.safetyStockMultiplier}
              onChange={(e) => handleChange("safetyStockMultiplier", e.target.value)}
              className={errors.safetyStockMultiplier ? "border-red-500" : ""}
            />
            {errors.safetyStockMultiplier && (
              <p className="text-sm text-red-500">{errors.safetyStockMultiplier}</p>
            )}
            <p className="text-sm text-slate-500">
              리드타임 수요의 몇 배를 안전재고로 유지할지 설정합니다.
            </p>
          </div>

          {/* 자동 발주 임계값 */}
          <div className="space-y-2">
            <Label htmlFor="autoReorderThreshold">
              자동 발주 임계값 (%)
              <span className="ml-2 text-xs text-slate-500">
                권장: 100% (발주점 도달 시)
              </span>
            </Label>
            <Input
              id="autoReorderThreshold"
              type="number"
              min="50"
              max="150"
              step="1"
              value={settings.autoReorderThreshold}
              onChange={(e) => handleChange("autoReorderThreshold", e.target.value)}
              className={errors.autoReorderThreshold ? "border-red-500" : ""}
            />
            {errors.autoReorderThreshold && (
              <p className="text-sm text-red-500">{errors.autoReorderThreshold}</p>
            )}
            <p className="text-sm text-slate-500">
              발주점 대비 현재고 비율. 100% = 발주점 도달 시, 120% = 발주점의 120% 도달 시 자동 발주.
            </p>
          </div>

          {/* 목표 재고일수 */}
          <div className="space-y-2">
            <Label htmlFor="targetDaysOfInventory">
              목표 재고일수 (일)
              <span className="ml-2 text-xs text-slate-500">
                권장: 30~45일
              </span>
            </Label>
            <Input
              id="targetDaysOfInventory"
              type="number"
              min="7"
              max="90"
              step="1"
              value={settings.targetDaysOfInventory}
              onChange={(e) => handleChange("targetDaysOfInventory", e.target.value)}
              className={errors.targetDaysOfInventory ? "border-red-500" : ""}
            />
            {errors.targetDaysOfInventory && (
              <p className="text-sm text-red-500">{errors.targetDaysOfInventory}</p>
            )}
            <p className="text-sm text-slate-500">
              발주 시 몇 일치 재고를 확보할지 설정합니다.
            </p>
          </div>

          {/* 기본 리드타임 */}
          <div className="space-y-2">
            <Label htmlFor="defaultLeadTimeDays">
              기본 리드타임 (일)
              <span className="ml-2 text-xs text-slate-500">
                권장: 5~10일
              </span>
            </Label>
            <Input
              id="defaultLeadTimeDays"
              type="number"
              min="1"
              max="60"
              step="1"
              value={settings.defaultLeadTimeDays}
              onChange={(e) => handleChange("defaultLeadTimeDays", e.target.value)}
              className={errors.defaultLeadTimeDays ? "border-red-500" : ""}
            />
            {errors.defaultLeadTimeDays && (
              <p className="text-sm text-red-500">{errors.defaultLeadTimeDays}</p>
            )}
            <p className="text-sm text-slate-500">
              제품별 리드타임 미설정 시 사용되는 기본값입니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ABC-XYZ 공급물량 보정계수 */}
      <Card>
        <CardHeader>
          <CardTitle>공급물량 보정계수</CardTitle>
          <CardDescription>
            ABC-XYZ 등급 조합별 적정재고 보정 비율을 설정합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              1.0 = 보정 없음, 0.65 = 35% 축소. ABC(매출기여도) × XYZ(수요변동성) 조합에 따라
              발주 추천 수량이 보정됩니다. 값 범위: 0.5 ~ 1.5
            </AlertDescription>
          </Alert>

          {/* 3×3 매트릭스 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium text-slate-600">
                    ABC \ XYZ
                  </th>
                  <th className="border border-slate-200 bg-green-50 px-3 py-2 text-center font-medium text-green-700">
                    X (안정)
                  </th>
                  <th className="border border-slate-200 bg-yellow-50 px-3 py-2 text-center font-medium text-yellow-700">
                    Y (보통)
                  </th>
                  <th className="border border-slate-200 bg-red-50 px-3 py-2 text-center font-medium text-red-700">
                    Z (불안정)
                  </th>
                </tr>
              </thead>
              <tbody>
                {(["A", "B", "C"] as const).map((abc) => (
                  <tr key={abc}>
                    <td className="border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-600">
                      {abc} ({abc === "A" ? "매출 高" : abc === "B" ? "매출 中" : "매출 低"})
                    </td>
                    {(["X", "Y", "Z"] as const).map((xyz) => {
                      const key = `${abc}${xyz}` as keyof SupplyAdjustmentCoefficients;
                      const coefficients = settings.supplyCoefficients || DEFAULT_SUPPLY_COEFFICIENTS;
                      return (
                        <td key={xyz} className="border border-slate-200 px-2 py-1">
                          <Input
                            type="number"
                            min="0.5"
                            max="1.5"
                            step="0.05"
                            value={coefficients[key]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val >= 0.5 && val <= 1.5) {
                                setSettings((prev) => ({
                                  ...prev,
                                  supplyCoefficients: {
                                    ...(prev.supplyCoefficients || DEFAULT_SUPPLY_COEFFICIENTS),
                                    [key]: val,
                                  },
                                }));
                              }
                            }}
                            className="h-8 text-center text-sm"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                supplyCoefficients: { ...DEFAULT_SUPPLY_COEFFICIENTS },
              }))
            }
            className="text-xs text-slate-500"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            보정계수 기본값 복원
          </Button>
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleReset}
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
    </div>
  );
}
