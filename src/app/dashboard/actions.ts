/**
 * 대시보드 레이아웃 전용 서버 데이터 로딩
 * - 'use server' 없이 순수 서버 유틸로 작성 (Server Action이 아님)
 * - layout.tsx에서 직접 호출
 */

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/server/db'
import { users, organizations } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { getMenuPermissionsForRole } from '@/server/actions/permissions'

const DEFAULT_USER_INFO = { name: '관리자', role: '관리자', orgName: '', isSuperadmin: false, allowedMenus: ['*'] as string[] }

function isDevMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return !url || !key || url.includes('dummy') || key.includes('dummy')
}

export async function getUserInfoForLayout() {
  if (isDevMode()) {
    return { name: '개발자', role: '관리자', orgName: '개발 조직', isSuperadmin: true, allowedMenus: ['*'] }
  }

  try {
    // 미들웨어에서 전달된 auth ID 우선 확인 (Supabase HTTP 호출 생략)
    const headerStore = await headers()
    const middlewareAuthId = headerStore.get('x-auth-user-id')

    let authUserId: string | null = null

    if (middlewareAuthId) {
      // 미들웨어가 이미 인증 완료 → Supabase 재호출 불필요 (100-200ms 절감)
      authUserId = middlewareAuthId
    } else {
      // 폴백: 미들웨어 경유하지 않은 경우 직접 인증
      const supabase = await createClient()
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      if (error || !authUser) return DEFAULT_USER_INFO
      authUserId = authUser.id
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUserId))
      .limit(1)

    if (!dbUser) {
      return DEFAULT_USER_INFO
    }

    const roleMap: Record<string, string> = { admin: '관리자', manager: '매니저', viewer: '뷰어', warehouse: '창고' }

    // org + permissions 병렬 조회 (순차 → 병렬로 15-30ms 절감)
    const [orgName, allowedMenus] = await Promise.all([
      db.query.organizations.findFirst({
        where: eq(organizations.id, dbUser.organizationId),
      }).then(org => org?.name || '').catch(() => ''),
      getMenuPermissionsForRole(dbUser.organizationId, dbUser.role).catch(() => ['*'] as string[]),
    ])

    return {
      name: dbUser.name || dbUser.email.split('@')[0],
      role: roleMap[dbUser.role] || dbUser.role,
      orgName,
      isSuperadmin: dbUser.isSuperadmin ?? false,
      allowedMenus,
    }
  } catch {
    return DEFAULT_USER_INFO
  }
}
