'use client'

import { OnboardingWizard } from '../_components/onboarding-wizard'

/**
 * 새 온보딩 세션 시작 페이지
 */
export default function NewOnboardingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">새 온보딩 시작</h1>
        <p className="text-slate-500 mt-2">
          고객사 정보와 데이터 파일을 순서대로 업로드하세요
        </p>
      </div>

      <OnboardingWizard />
    </div>
  )
}
