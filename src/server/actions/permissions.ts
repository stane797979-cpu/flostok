"use server";

import { db } from "@/server/db";
import { roleMenuPermissions } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "./auth-helpers";
import { revalidatePath } from "next/cache";
import { ALL_MENU_KEYS, DEFAULT_PERMISSIONS } from "@/lib/constants/menu-permissions";

/**
 * 역할별 메뉴 권한 조회
 */
export async function getMenuPermissionsForRole(
  organizationId: string,
  role: string
): Promise<string[]> {
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

    // DB 레코드가 있으면 allowed인 것만 반환
    if (records.length > 0) {
      return records.filter((r) => r.isAllowed).map((r) => r.menuKey);
    }

    // 없으면 기본값 사용
    return DEFAULT_PERMISSIONS[role] || [];
  } catch {
    return DEFAULT_PERMISSIONS[role] || [];
  }
}

/**
 * 조직의 전체 권한 설정 조회 (설정 페이지용) — 인증 기반
 */
export async function getAllMenuPermissions(organizationId?: string): Promise<
  Record<string, Record<string, boolean>>
> {
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

  try {
    const user = await requireAdmin();
    const orgId = user.organizationId || organizationId;

    const records = await db
      .select()
      .from(roleMenuPermissions)
      .where(eq(roleMenuPermissions.organizationId, orgId));

    // DB 레코드로 덮어쓰기
    for (const record of records) {
      if (result[record.role]) {
        result[record.role][record.menuKey] = record.isAllowed;
      }
    }
  } catch (error) {
    console.error("권한 설정 조회 오류:", error);
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

    // 배치 Upsert: 순차 SELECT+INSERT/UPDATE 루프 → 1개 쿼리 (30→1)
    const entries = Object.entries(permissions);
    const values = entries.map(([menuKey, isAllowed]) => ({
      organizationId,
      role: role as "admin" | "manager" | "viewer" | "warehouse",
      menuKey,
      isAllowed,
      updatedAt: new Date(),
    }));

    if (values.length > 0) {
      await db
        .insert(roleMenuPermissions)
        .values(values)
        .onConflictDoUpdate({
          target: [
            roleMenuPermissions.organizationId,
            roleMenuPermissions.role,
            roleMenuPermissions.menuKey,
          ],
          set: {
            isAllowed: sql`excluded.is_allowed`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("권한 업데이트 오류:", error);
    return { success: false, error: "권한 업데이트에 실패했습니다" };
  }
}
