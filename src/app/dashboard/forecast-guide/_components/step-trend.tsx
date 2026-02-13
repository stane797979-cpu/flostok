'use client';

import { TrendingUp, TrendingDown, ArrowRight, HelpCircle } from 'lucide-react';
import { OptionCard } from './option-card';
import type { GuideAnswers } from '@/server/actions/forecast-guide';

interface StepTrendProps {
  value?: GuideAnswers['trend'];
  onChange: (value: GuideAnswers['trend']) => void;
}

const OPTIONS: {
  value: GuideAnswers['trend'];
  icon: typeof TrendingUp;
  title: string;
  description: string;
}[] = [
  {
    value: 'growing',
    icon: TrendingUp,
    title: '꾸준히 늘고 있어요',
    description: '최근 6개월간 판매량이 계속 증가하는 추세입니다',
  },
  {
    value: 'declining',
    icon: TrendingDown,
    title: '줄어들고 있어요',
    description: '최근 6개월간 판매량이 감소하고 있습니다',
  },
  {
    value: 'stable',
    icon: ArrowRight,
    title: '특별한 변화 없어요',
    description: '판매량이 크게 오르지도 내리지도 않습니다',
  },
  {
    value: 'unknown',
    icon: HelpCircle,
    title: '잘 모르겠어요',
    description: '시스템이 자동으로 판단합니다',
  },
];

export function StepTrend({ value, onChange }: StepTrendProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">최근 판매량에 추세가 있나요?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          최근 6개월간의 판매 변화를 떠올려보세요
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            icon={option.icon}
            title={option.title}
            description={option.description}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
