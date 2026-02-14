"use server";

import { db } from "@/server/db";
import { deletionRequests, users } from "@/server/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireAdmin } from "./auth-helpers";
import {
  approveDeletionRequest as approveRequest,
  rejectDeletionRequest as rejectRequest,
} from "@/server/services/deletion/deletion-workflow";

/**
 * 삭제 요청 목록 조회
 */
export async function getDeletionRequests(
  status?: "pending" | "approved" | "rejected" | "completed" | "cancelled" | "all"
) {
  const user = await requireAuth();

  const conditions = [eq(deletionRequests.organizationId, user.organizationId)];

  if (status && status !== "all") {
    conditions.push(eq(deletionRequests.status, status));
  }

  const result = await db
    .select()
    .from(deletionRequests)
    .where(and(...conditions))
    .orderBy(desc(deletionRequests.createdAt))
    .limit(100);

  return result;
}

/**
 * 삭제 요청 상세 조회
 */
export async function getDeletionRequestById(requestId: string) {
  const user = await requireAuth();

  const [request] = await db
    .select()
    .from(deletionRequests)
    .where(
      and(
        eq(deletionRequests.id, requestId),
        eq(deletionRequests.organizationId, user.organizationId)
      )
    );

  return request || null;
}

/**
 * 대기 중인 삭제 요청 수 조회 (헤더 뱃지용)
 */
export async function getPendingDeletionRequestsCount(): Promise<number> {
  const user = await requireAuth();

  // admin만 대기 건수 표시
  if (user.role !== "admin" && !user.isSuperadmin) {
    return 0;
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(deletionRequests)
    .where(
      and(
        eq(deletionRequests.organizationId, user.organizationId),
        eq(deletionRequests.status, "pending")
      )
    );

  return result[0]?.count || 0;
}

/**
 * 삭제 요청 승인 (admin만)
 */
export async function approveDeletion(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAdmin();
    const result = await approveRequest(requestId, user);

    if (result.success) {
      revalidatePath("/dashboard/settings/deletion-requests");
      revalidatePath("/products");
      revalidatePath("/dashboard/suppliers");
    }

    return result;
  } catch (error) {
    console.error("삭제 승인 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "승인에 실패했습니다",
    };
  }
}

/**
 * 삭제 요청 거부 (admin만)
 */
export async function rejectDeletion(
  requestId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAdmin();
    const result = await rejectRequest(requestId, rejectionReason, user);

    if (result.success) {
      revalidatePath("/dashboard/settings/deletion-requests");
    }

    return result;
  } catch (error) {
    console.error("삭제 거부 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "거부에 실패했습니다",
    };
  }
}
