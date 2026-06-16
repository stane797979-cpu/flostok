'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrganizationSettings } from './organization-settings'
import { getOrganizationAction } from '@/server/actions/organization'
import { Skeleton } from '@/components/ui/skeleton'

interface OrganizationTabProps {
  organizationId: string
}

export function OrganizationTab({ organizationId }: OrganizationTabProps) {
  const [organization, setOrganization] = useState<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    plan: string;
    settings: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrganization() {
      try {
        setIsLoading(true)
        const result = await getOrganizationAction(organizationId)

        if (result.success) {
          setOrganization(result.data)
        } else {
          setError(result.error)
        }
      } catch {
        setError('조직 정보를 불러오는 중 오류가 발생했습니다')
      } finally {
        setIsLoading(false)
      }
    }

    loadOrganization()
  }, [organizationId])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>조직 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>조직 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-slate-400">
            {error || '조직 정보를 불러올 수 없습니다'}
          </div>
        </CardContent>
      </Card>
    )
  }

  return <OrganizationSettings organization={organization} />
}
