'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  ArrowUpCircle,
  Clock,
  Target,
  User,
  Calendar,
  CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  OptimizationStrategy,
  ProcessImprovement,
} from '@/server/services/scm/diagnostic-engine';

interface ResultStrategyPanelProps {
  strategies: OptimizationStrategy[];
  improvements: ProcessImprovement[];
}

const PRIORITY_BADGE: Record<
  OptimizationStrategy['priority'],
  { label: string; className: string }
> = {
  urgent: { label: '긴급', className: 'bg-red-600 text-white' },
  high: { label: '높음', className: 'bg-orange-500 text-white' },
  medium: { label: '보통', className: 'bg-blue-500 text-white' },
};

const CATEGORY_LABELS: Record<string, string> = {
  inventory: '재고',
  logistics: '물류',
  order: '발주',
};

export function ResultStrategyPanel({
  strategies,
  improvements,
}: ResultStrategyPanelProps) {
  return (
    <div className="space-y-6">
      {/* 최적화 전략 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">물류 최적화 전략</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            진단 결과에 기반한 우선순위별 개선 전략입니다
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {strategies.map((strategy, index) => (
            <div
              key={index}
              className="rounded-lg border bg-white p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">
                      {strategy.title}
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {strategy.description}
                    </p>
                  </div>
                </div>
                <Badge
                  className={cn(
                    'shrink-0',
                    PRIORITY_BADGE[strategy.priority].className
                  )}
                >
                  {PRIORITY_BADGE[strategy.priority].label}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  {strategy.expectedEffect}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                  {strategy.timeframe}
                </span>
                <span className="flex items-center gap-1">
                  <ArrowUpCircle className="h-3.5 w-3.5 text-slate-400" />
                  {strategy.relatedCategories
                    .map((c) => CATEGORY_LABELS[c] ?? c)
                    .join(' · ')}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 프로세스 개선 로드맵 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-lg">프로세스 개선 로드맵</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            단계별 액션플랜을 순서대로 실행하세요
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-0">
            {improvements.map((item, index) => {
              const isLast = index === improvements.length - 1;
              return (
                <div key={item.step} className="relative flex gap-4 pb-6">
                  {/* 세로 연결선 */}
                  {!isLast && (
                    <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5 bg-slate-200" />
                  )}

                  {/* 스텝 번호 */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {item.step}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 space-y-1 pt-0.5">
                    <h4 className="font-semibold text-slate-900">
                      {item.title}
                    </h4>
                    <p className="text-sm text-slate-600">{item.description}</p>
                    <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.owner}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {item.deadline}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
