'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  RotateCcw,
  Gauge,
  ClipboardList,
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResultCategoryCard } from './result-category-card';
import { ResultStrategyPanel } from './result-strategy-panel';
import type {
  DiagnosticResult as DiagnosticResultType,
  DiagnosticGrade,
} from '@/server/services/scm/diagnostic-engine';
import Link from 'next/link';

interface DiagnosticResultProps {
  result: DiagnosticResultType;
  onReset: () => void;
}

const GRADE_COLORS: Record<DiagnosticGrade, string> = {
  S: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  A: 'bg-emerald-600 text-white',
  B: 'bg-blue-600 text-white',
  C: 'bg-orange-500 text-white',
  D: 'bg-red-600 text-white',
};

const GRADE_BG: Record<DiagnosticGrade, string> = {
  S: 'from-amber-50 to-yellow-50 border-amber-200',
  A: 'from-emerald-50 to-green-50 border-emerald-200',
  B: 'from-blue-50 to-sky-50 border-blue-200',
  C: 'from-orange-50 to-amber-50 border-orange-200',
  D: 'from-red-50 to-rose-50 border-red-200',
};

const PROGRESS_COLORS: Record<DiagnosticGrade, string> = {
  S: '[&>div]:bg-amber-500',
  A: '[&>div]:bg-emerald-500',
  B: '[&>div]:bg-blue-500',
  C: '[&>div]:bg-orange-500',
  D: '[&>div]:bg-red-500',
};

export function DiagnosticResultView({ result, onReset }: DiagnosticResultProps) {
  const {
    overallScore,
    overallGrade,
    overallGradeLabel,
    categories,
    optimizationStrategies,
    processImprovements,
    summaryMessage,
    diagnosedAt,
  } = result;

  const formattedDate = new Date(diagnosedAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-8">
      {/* 헤더: 종합 점수 */}
      <div
        className={cn(
          'rounded-xl border bg-gradient-to-br p-6',
          GRADE_BG[overallGrade]
        )}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Stethoscope className="h-4 w-4" />
          <span>SCM 진단 결과 · {formattedDate}</span>
        </div>

        <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-slate-600">종합 점수</p>
              <p className="text-5xl font-extrabold tabular-nums tracking-tight">
                {overallScore}
              </p>
            </div>
            <Badge
              className={cn(
                'mb-2 px-4 py-1.5 text-lg font-black',
                GRADE_COLORS[overallGrade]
              )}
            >
              {overallGrade}등급
            </Badge>
          </div>
          <p className="text-sm font-medium text-slate-500">{overallGradeLabel}</p>
        </div>

        <div className="mt-4 space-y-1">
          <Progress
            value={overallScore}
            className={cn('h-3', PROGRESS_COLORS[overallGrade])}
          />
          <p className="text-sm text-slate-600">{summaryMessage}</p>
        </div>
      </div>

      {/* 카테고리별 결과 카드 */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">카테고리별 진단 결과</h3>
        <div className="grid gap-4 lg:grid-cols-1">
          {categories.map((cat) => (
            <ResultCategoryCard key={cat.category} result={cat} />
          ))}
        </div>
      </div>

      {/* 전략 + 프로세스 개선 */}
      <ResultStrategyPanel
        strategies={optimizationStrategies}
        improvements={processImprovements}
      />

      {/* CTA 버튼 */}
      <div className="flex flex-wrap items-center justify-center gap-3 border-t pt-6">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          다시 진단하기
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/kpi">
            <Gauge className="mr-2 h-4 w-4" />
            KPI 대시보드
          </Link>
        </Button>
        <Button asChild>
          <Link href="/dashboard/orders?tab=auto-reorder">
            <ClipboardList className="mr-2 h-4 w-4" />
            발주추천 바로가기
          </Link>
        </Button>
      </div>
    </div>
  );
}
