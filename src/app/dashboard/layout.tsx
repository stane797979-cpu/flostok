import { ReactNode } from 'react'
import { DashboardShell } from '@/components/layout/dashboard-shell'
import { Toaster } from '@/components/ui/toaster'
import { getUserInfoForLayout } from './actions'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const userInfo = await getUserInfoForLayout()

  return (
    <>
      <DashboardShell userInfo={userInfo}>
        {children}
      </DashboardShell>
      <Toaster />
    </>
  )
}
