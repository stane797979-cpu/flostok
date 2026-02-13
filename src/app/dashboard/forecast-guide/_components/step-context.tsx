'use client';

import { Calendar, Database, PackageOpen, PackageCheck, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { OptionCard } from './option-card';
import type { GuideAnswers } from '@/server/actions/forecast-guide';

interface StepContextProps {
  dataPeriod?: GuideAnswers['dataPeriod'];
  inventoryStatus?: GuideAnswers['inventoryStatus'];
  onChangePeriod: (value: GuideAnswers['dataPeriod']) => void;
  onChangeInventory: (value: GuideAnswers['inventoryStatus']) => void;
}

const PERIOD_OPTIONS: {
  value: GuideAnswers['dataPeriod'];
  icon: typeof Calendar;
  title: string;
  description: string;
}[] = [
  {
    value: 'less_3m',
    icon: Calendar,
    title: '3개월 미만',
    description: '데이터가 아직 많이 쌓이지 않았습니다',
  },
  {
    value: '3_6m',
    icon: Calendar,
    title: '3~6개월',
    description: '기본적인 예측이 가능한 수준입니다',
  },
  {
    value: '6_12m',
    icon: Database,
    title: '6~12개월',
    description: '충분한 데이터로 정확한 예측이 가능합니다',
  },
  {
    value: 'over_12m',
    icon: Database,
    title: '1년 이상',
    description: '계절성까지 반영한 정교한 예측이 가능합니다',
  },
];

const INVENTORY_OPTIONS: {
  value: GuideAnswers['inventoryStatus'];
  icon: typeof PackageOpen;
  title: string;
  description: string;
}[] = [
  {
    value: 'excess',
    icon: PackageOpen,
    title: '재고가 많이 쌓여있어요',
    description: '필요 이상으로 재고가 과다한 상태입니다',
  },
  {
    value: 'adequate',
    icon: PackageCheck,
    title: '적정 수준이에요',
    description: '현재 재고가 적정한 수준입니다',
  },
  {
    value: 'shortage',
    icon: AlertTriangle,
    title: '자주 부족해요',
    description: '재고 부족으로 판매 기회를 놓치고 있습니다',
  },
];

export function StepContext({
  dataPeriod,
  inventoryStatus,
  onChangePeriod,
  onChangeInventory,
}: StepContextProps) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-bold">데이터와 재고 상황을 알려주세요</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          두 가지 질문에 답변해주세요
        </p>
      </div>

      {/* 데이터 기간 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">판매 데이터가 쌓인 기간은?</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PERIOD_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={dataPeriod === option.value}
              onClick={() => onChangePeriod(option.value)}
            />
          ))}
        </div>
      </div>

      {/* 재고 상황 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">현재 재고가 어떤 상태인가요?</Label>
        <div className="space-y-2">
          {INVENTORY_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.description}
              selected={inventoryStatus === option.value}
              onClick={() => onChangeInventory(option.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
