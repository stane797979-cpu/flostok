'use server'

import { z } from 'zod'
import { db } from '@/server/db'
import { organizations } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// ============================================
// 타입 정의
// ============================================

export interface APIKey {
  id: string
  name: string
  key: string
  maskedKey: string
  createdAt: string
  lastUsedAt?: string
  status: 'active' | 'revoked'
}

interface OrganizationSettings {
  apiKeys?: Array<{
    id: string
    name: string
    keyHash: string // SHA-256 해시
    prefix: string // 키 프리픽스 (표시용)
    createdAt: string
    lastUsedAt?: string
    status: 'active' | 'revoked'
  }>
  [key: string]: unknown
}

// ============================================
// 유효성 검증 스키마
// ============================================

const createApiKeySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1, 'API 키 이름을 입력해주세요').max(100),
})

const deleteApiKeySchema = z.object({
  organizationId: z.string().uuid(),
  keyId: z.string(),
})

const updateLastUsedSchema = z.object({
  organizationId: z.string().uuid(),
  keyId: z.string(),
})

// ============================================
// 헬퍼 함수
// ============================================

/**
 * API 키 생성 (fs_live_ 프리픽스 + 32바이트 랜덤)
 */
function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32)
  const key = randomBytes.toString('base64url')
  return `fs_live_${key}`
}

/**
 * API 키 해싱 (SHA-256)
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * API 키 마스킹 (마지막 4자리만 표시)
 */
function maskApiKey(key: string): string {
  const prefix = key.split('_')[0] + '_' + key.split('_')[1] + '_'
  const suffix = key.slice(-4)
  return `${prefix}${'•'.repeat(28)}${suffix}`
}

/**
 * 조직의 현재 사용자 확인
 */
async function verifyOrganizationAccess(_organizationId: string): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  // TODO: users 테이블에서 실제 조직 권한 확인
  // 현재는 간단히 organizationId만 검증
  return true
}

// ============================================
// Server Actions
// ============================================

/**
 * API 키 생성
 */
export async function createApiKey(input: z.infer<typeof createApiKeySchema>) {
  try {
    const validated = createApiKeySchema.parse(input)

    // 권한 확인
    const hasAccess = await verifyOrganizationAccess(validated.organizationId)
    if (!hasAccess) {
      return {
        success: false,
        error: '조직에 접근할 권한이 없습니다',
      }
    }

    // API 키 생성
    const apiKey = generateApiKey()
    const keyHash = hashApiKey(apiKey)
    const prefix = apiKey.slice(0, 12)

    // 조직 설정 가져오기
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, validated.organizationId))
      .limit(1)

    if (!org) {
      return {
        success: false,
        error: '조직을 찾을 수 없습니다',
      }
    }

    const settings = (org.settings as OrganizationSettings) || {}
    const apiKeys = settings.apiKeys || []

    // 새 키 추가
    const newKey = {
      id: crypto.randomUUID(),
      name: validated.name,
      keyHash,
      prefix,
      createdAt: new Date().toISOString(),
      status: 'active' as const,
    }

    apiKeys.push(newKey)

    // DB 업데이트
    await db
      .update(organizations)
      .set({
        settings: {
          ...settings,
          apiKeys,
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, validated.organizationId))

    revalidatePath('/dashboard/settings')

    return {
      success: true,
      data: {
        id: newKey.id,
        name: newKey.name,
        key: apiKey, // 한 번만 반환
        maskedKey: maskApiKey(apiKey),
        createdAt: newKey.createdAt,
      },
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '유효성 검증 실패',
      }
    }

    console.error('API 키 생성 실패:', error)
    return {
      success: false,
      error: 'API 키 생성에 실패했습니다',
    }
  }
}

/**
 * API 키 목록 조회
 */
export async function listApiKeys(organizationId: string) {
  try {
    // 권한 확인
    const hasAccess = await verifyOrganizationAccess(organizationId)
    if (!hasAccess) {
      return {
        success: false,
        error: '조직에 접근할 권한이 없습니다',
      }
    }

    // 조직 설정 가져오기
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1)

    if (!org) {
      return {
        success: false,
        error: '조직을 찾을 수 없습니다',
      }
    }

    const settings = (org.settings as OrganizationSettings) || {}
    const apiKeys = settings.apiKeys || []

    // active 상태만 필터링하고 마스킹된 키 반환
    const maskedKeys = apiKeys
      .filter((key) => key.status === 'active')
      .map((key) => ({
        id: key.id,
        name: key.name,
        maskedKey: `${key.prefix}${'•'.repeat(28)}${key.prefix.slice(-4)}`,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        status: key.status,
      }))

    return {
      success: true,
      data: maskedKeys,
    }
  } catch (error) {
    console.error('API 키 목록 조회 실패:', error)
    return {
      success: false,
      error: 'API 키 목록 조회에 실패했습니다',
    }
  }
}

/**
 * API 키 삭제 (실제로는 revoke)
 */
export async function deleteApiKey(input: z.infer<typeof deleteApiKeySchema>) {
  try {
    const validated = deleteApiKeySchema.parse(input)

    // 권한 확인
    const hasAccess = await verifyOrganizationAccess(validated.organizationId)
    if (!hasAccess) {
      return {
        success: false,
        error: '조직에 접근할 권한이 없습니다',
      }
    }

    // 조직 설정 가져오기
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, validated.organizationId))
      .limit(1)

    if (!org) {
      return {
        success: false,
        error: '조직을 찾을 수 없습니다',
      }
    }

    const settings = (org.settings as OrganizationSettings) || {}
    const apiKeys = settings.apiKeys || []

    // 키를 찾아서 revoke 상태로 변경
    const updatedKeys = apiKeys.map((key) => {
      if (key.id === validated.keyId) {
        return {
          ...key,
          status: 'revoked' as const,
        }
      }
      return key
    })

    // DB 업데이트
    await db
      .update(organizations)
      .set({
        settings: {
          ...settings,
          apiKeys: updatedKeys,
        },
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, validated.organizationId))

    revalidatePath('/dashboard/settings')

    return {
      success: true,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? '유효성 검증 실패',
      }
    }

    console.error('API 키 삭제 실패:', error)
    return {
      success: false,
      error: 'API 키 삭제에 실패했습니다',
    }
  }
}

/**
 * API 키 검증 (API Routes에서 사용)
 */
export async function verifyApiKey(apiKey: string): Promise<{
  valid: boolean
  organizationId?: string
  keyId?: string
}> {
  try {
    // API 키 형식 검증
    if (!apiKey.startsWith('fs_live_')) {
      return { valid: false }
    }

    const keyHash = hashApiKey(apiKey)

    // 모든 조직의 설정에서 해당 키 찾기
    const orgs = await db.select().from(organizations)

    for (const org of orgs) {
      const settings = (org.settings as OrganizationSettings) || {}
      const apiKeys = settings.apiKeys || []

      const matchedKey = apiKeys.find((key) => key.keyHash === keyHash && key.status === 'active')

      if (matchedKey) {
        // 마지막 사용 시간 업데이트 (비동기, 결과 대기 안함)
        updateLastUsed({
          organizationId: org.id,
          keyId: matchedKey.id,
        }).catch(console.error)

        return {
          valid: true,
          organizationId: org.id,
          keyId: matchedKey.id,
        }
      }
    }

    return { valid: false }
  } catch (error) {
    console.error('API 키 검증 실패:', error)
    return { valid: false }
  }
}

/**
 * 마지막 사용 시간 업데이트
 */
async function updateLastUsed(input: z.infer<typeof updateLastUsedSchema>) {
  try {
    const validated = updateLastUsedSchema.parse(input)

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, validated.organizationId))
      .limit(1)

    if (!org) return

    const settings = (org.settings as OrganizationSettings) || {}
    const apiKeys = settings.apiKeys || []

    const updatedKeys = apiKeys.map((key) => {
      if (key.id === validated.keyId) {
        return {
          ...key,
          lastUsedAt: new Date().toISOString(),
        }
      }
      return key
    })

    await db
      .update(organizations)
      .set({
        settings: {
          ...settings,
          apiKeys: updatedKeys,
        },
      })
      .where(eq(organizations.id, validated.organizationId))
  } catch (error) {
    console.error('마지막 사용 시간 업데이트 실패:', error)
  }
}
