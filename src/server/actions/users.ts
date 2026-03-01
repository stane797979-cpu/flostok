'use server'

/**
 * 사용자 관련 Server Actions
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import { users, organizations } from '@/server/db/schema'
import { eq, and, asc, isNull } from 'drizzle-orm'
import { getCurrentUser } from './auth-helpers'

/** 응답 타입 */
type ActionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

/** 사용자 타입 */
export interface OrganizationUser {
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

/** 회원가입 후 조직 + 사용자 레코드 생성 */
export async function createUserWithOrganization(params: {
  authId: string
  email: string
  name: string
  organizationName: string
}): Promise<ActionResponse<{ userId: string; organizationId: string }>> {
  try {
    // slug 생성 (조직명에서 특수문자 제거 + 타임스탬프)
    const slug = params.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'org'
    const uniqueSlug = `${slug}-${Date.now().toString(36)}`

    // 조직 생성
    const [org] = await db.insert(organizations).values({
      name: params.organizationName,
      slug: uniqueSlug,
      plan: 'free',
    }).returning()

    // 사용자 생성 (admin 역할)
    const [user] = await db.insert(users).values({
      authId: params.authId,
      organizationId: org.id,
      email: params.email,
      name: params.name,
      role: 'admin',
    }).returning()

    return {
      success: true,
      data: { userId: user.id, organizationId: org.id },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '조직 생성에 실패했습니다',
    }
  }
}

/** 현재 로그인한 사용자의 프로필 (이름, 역할, 조직명) 조회 */
export async function getCurrentUserProfile(authId: string): Promise<{
  name: string;
  role: string;
  organizationName: string;
} | null> {
  try {
    // leftJoin으로 단일 쿼리 처리 (순차 2회 → 1회)
    const [row] = await db
      .select({
        name: users.name,
        email: users.email,
        role: users.role,
        organizationName: organizations.name,
      })
      .from(users)
      .leftJoin(organizations, eq(organizations.id, users.organizationId))
      .where(eq(users.authId, authId))
      .limit(1)

    if (!row) return null

    const roleMap: Record<string, string> = {
      admin: '관리자',
      manager: '매니저',
      viewer: '뷰어',
    }

    return {
      name: row.name || row.email.split('@')[0],
      role: roleMap[row.role] || row.role,
      organizationName: row.organizationName || '조직 미설정',
    }
  } catch {
    return null
  }
}

/** 조직의 사용자 목록 조회 — 인증 기반 */
export async function getOrganizationUsersAction(
  organizationId?: string
): Promise<ActionResponse<OrganizationUser[]>> {
  try {
    const currentUser = await getCurrentUser()
    const orgId = currentUser?.organizationId || organizationId
    if (!orgId) {
      return { success: false, error: '인증이 필요합니다' }
    }

    const organizationUsers = await db
      .select({
        id: users.id,
        authId: users.authId,
        organizationId: users.organizationId,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        role: users.role,
        isSuperadmin: users.isSuperadmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(
        eq(users.organizationId, orgId),
        isNull(users.deletedAt)
      ))
      .orderBy(asc(users.createdAt))

    return {
      success: true,
      data: organizationUsers,
    }
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '사용자 목록 조회에 실패했습니다',
    }
  }
}

/** 사용자 역할 변경 */
export async function updateUserRoleAction(
  userId: string,
  organizationId: string,
  newRole: 'admin' | 'manager' | 'viewer' | 'warehouse'
): Promise<ActionResponse<void>> {
  try {
    const currentUser = await getCurrentUser()
    const orgId = currentUser?.organizationId || organizationId

    // 사용자가 해당 조직에 속하는지 확인
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, orgId)))
      .limit(1)

    if (!user) {
      return {
        success: false,
        error: '사용자를 찾을 수 없습니다',
      }
    }

    // 역할 업데이트
    await db
      .update(users)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    revalidatePath('/dashboard/settings')

    return {
      success: true,
      data: undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '역할 변경에 실패했습니다',
    }
  }
}

/** 사용자 제거 */
export async function removeUserAction(
  userId: string,
  organizationId: string
): Promise<ActionResponse<void>> {
  try {
    const currentUser = await getCurrentUser()
    const orgId = currentUser?.organizationId || organizationId

    // 사용자가 해당 조직에 속하는지 확인
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, orgId)))
      .limit(1)

    if (!user) {
      return {
        success: false,
        error: '사용자를 찾을 수 없습니다',
      }
    }

    // 마지막 admin 체크 (최소 1명의 admin 필요)
    if (user.role === 'admin') {
      const adminUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.organizationId, orgId),
          eq(users.role, 'admin'),
          isNull(users.deletedAt)
        ))

      if (adminUsers.length <= 1) {
        return {
          success: false,
          error: '조직에 최소 1명의 관리자가 필요합니다',
        }
      }
    }

    // 사용자 제거
    await db.delete(users).where(eq(users.id, userId))

    revalidatePath('/dashboard/settings')

    return {
      success: true,
      data: undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '사용자 제거에 실패했습니다',
    }
  }
}

/** 슈퍼관리자 설정/해제 — admin만 가능 */
export async function toggleSuperadminAction(
  userId: string,
  isSuperadmin: boolean
): Promise<ActionResponse<void>> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: '인증이 필요합니다' }
    }

    // admin만 superadmin 설정 가능
    if (currentUser.role !== 'admin' && !currentUser.isSuperadmin) {
      return { success: false, error: '관리자 권한이 필요합니다' }
    }

    // 대상 사용자 확인
    const [targetUser] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.id, userId),
        eq(users.organizationId, currentUser.organizationId)
      ))
      .limit(1)

    if (!targetUser) {
      return { success: false, error: '사용자를 찾을 수 없습니다' }
    }

    // 본인의 superadmin 해제 시 다른 superadmin이 있는지 확인
    if (!isSuperadmin && userId === currentUser.id) {
      const otherSuperadmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.organizationId, currentUser.organizationId),
          eq(users.isSuperadmin, true),
          isNull(users.deletedAt)
        ))

      if (otherSuperadmins.length <= 1) {
        return {
          success: false,
          error: '최소 1명의 슈퍼관리자가 필요합니다. 다른 사용자를 먼저 슈퍼관리자로 지정해주세요.',
        }
      }
    }

    await db
      .update(users)
      .set({
        isSuperadmin,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    revalidatePath('/dashboard/settings')

    return { success: true, data: undefined }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '슈퍼관리자 설정에 실패했습니다',
    }
  }
}

/** 사용자 초대 (이메일 기반) */
export async function inviteUserAction(
  organizationId: string,
  email: string,
  role: 'admin' | 'manager' | 'viewer' | 'warehouse'
): Promise<ActionResponse<void>> {
  try {
    const currentUser = await getCurrentUser()
    const orgId = currentUser?.organizationId || organizationId

    // 이메일 중복 확인
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), eq(users.organizationId, orgId)))
      .limit(1)

    if (existingUser) {
      return {
        success: false,
        error: '이미 등록된 이메일입니다',
      }
    }

    // TODO: 실제로는 Supabase Auth를 통한 초대 이메일 발송 필요
    // 현재는 임시 사용자 생성 (authId는 임시값)
    await db.insert(users).values({
      authId: `temp_${Date.now()}_${Math.random()}`, // 임시 authId
      organizationId: orgId,
      email,
      name: email.split('@')[0], // 이메일에서 이름 추출
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    revalidatePath('/dashboard/settings')

    return {
      success: true,
      data: undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '사용자 초대에 실패했습니다',
    }
  }
}
