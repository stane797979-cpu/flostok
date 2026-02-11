'use server'

/**
 * 사용자 관련 Server Actions
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import { users, organizations } from '@/server/db/schema'
import { eq, and } from 'drizzle-orm'

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
    const user = await db.query.users.findFirst({
      where: eq(users.authId, authId),
    })
    if (!user) return null

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
    })

    const roleMap: Record<string, string> = {
      admin: '관리자',
      manager: '매니저',
      viewer: '뷰어',
    }

    return {
      name: user.name || user.email.split('@')[0],
      role: roleMap[user.role] || user.role,
      organizationName: org?.name || '조직 미설정',
    }
  } catch {
    return null
  }
}

/** 조직의 사용자 목록 조회 */
export async function getOrganizationUsersAction(
  organizationId: string
): Promise<ActionResponse<OrganizationUser[]>> {
  try {
    const organizationUsers = await db.query.users.findMany({
      where: eq(users.organizationId, organizationId),
      orderBy: (users, { asc }) => [asc(users.createdAt)],
    })

    return {
      success: true,
      data: organizationUsers,
    }
  } catch (error) {
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
    // 사용자가 해당 조직에 속하는지 확인
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.organizationId, organizationId)),
    })

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
    // 사용자가 해당 조직에 속하는지 확인
    const user = await db.query.users.findFirst({
      where: and(eq(users.id, userId), eq(users.organizationId, organizationId)),
    })

    if (!user) {
      return {
        success: false,
        error: '사용자를 찾을 수 없습니다',
      }
    }

    // 마지막 admin 체크 (최소 1명의 admin 필요)
    if (user.role === 'admin') {
      const adminCount = await db.query.users.findMany({
        where: and(eq(users.organizationId, organizationId), eq(users.role, 'admin')),
      })

      if (adminCount.length <= 1) {
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

/** 사용자 초대 (이메일 기반) */
export async function inviteUserAction(
  organizationId: string,
  email: string,
  role: 'admin' | 'manager' | 'viewer' | 'warehouse'
): Promise<ActionResponse<void>> {
  try {
    // 이메일 중복 확인
    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.organizationId, organizationId)),
    })

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
      organizationId,
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
