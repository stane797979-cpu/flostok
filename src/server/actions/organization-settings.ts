"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type {
  OrderPolicySettings,
  OrganizationSettings,
} from "@/types/organization-settings";
import { DEFAULT_ORDER_POLICY } from "@/types/organization-settings";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

/**
 * 발주 정책 설정 스키마
 */
const orderPolicySchema = z.object({
  serviceLevel: z
    .number()
    .min(90, "서비스 레벨은 90% 이상이어야 합니다")
    .max(99.9, "서비스 레벨은 99.9% 이하여야 합니다"),
  safetyStockMultiplier: z
    .number()
    .min(0.1, "안전재고 배수는 0.1 이상이어야 합니다")
    .max(2, "안전재고 배수는 2.0 이하여야 합니다"),
  autoReorderThreshold: z
    .number()
    .min(50, "자동 발주 임계값은 50% 이상이어야 합니다")
    .max(150, "자동 발주 임계값은 150% 이하여야 합니다"),
  targetDaysOfInventory: z
    .number()
    .min(7, "목표 재고일수는 7일 이상이어야 합니다")
    .max(90, "목표 재고일수는 90일 이하여야 합니다"),
  defaultLeadTimeDays: z
    .number()
    .min(1, "기본 리드타임은 1일 이상이어야 합니다")
    .max(60, "기본 리드타임은 60일 이하여야 합니다"),
});

/**
 * 발주 정책 설정 조회
 */
export async function getOrderPolicySettings(
  organizationId: string
): Promise<OrderPolicySettings> {
  try {
    const user = await requireAuth();

    // 권한 확인: 사용자의 조직만 조회 가능
    if (user.organizationId !== organizationId) {
      throw new Error("권한이 없습니다");
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      throw new Error("조직을 찾을 수 없습니다");
    }

    const settings = org.settings as OrganizationSettings | null;
    return settings?.orderPolicy || DEFAULT_ORDER_POLICY;
  } catch (error) {
    console.error("발주 정책 설정 조회 실패:", error);
    // 에러 시 기본값 반환
    return DEFAULT_ORDER_POLICY;
  }
}

/**
 * 발주 정책 설정 저장
 */
export async function updateOrderPolicySettings(
  organizationId: string,
  orderPolicy: OrderPolicySettings
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await requireAuth();

    // 권한 확인: 사용자의 조직만 수정 가능
    if (user.organizationId !== organizationId) {
      return {
        success: false,
        message: "권한이 없습니다",
      };
    }

    // 입력 검증
    const validated = orderPolicySchema.parse(orderPolicy);

    // 현재 설정 조회
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return {
        success: false,
        message: "조직을 찾을 수 없습니다",
      };
    }

    // 기존 settings 유지하면서 orderPolicy만 업데이트
    const currentSettings = (org.settings as OrganizationSettings) || {};
    const updatedSettings: OrganizationSettings = {
      ...currentSettings,
      orderPolicy: validated,
    };

    // DB 업데이트
    await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    // 캐시 무효화
    revalidatePath("/settings");
    revalidatePath("/orders");
    revalidatePath("/");

    // 활동 로그 기록
    await logActivity({
      user,
      action: "UPDATE",
      entityType: "organization_settings",
      description: `조직 설정 변경`,
    });

    return {
      success: true,
      message: "발주 정책이 성공적으로 저장되었습니다",
    };
  } catch (error) {
    console.error("발주 정책 설정 저장 실패:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message:
          error.issues?.[0]?.message || "입력 데이터가 올바르지 않습니다",
      };
    }

    return {
      success: false,
      message: "발주 정책 저장 중 오류가 발생했습니다",
    };
  }
}

/**
 * 발주 정책 초기화 (기본값으로 리셋)
 */
export async function resetOrderPolicySettings(
  organizationId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await requireAuth();

    // 권한 확인
    if (user.organizationId !== organizationId) {
      return {
        success: false,
        message: "권한이 없습니다",
      };
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return {
        success: false,
        message: "조직을 찾을 수 없습니다",
      };
    }

    const currentSettings = (org.settings as OrganizationSettings) || {};
    const updatedSettings: OrganizationSettings = {
      ...currentSettings,
      orderPolicy: DEFAULT_ORDER_POLICY,
    };

    await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    revalidatePath("/settings");
    revalidatePath("/orders");
    revalidatePath("/");

    // 활동 로그 기록
    await logActivity({
      user,
      action: "UPDATE",
      entityType: "organization_settings",
      description: `조직 설정 초기화`,
    });

    return {
      success: true,
      message: "발주 정책이 기본값으로 초기화되었습니다",
    };
  } catch (error) {
    console.error("발주 정책 초기화 실패:", error);
    return {
      success: false,
      message: "발주 정책 초기화 중 오류가 발생했습니다",
    };
  }
}
