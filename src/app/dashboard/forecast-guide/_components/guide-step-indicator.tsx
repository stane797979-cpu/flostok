'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = [
  { label: '제품', short: '제품' },
  { label: '판매 패턴', short: '패턴' },
  { label: '판매 추세', short: '추세' },
  { label: '매출 비중', short: '비중' },
  { label: '데이터/재고', short: '상황' },
];

interface GuideStepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export function GuideStepIndicator({ currentStep }: GuideStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div key={step.label} className="flex items-center">
            {/* 단계 원형 */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
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
            {index < STEPS.length - 1 && (
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
