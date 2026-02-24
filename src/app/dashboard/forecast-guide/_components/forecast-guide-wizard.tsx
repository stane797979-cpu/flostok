'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { GuideStepIndicator } from './guide-step-indicator';
import { StepProductSelect } from './step-product-select';
import { StepSalesPattern } from './step-sales-pattern';
import { StepTrend } from './step-trend';
import { StepImportance } from './step-importance';
import { StepContext } from './step-context';
import { GuideResult } from './guide-result';
import { BulkGuideResult } from './bulk-guide-result';
import {
  getGuideRecommendation,
  getBulkForecastGuide,
  type GuideAnswers,
  type GuideRecommendation,
  type BulkForecastResult,
  type ProductOption,
} from '@/server/actions/forecast-guide';

interface ForecastGuideWizardProps {
  products: ProductOption[];
}

export function ForecastGuideWizard({ products }: ForecastGuideWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<GuideAnswers>>({});
  const [result, setResult] = useState<GuideRecommendation | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkForecastResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const isResultStep = result !== null || bulkResult !== null;

  // 현재 단계가 완료되었는지 확인
  const isStepComplete = (): boolean => {
    switch (currentStep) {
      case 0: return true; // 제품 선택은 선택사항
      case 1: return !!answers.salesPattern;
      case 2: return !!answers.trend;
      case 3: return !!answers.importance;
      case 4: return !!answers.dataPeriod && !!answers.inventoryStatus;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (currentStep < 4) {
      setCurrentStep((s) => s + 1);
    } else {
      // 마지막 단계 → 추천 실행
      setIsLoading(true);
      try {
        const recommendation = await getGuideRecommendation(answers as GuideAnswers);
        setResult(recommendation);
      } catch {
        // 에러 시 기본 결과 표시
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setAnswers({});
    setResult(null);
    setBulkResult(null);
  };

  const handleProductSelect = (productId: string) => {
    setAnswers((prev) => ({ ...prev, productId }));
  };

  const handleSkipProduct = async () => {
    setIsBulkLoading(true);
    try {
      const bulk = await getBulkForecastGuide();
      setBulkResult(bulk);
    } catch {
      // 실패 시 기존 질문 흐름으로 폴백
      setAnswers((prev) => {
        const { productId: _, ...rest } = prev;
        return rest;
      });
      setCurrentStep(1);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const renderStep = () => {
    if (bulkResult) {
      return <BulkGuideResult result={bulkResult} onReset={handleReset} />;
    }

    if (result) {
      return (
        <GuideResult
          recommendation={result}
          productId={answers.productId}
          onReset={handleReset}
        />
      );
    }

    switch (currentStep) {
      case 0:
        return isBulkLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold">전체 SKU 수요예측 분석 중...</p>
              <p className="text-sm text-muted-foreground mt-1">
                판매 데이터를 기반으로 최적의 예측 모델을 선택하고 있습니다
              </p>
            </div>
          </div>
        ) : (
          <StepProductSelect
            products={products}
            selectedProductId={answers.productId}
            onSelectProduct={handleProductSelect}
            onNext={() => setCurrentStep(1)}
            onSkip={handleSkipProduct}
          />
        );
      case 1:
        return (
          <StepSalesPattern
            value={answers.salesPattern}
            onChange={(v) => setAnswers((prev) => ({ ...prev, salesPattern: v }))}
          />
        );
      case 2:
        return (
          <StepTrend
            value={answers.trend}
            onChange={(v) => setAnswers((prev) => ({ ...prev, trend: v }))}
          />
        );
      case 3:
        return (
          <StepImportance
            value={answers.importance}
            onChange={(v) => setAnswers((prev) => ({ ...prev, importance: v }))}
          />
        );
      case 4:
        return (
          <StepContext
            dataPeriod={answers.dataPeriod}
            inventoryStatus={answers.inventoryStatus}
            onChangePeriod={(v) => setAnswers((prev) => ({ ...prev, dataPeriod: v }))}
            onChangeInventory={(v) => setAnswers((prev) => ({ ...prev, inventoryStatus: v }))}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 단계 표시기 */}
      {!isResultStep && (
        <GuideStepIndicator currentStep={currentStep} />
      )}

      {/* 메인 카드 */}
      <Card>
        <CardContent className="p-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* 하단 네비게이션 */}
      {!isResultStep && currentStep > 0 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={handlePrev} disabled={isLoading}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            이전
          </Button>

          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={!isStepComplete()}>
              다음
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!isStepComplete() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  결과 보기
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
