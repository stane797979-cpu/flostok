"use server";

import { db } from "@/server/db";
import { warehouses, type Warehouse } from "@/server/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import { inventory } from "@/server/db/schema";

/**
 * 창고 생성 스키마
 */
const createWarehouseSchema = z.object({
  code: z
    .string()
    .min(1, "창고 코드는 필수입니다")
    .max(20, "창고 코드는 20자 이하여야 합니다")
    .regex(/^[A-Z0-9_]+$/, "창고 코드는 영문 대문자, 숫자, 밑줄만 사용 가능합니다"),
  name: z
    .string()
    .min(1, "창고명은 필수입니다")
    .max(100, "창고명은 100자 이하여야 합니다"),
  type: z.string().optional(),
  address: z.string().optional(),
});

/**
 * 창고 수정 스키마
 */
const updateWarehouseSchema = z.object({
  code: z
    .string()
    .min(1, "창고 코드는 필수입니다")
    .max(20, "창고 코드는 20자 이하여야 합니다")
    .regex(/^[A-Z0-9_]+$/, "창고 코드는 영문 대문자, 숫자, 밑줄만 사용 가능합니다")
    .optional(),
  name: z
    .string()
    .min(1, "창고명은 필수입니다")
    .max(100, "창고명은 100자 이하여야 합니다")
    .optional(),
  type: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * 창고 간 재고 이동 스키마
 */
const transferInventorySchema = z.object({
  productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
  sourceWarehouseId: z.string().uuid("유효한 출발 창고 ID가 아닙니다"),
  targetWarehouseId: z.string().uuid("유효한 도착 창고 ID가 아닙니다"),
  quantity: z.number().min(1, "수량은 1 이상이어야 합니다"),
  notes: z.string().optional(),
});

export type TransferInventoryInput = z.infer<typeof transferInventorySchema>;

/**
 * 조직의 창고 목록 조회
 */
export async function getWarehouses(): Promise<{ warehouses: Warehouse[] }> {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return { warehouses: [] };
  }

  try {
    const result = await db
      .select()
      .from(warehouses)
      .where(eq(warehouses.organizationId, user.organizationId))
      .orderBy(desc(warehouses.isDefault), asc(warehouses.code));

    return { warehouses: result };
  } catch (error) {
    console.error("창고 목록 조회 오류:", error);
    return { warehouses: [] };
  }
}

/**
 * 기본 창고 조회 (isDefault=true)
 */
export async function getDefaultWarehouse(): Promise<Warehouse | null> {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return null;
  }

  try {
    const [result] = await db
      .select()
      .from(warehouses)
      .where(
        and(
          eq(warehouses.organizationId, user.organizationId),
          eq(warehouses.isDefault, true),
          eq(warehouses.isActive, true)
        )
      )
      .limit(1);

    return result || null;
  } catch (error) {
    console.error("기본 창고 조회 오류:", error);
    return null;
  }
}

/**
 * 창고 생성 (SUPERADMIN만 가능)
 */
export async function createWarehouse(
  input: z.infer<typeof createWarehouseSchema>
): Promise<{
  success: boolean;
  warehouse?: Warehouse;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    if (!user.isSuperadmin) {
      return { success: false, error: "창고 생성은 슈퍼관리자만 가능합니다" };
    }
    const validated = createWarehouseSchema.parse(input);

    // 코드 중복 체크
    const [existing] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.organizationId, user.organizationId),
          eq(warehouses.code, validated.code)
        )
      )
      .limit(1);

    if (existing) {
      return { success: false, error: "이미 존재하는 창고 코드입니다" };
    }

    // 창고 생성
    const [newWarehouse] = await db
      .insert(warehouses)
      .values({
        organizationId: user.organizationId,
        code: validated.code,
        name: validated.name,
        type: validated.type || "MAIN",
        address: validated.address,
        isActive: true,
        isDefault: false,
      })
      .returning();

    await logActivity({
      user,
      action: "CREATE",
      entityType: "warehouse",
      entityId: newWarehouse.id,
      description: `창고 생성: ${validated.name} (${validated.code})`,
    });

    revalidatePath("/dashboard/warehouses");
    revalidatePath("/dashboard/settings/warehouses");

    return { success: true, warehouse: newWarehouse };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("창고 생성 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "창고 생성에 실패했습니다",
    };
  }
}

/**
 * 창고 수정 (SUPERADMIN만 가능)
 */
export async function updateWarehouse(
  id: string,
  input: z.infer<typeof updateWarehouseSchema>
): Promise<{
  success: boolean;
  warehouse?: Warehouse;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    if (!user.isSuperadmin) {
      return { success: false, error: "창고 수정은 슈퍼관리자만 가능합니다" };
    }
    const validated = updateWarehouseSchema.parse(input);

    // 창고 조회
    const [warehouse] = await db
      .select()
      .from(warehouses)
      .where(
        and(eq(warehouses.id, id), eq(warehouses.organizationId, user.organizationId))
      )
      .limit(1);

    if (!warehouse) {
      return { success: false, error: "창고를 찾을 수 없습니다" };
    }

    // 기본 창고의 code는 'MAIN'에서 변경 불가
    if (warehouse.isDefault && warehouse.code === "MAIN" && validated.code && validated.code !== "MAIN") {
      return { success: false, error: "기본 창고의 코드는 'MAIN'에서 변경할 수 없습니다" };
    }

    // code 변경 시 중복 체크
    if (validated.code && validated.code !== warehouse.code) {
      const [existing] = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.organizationId, user.organizationId),
            eq(warehouses.code, validated.code)
          )
        )
        .limit(1);

      if (existing) {
        return { success: false, error: "이미 존재하는 창고 코드입니다" };
      }
    }

    // 업데이트 데이터 구성
    const updateData: Partial<typeof warehouses.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (validated.code !== undefined) updateData.code = validated.code;
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.type !== undefined) updateData.type = validated.type;
    if (validated.address !== undefined) updateData.address = validated.address;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

    const [updatedWarehouse] = await db
      .update(warehouses)
      .set(updateData)
      .where(
        and(eq(warehouses.id, id), eq(warehouses.organizationId, user.organizationId))
      )
      .returning();

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "warehouse",
      entityId: id,
      description: `창고 수정: ${updatedWarehouse.name}`,
    });

    revalidatePath("/dashboard/warehouses");
    revalidatePath("/dashboard/settings/warehouses");

    return { success: true, warehouse: updatedWarehouse };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("창고 수정 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "창고 수정에 실패했습니다",
    };
  }
}

/**
 * 창고 삭제 (SUPERADMIN만 가능)
 */
export async function deleteWarehouse(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    if (!user.isSuperadmin) {
      return { success: false, error: "창고 삭제는 슈퍼관리자만 가능합니다" };
    }

    // 창고 조회
    const [warehouse] = await db
      .select()
      .from(warehouses)
      .where(
        and(eq(warehouses.id, id), eq(warehouses.organizationId, user.organizationId))
      )
      .limit(1);

    if (!warehouse) {
      return { success: false, error: "창고를 찾을 수 없습니다" };
    }

    // 기본 창고 삭제 불가
    if (warehouse.isDefault) {
      return { success: false, error: "기본 창고는 삭제할 수 없습니다" };
    }

    // 재고 존재 확인
    const [inventoryCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventory)
      .where(eq(inventory.warehouseId, id));

    if (Number(inventoryCount?.count || 0) > 0) {
      return { success: false, error: "재고가 있는 창고는 삭제할 수 없습니다" };
    }

    // 삭제
    await db.delete(warehouses).where(eq(warehouses.id, id));

    await logActivity({
      user,
      action: "DELETE",
      entityType: "warehouse",
      entityId: id,
      description: `창고 삭제: ${warehouse.name} (${warehouse.code})`,
    });

    revalidatePath("/dashboard/warehouses");
    revalidatePath("/dashboard/settings/warehouses");

    return { success: true };
  } catch (error) {
    console.error("창고 삭제 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "창고 삭제에 실패했습니다",
    };
  }
}

/**
 * 창고 간 재고 이동
 */
export async function transferInventory(
  input: TransferInventoryInput
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const validated = transferInventorySchema.parse(input);

    // 같은 창고 방지
    if (validated.sourceWarehouseId === validated.targetWarehouseId) {
      return { success: false, error: "출발 창고와 도착 창고가 같을 수 없습니다" };
    }

    // 출발 창고 재고 확인
    const [sourceInventory] = await db
      .select()
      .from(inventory)
      .where(
        and(
          eq(inventory.organizationId, user.organizationId),
          eq(inventory.warehouseId, validated.sourceWarehouseId),
          eq(inventory.productId, validated.productId)
        )
      )
      .limit(1);

    if (!sourceInventory) {
      return { success: false, error: "출발 창고에 해당 제품의 재고가 없습니다" };
    }

    if (sourceInventory.currentStock < validated.quantity) {
      return {
        success: false,
        error: `출발 창고의 재고가 부족합니다. 현재고: ${sourceInventory.currentStock}, 이동 요청: ${validated.quantity}`,
      };
    }

    // 트랜잭션으로 출고 + 입고 처리 (같은 tx 전달로 원자성 보장)
    await db.transaction(async (tx) => {
      // 동적 import로 circular dependency 방지
      const { processInventoryTransaction } = await import("./inventory");

      // 1. 출발 창고에서 출고
      const outboundResult = await processInventoryTransaction(
        {
          productId: validated.productId,
          changeType: "OUTBOUND_TRANSFER",
          quantity: validated.quantity,
          notes: validated.notes,
        },
        {
          user,
          tx,
          skipRevalidate: true,
          skipActivityLog: true,
        }
      );

      if (!outboundResult.success) {
        throw new Error(`출고 실패: ${outboundResult.error}`);
      }

      // 2. 도착 창고로 입고
      const inboundResult = await processInventoryTransaction(
        {
          productId: validated.productId,
          changeType: "INBOUND_TRANSFER",
          quantity: validated.quantity,
          notes: validated.notes,
        },
        {
          user,
          tx,
          skipRevalidate: true,
          skipActivityLog: true,
        }
      );

      if (!inboundResult.success) {
        throw new Error(`입고 실패: ${inboundResult.error}`);
      }
    });

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "inventory",
      entityId: validated.productId,
      description: `창고 간 재고 이동: ${validated.quantity}개`,
    });

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/warehouses");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("재고 이동 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "재고 이동에 실패했습니다",
    };
  }
}
