import { ReactNode } from 'react'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { Toaster } from '@/components/ui/toaster'
import { getUserInfoForLayout } from './actions'
import { getSidebarBadges } from '@/server/actions/sidebar-badges'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const [userInfo, sidebarBadges] = await Promise.all([
    getUserInfoForLayout().catch(() => ({ name: '관리자', role: '관리자', orgName: '', isSuperadmin: false, allowedMenus: ['*'] as string[] })),
    getSidebarBadges().catch(() => ({} as Record<string, number>)),
  ])

  return (
    <>
      <DashboardShell userInfo={userInfo} sidebarBadges={sidebarBadges}>
        {children}
      </DashboardShell>
      <Toaster />
    </>
  )
}
