"use server";

import { db } from "@/server/db";
import { roleMenuPermissions } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { unstable_cache } from "next/cache";
import { ALL_MENU_KEYS, DEFAULT_PERMISSIONS } from "@/lib/constants/menu-permissions";

/**
 * 역할별 메뉴 권한 조회 (5분 캐싱)
 */
export async function getMenuPermissionsForRole(
  organizationId: string,
  role: string
): Promise<string[]> {
  return unstable_cache(
    async () => {
      try {
        const records = await db
          .select()
          .from(roleMenuPermissions)
          .where(
            and(
              eq(roleMenuPermissions.organizationId, organizationId),
              eq(roleMenuPermissions.role, role as "admin" | "manager" | "viewer" | "warehouse")
            )
          );

        if (records.length > 0) {
          return records.filter((r) => r.isAllowed).map((r) => r.menuKey);
        }

        return DEFAULT_PERMISSIONS[role] || [];
      } catch {
        return DEFAULT_PERMISSIONS[role] || [];
      }
    },
    [`permissions-${organizationId}-${role}`],
    { revalidate: 300, tags: [`permissions-${organizationId}`] }
  )();
}

/**
 * 조직의 전체 권한 설정 조회 (설정 페이지용)
 */
export async function getAllMenuPermissions(organizationId: string): Promise<
  Record<string, Record<string, boolean>>
> {
  await requireAdmin();

  const records = await db
    .select()
    .from(roleMenuPermissions)
    .where(eq(roleMenuPermissions.organizationId, organizationId));

  // 기본값으로 초기화
  const result: Record<string, Record<string, boolean>> = {};
  const roles = ["admin", "manager", "viewer", "warehouse"] as const;

  for (const role of roles) {
    result[role] = {};
    const defaults = DEFAULT_PERMISSIONS[role];
    for (const key of ALL_MENU_KEYS) {
      result[role][key] = defaults.includes("*") || defaults.includes(key);
    }
  }

  // DB 레코드로 덮어쓰기
  for (const record of records) {
    if (result[record.role]) {
      result[record.role][record.menuKey] = record.isAllowed;
    }
  }

  return result;
}

/**
 * 역할별 메뉴 권한 업데이트
 */
export async function updateMenuPermissions(
  role: string,
  permissions: Record<string, boolean>
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAdmin();
    const organizationId = user.organizationId;

    // admin 역할은 변경 불가
    if (role === "admin") {
      return { success: false, error: "관리자 역할의 권한은 변경할 수 없습니다" };
    }

    const entries = Object.entries(permissions);
    for (const [menuKey, isAllowed] of entries) {
      // upsert: 존재하면 업데이트, 없으면 생성
      const existing = await db
        .select()
        .from(roleMenuPermissions)
        .where(
          and(
            eq(roleMenuPermissions.organizationId, organizationId),
            eq(roleMenuPermissions.role, role as "admin" | "manager" | "viewer" | "warehouse"),
            eq(roleMenuPermissions.menuKey, menuKey)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(roleMenuPermissions)
          .set({ isAllowed, updatedAt: new Date() })
          .where(eq(roleMenuPermissions.id, existing[0].id));
      } else {
        await db.insert(roleMenuPermissions).values({
          organizationId,
          role: role as "admin" | "manager" | "viewer" | "warehouse",
          menuKey,
          isAllowed,
        });
      }
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("권한 업데이트 오류:", error);
    return { success: false, error: "권한 업데이트에 실패했습니다" };
  }
}
