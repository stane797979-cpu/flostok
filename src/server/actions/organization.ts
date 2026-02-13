'use server'

/**
 * 조직 관련 Server Actions
 *
 * 모든 조회/수정은 getCurrentUser() 기반으로 조직 ID를 결정합니다.
 * 클라이언트에서 organizationId를 전달할 필요 없음.
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import { organizations } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import {
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from '@/lib/validations/organization'
import { getCurrentUser } from './auth-helpers'

/** 응답 타입 */
type ActionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

/** 조직 정보 조회 — 인증 기반 (organizationId 파라미터는 폴백용) */
export async function getOrganizationAction(
  organizationId?: string
): Promise<ActionResponse<{
  id: string
  name: string
  slug: string
  logoUrl: string | null
  plan: string
  settings: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}>> {
  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId || organizationId
    if (!orgId) {
      return { success: false, error: '인증이 필요합니다' }
    }

    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!organization) {
      return {
        success: false,
        error: '조직 정보를 찾을 수 없습니다',
      }
    }

    return {
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logoUrl: organization.logoUrl,
        plan: organization.plan,
        settings: (organization.settings as Record<string, unknown>) || {},
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    }
  } catch (error) {
    console.error('조직 정보 조회 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '조직 정보 조회에 실패했습니다',
    }
  }
}

/** 조직 정보 업데이트 — 인증 기반 */
export async function updateOrganizationAction(
  _organizationId: string,
  input: UpdateOrganizationInput
): Promise<ActionResponse<void>> {
  try {
    const user = await getCurrentUser()
    const orgId = user?.organizationId || _organizationId
    if (!orgId) {
      return { success: false, error: '인증이 필요합니다' }
    }

    // 입력 검증
    const validated = updateOrganizationSchema.parse(input)

    // 조직 존재 확인
    const [existingOrganization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1)

    if (!existingOrganization) {
      return {
        success: false,
        error: '조직 정보를 찾을 수 없습니다',
      }
    }

    // 기존 settings 가져오기
    const currentSettings = (existingOrganization.settings as Record<string, unknown>) || {}

    // settings에 연락처 정보 저장
    const updatedSettings = {
      ...currentSettings,
      contact: {
        phone: validated.contactPhone || '',
        email: validated.contactEmail || '',
      },
      address: {
        full: validated.address || '',
        detail: validated.addressDetail || '',
        postalCode: validated.postalCode || '',
      },
    }

    // 조직 정보 업데이트
    await db
      .update(organizations)
      .set({
        name: validated.name,
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))

    revalidatePath('/settings')

    return {
      success: true,
      data: undefined,
    }
  } catch (error) {
    console.error('조직 정보 업데이트 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '조직 정보 업데이트에 실패했습니다',
    }
  }
}
