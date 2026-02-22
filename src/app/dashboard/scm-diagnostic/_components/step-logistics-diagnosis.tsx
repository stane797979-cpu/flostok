'use client';

import {
  AlertCircle,
  Building2,
  RefreshCw,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { OptionCard } from '@/app/dashboard/forecast-guide/_components/option-card';
import type { LogisticsAnswers } from '@/server/services/scm/diagnostic-engine';

interface StepLogisticsDiagnosisProps {
  answers: Partial<LogisticsAnswers>;
  onChange: (answers: Partial<LogisticsAnswers>) => void;
}

export function StepLogisticsDiagnosis({ answers, onChange }: StepLogisticsDiagnosisProps) {
  const set = <K extends keyof LogisticsAnswers>(key: K, value: LogisticsAnswers[K]) => {
    onChange({ ...answers, [key]: value });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">물류비용 진단</h2>
        <p className="mt-1 text-sm text-muted-foreground">총 5문항입니다. 해당되는 항목을 선택해 주세요.</p>
      </div>

      {/* Q1 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q1. 매출 대비 물류비(배송+보관+처리비) 비율은?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'under5' as const, title: '5% 미만', description: '업계 최우수 수준' },
            { value: '5to10' as const, title: '5~10%', description: '업계 평균 수준' },
            { value: '10to15' as const, title: '10~15%', description: '개선 여지 있음' },
            { value: 'over15' as const, title: '15% 초과', description: '즉각적인 원가 절감 필요' },
            { value: 'unknown' as const, title: '잘 모르겠어요', description: '물류비를 별도로 집계하지 않음' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={TrendingUp}
              title={option.title}
              description={option.description}
              selected={answers.logisticsRatio === option.value}
              onClick={() => set('logisticsRatio', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q2 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q2. 반품·교환 발생 비율은?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'under2' as const, title: '2% 미만', description: '매우 낮은 반품률' },
            { value: '2to5' as const, title: '2~5%', description: '업계 평균 수준' },
            { value: '5to10' as const, title: '5~10%', description: '반품 원인 분석 필요' },
            { value: 'over10' as const, title: '10% 이상', description: '심각한 품질/배송 문제' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={RefreshCw}
              title={option.title}
              description={option.description}
              selected={answers.returnRate === option.value}
              onClick={() => set('returnRate', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q3 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q3. 약속한 배송 기한을 얼마나 지키나요?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'over95' as const, title: '95% 이상', description: '매우 높은 납기 준수율' },
            { value: '80to95' as const, title: '80~95%', description: '양호한 수준' },
            { value: '50to80' as const, title: '50~80%', description: '개선이 필요한 수준' },
            { value: 'under50' as const, title: '50% 미만', description: '납기 관리 체계 재정비 필요' },
            { value: 'unknown' as const, title: '측정하지 않아요', description: '배송 기한 준수율을 추적하지 않음' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Truck}
              title={option.title}
              description={option.description}
              selected={answers.deliveryOnTime === option.value}
              onClick={() => set('deliveryOnTime', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q4 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q4. 주문 처리 오류(오배송, 수량 착오 등) 빈도는?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'rarely' as const, title: '거의 없어요', description: '월 1회 미만' },
            { value: 'monthly' as const, title: '월 1~5회', description: '가끔 오류 발생' },
            { value: 'weekly' as const, title: '주 1~2회', description: '잦은 오류로 업무 지장' },
            { value: 'daily' as const, title: '거의 매일', description: '오류가 일상화된 상태' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={AlertCircle}
              title={option.title}
              description={option.description}
              selected={answers.orderErrorFreq === option.value}
              onClick={() => set('orderErrorFreq', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q5 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q5. 공급업체를 몇 곳 운용하나요?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'one' as const, title: '1곳', description: '단일 공급업체 의존' },
            { value: 'two_three' as const, title: '2~3곳', description: '소수 공급업체 운용' },
            { value: 'four_five' as const, title: '4~5곳', description: '분산된 공급망' },
            { value: 'over_six' as const, title: '6곳 이상', description: '다수 공급업체 관리' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Building2}
              title={option.title}
              description={option.description}
              selected={answers.supplierCount === option.value}
              onClick={() => set('supplierCount', option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
