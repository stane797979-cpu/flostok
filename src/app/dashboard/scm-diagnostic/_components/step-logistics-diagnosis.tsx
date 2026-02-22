'use client';

import {
  AlertCircle,
  BarChart3,
  Building2,
  ClipboardCheck,
  Database,
  HelpCircle,
  Package,
  RefreshCw,
  Settings,
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
        <p className="mt-1 text-sm text-muted-foreground">총 10문항입니다. 해당되는 항목을 선택해 주세요.</p>
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

      {/* Q6 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q6. 물류 운영 방식은?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'hybrid' as const, title: '자체 + 3PL 혼합', description: '자체물류와 외부 위탁을 병행' },
            { value: 'thirdParty' as const, title: '3PL(외부 위탁)', description: '전문 물류업체에 전면 위탁' },
            { value: 'inHouse' as const, title: '전량 자체 운영', description: '자사 창고·차량으로 직접 운영' },
            { value: 'ad_hoc' as const, title: '그때그때 다르게', description: '일관된 체계 없이 상황별 대응' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Truck}
              title={option.title}
              description={option.description}
              selected={answers.operationMode === option.value}
              onClick={() => set('operationMode', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q7 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q7. 물류비를 어떻게 모니터링하나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'monthly_analysis' as const,
              icon: BarChart3,
              title: '항목별 월간 분석',
              description: '운송비·보관비·처리비 등 항목별로 정기 분석',
            },
            {
              value: 'total_only' as const,
              icon: TrendingUp,
              title: '총액만 파악',
              description: '물류비 총액은 알지만 세부 항목은 미분류',
            },
            {
              value: 'rarely' as const,
              icon: HelpCircle,
              title: '거의 분석하지 않아요',
              description: '물류비를 별도로 집계·분석하지 않음',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.costMonitoring === option.value}
              onClick={() => set('costMonitoring', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q8 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q8. 배송 클레임(파손, 오배송 등) 처리 체계는?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'systematic' as const, title: '체계적 대응', description: '원인 분석 + 재발 방지 체계 운영' },
            { value: 'case_by_case' as const, title: '건별 대응', description: '발생 시 개별적으로 처리' },
            { value: 'reactive' as const, title: '사후 대응', description: '고객 불만 접수 후에야 처리' },
            { value: 'ignored' as const, title: '별도 체계 없음', description: '클레임 관리 프로세스가 없음' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={AlertCircle}
              title={option.title}
              description={option.description}
              selected={answers.claimHandling === option.value}
              onClick={() => set('claimHandling', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q9 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q9. 피킹/패킹 프로세스가 표준화되어 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'standardized' as const,
              icon: ClipboardCheck,
              title: '표준화됨',
              description: '작업 매뉴얼·체크리스트 기반 일관된 출고 프로세스',
            },
            {
              value: 'partial' as const,
              icon: Settings,
              title: '부분 표준화',
              description: '일부 프로세스만 매뉴얼화, 나머지는 담당자 재량',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '표준화되지 않음',
              description: '담당자마다 출고 방식이 다름',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.pickPackProcess === option.value}
              onClick={() => set('pickPackProcess', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q10 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q10. 물류 데이터를 업무 개선에 활용하고 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'active' as const,
              icon: Database,
              title: '적극 활용 중',
              description: '배송 실적·비용 데이터로 지속적 개선 추진',
            },
            {
              value: 'partial' as const,
              icon: Package,
              title: '부분적으로 활용',
              description: '데이터를 수집하지만 분석은 간헐적',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '활용하지 않아요',
              description: '물류 데이터를 수집하거나 분석하지 않음',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.dataUtilization === option.value}
              onClick={() => set('dataUtilization', option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
