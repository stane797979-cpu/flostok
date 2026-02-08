"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type {
  WizardState,
  UploadedFileInfo,
  CompanyInfo,
  MappingEntry,
} from "@/types/onboarding";
import { WizardProgress } from "./wizard-progress";
import { StepCompanyInfo } from "./step-company-info";
import { StepFileUpload } from "./step-file-upload";
import { StepFileAnalysis } from "./step-file-analysis";
import { StepColumnMapping } from "./step-column-mapping";
import { StepPreviewImport } from "./step-preview-import";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  updateSessionStep,
  completeOnboardingSession,
} from "@/server/actions/onboarding";
import { useToast } from "@/hooks/use-toast";

interface OnboardingWizardProps {
  initialSessionId?: string;
  initialStep?: number;
  initialFiles?: UploadedFileInfo[];
}

const STEPS = [
  { title: "회사 정보", description: "기본 정보 입력" },
  { title: "파일 업로드", description: "데이터 파일 업로드" },
  { title: "구조 분석", description: "파일 구조 확인" },
  { title: "컬럼 매핑", description: "필드 매핑 설정" },
  { title: "미리보기", description: "임포트 미리보기" },
];

export function OnboardingWizard({
  initialSessionId,
  initialStep = 1,
  initialFiles = [],
}: OnboardingWizardProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [state, setState] = useState<WizardState>({
    currentStep: initialStep,
    sessionId: initialSessionId,
    companyInfo: {
      industry: "",
      employeeCount: "",
      skuCount: "",
      currentSystem: "",
      notes: "",
    },
    files: initialFiles,
    mappings: {},
  });

  const [canGoNext, setCanGoNext] = useState(false);

  // 단계별 진행 가능 여부 체크
  useEffect(() => {
    switch (state.currentStep) {
      case 1:
        setCanGoNext(!!state.sessionId);
        break;
      case 2:
        setCanGoNext(state.files.length > 0);
        break;
      case 3:
        setCanGoNext(
          state.files.length > 0 &&
            state.files.every((f) => f.status === "analyzed" || f.status === "mapped" || f.status === "imported")
        );
        break;
      case 4:
        setCanGoNext(
          state.files.length > 0 &&
            state.files.every((f) => f.status === "mapped" || f.status === "imported")
        );
        break;
      case 5:
        setCanGoNext(true);
        break;
      default:
        setCanGoNext(false);
    }
  }, [state.currentStep, state.sessionId, state.files]);

  const handlePrevious = () => {
    if (state.currentStep > 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleNext = async () => {
    if (!canGoNext || state.currentStep >= 5) return;

    const nextStep = state.currentStep + 1;

    // DB에 현재 단계 업데이트
    if (state.sessionId) {
      const statusMap: Record<number, string> = {
        2: "uploaded",
        3: "analyzing",
        4: "mapping",
        5: "previewing",
      };
      const result = await updateSessionStep(
        state.sessionId,
        nextStep,
        statusMap[nextStep]
      );
      if (!result.success) {
        toast({
          title: "단계 저장 실패",
          description: result.error || "단계 업데이트 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        return;
      }
    }

    setState((prev) => ({ ...prev, currentStep: nextStep }));
  };

  const handleSessionCreated = (
    sessionId: string,
    companyInfo: CompanyInfo
  ) => {
    setState((prev) => ({
      ...prev,
      sessionId,
      companyInfo,
    }));
  };

  const handleFilesChange = (files: UploadedFileInfo[]) => {
    setState((prev) => ({ ...prev, files }));
  };

  const handleMappingsChange = (mappings: Record<string, MappingEntry[]>) => {
    setState((prev) => ({ ...prev, mappings }));
  };

  const handleComplete = async () => {
    if (state.sessionId) {
      await completeOnboardingSession(state.sessionId);
    }
    toast({
      title: "온보딩 완료",
      description: "데이터가 성공적으로 임포트되었습니다.",
    });
    router.push("/dashboard/onboarding");
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case 1:
        return (
          <StepCompanyInfo
            companyInfo={state.companyInfo}
            onChange={(info) =>
              setState((prev) => ({ ...prev, companyInfo: info }))
            }
            onSubmit={handleSessionCreated}
          />
        );
      case 2:
        return (
          <StepFileUpload
            sessionId={state.sessionId!}
            files={state.files}
            onFilesChange={handleFilesChange}
          />
        );
      case 3:
        return (
          <StepFileAnalysis
            files={state.files}
            onFilesChange={handleFilesChange}
          />
        );
      case 4:
        return (
          <StepColumnMapping
            files={state.files}
            mappings={state.mappings}
            onMappingsChange={handleMappingsChange}
            onFilesChange={handleFilesChange}
          />
        );
      case 5:
        return (
          <StepPreviewImport
            sessionId={state.sessionId!}
            files={state.files}
            onFilesChange={handleFilesChange}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* 프로그레스 바 */}
      <WizardProgress currentStep={state.currentStep} steps={STEPS} />

      {/* 현재 단계 컨텐츠 */}
      <div className="min-h-[400px]">{renderStep()}</div>

      {/* 네비게이션 버튼 */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={state.currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          이전
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/onboarding")}
          >
            나가기
          </Button>

          {state.currentStep < 5 ? (
            <Button onClick={handleNext} disabled={!canGoNext}>
              다음
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleComplete}>완료</Button>
          )}
        </div>
      </div>
    </div>
  );
}
