'use client';

import { Check, ClipboardList, Package, Truck } from 'lucide-react';
import { OptionCard } from '@/app/dashboard/forecast-guide/_components/option-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DiagnosticCategory } from '@/server/services/scm/diagnostic-engine';

interface StepCategorySelectProps {
  selected: DiagnosticCategory[];
  onChange: (categories: DiagnosticCategory[]) => void;
}

const CATEGORIES: {
  value: DiagnosticCategory;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}[] = [
  {
    value: 'inventory',
    icon: Package,
    title: '재고현황 진단',
    description: '재고 상태·과잉/부족 분석·회전율 점검',
  },
  {
    value: 'logistics',
    icon: Truck,
    title: '물류비용 진단',
    description: '운송비·보관비·주문처리 효율 점검',
  },
  {
    value: 'order',
    icon: ClipboardList,
    title: '발주현황 진단',
    description: '납기준수율·발주효율성·공급자성과 점검',
  },
];

const ALL_CATEGORIES: DiagnosticCategory[] = ['inventory', 'logistics', 'order'];

export function StepCategorySelect({ selected, onChange }: StepCategorySelectProps) {
  const handleToggle = (value: DiagnosticCategory) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === ALL_CATEGORIES.length) {
      onChange([]);
    } else {
      onChange([...ALL_CATEGORIES]);
    }
  };

  const isAllSelected = selected.length === ALL_CATEGORIES.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">어떤 영역을 진단하시겠습니까?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          1개만 선택해도 괜찮습니다 (각 약 2분 소요)
        </p>
      </div>

      <div className="grid gap-3">
        {CATEGORIES.map((category) => {
          const isSelected = selected.includes(category.value);
          return (
            <div key={category.value} className="relative">
              <OptionCard
                icon={category.icon as Parameters<typeof OptionCard>[0]['icon']}
                title={category.title}
                description={category.description}
                selected={isSelected}
                onClick={() => handleToggle(category.value)}
              />
              {isSelected && (
                <div
                  className={cn(
                    'pointer-events-none absolute right-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full',
                    'bg-primary text-white'
                  )}
                >
                  <Check className="h-3 w-3" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSelectAll}
          className="text-sm text-muted-foreground hover:text-slate-900"
        >
          {isAllSelected ? '전체 해제' : '전체 선택'}
        </Button>
      </div>
    </div>
  );
}
