/**
 * 인증 헬퍼 함수
 * - 모든 Server Actions에서 사용하는 공통 인증 로직
 * - 내부적으로 React cache()로 감싼 getCachedCurrentUser()를 사용하여
 *   동일 요청 내 중복 supabase.auth.getUser() 호출을 방지
 */

"use server";

import {
  getCachedCurrentUser,
  type AuthUser,
} from "@/server/auth/get-current-user";

export type { AuthUser };

/**
 * 현재 로그인한 사용자 정보 조회 (요청 내 캐싱)
 * @returns 사용자 정보 또는 null (미인증 시)
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return getCachedCurrentUser();
}

/**
 * 인증 필수 - 미인증 시 에러 발생
 * @returns 사용자 정보
 * @throws Error 미인증 시
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCachedCurrentUser();
  if (!user) {
    throw new Error("인증이 필요합니다");
  }
  return user;
}

/**
 * 관리자 권한 확인
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("관리자 권한이 필요합니다");
  }
  return user;
}

/**
 * 관리자 또는 매니저 권한 확인
 */
export async function requireManagerOrAbove(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role === "viewer" || user.role === "warehouse") {
    throw new Error("매니저 이상 권한이 필요합니다");
  }
  return user;
}

/**
 * 창고 이상 권한 확인 (warehouse, manager, admin)
 */
export async function requireWarehouseOrAbove(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role === "viewer") {
    throw new Error("창고 이상 권한이 필요합니다");
  }
  return user;
}

/**
 * 슈퍼관리자 권한 확인
 */
export async function requireSuperadmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!user.isSuperadmin) {
    throw new Error("슈퍼관리자 권한이 필요합니다");
  }
  return user;
}
