'use client';

import {
  AlertTriangle,
  Brain,
  Calculator,
  ClipboardCheck,
  HelpCircle,
  Package,
} from 'lucide-react';
import { OptionCard } from '@/app/dashboard/forecast-guide/_components/option-card';
import type { InventoryAnswers } from '@/server/services/scm/diagnostic-engine';

interface StepInventoryDiagnosisProps {
  answers: Partial<InventoryAnswers>;
  onChange: (answers: Partial<InventoryAnswers>) => void;
}

export function StepInventoryDiagnosis({ answers, onChange }: StepInventoryDiagnosisProps) {
  const set = <K extends keyof InventoryAnswers>(key: K, value: InventoryAnswers[K]) => {
    onChange({ ...answers, [key]: value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">재고현황 진단</h2>
        <p className="mt-1 text-sm text-muted-foreground">총 4문항입니다. 해당되는 항목을 선택해 주세요.</p>
      </div>

      {/* Q1 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q1. 품절/재고부족이 얼마나 자주 발생하나요?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'rarely' as const, title: '거의 없어요', description: '월 1회 미만' },
            { value: 'monthly' as const, title: '가끔 발생해요', description: '월 1~3회' },
            { value: 'weekly' as const, title: '자주 발생해요', description: '주 1~2회' },
            { value: 'always' as const, title: '항상 발생해요', description: '거의 매일' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={AlertTriangle}
              title={option.title}
              description={option.description}
              selected={answers.stockoutFrequency === option.value}
              onClick={() => set('stockoutFrequency', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q2 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q2. 과잉재고(안 팔리는데 쌓여있는) 제품 비율은?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'under10' as const, title: '10% 미만', description: '재고 대부분이 잘 순환됨' },
            { value: '10to30' as const, title: '10~30%', description: '일부 제품 과잉 보유' },
            { value: '30to50' as const, title: '30~50%', description: '상당수 제품이 과잉 상태' },
            { value: 'over50' as const, title: '50% 이상', description: '절반 이상이 재고 고착' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Package}
              title={option.title}
              description={option.description}
              selected={answers.excessRatio === option.value}
              onClick={() => set('excessRatio', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q3 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q3. 재고 실사를 얼마나 자주 하나요?
        </h3>
        <div className="grid gap-2">
          {[
            { value: 'monthly' as const, title: '월 1회 이상', description: '정기적으로 재고 정확도를 유지함' },
            { value: 'quarterly' as const, title: '분기에 한 번', description: '3개월마다 실사 진행' },
            { value: 'biannual' as const, title: '반기에 한 번', description: '6개월마다 실사 진행' },
            { value: 'rarely' as const, title: '거의 안 해요', description: '실사 주기가 불규칙하거나 없음' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={ClipboardCheck}
              title={option.title}
              description={option.description}
              selected={answers.auditFrequency === option.value}
              onClick={() => set('auditFrequency', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q4 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q4. 안전재고는 어떻게 설정되어 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'data' as const,
              icon: Calculator,
              title: '판매 데이터·리드타임 기반으로 계산',
              description: '수요변동성과 조달 기간을 반영한 과학적 설정',
            },
            {
              value: 'experience' as const,
              icon: Brain,
              title: '담당자 경험과 감으로',
              description: '오랜 경험을 바탕으로 주관적 판단',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '딱히 설정된 게 없어요',
              description: '안전재고 개념 없이 운영 중',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.safetyStockMethod === option.value}
              onClick={() => set('safetyStockMethod', option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
