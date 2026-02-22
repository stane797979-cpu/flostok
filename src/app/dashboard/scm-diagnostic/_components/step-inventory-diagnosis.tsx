'use client';

import {
  AlertTriangle,
  BarChart3,
  Brain,
  Calculator,
  ClipboardCheck,
  Database,
  HelpCircle,
  Layers,
  Monitor,
  Package,
  RefreshCw,
  Target,
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
        <p className="mt-1 text-sm text-muted-foreground">총 9문항입니다. 해당되는 항목을 선택해 주세요.</p>
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

      {/* Q5 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q5. 재고 관리에 어떤 도구를 사용하나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'erp_wms' as const,
              icon: Monitor,
              title: 'ERP / WMS 시스템',
              description: '전문 재고 관리 시스템으로 실시간 관리',
            },
            {
              value: 'spreadsheet' as const,
              icon: BarChart3,
              title: '엑셀 / 스프레드시트',
              description: '엑셀이나 구글 시트로 수동 관리',
            },
            {
              value: 'manual' as const,
              icon: HelpCircle,
              title: '수기 / 별도 도구 없음',
              description: '종이 장부나 기억에 의존',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.managementTool === option.value}
              onClick={() => set('managementTool', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q6 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q6. ABC 분류(제품 중요도별 차등 관리)를 적용하고 있나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'applied' as const,
              icon: Layers,
              title: '체계적으로 적용 중',
              description: 'A/B/C 등급별로 재고 정책을 차등 적용',
            },
            {
              value: 'partial' as const,
              icon: Layers,
              title: '부분적으로 적용',
              description: '일부 제품만 중요도를 구분하여 관리',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '적용하지 않아요',
              description: '모든 제품을 동일한 방식으로 관리',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.abcClassification === option.value}
              onClick={() => set('abcClassification', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q7 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q7. 재고 데이터를 얼마나 자주 갱신하나요?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'realtime' as const, title: '실시간', description: '입출고 즉시 시스템에 반영' },
            { value: 'daily' as const, title: '매일 1회', description: '하루 마감 시 일괄 갱신' },
            { value: 'weekly' as const, title: '주 1회', description: '주간 단위로 데이터 갱신' },
            { value: 'irregular' as const, title: '불규칙', description: '필요할 때만 갱신하거나 갱신하지 않음' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={RefreshCw}
              title={option.title}
              description={option.description}
              selected={answers.dataRefreshFreq === option.value}
              onClick={() => set('dataRefreshFreq', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q8 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q8. 유통기한/시즌 재고를 별도로 관리하나요?
        </h3>
        <div className="grid gap-2">
          {[
            {
              value: 'systematic' as const,
              icon: Database,
              title: '체계적으로 관리',
              description: '유통기한·시즌별 선입선출, 자동 알림 등 운영',
            },
            {
              value: 'partial' as const,
              icon: Database,
              title: '부분적으로 관리',
              description: '일부 품목만 유통기한을 추적',
            },
            {
              value: 'none' as const,
              icon: HelpCircle,
              title: '별도 관리 없음',
              description: '유통기한·시즌 구분 없이 동일 관리',
            },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={answers.seasonalHandling === option.value}
              onClick={() => set('seasonalHandling', option.value)}
            />
          ))}
        </div>
      </div>

      {/* Q9 */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-800">
          Q9. 장부(시스템)상 재고와 실제 재고가 얼마나 일치하나요?
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: 'very_close' as const, title: '거의 일치해요', description: '오차 3% 미만' },
            { value: 'mostly_close' as const, title: '대부분 비슷해요', description: '오차 3~10% 수준' },
            { value: 'often_different' as const, title: '자주 달라요', description: '오차 10% 이상 빈발' },
            { value: 'dont_know' as const, title: '비교해 본 적 없어요', description: '장부와 실제 재고를 대조하지 않음' },
          ].map((option) => (
            <OptionCard
              key={option.value}
              icon={Target}
              title={option.title}
              description={option.description}
              selected={answers.stockAccuracy === option.value}
              onClick={() => set('stockAccuracy', option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
