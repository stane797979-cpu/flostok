"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveKPITargets } from "@/server/actions/kpi";
import { DEFAULT_KPI_TARGETS } from "@/server/services/scm/kpi-improvement";
import type { KPITarget } from "@/server/services/scm/kpi-improvement";
import { Loader2 } from "lucide-react";

interface KpiTargetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTargets: KPITarget;
  onSaved: (targets: KPITarget) => void;
}

interface FieldConfig {
  key: keyof KPITarget;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  description: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: "inventoryTurnoverRate",
    label: "재고회전율",
    unit: "회/년",
    min: 1,
    max: 100,
    step: 0.5,
    description: "연간 재고가 순환되는 횟수. 높을수록 좋음",
  },
  {
    key: "averageInventoryDays",
    label: "평균 재고일수",
    unit: "일",
    min: 1,
    max: 365,
    step: 1,
    description: "재고가 창고에 머무는 평균 일수. 낮을수록 좋음",
  },
  {
    key: "inventoryAccuracy",
    label: "재고 정확도",
    unit: "%",
    min: 50,
    max: 100,
    step: 0.5,
    description: "실물재고와 시스템 재고의 일치율. 높을수록 좋음",
  },
  {
    key: "stockoutRate",
    label: "품절률",
    unit: "%",
    min: 0,
    max: 50,
    step: 0.5,
    description: "품절 상태인 SKU의 비율. 낮을수록 좋음",
  },
  {
    key: "onTimeOrderRate",
    label: "적시 발주율",
    unit: "%",
    min: 50,
    max: 100,
    step: 1,
    description: "납기일을 준수한 발주의 비율. 높을수록 좋음",
  },
  {
    key: "averageLeadTime",
    label: "평균 리드타임",
    unit: "일",
    min: 1,
    max: 60,
    step: 0.5,
    description: "발주 후 입고까지 걸리는 평균 일수. 낮을수록 좋음",
  },
  {
    key: "orderFulfillmentRate",
    label: "발주 충족률",
    unit: "%",
    min: 50,
    max: 100,
    step: 1,
    description: "발주 수량 대비 실제 입고된 수량의 비율. 높을수록 좋음",
  },
];

export function KpiTargetDialog({
  open,
  onOpenChange,
  currentTargets,
  onSaved,
}: KpiTargetDialogProps) {
  const [values, setValues] = useState<KPITarget>(currentTargets);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Dialog가 열릴 때 현재 값으로 초기화
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setValues(currentTargets);
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleChange = (key: keyof KPITarget, raw: string) => {
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      setValues((prev) => ({ ...prev, [key]: num }));
    }
  };

  const handleReset = () => {
    setValues(DEFAULT_KPI_TARGETS);
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveKPITargets(values);
      if (result.success) {
        onSaved(values);
        onOpenChange(false);
      } else {
        setError(result.error ?? "저장에 실패했습니다.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>KPI 목표값 설정</DialogTitle>
          <DialogDescription>
            조직의 KPI 목표값을 설정합니다. 달성률 계산 및 개선 제안에 사용됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {FIELD_CONFIGS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={`target-${field.key}`} className="text-sm font-medium">
                  {field.label}
                  <span className="ml-1 text-xs text-slate-500">({field.unit})</span>
                </Label>
                <span className="text-xs text-slate-400">{field.description}</span>
              </div>
              <Input
                id={`target-${field.key}`}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="h-9"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isPending}
            className="text-slate-500"
          >
            기본값으로 초기화
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              취소
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              저장
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
