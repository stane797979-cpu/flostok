'use client';

import {
  Bell,
  Clock,
  Eye,
  ShoppingCart,
  Zap,
} from 'lucide-react';
import { OptionCard } from '@/app/dashboard/forecast-guide/_components/option-card';
import type { OrderAnswers } from '@/server/services/scm/diagnostic-engine';

interface StepOrderDiagnosisProps {
  answers: Partial<OrderAnswers>;
  onChange: (answers: Partial<OrderAnswers>) => void;
}

export function StepOrderDiagnosis({ answers, onChange }: StepOrderDiagnosisProps) {
  const set = <K extends keyof OrderAnswers>(key: K, value: OrderAnswers[K]) => {
    onChange({ ...answers, [key]: value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">발주현황 진단</h2>
        <p className="mt-1 text-sm text-muted-foreground">총 4문항입니다. 해당되는 항목을 선택해 주세요.</p>
      </div>

      {/* Q1 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q1. 공급업체가 약속한 납기를 얼마나 지키나요?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'over95' as const, title: '거의 항상 (95%+)', description: '공급업체 납기 신뢰도 매우 높음' },
            { value: '80to95' as const, title: '대부분 (80~95%)', description: '간헐적인 납기 지연 발생' },
            { value: '50to80' as const, title: '절반 정도', description: '잦은 납기 지연으로 계획 차질' },
            { value: 'often_late' as const, title: '자주 늦어요', description: '납기 준수를 기대하기 어려운 수준' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Clock}
              title={option.title}
              description={option.description}
              selected={answers.leadTimeCompliance === option.value}
              onClick={() => set('leadTimeCompliance', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q2 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q2. 긴급발주가 얼마나 자주 발생하나요?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'rarely' as const, title: '거의 없어요', description: '계획적 발주가 잘 이루어짐' },
            { value: 'monthly' as const, title: '월 1~2회', description: '가끔 긴급 상황 발생' },
            { value: 'weekly' as const, title: '주 1회 이상', description: '긴급발주가 일상화된 상태' },
            { value: 'always' as const, title: '거의 항상', description: '발주 계획 없이 사후 대응 위주' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Zap}
              title={option.title}
              description={option.description}
              selected={answers.urgentOrderFreq === option.value}
              onClick={() => set('urgentOrderFreq', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q3 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q3. 공급업체별 리드타임을 정확히 알고 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'exact' as const,
              title: '정확히 알고 있어요 (시스템에 등록됨)',
              description: '공급업체별 리드타임이 시스템에 기록되어 발주 계획에 활용',
            },
            {
              value: 'approximate' as const,
              title: '대략은 알고 있어요',
              description: '경험적으로 파악하고 있으나 정확한 수치는 불명확',
            },
            {
              value: 'unknown' as const,
              title: '잘 모르겠어요',
              description: '리드타임을 별도로 관리하지 않음',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Eye}
              title={option.title}
              description={option.description}
              selected={answers.leadTimeAwareness === option.value}
              onClick={() => set('leadTimeAwareness', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q4 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q4. 발주 시점을 어떻게 파악하나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'system' as const,
              icon: Bell,
              title: '시스템 알림/자동 발주점 도달 시',
              description: '발주점 기반 자동화로 적시 발주',
            },
            {
              value: 'manual' as const,
              icon: Eye,
              title: '재고 수량 보고 직접 판단',
              description: '담당자가 재고를 확인하고 수동으로 발주',
            },
            {
              value: 'reactive' as const,
              icon: ShoppingCart,
              title: '재고가 바닥나면 그때서야',
              description: '품절 후 긴급 발주하는 사후 대응 방식',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.orderTrigger === option.value}
              onClick={() => set('orderTrigger', option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
