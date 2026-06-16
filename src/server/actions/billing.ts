"use server";

import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const VALID_PLANS = ["free", "starter", "pro", "enterprise"];

export async function updateOrganizationPlan(
  orgId: string,
  plan: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!orgId) {
      return { success: false, error: "조직 ID가 없습니다." };
    }

    if (!VALID_PLANS.includes(plan)) {
      return { success: false, error: "유효하지 않은 플랜입니다." };
    }

    await db
      .update(organizations)
      .set({ plan, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));

    return { success: true };
  } catch (error) {
    console.error("플랜 변경 오류:", error);
    return { success: false, error: "플랜 변경 중 오류가 발생했습니다." };
  }
}
