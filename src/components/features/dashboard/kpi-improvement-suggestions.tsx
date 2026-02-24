'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  generateKPIImprovementProposals,
  sortProposalsByPriority,
  filterProposalsByCategory,
  hasKPIData,
  type KPIMetrics,
  type KPITarget,
} from '@/server/services/scm/kpi-improvement';
import { KPIImprovementCard } from './kpi-improvement-card';
import { AlertCircle, Lightbulb, BarChart3, ClipboardList, TrendingUp, Clock, CheckCircle2, CircleDot, Database } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface KPIImprovementSuggestionsProps {
  metrics: KPIMetrics;
  targets: KPITarget;
  className?: string;
}

export function KPIImprovementSuggestions({
  metrics,
  targets,
  className,
}: KPIImprovementSuggestionsProps) {
  const { toast } = useToast();
  const [showAllPlanDialog, setShowAllPlanDialog] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (key: string) => {
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 개선 제안 생성 및 우선순위 정렬
  const proposals = useMemo(() => {
    const all = generateKPIImprovementProposals(metrics, targets);
    return sortProposalsByPriority(all);
  }, [metrics, targets]);

  // 카테고리별 필터링
  const inventoryProposals = useMemo(
    () => filterProposalsByCategory(proposals, 'inventory'),
    [proposals]
  );
  const orderProposals = useMemo(() => filterProposalsByCategory(proposals, 'order'), [proposals]);
  const costProposals = useMemo(() => filterProposalsByCategory(proposals, 'cost'), [proposals]);

  // 우선순위별 카운트
  const highPriorityCount = proposals.filter((p) => p.priority === 'high').length;
  const mediumPriorityCount = proposals.filter((p) => p.priority === 'medium').length;
  const lowPriorityCount = proposals.filter((p) => p.priority === 'low').length;

  const noData = !hasKPIData(metrics);

  if (noData) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            KPI 개선 제안
          </CardTitle>
          <CardDescription>현재 KPI 현황에 기반한 맞춤형 개선 제안</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-12 dark:border-slate-700">
            <Database className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-center text-sm text-slate-500">
              분석할 데이터가 없습니다
            </p>
            <p className="mt-1 text-center text-xs text-slate-400">
              제품, 재고, 판매, 발주 데이터를 등록하면 KPI 기반 개선 제안이 생성됩니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (proposals.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            KPI 개선 제안
          </CardTitle>
          <CardDescription>현재 KPI 현황에 기반한 맞춤형 개선 제안</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-12 dark:border-slate-700">
            <AlertCircle className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-center text-sm text-slate-500">
              모든 KPI가 목표를 달성했습니다!
            </p>
            <p className="mt-1 text-center text-xs text-slate-400">
              지속적인 개선을 통해 경쟁력을 강화하세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              KPI 개선 제안
            </CardTitle>
            <CardDescription>현재 KPI 현황에 기반한 맞춤형 개선 제안</CardDescription>
          </div>

          {/* 우선순위별 요약 */}
          <div className="grid grid-cols-3 gap-2">
            {highPriorityCount > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
                <div className="text-center">
                  <p className="text-xs font-medium text-red-600 dark:text-red-300">긴급</p>
                  <p className="text-lg font-bold text-red-700 dark:text-red-200">
                    {highPriorityCount}개
                  </p>
                </div>
              </div>
            )}
            {mediumPriorityCount > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
                <div className="text-center">
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-300">중간</p>
                  <p className="text-lg font-bold text-yellow-700 dark:text-yellow-200">
                    {mediumPriorityCount}개
                  </p>
                </div>
              </div>
            )}
            {lowPriorityCount > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
                <div className="text-center">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-300">낮음</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-200">
                    {lowPriorityCount}개
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              전체 ({proposals.length})
            </TabsTrigger>
            <TabsTrigger value="inventory">
              재고 ({inventoryProposals.length})
            </TabsTrigger>
            <TabsTrigger value="order">
              발주 ({orderProposals.length})
            </TabsTrigger>
            <TabsTrigger value="cost">
              비용 ({costProposals.length})
            </TabsTrigger>
          </TabsList>

          {/* 전체 제안 */}
          <TabsContent value="all" className="space-y-3">
            {proposals.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500">
                현재 실행할 개선 제안이 없습니다.
              </div>
            ) : (
              proposals.map((proposal) => (
                <KPIImprovementCard key={proposal.id} proposal={proposal} />
              ))
            )}
          </TabsContent>

          {/* 재고 관리 제안 */}
          <TabsContent value="inventory" className="space-y-3">
            {inventoryProposals.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500">
                현재 실행할 재고 관리 개선 제안이 없습니다.
              </div>
            ) : (
              inventoryProposals.map((proposal) => (
                <KPIImprovementCard key={proposal.id} proposal={proposal} />
              ))
            )}
          </TabsContent>

          {/* 발주 관리 제안 */}
          <TabsContent value="order" className="space-y-3">
            {orderProposals.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500">
                현재 실행할 발주 관리 개선 제안이 없습니다.
              </div>
            ) : (
              orderProposals.map((proposal) => (
                <KPIImprovementCard key={proposal.id} proposal={proposal} />
              ))
            )}
          </TabsContent>

          {/* 비용 최적화 제안 */}
          <TabsContent value="cost" className="space-y-3">
            {costProposals.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500">
                현재 실행할 비용 최적화 개선 제안이 없습니다.
              </div>
            ) : (
              costProposals.map((proposal) => (
                <KPIImprovementCard key={proposal.id} proposal={proposal} />
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* 액션 버튼 */}
        <div className="mt-6 flex gap-2 border-t pt-6 dark:border-slate-800">
          <Button
            className="flex-1"
            variant="default"
            onClick={() => {
              setCheckedSteps({});
              setShowAllPlanDialog(true);
            }}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            전체 계획 수립
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => setShowAnalysisDialog(true)}
          >
            상세 분석 보기
          </Button>
        </div>
      </CardContent>

      {/* 전체 계획 수립 다이얼로그 */}
      <Dialog open={showAllPlanDialog} onOpenChange={setShowAllPlanDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              전체 KPI 개선 실행 계획
            </DialogTitle>
            <DialogDescription>
              {proposals.length}개 개선 제안에 대한 통합 실행 계획
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* 요약 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{highPriorityCount}</p>
                <p className="text-xs text-slate-500">긴급 과제</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{mediumPriorityCount}</p>
                <p className="text-xs text-slate-500">중간 과제</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{lowPriorityCount}</p>
                <p className="text-xs text-slate-500">개선 과제</p>
              </div>
            </div>

            {/* 전체 진행률 */}
            {(() => {
              const allStepsCount = proposals.reduce((sum, p) => sum + p.actionSteps.length, 0);
              const completedCount = Object.values(checkedSteps).filter(Boolean).length;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">전체 진행률</span>
                    <span className="text-slate-500">
                      {completedCount}/{allStepsCount}단계 완료
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${allStepsCount > 0 ? (completedCount / allStepsCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* 제안별 실행 단계 */}
            {proposals.map((proposal) => {
              const priorityColors = {
                high: 'border-l-red-500',
                medium: 'border-l-yellow-500',
                low: 'border-l-blue-500',
              };
              const priorityLabels = { high: '긴급', medium: '중간', low: '낮음' };

              return (
                <div
                  key={proposal.id}
                  className={cn('rounded-lg border border-l-4 p-4 space-y-3', priorityColors[proposal.priority])}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold">{proposal.title}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {proposal.timeToImplement}
                        </span>
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {proposal.estimatedImpact}
                        </span>
                      </div>
                    </div>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium',
                      proposal.priority === 'high' && 'bg-red-100 text-red-700',
                      proposal.priority === 'medium' && 'bg-yellow-100 text-yellow-700',
                      proposal.priority === 'low' && 'bg-blue-100 text-blue-700',
                    )}>
                      {priorityLabels[proposal.priority]}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {proposal.actionSteps.map((step, stepIdx) => {
                      const key = `${proposal.id}-${stepIdx}`;
                      return (
                        <div
                          key={key}
                          className={cn(
                            'flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors text-sm',
                            checkedSteps[key]
                              ? 'bg-green-50 dark:bg-green-950'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-900'
                          )}
                          onClick={() => toggleStep(key)}
                        >
                          {checkedSteps[key] ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <CircleDot className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={cn(checkedSteps[key] && 'line-through text-slate-400')}>
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllPlanDialog(false)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                const completedCount = Object.values(checkedSteps).filter(Boolean).length;
                const allStepsCount = proposals.reduce((sum, p) => sum + p.actionSteps.length, 0);
                toast({
                  title: '전체 실행 계획이 저장되었습니다',
                  description: `${proposals.length}개 과제, ${completedCount}/${allStepsCount}단계 완료`,
                });
                setShowAllPlanDialog(false);
              }}
            >
              계획 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상세 분석 다이얼로그 */}
      <Dialog open={showAnalysisDialog} onOpenChange={setShowAnalysisDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              KPI 상세 분석
            </DialogTitle>
            <DialogDescription>
              현재 KPI 현황과 목표 대비 달성도
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* KPI 현황 테이블 */}
            <div className="space-y-3">
              {[
                { label: '재고회전율', current: metrics.inventoryTurnoverRate, target: targets.inventoryTurnoverRate, unit: '회/년', higher: true },
                { label: '평균 재고일수', current: metrics.averageInventoryDays, target: targets.averageInventoryDays, unit: '일', higher: false },
                { label: '재고 정확도', current: metrics.inventoryAccuracy ?? 0, target: targets.inventoryAccuracy, unit: '%', higher: true },
                { label: '품절률', current: metrics.stockoutRate, target: targets.stockoutRate, unit: '%', higher: false },
                { label: '적시 발주율', current: metrics.onTimeOrderRate, target: targets.onTimeOrderRate, unit: '%', higher: true },
                { label: '평균 리드타임', current: metrics.averageLeadTime, target: targets.averageLeadTime, unit: '일', higher: false },
                { label: '발주 충족률', current: metrics.orderFulfillmentRate, target: targets.orderFulfillmentRate, unit: '%', higher: true },
              ].map((kpi) => {
                const isGood = kpi.higher
                  ? kpi.current >= kpi.target
                  : kpi.current <= kpi.target;
                const gap = kpi.higher
                  ? kpi.current - kpi.target
                  : kpi.target - kpi.current;
                const percentage = kpi.higher
                  ? Math.min(100, (kpi.current / kpi.target) * 100)
                  : Math.min(100, (kpi.target / kpi.current) * 100);

                return (
                  <div key={kpi.label} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{kpi.label}</span>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      )}>
                        {isGood ? '달성' : '미달'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                      <div>
                        <p className="text-xs text-slate-500">현재</p>
                        <p className={cn('text-lg font-bold', isGood ? 'text-green-600' : 'text-red-600')}>
                          {kpi.current.toFixed(1)}{kpi.unit}
                        </p>
                      </div>
                      <div className="text-slate-300">→</div>
                      <div>
                        <p className="text-xs text-slate-500">목표</p>
                        <p className="text-lg font-bold text-slate-700">
                          {kpi.target.toFixed(1)}{kpi.unit}
                        </p>
                      </div>
                      <div className="flex-1 text-right">
                        <p className={cn('text-sm font-medium', isGood ? 'text-green-600' : 'text-red-600')}>
                          {gap >= 0 ? '+' : ''}{gap.toFixed(1)}{kpi.unit}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className={cn(
                          'rounded-full h-1.5 transition-all',
                          isGood ? 'bg-green-500' : percentage > 70 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 개선 필요 요약 */}
            {proposals.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 dark:bg-amber-950 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">개선 필요 항목</p>
                </div>
                <ul className="space-y-1">
                  {proposals.map((p) => (
                    <li key={p.id} className="text-sm text-amber-700 dark:text-amber-300">
                      • {p.title} ({p.estimatedImpact})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnalysisDialog(false)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                setShowAnalysisDialog(false);
                setShowAllPlanDialog(true);
              }}
            >
              <ClipboardList className="mr-1 h-4 w-4" />
              전체 계획 수립
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
