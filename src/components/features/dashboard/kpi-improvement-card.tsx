'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ImprovementProposal } from '@/server/services/scm/kpi-improvement';
import {
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  ClipboardList,
  Calendar,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface KPIImprovementCardProps {
  proposal: ImprovementProposal;
  className?: string;
}

export function KPIImprovementCard({ proposal, className }: KPIImprovementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const { toast } = useToast();

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const completedSteps = Object.values(checkedSteps).filter(Boolean).length;
  const totalSteps = proposal.actionSteps.length;

  const priorityConfig = {
    high: {
      label: '높음',
      color: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900',
      textColor: 'text-red-700 dark:text-red-300',
      badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      icon: AlertCircle,
    },
    medium: {
      label: '중간',
      color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-900',
      textColor: 'text-yellow-700 dark:text-yellow-300',
      badgeColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
      icon: TrendingUp,
    },
    low: {
      label: '낮음',
      color: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900',
      textColor: 'text-blue-700 dark:text-blue-300',
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      icon: CheckCircle2,
    },
  };

  const categoryConfig = {
    inventory: {
      label: '재고 관리',
      icon: '📦',
      color: 'bg-purple-50 dark:bg-purple-950',
    },
    order: {
      label: '발주 관리',
      icon: '📋',
      color: 'bg-green-50 dark:bg-green-950',
    },
    cost: {
      label: '비용 최적화',
      icon: '💰',
      color: 'bg-indigo-50 dark:bg-indigo-950',
    },
  };

  const config = priorityConfig[proposal.priority];
  const catConfig = categoryConfig[proposal.kpiCategory];
  const PriorityIcon = config.icon;

  return (
    <Card
      className={cn(
        'border transition-all hover:shadow-md',
        config.color,
        isExpanded && 'ring-2 ring-offset-2',
        className
      )}
    >
      <CardHeader
        className="cursor-pointer pb-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="space-y-2">
          {/* 헤더: 제목과 카테고리 배지 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 flex-shrink-0" />
                <CardTitle className="text-base">{proposal.title}</CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-600 dark:text-slate-400">
                {proposal.description}
              </CardDescription>
            </div>

            {/* 우선순위 배지 */}
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', config.badgeColor)}>
                <PriorityIcon className="h-3 w-3" />
                {config.label}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-4">
          {/* 카테고리 및 영향 KPI */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-lg">{catConfig.icon}</span>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">카테고리</p>
                <p className="text-sm font-semibold">{catConfig.label}</p>
              </div>
            </div>
          </div>

          {/* 영향을 받는 KPI */}
          <div className="space-y-2 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">영향 KPI</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {proposal.affectedKPIs.map((kpi) => (
                <span
                  key={kpi}
                  className="inline-block rounded-full bg-white px-2 py-1 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                >
                  {kpi}
                </span>
              ))}
            </div>
          </div>

          {/* 예상 효과 */}
          <div className="space-y-2 rounded-lg bg-green-50 p-3 dark:bg-green-950">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <p className="text-xs font-medium text-green-600 dark:text-green-400">예상 효과</p>
            </div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
              {proposal.estimatedImpact}
            </p>
          </div>

          {/* 구현 기간 */}
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
            <Clock className="h-4 w-4 flex-shrink-0 text-slate-600 dark:text-slate-400" />
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">구현 기간</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {proposal.timeToImplement}
              </p>
            </div>
          </div>

          {/* 실행 단계 */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">실행 단계</p>
            <ol className="space-y-1">
              {proposal.actionSteps.map((step, index) => (
                <li key={index} className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setShowPlanDialog(true);
              }}
            >
              <ClipboardList className="mr-1 h-4 w-4" />
              실행 계획 수립
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailDialog(true);
              }}
            >
              상세 보기
            </Button>
          </div>
        </CardContent>
      )}

      {/* 실행 계획 수립 다이얼로그 */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              실행 계획
            </DialogTitle>
            <DialogDescription>
              {proposal.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 개요 */}
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-900">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {proposal.description}
              </p>
            </div>

            {/* 일정 & 영향 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">예상 기간</p>
                  <p className="text-sm font-semibold">{proposal.timeToImplement}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">예상 효과</p>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                    {proposal.estimatedImpact}
                  </p>
                </div>
              </div>
            </div>

            {/* 실행 단계 체크리스트 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">실행 단계</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {completedSteps}/{totalSteps} 완료
                </span>
              </div>

              {/* 프로그레스 바 */}
              <div className="w-full bg-slate-200 rounded-full h-1.5 dark:bg-slate-700">
                <div
                  className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
                />
              </div>

              <div className="space-y-2 mt-3">
                {proposal.actionSteps.map((step, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      checkedSteps[index]
                        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                    )}
                    onClick={() => toggleStep(index)}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {checkedSteps[index] ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <CircleDot className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm',
                        checkedSteps[index] && 'line-through text-slate-400'
                      )}
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 영향 KPI */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">영향받는 KPI</h4>
              <div className="flex flex-wrap gap-1.5">
                {proposal.affectedKPIs.map((kpi) => (
                  <span
                    key={kpi}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    <ArrowRight className="h-3 w-3" />
                    {kpi}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPlanDialog(false)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                toast({
                  title: '실행 계획이 저장되었습니다',
                  description: `${proposal.title} - ${completedSteps}/${totalSteps}단계 완료`,
                });
                setShowPlanDialog(false);
              }}
            >
              계획 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 보기 다이얼로그 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {proposal.title}
            </DialogTitle>
            <DialogDescription>
              {proposal.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 우선순위 & 카테고리 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">우선순위</p>
                <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium', config.badgeColor)}>
                  <PriorityIcon className="h-3 w-3" />
                  {config.label}
                </span>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">카테고리</p>
                <p className="text-sm font-medium">
                  {catConfig.icon} {catConfig.label}
                </p>
              </div>
            </div>

            {/* 예상 효과 */}
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 dark:bg-green-950 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-xs font-medium text-green-600">예상 효과</p>
              </div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                {proposal.estimatedImpact}
              </p>
            </div>

            {/* 구현 기간 */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Clock className="h-5 w-5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">구현 기간</p>
                <p className="text-sm font-semibold">{proposal.timeToImplement}</p>
              </div>
            </div>

            {/* 영향 KPI */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                영향받는 KPI
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {proposal.affectedKPIs.map((kpi) => (
                  <span
                    key={kpi}
                    className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {kpi}
                  </span>
                ))}
              </div>
            </div>

            {/* 상세 실행 단계 */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">실행 단계 상세</h4>
              <div className="space-y-2">
                {proposal.actionSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white flex-shrink-0">
                      {index + 1}
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {step.replace(/^\d+\.\s*/, '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                setShowDetailDialog(false);
                setShowPlanDialog(true);
              }}
            >
              <ClipboardList className="mr-1 h-4 w-4" />
              실행 계획 수립
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
