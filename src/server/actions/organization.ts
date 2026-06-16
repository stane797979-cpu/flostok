'use server'

/**
 * 조직 관련 Server Actions
 */

import { revalidatePath } from 'next/cache'
import { db } from '@/server/db'
import { organizations } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import {
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from '@/lib/validations/organization'

/** 응답 타입 */
type ActionResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

/** 조직 정보 조회 */
export async function getOrganizationAction(
  organizationId: string
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
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    })

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
    return {
      success: false,
      error: error instanceof Error ? error.message : '조직 정보 조회에 실패했습니다',
    }
  }
}

/** 조직 정보 업데이트 */
export async function updateOrganizationAction(
  organizationId: string,
  input: UpdateOrganizationInput
): Promise<ActionResponse<void>> {
  try {
    // 입력 검증
    const validated = updateOrganizationSchema.parse(input)

    // 조직 존재 확인
    const existingOrganization = await db.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    })

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
      .where(eq(organizations.id, organizationId))

    revalidatePath('/settings')

    return {
      success: true,
      data: undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '조직 정보 업데이트에 실패했습니다',
    }
  }
}
