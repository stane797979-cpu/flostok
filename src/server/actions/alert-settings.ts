"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { AlertSettings, OrganizationSettings } from "@/types/organization-settings";
import { DEFAULT_ALERT_SETTINGS } from "@/types/organization-settings";
import { getCurrentUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

/**
 * 알림 설정 조회
 */
export async function getAlertSettings(): Promise<AlertSettings> {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return DEFAULT_ALERT_SETTINGS;
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    if (!org) {
      return DEFAULT_ALERT_SETTINGS;
    }

    const settings = org.settings as OrganizationSettings | null;
    return settings?.alertSettings
      ? { ...DEFAULT_ALERT_SETTINGS, ...settings.alertSettings }
      : DEFAULT_ALERT_SETTINGS;
  } catch (error) {
    console.error("[getAlertSettings] 조회 실패:", error);
    return DEFAULT_ALERT_SETTINGS;
  }
}

/**
 * 알림 설정 저장
 */
export async function saveAlertSettings(
  alertSettings: Partial<AlertSettings>
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return { success: false, message: "인증이 필요합니다" };
    }

    // 값 범위 검증
    if (
      alertSettings.stockThresholdPercent !== undefined &&
      (alertSettings.stockThresholdPercent < 0 || alertSettings.stockThresholdPercent > 200)
    ) {
      return { success: false, message: "재고 임계값은 0~200% 사이여야 합니다" };
    }
    if (
      alertSettings.orderDelayDays !== undefined &&
      (alertSettings.orderDelayDays < 1 || alertSettings.orderDelayDays > 14)
    ) {
      return { success: false, message: "납기 알림 기준은 1~14일 사이여야 합니다" };
    }
    if (
      alertSettings.demandChangePercent !== undefined &&
      (alertSettings.demandChangePercent < 10 || alertSettings.demandChangePercent > 100)
    ) {
      return { success: false, message: "수요 변동 기준은 10~100% 사이여야 합니다" };
    }

    // 현재 설정 조회
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    if (!org) {
      return { success: false, message: "조직을 찾을 수 없습니다" };
    }

    const currentSettings = (org.settings as OrganizationSettings) || {};
    const currentAlertSettings = currentSettings.alertSettings ?? DEFAULT_ALERT_SETTINGS;

    const updatedSettings: OrganizationSettings = {
      ...currentSettings,
      alertSettings: {
        ...currentAlertSettings,
        ...alertSettings,
      },
    };

    await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, user.organizationId));

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/alerts");

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "organization_settings",
      description: "알림 임계값 설정 변경",
    });

    return { success: true, message: "알림 설정이 저장되었습니다" };
  } catch (error) {
    console.error("[saveAlertSettings] 저장 실패:", error);
    return { success: false, message: "알림 설정 저장 중 오류가 발생했습니다" };
  }
}

/**
 * 알림 설정 초기화
 */
export async function resetAlertSettings(): Promise<{ success: boolean; message: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return { success: false, message: "인증이 필요합니다" };
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.organizationId))
      .limit(1);

    if (!org) {
      return { success: false, message: "조직을 찾을 수 없습니다" };
    }

    const currentSettings = (org.settings as OrganizationSettings) || {};
    const updatedSettings: OrganizationSettings = {
      ...currentSettings,
      alertSettings: DEFAULT_ALERT_SETTINGS,
    };

    await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, user.organizationId));

    revalidatePath("/dashboard/settings");

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "organization_settings",
      description: "알림 임계값 설정 초기화",
    });

    return { success: true, message: "알림 설정이 기본값으로 초기화되었습니다" };
  } catch (error) {
    console.error("[resetAlertSettings] 초기화 실패:", error);
    return { success: false, message: "알림 설정 초기화 중 오류가 발생했습니다" };
  }
}
