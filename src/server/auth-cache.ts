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
import { users, organizations } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";

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

      // DB에서 사용자 정보 조회 (authId OR email 단일 쿼리)
      const whereCondition = user.email
        ? or(eq(users.authId, user.id), eq(users.email, user.email))
        : eq(users.authId, user.id);

      const [dbUser] = await db
        .select()
        .from(users)
        .where(whereCondition)
        .limit(1);

      if (!dbUser) {
        // Auth는 있지만 DB 레코드가 없는 경우 자동 프로비저닝
        // (회원가입 시 Auth 성공 후 DB 생성 실패한 경우 복구)
        if (user.email) {
          try {
            const userName =
              user.user_metadata?.name ||
              user.email.split("@")[0] ||
              "사용자";
            const orgName =
              user.user_metadata?.organization_name ||
              `${userName}님의 조직`;
            const baseSlug = user.email
              .split("@")[0]
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "-")
              .slice(0, 40);
            const slug = `${baseSlug}-${Date.now().toString(36)}`;

            const [newOrg] = await db
              .insert(organizations)
              .values({ name: orgName, slug, plan: "free" })
              .returning();

            if (newOrg) {
              const [newUser] = await db
                .insert(users)
                .values({
                  authId: user.id,
                  organizationId: newOrg.id,
                  email: user.email,
                  name: userName,
                  role: "admin",
                })
                .returning();

              if (newUser) return newUser;
            }
          } catch (provisionError) {
            console.error("사용자 자동 프로비저닝 실패:", provisionError);
          }
        }
        return null;
      }

      // 탈퇴한 사용자 차단
      if (dbUser.deletedAt) return null;

      // authId 동기화 필요 시 (email로 매칭된 경우) 비차단 업데이트
      if (dbUser.authId !== user.id) {
        db.update(users)
          .set({ authId: user.id, updatedAt: new Date() })
          .where(eq(users.id, dbUser.id))
          .then(() => {})
          .catch(() => {});
        return { ...dbUser, authId: user.id };
      }

      return dbUser;
    } catch (error) {
      console.error("getCurrentUser 오류:", error);
      return null;
    }
  }
);
