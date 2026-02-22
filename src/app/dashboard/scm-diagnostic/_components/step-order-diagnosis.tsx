'use client';

import {
  BarChart3,
  Bell,
  ClipboardCheck,
  Clock,
  Eye,
  HelpCircle,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
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
        <p className="mt-1 text-sm text-muted-foreground">총 9문항입니다. 해당되는 항목을 선택해 주세요.</p>
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

      {/* Q5 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q5. 발주 프로세스가 표준화(SOP)되어 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'documented' as const,
              icon: ClipboardCheck,
              title: '문서화된 SOP가 있어요',
              description: '발주 절차가 매뉴얼로 문서화되어 누구나 동일하게 수행',
            },
            {
              value: 'informal' as const,
              icon: Eye,
              title: '암묵적으로 정해져 있어요',
              description: '담당자끼리 구두로 공유하는 비공식 절차',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '정해진 절차가 없어요',
              description: '담당자마다 발주 방식이 다름',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.orderSop === option.value}
              onClick={() => set('orderSop', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q6 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q6. 최소주문수량(MOQ)에 어떻게 대응하나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'optimized' as const,
              icon: Package,
              title: '수요에 맞춰 최적화',
              description: 'MOQ와 실제 수요를 비교하여 최적 수량으로 발주',
            },
            {
              value: 'sometimes_over' as const,
              icon: Package,
              title: 'MOQ 때문에 과다 발주하기도 해요',
              description: '수요보다 많지만 MOQ 맞추기 위해 어쩔 수 없이 발주',
            },
            {
              value: 'not_applicable' as const,
              icon: HelpCircle,
              title: 'MOQ가 없거나 해당 없어요',
              description: 'MOQ 제약이 없는 공급 구조',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.moqHandling === option.value}
              onClick={() => set('moqHandling', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q7 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q7. 공급자 평가/관리 체계가 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'formal' as const,
              icon: ShieldCheck,
              title: '정기적으로 평가해요',
              description: '납기·품질·가격 등 기준으로 체계적 평가',
            },
            {
              value: 'informal' as const,
              icon: Users,
              title: '비공식적으로 관리해요',
              description: '문제 발생 시 구두 피드백 수준',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '평가 체계가 없어요',
              description: '공급자 성과를 별도로 관리하지 않음',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.supplierEvaluation === option.value}
              onClick={() => set('supplierEvaluation', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q8 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q8. 발주 데이터(이력)를 분석하여 업무에 활용하나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'active' as const,
              icon: BarChart3,
              title: '적극 활용 중',
              description: '발주 이력 분석으로 발주량·시기를 최적화',
            },
            {
              value: 'partial' as const,
              icon: BarChart3,
              title: '부분적으로 활용',
              description: '데이터를 보기는 하지만 체계적 분석은 미흡',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '활용하지 않아요',
              description: '발주 이력을 분석하거나 참고하지 않음',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.orderDataAnalysis === option.value}
              onClick={() => set('orderDataAnalysis', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q9 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q9. 주요 품목의 대체 공급자를 확보하고 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'prepared' as const,
              icon: ShieldCheck,
              title: '주요 품목 모두 확보',
              description: '핵심 품목별 대체 공급자가 준비되어 있음',
            },
            {
              value: 'some' as const,
              icon: Users,
              title: '일부 품목만 확보',
              description: '몇몇 품목은 대체 공급자가 있지만 전체는 아님',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '대체 공급자가 없어요',
              description: '모든 품목이 단일 공급자에 의존',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.backupSupplier === option.value}
              onClick={() => set('backupSupplier', option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
