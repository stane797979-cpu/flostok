/**
 * 활동 로그 기록 유틸
 *
 * fire-and-forget 방식: 메인 작업 성능에 영향 없음
 */

import { db } from "@/server/db";
import { activityLogs } from "@/server/db/schema";

export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "IMPORT"
  | "EXPORT";

export type ActivityEntityType =
  | "product"
  | "supplier"
  | "inventory"
  | "purchase_order"
  | "sales_record"
  | "inbound_record"
  | "outbound_record"
  | "organization_settings"
  | "excel_import"
  | "excel_export"
  | "onboarding";

interface LogActivityParams {
  /** 사용자 정보 (requireAuth() 또는 getCurrentUser() 결과) */
  user: {
    id: string;
    organizationId: string;
    name?: string | null;
    email: string;
  };
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * 활동 로그 기록
 *
 * - await 가능한 async 함수
 * - Next.js Server Action 환경에서 fire-and-forget은 실행 보장이 안 되므로 await 사용 권장
 * - 로깅 실패 시 콘솔 에러만 출력, 메인 작업에 영향 없음
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  const { user, action, entityType, entityId, description, metadata } = params;

  try {
    await db.insert(activityLogs).values({
      organizationId: user.organizationId,
      userId: user.id,
      userName: user.name || user.email,
      action,
      entityType,
      entityId: entityId || null,
      description,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error("[ActivityLog] 로깅 실패:", error);
  }
}
