"use server";

import { db } from "@/server/db";
import {
  purchaseOrderApprovals,
  purchaseOrders,
  alerts,
  type PurchaseOrderApproval,
} from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

// 기본 결재라인 4단계
const DEFAULT_APPROVAL_STEPS = [
  { stepOrder: 1, roleName: "구매담당" },
  { stepOrder: 2, roleName: "팀장" },
];

/**
 * 발주서 결재라인 조회
 */
export async function getApprovalSteps(
  purchaseOrderId: string
): Promise<PurchaseOrderApproval[]> {
  return db
    .select()
    .from(purchaseOrderApprovals)
    .where(eq(purchaseOrderApprovals.purchaseOrderId, purchaseOrderId))
    .orderBy(asc(purchaseOrderApprovals.stepOrder));
}

/**
 * 결재 상신 — 발주서에 결재라인 생성 + status: pending으로 변경
 * 이미 결재라인이 있으면 그냥 반환
 */
export async function submitForApproval(
  purchaseOrderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "인증이 필요합니다" };

    // 이미 결재라인 있으면 skip
    const existing = await db
      .select({ id: purchaseOrderApprovals.id })
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.purchaseOrderId, purchaseOrderId))
      .limit(1);

    if (existing.length === 0) {
      // 1단계는 현재 사용자 이름으로 자동 지정
      const steps = DEFAULT_APPROVAL_STEPS.map((s, i) => ({
        purchaseOrderId,
        organizationId: user.organizationId,
        stepOrder: s.stepOrder,
        roleName: s.roleName,
        approverId: i === 0 ? user.id : null,
        approverName: i === 0 ? (user.name ?? user.email) : null,
        status: (i === 0 ? "pending" : "waiting") as "pending" | "waiting",
      }));

      await db.insert(purchaseOrderApprovals).values(steps);
    }

    // 발주서 상태 → pending
    await db
      .update(purchaseOrders)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(purchaseOrders.id, purchaseOrderId));

    revalidatePath("/dashboard/orders");

    if (user) {
      logActivity({
        user,
        action: "UPDATE",
        entityType: "purchase_order",
        entityId: purchaseOrderId,
        description: "결재 상신",
      }).catch(console.error);
    }

    return { success: true };
  } catch (e) {
    console.error("결재 상신 오류:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/**
 * 단계 승인
 */
export async function approveStep(
  stepId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "인증이 필요합니다" };

    const [step] = await db
      .select()
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.id, stepId))
      .limit(1);

    if (!step) return { success: false, error: "결재 단계를 찾을 수 없습니다" };
    if (step.status !== "pending") return { success: false, error: "현재 결재 차례가 아닙니다" };

    const now = new Date();

    // 현재 단계 승인 처리
    await db
      .update(purchaseOrderApprovals)
      .set({
        status: "approved",
        approverId: user.id,
        approverName: user.name ?? user.email,
        comment: comment ?? null,
        actedAt: now,
        updatedAt: now,
      })
      .where(eq(purchaseOrderApprovals.id, stepId));

    // 전체 단계 조회
    const allSteps = await db
      .select()
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.purchaseOrderId, step.purchaseOrderId))
      .orderBy(asc(purchaseOrderApprovals.stepOrder));

    const nextStep = allSteps.find((s) => s.stepOrder === step.stepOrder + 1);

    if (nextStep) {
      // 다음 단계 pending으로 활성화
      await db
        .update(purchaseOrderApprovals)
        .set({ status: "pending", updatedAt: now })
        .where(eq(purchaseOrderApprovals.id, nextStep.id));

      // 다음 결재자에게 알림 생성
      await db.insert(alerts).values({
        organizationId: user.organizationId,
        type: "order_pending",
        severity: "info",
        title: "발주서 결재 요청",
        message: `[${nextStep.roleName}] 결재 차례가 되었습니다. 발주서를 검토해주세요.`,
        actionUrl: "/dashboard/orders",
      });
    } else {
      // 마지막 단계 승인 → 발주서 approved 처리
      await db
        .update(purchaseOrders)
        .set({
          status: "approved",
          approvedById: user.id,
          approvedAt: now,
          updatedAt: now,
        })
        .where(eq(purchaseOrders.id, step.purchaseOrderId));
    }

    revalidatePath("/dashboard/orders");

    logActivity({
      user,
      action: "UPDATE",
      entityType: "purchase_order",
      entityId: step.purchaseOrderId,
      description: `[${step.roleName}] 결재 승인${comment ? ` — ${comment}` : ""}`,
    }).catch(console.error);

    return { success: true };
  } catch (e) {
    console.error("결재 승인 오류:", e);
    return { success: false, error: "결재 승인에 실패했습니다" };
  }
}

/**
 * 단계 반려
 * 반려 시 이후 단계 모두 waiting 초기화, 발주서 status → draft
 */
export async function rejectStep(
  stepId: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "인증이 필요합니다" };

    if (!comment.trim()) return { success: false, error: "반려 사유를 입력해주세요" };

    const [step] = await db
      .select()
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.id, stepId))
      .limit(1);

    if (!step) return { success: false, error: "결재 단계를 찾을 수 없습니다" };
    if (step.status !== "pending") return { success: false, error: "현재 결재 차례가 아닙니다" };

    const now = new Date();

    // 현재 단계 반려
    await db
      .update(purchaseOrderApprovals)
      .set({
        status: "rejected",
        approverId: user.id,
        approverName: user.name ?? user.email,
        comment,
        actedAt: now,
        updatedAt: now,
      })
      .where(eq(purchaseOrderApprovals.id, stepId));

    // 이후 단계 → waiting 초기화
    const allSteps = await db
      .select()
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.purchaseOrderId, step.purchaseOrderId))
      .orderBy(asc(purchaseOrderApprovals.stepOrder));

    const laterSteps = allSteps.filter((s) => s.stepOrder > step.stepOrder);
    for (const s of laterSteps) {
      await db
        .update(purchaseOrderApprovals)
        .set({ status: "waiting", comment: null, actedAt: null, updatedAt: now })
        .where(eq(purchaseOrderApprovals.id, s.id));
    }

    // 발주서 → draft로 복귀
    await db
      .update(purchaseOrders)
      .set({ status: "draft", updatedAt: now })
      .where(eq(purchaseOrders.id, step.purchaseOrderId));

    revalidatePath("/dashboard/orders");

    logActivity({
      user,
      action: "UPDATE",
      entityType: "purchase_order",
      entityId: step.purchaseOrderId,
      description: `[${step.roleName}] 결재 반려 — ${comment}`,
    }).catch(console.error);

    return { success: true };
  } catch (e) {
    console.error("결재 반려 오류:", e);
    return { success: false, error: "결재 반려에 실패했습니다" };
  }
}

/**
 * 반려 후 재상신 — 결재라인 전체 초기화 후 1단계 pending으로 재시작
 */
export async function resubmitForApproval(
  purchaseOrderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "인증이 필요합니다" };

    const now = new Date();
    const allSteps = await db
      .select()
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.purchaseOrderId, purchaseOrderId))
      .orderBy(asc(purchaseOrderApprovals.stepOrder));

    if (allSteps.length === 0) return { success: false, error: "결재라인이 없습니다" };

    for (const s of allSteps) {
      await db
        .update(purchaseOrderApprovals)
        .set({
          status: s.stepOrder === 1 ? "pending" : "waiting",
          comment: null,
          actedAt: null,
          approverId: s.stepOrder === 1 ? user.id : null,
          approverName: s.stepOrder === 1 ? (user.name ?? user.email) : null,
          updatedAt: now,
        })
        .where(eq(purchaseOrderApprovals.id, s.id));
    }

    await db
      .update(purchaseOrders)
      .set({ status: "pending", updatedAt: now })
      .where(eq(purchaseOrders.id, purchaseOrderId));

    revalidatePath("/dashboard/orders");

    logActivity({
      user,
      action: "UPDATE",
      entityType: "purchase_order",
      entityId: purchaseOrderId,
      description: "결재 재상신",
    }).catch(console.error);

    return { success: true };
  } catch (e) {
    console.error("재상신 오류:", e);
    return { success: false, error: "재상신에 실패했습니다" };
  }
}
