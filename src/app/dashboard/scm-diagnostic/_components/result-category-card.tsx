'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  CategoryDiagnosticResult,
  DiagnosticGrade,
  DiagnosticMetricItem,
} from '@/server/services/scm/diagnostic-engine';

interface ResultCategoryCardProps {
  result: CategoryDiagnosticResult;
}

const GRADE_COLORS: Record<DiagnosticGrade, string> = {
  S: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white',
  A: 'bg-emerald-600 text-white',
  B: 'bg-blue-600 text-white',
  C: 'bg-orange-500 text-white',
  D: 'bg-red-600 text-white',
};

const GRADE_RING_COLORS: Record<DiagnosticGrade, string> = {
  S: 'ring-amber-400/30',
  A: 'ring-emerald-500/30',
  B: 'ring-blue-500/30',
  C: 'ring-orange-400/30',
  D: 'ring-red-500/30',
};

const PROGRESS_COLORS: Record<DiagnosticGrade, string> = {
  S: '[&>div]:bg-amber-500',
  A: '[&>div]:bg-emerald-500',
  B: '[&>div]:bg-blue-500',
  C: '[&>div]:bg-orange-500',
  D: '[&>div]:bg-red-500',
};

const STATUS_COLORS: Record<DiagnosticMetricItem['status'], string> = {
  good: 'text-emerald-600',
  warning: 'text-orange-500',
  danger: 'text-red-600',
};

export function ResultCategoryCard({ result }: ResultCategoryCardProps) {
  const {
    categoryLabel,
    score,
    grade,
    gradeLabel,
    dbMetrics,
    strengths,
    weaknesses,
    topAction,
  } = result;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{categoryLabel}</CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold tabular-nums">{score}</span>
            <Badge
              className={cn(
                'px-3 py-1 text-sm font-bold ring-2',
                GRADE_COLORS[grade],
                GRADE_RING_COLORS[grade]
              )}
            >
              {grade}
            </Badge>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{gradeLabel}</span>
            <span className="text-muted-foreground">{score}/100</span>
          </div>
          <Progress value={score} className={cn('h-2', PROGRESS_COLORS[grade])} />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* DB 실측값 */}
        {dbMetrics.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700">실측 지표</h4>
            <div className="grid gap-2 sm:grid-cols-3">
              {dbMetrics.map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-lg border bg-slate-50 p-3"
                >
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className={cn('text-lg font-bold', STATUS_COLORS[metric.status])}>
                    {metric.value}
                    <span className="ml-0.5 text-sm font-normal">{metric.unit}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    벤치마크: {metric.benchmark}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 강점 & 약점 */}
        <div className="grid gap-3 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-emerald-700">강점</h4>
              </div>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {weaknesses.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <h4 className="text-sm font-semibold text-red-600">약점</h4>
              </div>
              <ul className="space-y-1">
                {weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-slate-600">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 핵심 조치사항 */}
        {topAction && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-medium text-primary">
              핵심 조치: {topAction}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
