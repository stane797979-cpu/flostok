'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticCategory } from '@/server/services/scm/diagnostic-engine';

const CATEGORY_LABELS: Record<DiagnosticCategory, { label: string; short: string }> = {
  inventory: { label: '재고현황', short: '재고' },
  logistics: { label: '물류비용', short: '물류' },
  order: { label: '발주현황', short: '발주' },
};

interface DiagnosticStepIndicatorProps {
  /** 선택한 카테고리 순서 */
  selectedCategories: DiagnosticCategory[];
  /** 현재 스텝 (0=카테고리 선택, 1~N=질문, 마지막=결과) */
  currentStep: number;
}

export function DiagnosticStepIndicator({
  selectedCategories,
  currentStep,
}: DiagnosticStepIndicatorProps) {
  // 동적 스텝 구성: [카테고리선택, ...선택된 카테고리들]
  const steps = [
    { label: '영역 선택', short: '선택' },
    ...selectedCategories.map((c) => CATEGORY_LABELS[c]),
  ];

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={`${step.short}-${index}`} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent &&
                    'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  !isCompleted && !isCurrent && 'bg-slate-100 text-slate-400'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  'mt-1 text-[10px] leading-tight sm:text-xs',
                  isCurrent ? 'font-medium text-primary' : 'text-muted-foreground'
                )}
              >
                {step.short}
              </span>
            </div>

            {/* 연결선 */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 w-4 sm:w-8',
                  index < currentStep ? 'bg-primary' : 'bg-slate-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
