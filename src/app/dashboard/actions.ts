/**
 * 대시보드 레이아웃 전용 서버 데이터 로딩
 * - getCachedCurrentUser()로 page.tsx의 server action들과 인증 공유
 * - org + permissions 병렬 실행
 */

import { getCurrentUser } from "@/server/actions/auth-helpers";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getMenuPermissionsForRole } from "@/server/actions/permissions";

const DEFAULT_USER_INFO = {
  name: "관리자",
  role: "관리자",
  orgName: "",
  isSuperadmin: false,
  allowedMenus: ["*"] as string[],
};

const roleMap: Record<string, string> = {
  admin: "관리자",
  manager: "매니저",
  viewer: "뷰어",
  warehouse: "창고",
};

export async function getUserInfoForLayout() {
  try {
    // cache()로 캐싱된 인증 — page action들과 동일 호출 공유
    const user = await getCurrentUser();
    if (!user) return DEFAULT_USER_INFO;

    // org + permissions 병렬 실행 (직렬 → 병렬: 50-150ms 절감)
    const [org, allowedMenus] = await Promise.all([
      db.query.organizations
        .findFirst({
          where: eq(organizations.id, user.organizationId),
          columns: { name: true },
        })
        .catch(() => null),
      getMenuPermissionsForRole(user.organizationId, user.role).catch(
        () => ["*"] as string[]
      ),
    ]);

    return {
      name: user.name || user.email.split("@")[0],
      role: roleMap[user.role] || user.role,
      orgName: org?.name || "",
      isSuperadmin: user.isSuperadmin ?? false,
      allowedMenus,
    };
  } catch {
    return DEFAULT_USER_INFO;
  }
}
