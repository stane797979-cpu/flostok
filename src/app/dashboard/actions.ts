/**
 * 대시보드 레이아웃 전용 서버 데이터 로딩
 * - 'use server' 없이 순수 서버 유틸로 작성 (Server Action이 아님)
 * - layout.tsx에서 직접 호출
 */

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
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser()

    if (error || !authUser) {
      return DEFAULT_USER_INFO
    }

    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1)

    if (!dbUser) {
      return DEFAULT_USER_INFO
    }

    const roleMap: Record<string, string> = { admin: '관리자', manager: '매니저', viewer: '뷰어', warehouse: '창고' }
    let orgName = ''
    try {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, dbUser.organizationId),
      })
      orgName = org?.name || ''
    } catch {
      /* 조직 조회 실패 무시 */
    }

    // 권한 조회
    let allowedMenus: string[] = ['*']
    try {
      allowedMenus = await getMenuPermissionsForRole(dbUser.organizationId, dbUser.role)
    } catch {
      /* 권한 조회 실패 시 기본값 유지 */
    }

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
