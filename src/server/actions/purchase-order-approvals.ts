"use server";

import { db } from "@/server/db";
import {
  purchaseOrderApprovals,
  purchaseOrders,
  purchaseOrderItems,
  products,
  inventory,
  salesRecords,
  alerts,
  type PurchaseOrderApproval,
} from "@/server/db/schema";
import { eq, asc, and, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

// 결재라인: 구매담당(상신 즉시 자동완료) → 팀장(승인시 발주확정)
const DEFAULT_APPROVAL_STEPS = [
  { stepOrder: 1, roleName: "구매담당" },
  { stepOrder: 2, roleName: "팀장" },
];

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
 * 결재 상신
 * 구매담당(1단계)은 상신과 동시에 approved 처리 → 팀장(2단계) 즉시 pending
 */
export async function submitForApproval(
  purchaseOrderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "인증이 필요합니다" };

    const existing = await db
      .select({ id: purchaseOrderApprovals.id })
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.purchaseOrderId, purchaseOrderId))
      .limit(1);

    const now = new Date();

    if (existing.length === 0) {
      // 1단계(구매담당) → 상신 즉시 approved, 2단계(팀장) → pending
      const steps = DEFAULT_APPROVAL_STEPS.map((s, i) => ({
        purchaseOrderId,
        organizationId: user.organizationId,
        stepOrder: s.stepOrder,
        roleName: s.roleName,
        approverId: i === 0 ? user.id : null,
        approverName: i === 0 ? (user.name ?? user.email) : null,
        status: (i === 0 ? "approved" : "pending") as "approved" | "pending",
        actedAt: i === 0 ? now : null,
        comment: i === 0 ? "발주 상신" : null,
      }));
      await db.insert(purchaseOrderApprovals).values(steps);
    }

    await db
      .update(purchaseOrders)
      .set({ status: "pending", updatedAt: now })
      .where(eq(purchaseOrders.id, purchaseOrderId));

    revalidatePath("/dashboard/orders");
    logActivity({
      user, action: "UPDATE", entityType: "purchase_order",
      entityId: purchaseOrderId, description: "발주 상신 (구매담당 자동승인 → 팀장 검토 대기)",
    }).catch(console.error);

    return { success: true };
  } catch (e) {
    console.error("결재 상신 오류:", e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 단계 승인
 * 팀장(마지막 단계) 승인 시 → 발주서 ordered(발주확정)
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

    const allSteps = await db
      .select()
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.purchaseOrderId, step.purchaseOrderId))
      .orderBy(asc(purchaseOrderApprovals.stepOrder));

    const nextStep = allSteps.find((s) => s.stepOrder === step.stepOrder + 1);

    if (nextStep) {
      await db
        .update(purchaseOrderApprovals)
        .set({ status: "pending", updatedAt: now })
        .where(eq(purchaseOrderApprovals.id, nextStep.id));

      await db.insert(alerts).values({
        organizationId: user.organizationId,
        type: "order_pending",
        severity: "info",
        title: "발주서 결재 요청",
        message: `[${nextStep.roleName}] 결재 차례입니다.`,
        actionUrl: "/dashboard/orders",
      });
    } else {
      // 마지막 단계(팀장) 승인 → 발주확정(ordered)
      await db
        .update(purchaseOrders)
        .set({
          status: "ordered",
          approvedById: user.id,
          approvedAt: now,
          updatedAt: now,
        })
        .where(eq(purchaseOrders.id, step.purchaseOrderId));
    }

    revalidatePath("/dashboard/orders");
    logActivity({
      user, action: "UPDATE", entityType: "purchase_order",
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
 * 단계 반려 → 발주서 draft 복귀
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

    const allSteps = await db
      .select()
      .from(purchaseOrderApprovals)
      .where(eq(purchaseOrderApprovals.purchaseOrderId, step.purchaseOrderId))
      .orderBy(asc(purchaseOrderApprovals.stepOrder));

    for (const s of allSteps.filter((s) => s.stepOrder > step.stepOrder)) {
      await db
        .update(purchaseOrderApprovals)
        .set({ status: "waiting", comment: null, actedAt: null, updatedAt: now })
        .where(eq(purchaseOrderApprovals.id, s.id));
    }

    await db
      .update(purchaseOrders)
      .set({ status: "draft", updatedAt: now })
      .where(eq(purchaseOrders.id, step.purchaseOrderId));

    revalidatePath("/dashboard/orders");
    logActivity({
      user, action: "UPDATE", entityType: "purchase_order",
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
 * 재상신 — 1단계(구매담당) 다시 approved, 2단계(팀장) pending으로 리셋
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
          status: s.stepOrder === 1 ? "approved" : (s.stepOrder === 2 ? "pending" : "waiting"),
          comment: s.stepOrder === 1 ? "발주 상신 (재상신)" : null,
          actedAt: s.stepOrder === 1 ? now : null,
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
      user, action: "UPDATE", entityType: "purchase_order",
      entityId: purchaseOrderId, description: "결재 재상신",
    }).catch(console.error);

    return { success: true };
  } catch (e) {
    console.error("재상신 오류:", e);
    return { success: false, error: "재상신에 실패했습니다" };
  }
}

export type OrderReviewData = {
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    abcGrade: string | null;
    xyzGrade: string | null;
    currentStock: number;
    safetyStock: number;
    orderQty: number;
    stockAfter: number;
    avgDailySales: number;
    daysOfStockNow: number;    // 현재 재고일수
    daysOfStockAfter: number;  // 발주 후 재고일수
    turnoverNow: number;       // 현재 연간 회전율
    turnoverAfter: number;     // 발주 후 연간 회전율
    shortage: number;          // 부족분 (현재고 - 안전재고, 음수면 부족)
    leadTime: number;
  }>;
};

/**
 * 팀장 근거검토용 재고 분석 데이터 조회
 */
export async function getOrderReviewData(
  purchaseOrderId: string
): Promise<OrderReviewData> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId ?? "00000000-0000-0000-0000-000000000001";

  // 발주 항목 조회
  const items = await db
    .select({
      productId: purchaseOrderItems.productId,
      orderQty: purchaseOrderItems.quantity,
      sku: products.sku,
      name: products.name,
      abcGrade: products.abcGrade,
      xyzGrade: products.xyzGrade,
      safetyStock: products.safetyStock,
      leadTime: products.leadTime,
      currentStock: inventory.currentStock,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
    .leftJoin(inventory, eq(products.id, inventory.productId))
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));

  if (items.length === 0) return { items: [] };

  // 최근 90일 일평균 판매량 조회
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0];

  const productIds = items.map((i) => i.productId);
  const salesRows = await db
    .select({
      productId: salesRecords.productId,
      total: sql<number>`coalesce(sum(${salesRecords.quantity}), 0)`,
    })
    .from(salesRecords)
    .where(
      and(
        eq(salesRecords.organizationId, orgId),
        gte(salesRecords.date, ninetyDaysAgoStr),
        sql`${salesRecords.productId} = ANY(ARRAY[${sql.raw(productIds.map((id) => `'${id}'::uuid`).join(","))}])`
      )
    )
    .groupBy(salesRecords.productId);

  const salesMap = new Map(salesRows.map((r) => [r.productId, Number(r.total)]));

  const result = items.map((item) => {
    const totalSales90 = salesMap.get(item.productId) ?? 0;
    const avgDailySales = Math.round((totalSales90 / 90) * 100) / 100;
    const currentStock = item.currentStock ?? 0;
    const safetyStock = item.safetyStock ?? 0;
    const orderQty = item.orderQty;
    const stockAfter = currentStock + orderQty;

    const daysOfStockNow = avgDailySales > 0 ? Math.round(currentStock / avgDailySales) : 999;
    const daysOfStockAfter = avgDailySales > 0 ? Math.round(stockAfter / avgDailySales) : 999;
    const turnoverNow = avgDailySales > 0 && currentStock > 0
      ? Math.round((avgDailySales * 365) / currentStock * 10) / 10 : 0;
    const turnoverAfter = avgDailySales > 0 && stockAfter > 0
      ? Math.round((avgDailySales * 365) / stockAfter * 10) / 10 : 0;

    return {
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      abcGrade: item.abcGrade,
      xyzGrade: item.xyzGrade,
      currentStock,
      safetyStock,
      orderQty,
      stockAfter,
      avgDailySales,
      daysOfStockNow,
      daysOfStockAfter,
      turnoverNow,
      turnoverAfter,
      shortage: currentStock - safetyStock,
      leadTime: item.leadTime ?? 7,
    };
  });

  return { items: result };
}
