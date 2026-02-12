/**
 * 요청 단위 캐싱된 현재 사용자 조회
 *
 * React cache()로 감싸므로 동일 렌더링 패스(request) 내에서
 * 몇 번을 호출하든 실제 실행은 최초 1회만 수행됩니다.
 *
 * - layout.tsx에서 1회 호출
 * - page.tsx의 server action 5개에서 각 1회 호출
 * → 총 6회 호출이지만 실제 supabase.auth.getUser() + DB 쿼리는 1회만
 *
 * 주의: 'use server' 없음 — 순수 서버 유틸리티 모듈
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

      if (dbUser) return dbUser;

      // authId로 못 찾으면, 이메일로 찾아서 authId 자동 동기화
      if (user.email) {
        const [emailUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (emailUser) {
          await db
            .update(users)
            .set({ authId: user.id, updatedAt: new Date() })
            .where(eq(users.id, emailUser.id));
          return { ...emailUser, authId: user.id };
        }
      }

      return null;
    } catch (error) {
      console.error("getCachedCurrentUser 오류:", error);
      return null;
    }
  }
);
