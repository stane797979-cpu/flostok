'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { DiagnosticStepIndicator } from './diagnostic-step-indicator';
import { StepCategorySelect } from './step-category-select';
import { StepInventoryDiagnosis } from './step-inventory-diagnosis';
import { StepLogisticsDiagnosis } from './step-logistics-diagnosis';
import { StepOrderDiagnosis } from './step-order-diagnosis';
import { DiagnosticResultView } from './diagnostic-result';
import { runScmDiagnosis } from '@/server/actions/scm-diagnostic';
import type {
  DiagnosticCategory,
  DiagnosticAnswers,
  InventoryAnswers,
  LogisticsAnswers,
  OrderAnswers,
  DiagnosticResult,
} from '@/server/services/scm/diagnostic-engine';

/** 카테고리 표시 순서 */
const CATEGORY_ORDER: DiagnosticCategory[] = ['inventory', 'logistics', 'order'];

/** 각 카테고리의 필수 답변 키 수 */
const REQUIRED_ANSWER_COUNT: Record<DiagnosticCategory, number> = {
  inventory: 9,
  logistics: 10,
  order: 9,
};

export function ScmDiagnosticWizard() {
  // ── 상태 ──────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<DiagnosticCategory[]>([]);
  const [inventoryAnswers, setInventoryAnswers] = useState<Partial<InventoryAnswers>>({});
  const [logisticsAnswers, setLogisticsAnswers] = useState<Partial<LogisticsAnswers>>({});
  const [orderAnswers, setOrderAnswers] = useState<Partial<OrderAnswers>>({});
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 선택한 카테고리를 고정 순서로 정렬
  const orderedCategories = CATEGORY_ORDER.filter((c) =>
    selectedCategories.includes(c)
  );

  // 총 스텝 수: 카테고리 선택(1) + 선택된 카테고리 질문 수
  const totalSteps = 1 + orderedCategories.length;
  const isLastStep = currentStep === totalSteps - 1;
  const isResultView = result !== null;

  // ── 현재 스텝의 카테고리 ─────────────────
  const getCurrentCategory = (): DiagnosticCategory | null => {
    if (currentStep === 0) return null;
    return orderedCategories[currentStep - 1] ?? null;
  };

  // ── 스텝 완료 여부 ────────────────────────
  const isStepComplete = (): boolean => {
    if (currentStep === 0) {
      return selectedCategories.length > 0;
    }

    const category = getCurrentCategory();
    if (!category) return false;

    switch (category) {
      case 'inventory':
        return Object.keys(inventoryAnswers).length >= REQUIRED_ANSWER_COUNT.inventory;
      case 'logistics':
        return Object.keys(logisticsAnswers).length >= REQUIRED_ANSWER_COUNT.logistics;
      case 'order':
        return Object.keys(orderAnswers).length >= REQUIRED_ANSWER_COUNT.order;
      default:
        return false;
    }
  };

  // ── 다음 / 결과 보기 ─────────────────────
  const handleNext = useCallback(async () => {
    if (!isLastStep) {
      setCurrentStep((s) => s + 1);
      return;
    }

    // 마지막 스텝 → 진단 실행
    setIsLoading(true);
    setError(null);

    try {
      const answers: DiagnosticAnswers = {
        selectedCategories: orderedCategories,
        ...(orderedCategories.includes('inventory') && {
          inventory: inventoryAnswers as InventoryAnswers,
        }),
        ...(orderedCategories.includes('logistics') && {
          logistics: logisticsAnswers as LogisticsAnswers,
        }),
        ...(orderedCategories.includes('order') && {
          order: orderAnswers as OrderAnswers,
        }),
      };

      const diagnosticResult = await runScmDiagnosis(answers);
      setResult(diagnosticResult);
    } catch (err) {
      console.error('[ScmDiagnosticWizard] 진단 실행 실패:', err);
      setError('진단 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [isLastStep, orderedCategories, inventoryAnswers, logisticsAnswers, orderAnswers]);

  // ── 이전 ──────────────────────────────────
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  // ── 초기화 ────────────────────────────────
  const handleReset = () => {
    setCurrentStep(0);
    setSelectedCategories([]);
    setInventoryAnswers({});
    setLogisticsAnswers({});
    setOrderAnswers({});
    setResult(null);
    setError(null);
  };

  // ── 스텝별 렌더링 ────────────────────────
  const renderStep = () => {
    if (isResultView) {
      return <DiagnosticResultView result={result} onReset={handleReset} />;
    }

    if (currentStep === 0) {
      return (
        <StepCategorySelect
          selected={selectedCategories}
          onChange={setSelectedCategories}
        />
      );
    }

    const category = getCurrentCategory();

    switch (category) {
      case 'inventory':
        return (
          <StepInventoryDiagnosis
            answers={inventoryAnswers}
            onChange={setInventoryAnswers}
          />
        );
      case 'logistics':
        return (
          <StepLogisticsDiagnosis
            answers={logisticsAnswers}
            onChange={setLogisticsAnswers}
          />
        );
      case 'order':
        return (
          <StepOrderDiagnosis
            answers={orderAnswers}
            onChange={setOrderAnswers}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 스텝 인디케이터 */}
      {!isResultView && selectedCategories.length > 0 && (
        <DiagnosticStepIndicator
          selectedCategories={orderedCategories}
          currentStep={currentStep}
        />
      )}

      {/* 메인 카드 */}
      <Card>
        <CardContent className="p-6">{renderStep()}</CardContent>
      </Card>

      {/* 에러 메시지 */}
      {error && (
        <p className="text-center text-sm text-red-600">{error}</p>
      )}

      {/* 하단 네비게이션 */}
      {!isResultView && (
        <div className="flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <Button variant="ghost" onClick={handlePrev} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                이전
              </Button>
            )}
          </div>

          <Button
            onClick={handleNext}
            disabled={!isStepComplete() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                진단 중...
              </>
            ) : isLastStep ? (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                결과 보기
              </>
            ) : (
              <>
                다음
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
