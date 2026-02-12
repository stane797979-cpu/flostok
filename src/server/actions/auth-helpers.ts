/**
 * 인증 헬퍼 함수
 * - 모든 Server Actions에서 사용하는 공통 인증 로직
 * - React.cache()로 요청 단위 메모이제이션 적용 (auth-cache.ts)
 */

'use server'

import { getCachedCurrentUser } from '@/server/auth-cache'
export type { AuthUser } from '@/server/auth-cache'

/**
 * 현재 로그인한 사용자 정보 조회
 * @returns 사용자 정보 또는 null (미인증 시)
 */
export async function getCurrentUser() {
  return getCachedCurrentUser()
}

/**
 * 인증 필수 - 미인증 시 에러 발생
 * @returns 사용자 정보
 * @throws Error 미인증 시
 */
export async function requireAuth() {
  const user = await getCachedCurrentUser()
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
export async function requireAdmin() {
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
export async function requireManagerOrAbove() {
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
export async function requireWarehouseOrAbove() {
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
export async function requireSuperadmin() {
  const user = await requireAuth()
  if (!user.isSuperadmin) {
    throw new Error('슈퍼관리자 권한이 필요합니다')
  }
  return user
}
