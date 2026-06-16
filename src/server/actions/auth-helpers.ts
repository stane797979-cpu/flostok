/**
 * 인증 헬퍼 함수
 * - 모든 Server Actions에서 사용하는 공통 인증 로직
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/server/db'
import { users } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export type AuthUser = {
  id: string
  authId: string
  organizationId: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: 'admin' | 'manager' | 'viewer' | 'warehouse'
  isSuperadmin: boolean
  createdAt: Date
  updatedAt: Date
}

/** 개발용 더미 사용자 (Supabase 미연결 시) */
const DEV_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  authId: 'dev-auth-id',
  organizationId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@dev.local',
  name: '개발자',
  avatarUrl: null,
  role: 'admin',
  isSuperadmin: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function isDevMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  return !url || !key || url.includes('dummy') || key.includes('dummy')
}

/**
 * 현재 로그인한 사용자 정보 조회
 * @returns 사용자 정보 또는 null (미인증 시)
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  // 개발 환경 (Supabase 미연결): 더미 사용자 반환
  if (isDevMode()) {
    return DEV_USER
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // DB에서 사용자 정보 조회 (authId로)
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1)

    if (dbUser) return dbUser

    // authId로 못 찾으면, 이메일로 찾아서 authId 자동 동기화
    if (user.email) {
      const [emailUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1)

      if (emailUser) {
        await db.update(users).set({ authId: user.id, updatedAt: new Date() }).where(eq(users.id, emailUser.id))
        return { ...emailUser, authId: user.id }
      }
    }

    return null
  } catch (error) {
    console.error('getCurrentUser 오류:', error)
    return null
  }
}

/**
 * 인증 필수 - 미인증 시 에러 발생
 * @returns 사용자 정보
 * @throws Error 미인증 시
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('인증이 필요합니다')
  }
  return user
}

/**
 * 관리자 권한 확인
 * @returns 사용자 정보
 * @throws Error 권한 부족 시
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다')
  }
  return user
}

/**
 * 관리자 또는 매니저 권한 확인
 * @returns 사용자 정보
 * @throws Error 권한 부족 시
 */
export async function requireManagerOrAbove(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role === 'viewer' || user.role === 'warehouse') {
    throw new Error('매니저 이상 권한이 필요합니다')
  }
  return user
}

/**
 * 창고 이상 권한 확인 (warehouse, manager, admin)
 * @returns 사용자 정보
 * @throws Error 권한 부족 시
 */
export async function requireWarehouseOrAbove(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role === 'viewer') {
    throw new Error('창고 이상 권한이 필요합니다')
  }
  return user
}

/**
 * 슈퍼관리자 권한 확인
 * @returns 사용자 정보
 * @throws Error 권한 부족 시
 */
export async function requireSuperadmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (!user.isSuperadmin) {
    throw new Error('슈퍼관리자 권한이 필요합니다')
  }
  return user
}
