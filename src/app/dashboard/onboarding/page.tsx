import { getOnboardingSessions } from '@/server/actions/onboarding'
import { OnboardingListClient } from './_components/onboarding-list-client'

/**
 * 온보딩 세션 목록 페이지
 */
export default async function OnboardingPage() {
  const result = await getOnboardingSessions()
  const sessions = result.success ? result.data : []

  return <OnboardingListClient initialSessions={sessions} />
}
