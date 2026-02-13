'use client';

import { Minus, Activity, Shuffle } from 'lucide-react';
import { OptionCard } from './option-card';
import type { GuideAnswers } from '@/server/actions/forecast-guide';

interface StepSalesPatternProps {
  value?: GuideAnswers['salesPattern'];
  onChange: (value: GuideAnswers['salesPattern']) => void;
}

const OPTIONS: {
  value: GuideAnswers['salesPattern'];
  icon: typeof Minus;
  title: string;
  description: string;
  example: string;
}[] = [
  {
    value: 'stable',
    icon: Minus,
    title: '매달 비슷하게 팔려요',
    description: '월별 판매량 차이가 크지 않고 일정한 편입니다',
    example: '세제, 생필품, 소모품 등',
  },
  {
    value: 'variable',
    icon: Activity,
    title: '오르내리지만 어느 정도 예측돼요',
    description: '변동은 있지만 전체적인 추세는 파악할 수 있습니다',
    example: '계절 상품, 의류, 식품류 등',
  },
  {
    value: 'irregular',
    icon: Shuffle,
    title: '들쭉날쭉, 예측이 어려워요',
    description: '언제 팔릴지 패턴을 찾기 어렵습니다',
    example: '이벤트 상품, 신제품, 유행 상품 등',
  },
];

export function StepSalesPattern({ value, onChange }: StepSalesPatternProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">이 제품의 판매 패턴은 어떤가요?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          가장 가까운 패턴을 선택해주세요
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            icon={option.icon}
            title={option.title}
            description={option.description}
            example={option.example}
            selected={value === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}
