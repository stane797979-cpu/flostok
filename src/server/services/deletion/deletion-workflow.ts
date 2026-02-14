"use server";

import { db } from "@/server/db";
import {
  deletionRequests,
  products,
  suppliers,
  purchaseOrders,
  inventory,
  inventoryHistory,
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { logActivity } from "@/server/services/activity-log";
import {
  checkEntityDependencies,
  type DependencyCheckResult,
} from "./dependency-checker";

/** 승인 요청 가능한 모든 엔티티 타입 */
type ApprovalEntityType =
  | "product" | "supplier" | "purchase_order" | "inventory"
  | "inventory_adjustment"
  | "product_create" | "product_update"
  | "supplier_create" | "supplier_update";

/** 활동 로그용 엔티티 타입 매핑 */
function mapEntityTypeForLog(entityType: ApprovalEntityType): "product" | "supplier" | "purchase_order" {
  switch (entityType) {
    case "product":
    case "product_create":
    case "product_update":
    case "inventory":
    case "inventory_adjustment":
      return "product";
    case "supplier":
    case "supplier_create":
    case "supplier_update":
      return "supplier";
    case "purchase_order":
      return "purchase_order";
  }
}

/** 활동 로그용 액션 라벨 */
function getActionLabel(entityType: ApprovalEntityType): string {
  switch (entityType) {
    case "product": return "삭제";
    case "supplier": return "삭제";
    case "purchase_order": return "삭제";
    case "inventory": return "삭제";
    case "inventory_adjustment": return "재고 조정";
    case "product_create": return "등록";
    case "product_update": return "수정";
    case "supplier_create": return "등록";
    case "supplier_update": return "수정";
  }
}

interface CreateDeletionRequestInput {
  entityType: ApprovalEntityType;
  entityId: string;
  reason: string;
  notes?: string;
  /** 재고 조정 요청 시 추가 정보 */
  adjustmentInfo?: {
    changeType: "INBOUND_ADJUSTMENT" | "OUTBOUND_ADJUSTMENT";
    quantity: number;
    warehouseId?: string;
  };
  /** 생성/수정 요청 시 데이터 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changeData?: Record<string, any>;
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
    case "inventory": {
      const [inv] = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.id, input.entityId),
            eq(inventory.organizationId, user.organizationId)
          )
        );
      if (!inv) return { success: false, error: "재고 항목을 찾을 수 없습니다" };
      // 제품명도 함께 조회
      const [prod] = await db
        .select({ sku: products.sku, name: products.name })
        .from(products)
        .where(eq(products.id, inv.productId));
      entitySnapshot = inv as unknown as Record<string, unknown>;
      entityName = prod ? `${prod.sku} ${prod.name} (재고 ${inv.currentStock}개)` : `재고 ${inv.currentStock}개`;
      break;
    }
    case "inventory_adjustment": {
      // 재고 조정 요청: entityId = productId
      const [adjProd] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, input.entityId),
            eq(products.organizationId, user.organizationId)
          )
        );
      if (!adjProd) return { success: false, error: "제품을 찾을 수 없습니다" };
      const adjInfo = input.adjustmentInfo;
      const adjLabel = adjInfo?.changeType === "INBOUND_ADJUSTMENT" ? "증가" : "감소";
      entitySnapshot = {
        productId: input.entityId,
        sku: adjProd.sku,
        name: adjProd.name,
        adjustmentInfo: adjInfo,
      };
      entityName = `${adjProd.sku} ${adjProd.name} 재고 조정 (${adjLabel} ${adjInfo?.quantity ?? 0}개)`;
      break;
    }
    case "product_create": {
      // 제품 생성 요청: entityId = "new", changeData = 입력 데이터
      entitySnapshot = { action: "create", data: input.changeData };
      entityName = `${input.changeData?.sku || ""} ${input.changeData?.name || ""} 제품 등록`;
      break;
    }
    case "product_update": {
      // 제품 수정 요청: entityId = productId, changeData = 변경 데이터
      const [existingProd] = await db
        .select()
        .from(products)
        .where(
          and(
            eq(products.id, input.entityId),
            eq(products.organizationId, user.organizationId)
          )
        );
      if (!existingProd) return { success: false, error: "제품을 찾을 수 없습니다" };
      entitySnapshot = { action: "update", before: existingProd, changes: input.changeData };
      entityName = `${existingProd.sku} ${existingProd.name} 제품 수정`;
      break;
    }
    case "supplier_create": {
      // 공급업체 생성 요청
      entitySnapshot = { action: "create", data: input.changeData };
      entityName = `${input.changeData?.name || ""} 공급업체 등록`;
      break;
    }
    case "supplier_update": {
      // 공급업체 수정 요청
      const [existingSup] = await db
        .select()
        .from(suppliers)
        .where(
          and(
            eq(suppliers.id, input.entityId),
            eq(suppliers.organizationId, user.organizationId)
          )
        );
      if (!existingSup) return { success: false, error: "공급업체를 찾을 수 없습니다" };
      entitySnapshot = { action: "update", before: existingSup, changes: input.changeData };
      entityName = `${existingSup.name} 공급업체 수정`;
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
  const logEntityType = mapEntityTypeForLog(input.entityType);
  const actionLabel = getActionLabel(input.entityType);
  await logActivity({
    user,
    action: "CREATE",
    entityType: logEntityType,
    entityId: request.id,
    description: `${entityName} ${actionLabel} 요청 생성 (사유: ${input.reason})`,
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

    case "inventory": {
      // 재고 삭제: 이력 기록 후 레코드 삭제
      const [inv] = await db
        .select()
        .from(inventory)
        .where(
          and(
            eq(inventory.id, request.entityId),
            eq(inventory.organizationId, user.organizationId)
          )
        );
      if (inv && inv.currentStock > 0) {
        await db.insert(inventoryHistory).values({
          organizationId: user.organizationId,
          productId: inv.productId,
          warehouseId: inv.warehouseId,
          changeType: "OUTBOUND_ADJUSTMENT",
          changeAmount: -inv.currentStock,
          stockBefore: inv.currentStock,
          stockAfter: 0,
          date: now.toISOString().split("T")[0],
          notes: `재고 삭제 승인 (사유: ${request.reason})`,
        });
      }
      if (inv) {
        await db
          .delete(inventory)
          .where(eq(inventory.id, request.entityId));
      }
      break;
    }
    case "inventory_adjustment": {
      // 재고 조정 승인: processInventoryTransaction과 동일한 로직 실행
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshot = request.entitySnapshot as any;
      const adjInfo = snapshot?.adjustmentInfo;
      if (!adjInfo) {
        return { success: false, error: "재고 조정 정보가 없습니다" };
      }
      // 동적 import로 순환 참조 방지
      const { processInventoryTransaction } = await import("@/server/actions/inventory");
      const adjResult = await processInventoryTransaction(
        {
          productId: request.entityId,
          changeType: adjInfo.changeType,
          quantity: adjInfo.quantity,
          warehouseId: adjInfo.warehouseId,
          notes: `승인된 재고 조정 (사유: ${request.reason}, 요청자: ${request.requestedByName})`,
        },
        {
          user: {
            id: user.id,
            authId: "",
            organizationId: user.organizationId,
            email: user.email,
            name: user.name || null,
            avatarUrl: null,
            role: user.role as "admin" | "manager" | "viewer" | "warehouse",
            isSuperadmin: user.isSuperadmin,
            createdAt: now,
            updatedAt: now,
          },
          skipActivityLog: true,
        }
      );
      if (!adjResult.success) {
        return { success: false, error: adjResult.error || "재고 조정 실행 실패" };
      }
      break;
    }
    case "product_create": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createSnap = request.entitySnapshot as any;
      const prodData = createSnap?.data;
      if (!prodData) return { success: false, error: "제품 생성 데이터가 없습니다" };
      await db.insert(products).values({
        ...prodData,
        organizationId: user.organizationId,
      });
      break;
    }
    case "product_update": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateSnap = request.entitySnapshot as any;
      const changes = updateSnap?.changes;
      if (!changes) return { success: false, error: "제품 수정 데이터가 없습니다" };
      await db
        .update(products)
        .set({ ...changes, updatedAt: now })
        .where(
          and(
            eq(products.id, request.entityId),
            eq(products.organizationId, user.organizationId)
          )
        );
      break;
    }
    case "supplier_create": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supCreateSnap = request.entitySnapshot as any;
      const supData = supCreateSnap?.data;
      if (!supData) return { success: false, error: "공급업체 생성 데이터가 없습니다" };
      await db.insert(suppliers).values({
        ...supData,
        organizationId: user.organizationId,
      });
      break;
    }
    case "supplier_update": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supUpdateSnap = request.entitySnapshot as any;
      const supChanges = supUpdateSnap?.changes;
      if (!supChanges) return { success: false, error: "공급업체 수정 데이터가 없습니다" };
      await db
        .update(suppliers)
        .set({ ...supChanges, updatedAt: now })
        .where(
          and(
            eq(suppliers.id, request.entityId),
            eq(suppliers.organizationId, user.organizationId)
          )
        );
      break;
    }
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
  const approveLogEntityType = mapEntityTypeForLog(request.entityType as ApprovalEntityType);
  const approveActionLabel = getActionLabel(request.entityType as ApprovalEntityType);
  await logActivity({
    user,
    action: request.entityType.includes("create") ? "CREATE" : request.entityType.includes("update") ? "UPDATE" : "DELETE",
    entityType: approveLogEntityType,
    entityId: request.entityId,
    description: `${request.entityName} ${approveActionLabel} 승인 및 실행 (요청자: ${request.requestedByName})`,
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
  const rejectLogEntityType = mapEntityTypeForLog(request.entityType as ApprovalEntityType);
  const rejectActionLabel = getActionLabel(request.entityType as ApprovalEntityType);
  await logActivity({
    user,
    action: "UPDATE",
    entityType: rejectLogEntityType,
    entityId: request.entityId,
    description: `${request.entityName} ${rejectActionLabel} 요청 거부 (사유: ${rejectionReason})`,
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
