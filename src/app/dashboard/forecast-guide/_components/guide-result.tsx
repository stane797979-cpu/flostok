'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  BarChart3,
  CalendarRange,
  ClipboardList,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Shield,
  Clock,
  Info,
} from 'lucide-react';
import type { GuideRecommendation } from '@/server/actions/forecast-guide';

interface GuideResultProps {
  recommendation: GuideRecommendation;
  productId?: string;
  onReset: () => void;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  low: 'bg-red-100 text-red-800 border-red-200',
};

const METHOD_ICONS: Record<string, typeof TrendingUp> = {
  SMA: BarChart3,
  SES: TrendingUp,
  Holts: Sparkles,
};

export function GuideResult({ recommendation, productId, onReset }: GuideResultProps) {
  const MethodIcon = METHOD_ICONS[recommendation.method] || Sparkles;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold">분석이 완료되었습니다</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          입력하신 정보를 바탕으로 최적의 예측 방법과 공급 전략을 추천합니다
        </p>
      </div>

      {/* 섹션 A: 추천 예측 방법 */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MethodIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">추천 예측 방법</p>
              <CardTitle className="text-lg">{recommendation.businessName}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{recommendation.description}</p>
        </CardContent>
      </Card>

      {/* 섹션 B: 추천 이유 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-blue-500" />
            분석 근거
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            {recommendation.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-blue-500">&#8226;</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 섹션 C: 예측 신뢰도 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              예측 신뢰도
            </CardTitle>
            <Badge className={CONFIDENCE_COLORS[recommendation.confidence]}>
              {recommendation.confidenceLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{recommendation.confidenceDescription}</p>
        </CardContent>
      </Card>

      {/* 섹션 D: 공급 전략 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              공급 전략
            </CardTitle>
            <Badge variant="outline">{recommendation.combinedGrade} 유형</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium">{recommendation.supplyStrategy.name}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" />
                발주 방식
              </div>
              <p className="mt-1 text-sm font-medium">{recommendation.supplyStrategy.orderType}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                안전재고 수준
              </div>
              <p className="mt-1 text-sm font-medium">{recommendation.supplyStrategy.safetyLevel}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                검토 주기
              </div>
              <p className="mt-1 text-sm font-medium">{recommendation.supplyStrategy.reviewCycle}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{recommendation.supplyStrategy.tip}</p>
        </CardContent>
      </Card>

      {/* 섹션 E: 추가 권장사항 */}
      {recommendation.warnings.length > 0 && (
        <div className="space-y-2">
          {recommendation.warnings.map((warning, i) => (
            <Alert key={i} className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm text-amber-800">
                {warning}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <Separator />

      {/* 섹션 F: CTA 버튼 */}
      <div className="space-y-3">
        <p className="text-center text-sm font-medium text-muted-foreground">
          다음 단계로 진행하세요
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button asChild>
            <Link
              href={
                productId
                  ? `/dashboard/analytics?tab=demand-forecast&productId=${productId}`
                  : '/dashboard/analytics?tab=demand-forecast'
              }
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              지금 예측 실행
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/psi">
              <CalendarRange className="mr-2 h-4 w-4" />
              PSI 계획 반영
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/orders?tab=reorder">
              <ClipboardList className="mr-2 h-4 w-4" />
              발주 추천 확인
            </Link>
          </Button>
        </div>
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            처음으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  );
}
