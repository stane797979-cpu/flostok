import { Metadata } from 'next';
import { ScmDiagnosticWizard } from './_components/scm-diagnostic-wizard';

export const metadata: Metadata = {
  title: 'SCM 진단키트 | Stock & Logis',
  description:
    '간단한 설문으로 재고·물류·발주 현황을 진단하고 최적화 전략을 추천받으세요.',
};

export default function ScmDiagnosticPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          SCM 진단키트
        </h1>
        <p className="mt-2 text-muted-foreground">
          간단한 질문에 답하면 SCM 현황을 진단하고 물류 최적화 전략을 추천해 드립니다
        </p>
      </div>

      <ScmDiagnosticWizard />
    </div>
  );
}
