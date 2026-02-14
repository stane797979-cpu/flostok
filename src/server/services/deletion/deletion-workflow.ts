"use server";

import { db } from "@/server/db";
import {
  deletionRequests,
  products,
  suppliers,
  purchaseOrders,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { logActivity } from "@/server/services/activity-log";
import {
  checkEntityDependencies,
  type DependencyCheckResult,
} from "./dependency-checker";

interface CreateDeletionRequestInput {
  entityType: "product" | "supplier" | "purchase_order";
  entityId: string;
  reason: string;
  notes?: string;
}

interface CreateDeletionRequestResult {
  success: boolean;
  requestId?: string;
  error?: string;
  dependencyCheck?: DependencyCheckResult;
}

/**
 * 삭제 요청 생성
 * - manager 이상 권한 필요
 * - 의존성 체크 후 삭제 가능 여부 판단
 * - 승인 대기 상태로 생성
 */
export async function createDeletionRequest(
  input: CreateDeletionRequestInput,
  user: {
    id: string;
    organizationId: string;
    name?: string | null;
    email: string;
    role: string;
  }
): Promise<CreateDeletionRequestResult> {
  // 의존성 체크
  const depCheck = await checkEntityDependencies(
    input.entityType,
    input.entityId,
    user.organizationId
  );

  if (!depCheck.canDelete) {
    return {
      success: false,
      error: depCheck.errors.join("\n"),
      dependencyCheck: depCheck,
    };
  }

  // 엔티티 스냅샷 + 이름 조회
  let entitySnapshot: Record<string, unknown> = {};
  let entityName = "";

  switch (input.entityType) {
    case "product": {
      const [product] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, input.entityId),
            eq(products.organizationId, user.organizationId)
          )
        );
      if (!product) return { success: false, error: "제품을 찾을 수 없습니다" };
      entitySnapshot = product as unknown as Record<string, unknown>;
      entityName = `${product.sku} ${product.name}`;
      break;
    }
    case "supplier": {
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.id, input.entityId),
            eq(suppliers.organizationId, user.organizationId)
          )
        );
      if (!supplier) return { success: false, error: "공급자를 찾을 수 없습니다" };
      entitySnapshot = supplier as unknown as Record<string, unknown>;
      entityName = supplier.name;
      break;
    }
    case "purchase_order": {
      const [order] = await db
        .select()
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.id, input.entityId),
            eq(purchaseOrders.organizationId, user.organizationId)
          )
        );
      if (!order) return { success: false, error: "발주서를 찾을 수 없습니다" };
      entitySnapshot = order as unknown as Record<string, unknown>;
      entityName = order.orderNumber;
      break;
    }
  }

  // 삭제 요청 생성
  const [request] = await db
    .insert(deletionRequests)
    .values({
      organizationId: user.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      entityName,
      entitySnapshot,
      dependencyCheck: depCheck,
      impactLevel: depCheck.impactLevel,
      status: "pending",
      reason: input.reason,
      requestedById: user.id,
      requestedByName: user.name || user.email,
      notes: input.notes,
    })
    .returning();

  // 활동 로그
  await logActivity({
    user,
    action: "CREATE",
    entityType: "product", // entityType을 활동 로그용으로 매핑
    entityId: request.id,
    description: `${entityName} 삭제 요청 생성 (사유: ${input.reason})`,
    metadata: {
      deletionRequestId: request.id,
      targetEntityType: input.entityType,
      targetEntityId: input.entityId,
      impactLevel: depCheck.impactLevel,
    },
  });

  return {
    success: true,
    requestId: request.id,
    dependencyCheck: depCheck,
  };
}

/**
 * 삭제 요청 승인
 * - admin만 가능
 * - 본인이 요청한 건은 본인이 승인 불가 (Separation of Duties)
 * - 승인 시 실제 soft delete 실행
 */
export async function approveDeletionRequest(
  requestId: string,
  user: {
    id: string;
    organizationId: string;
    name?: string | null;
    email: string;
    role: string;
    isSuperadmin: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const [request] = await db
    .select()
    .from(deletionRequests)
    .where(
      and(
        eq(deletionRequests.id, requestId),
        eq(deletionRequests.organizationId, user.organizationId)
      )
    );

  if (!request) {
    return { success: false, error: "삭제 요청을 찾을 수 없습니다" };
  }

  if (request.status !== "pending") {
    return { success: false, error: "이미 처리된 요청입니다" };
  }

  // Separation of Duties: 본인 요청은 본인이 승인 불가
  if (request.requestedById === user.id && !user.isSuperadmin) {
    return {
      success: false,
      error: "본인이 요청한 삭제는 본인이 승인할 수 없습니다",
    };
  }

  // 실제 soft delete 실행
  const now = new Date();

  switch (request.entityType) {
    case "product":
      await db
        .update(products)
        .set({
          deletedAt: now,
          deletedBy: user.id,
          deletionReason: request.reason,
          deletionMetadata: {
            deletionRequestId: requestId,
            snapshot: request.entitySnapshot,
            dependencies: request.dependencyCheck,
          },
          updatedAt: now,
        })
        .where(
          and(
            eq(products.id, request.entityId),
            eq(products.organizationId, user.organizationId)
          )
        );
      break;

    case "supplier":
      await db
        .update(suppliers)
        .set({
          deletedAt: now,
          deletedBy: user.id,
          deletionReason: request.reason,
          deletionMetadata: {
            deletionRequestId: requestId,
            snapshot: request.entitySnapshot,
            dependencies: request.dependencyCheck,
          },
          updatedAt: now,
        })
        .where(
          and(
            eq(suppliers.id, request.entityId),
            eq(suppliers.organizationId, user.organizationId)
          )
        );
      break;

    case "purchase_order":
      await db
        .update(purchaseOrders)
        .set({
          deletedAt: now,
          deletedBy: user.id,
          deletionReason: request.reason,
          deletionMetadata: {
            deletionRequestId: requestId,
            snapshot: request.entitySnapshot,
          },
          updatedAt: now,
        })
        .where(
          and(
            eq(purchaseOrders.id, request.entityId),
            eq(purchaseOrders.organizationId, user.organizationId)
          )
        );
      break;
  }

  // 요청 상태 업데이트
  await db
    .update(deletionRequests)
    .set({
      status: "completed",
      approvedById: user.id,
      approvedByName: user.name || user.email,
      approvedAt: now,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(deletionRequests.id, requestId));

  // 활동 로그
  await logActivity({
    user,
    action: "DELETE",
    entityType: request.entityType as "product" | "supplier" | "purchase_order",
    entityId: request.entityId,
    description: `${request.entityName} 삭제 승인 및 실행 (요청자: ${request.requestedByName})`,
    metadata: {
      deletionRequestId: requestId,
      beforeSnapshot: request.entitySnapshot,
      reason: request.reason,
    },
  });

  return { success: true };
}

/**
 * 삭제 요청 거부
 * - admin만 가능
 */
export async function rejectDeletionRequest(
  requestId: string,
  rejectionReason: string,
  user: {
    id: string;
    organizationId: string;
    name?: string | null;
    email: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const [request] = await db
    .select()
    .from(deletionRequests)
    .where(
      and(
        eq(deletionRequests.id, requestId),
        eq(deletionRequests.organizationId, user.organizationId)
      )
    );

  if (!request) {
    return { success: false, error: "삭제 요청을 찾을 수 없습니다" };
  }

  if (request.status !== "pending") {
    return { success: false, error: "이미 처리된 요청입니다" };
  }

  const now = new Date();

  await db
    .update(deletionRequests)
    .set({
      status: "rejected",
      rejectedById: user.id,
      rejectedByName: user.name || user.email,
      rejectedAt: now,
      rejectionReason,
      updatedAt: now,
    })
    .where(eq(deletionRequests.id, requestId));

  // 활동 로그
  await logActivity({
    user,
    action: "UPDATE",
    entityType: request.entityType as "product" | "supplier" | "purchase_order",
    entityId: request.entityId,
    description: `${request.entityName} 삭제 요청 거부 (사유: ${rejectionReason})`,
    metadata: {
      deletionRequestId: requestId,
      rejectionReason,
    },
  });

  return { success: true };
}

/**
 * Admin 즉시 soft delete (승인 워크플로우 우회)
 * - admin 이상만 가능
 * - 의존성 체크는 동일하게 수행
 */
export async function immediateDeleteEntity(
  entityType: "product" | "supplier",
  entityId: string,
  reason: string,
  user: {
    id: string;
    organizationId: string;
    name?: string | null;
    email: string;
    role: string;
  }
): Promise<{ success: boolean; error?: string }> {
  // 의존성 체크
  const depCheck = await checkEntityDependencies(
    entityType,
    entityId,
    user.organizationId
  );

  if (!depCheck.canDelete) {
    return { success: false, error: depCheck.errors.join("\n") };
  }

  const now = new Date();
  let entityName = "";

  switch (entityType) {
    case "product": {
      const [product] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, entityId),
            eq(products.organizationId, user.organizationId)
          )
        );
      if (!product) return { success: false, error: "제품을 찾을 수 없습니다" };
      entityName = `${product.sku} ${product.name}`;

      await db
        .update(products)
        .set({
          deletedAt: now,
          deletedBy: user.id,
          deletionReason: reason,
          deletionMetadata: { snapshot: product, dependencies: depCheck },
          updatedAt: now,
        })
        .where(
          and(
            eq(products.id, entityId),
            eq(products.organizationId, user.organizationId)
          )
        );
      break;
    }
    case "supplier": {
      const [supplier] = await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.id, entityId),
            eq(suppliers.organizationId, user.organizationId)
          )
        );
      if (!supplier) return { success: false, error: "공급자를 찾을 수 없습니다" };
      entityName = supplier.name;

      await db
        .update(suppliers)
        .set({
          deletedAt: now,
          deletedBy: user.id,
          deletionReason: reason,
          deletionMetadata: { snapshot: supplier, dependencies: depCheck },
          updatedAt: now,
        })
        .where(
          and(
            eq(suppliers.id, entityId),
            eq(suppliers.organizationId, user.organizationId)
          )
        );
      break;
    }
  }

  // 활동 로그
  await logActivity({
    user,
    action: "DELETE",
    entityType: entityType,
    entityId,
    description: `${entityName} 즉시 삭제 (관리자, 사유: ${reason})`,
    metadata: { reason, dependencies: depCheck },
  });

  return { success: true };
}
