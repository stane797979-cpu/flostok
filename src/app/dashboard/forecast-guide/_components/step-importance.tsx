'use client';

import { Star, Target, Package } from 'lucide-react';
import { OptionCard } from './option-card';
import type { GuideAnswers } from '@/server/actions/forecast-guide';

interface StepImportanceProps {
  value?: GuideAnswers['importance'];
  onChange: (value: GuideAnswers['importance']) => void;
}

const OPTIONS: {
  value: GuideAnswers['importance'];
  icon: typeof Star;
  title: string;
  description: string;
  example: string;
}[] = [
  {
    value: 'core',
    icon: Star,
    title: '핵심 매출 제품',
    description: '매출 상위 20%에 해당하는 없으면 안 되는 제품',
    example: '베스트셀러, 주력 상품',
  },
  {
    value: 'important',
    icon: Target,
    title: '중간 정도의 제품',
    description: '중요하지만 핵심까지는 아닌 제품',
    example: '중위권 매출 제품',
  },
  {
    value: 'auxiliary',
    icon: Package,
    title: '보조 제품',
    description: '매출 비중은 낮지만 구색상 필요한 제품',
    example: '부자재, 저매출 제품',
  },
];

export function StepImportance({ value, onChange }: StepImportanceProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">전체 매출에서 차지하는 비중은?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          이 제품의 매출 중요도를 선택해주세요
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
