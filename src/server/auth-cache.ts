/**
 * 요청 단위 인증 캐시
 *
 * React.cache()를 사용하여 동일 HTTP 요청 내에서 getCurrentUser()를
 * 여러 번 호출해도 Supabase API + DB 쿼리는 1회만 실행됩니다.
 *
 * 주의: "use server" 지시문 없음 (Railway standalone 빌드 호환성)
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export type AuthUser = {
  id: string;
  authId: string;
  organizationId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "admin" | "manager" | "viewer" | "warehouse";
  isSuperadmin: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** 개발용 더미 사용자 (Supabase 미연결 시) */
const DEV_USER: AuthUser = {
  id: "00000000-0000-0000-0000-000000000001",
  authId: "dev-auth-id",
  organizationId: "00000000-0000-0000-0000-000000000001",
  email: "admin@dev.local",
  name: "개발자",
  avatarUrl: null,
  role: "admin",
  isSuperadmin: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function isDevMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return !url || !key || url.includes("dummy") || key.includes("dummy");
}

/**
 * React.cache()로 감싼 getCurrentUser
 * - 동일 HTTP 요청 내에서는 1회만 실행
 * - 이후 호출은 캐시된 결과 반환
 */
export const getCachedCurrentUser = cache(
  async (): Promise<AuthUser | null> => {
    if (isDevMode()) {
      return DEV_USER;
    }

    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        return null;
      }

      // DB에서 사용자 정보 조회 (authId로)
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.authId, user.id))
        .limit(1);

      if (dbUser) {
        // 탈퇴한 사용자 차단
        if (dbUser.deletedAt) return null;
        return dbUser;
      }

      // authId로 못 찾으면, 이메일로 찾아서 authId 자동 동기화
      if (user.email) {
        const [emailUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (emailUser) {
          // 탈퇴한 사용자 차단
          if (emailUser.deletedAt) return null;
          await db
            .update(users)
            .set({ authId: user.id, updatedAt: new Date() })
            .where(eq(users.id, emailUser.id));
          return { ...emailUser, authId: user.id };
        }
      }

      return null;
    } catch (error) {
      console.error("getCurrentUser 오류:", error);
      return null;
    }
  }
);
