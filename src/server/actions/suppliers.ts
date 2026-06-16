"use server";

import { db } from "@/server/db";
import { suppliers, type Supplier } from "@/server/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

// TODO: 인증 구현 후 실제 organizationId로 교체
const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * 공급자 입력 스키마
 */
const supplierSchema = z.object({
  name: z.string().min(1, "공급자명은 필수입니다"),
  code: z.string().optional(),
  businessNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  paymentTerms: z.string().optional(),
  minOrderAmount: z.coerce.number().min(0).default(0),
  avgLeadTime: z.coerce.number().min(0).default(7),
  minLeadTime: z.coerce.number().min(0).default(3),
  maxLeadTime: z.coerce.number().min(0).default(14),
  rating: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

export type SupplierInput = z.infer<typeof supplierSchema>;

/**
 * 공급자 목록 조회
 */
export async function getSuppliers(options?: {
  search?: string;
  sortBy?: "name" | "createdAt" | "rating";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<{ suppliers: Supplier[]; total: number }> {
  const { search, sortBy = "name", sortOrder = "asc", limit = 50, offset = 0 } = options || {};

  // WHERE 조건 구성
  const user = await getCurrentUser();
  const orgId = user?.organizationId || TEMP_ORG_ID;
  const conditions = [eq(suppliers.organizationId, orgId)];

  if (search) {
    conditions.push(
      sql`(${suppliers.name} ILIKE ${`%${search}%`} OR ${suppliers.code} ILIKE ${`%${search}%`})`
    );
  }

  // 정렬 설정
  const orderByColumn = {
    name: suppliers.name,
    createdAt: suppliers.createdAt,
    rating: suppliers.rating,
  }[sortBy];

  const orderBy = sortOrder === "asc" ? asc(orderByColumn) : desc(orderByColumn);

  // 쿼리 실행
  const [supplierList, countResult] = await Promise.all([
    db
      .select()
      .from(suppliers)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(and(...conditions)),
  ]);

  return {
    suppliers: supplierList,
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 공급자 상세 조회
 */
export async function getSupplierById(id: string): Promise<Supplier | null> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || TEMP_ORG_ID;
  const result = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, orgId)))
    .limit(1);

  return result[0] || null;
}

/**
 * 공급자 생성
 */
export async function createSupplier(
  input: SupplierInput
): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;

    // 유효성 검사
    const validated = supplierSchema.parse(input);

    // 생성
    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        ...validated,
        organizationId: orgId,
        contactEmail: validated.contactEmail || null,
        rating: String(validated.rating),
      })
      .returning();

    // 활동 로깅
    if (user) {
      await logActivity({
        user,
        action: "CREATE",
        entityType: "supplier",
        entityId: newSupplier.id,
        description: `${validated.name} 공급업체 등록`,
      });
    }

    revalidatePath("/dashboard/suppliers");
    return { success: true, supplier: newSupplier };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return { success: false, error: zodError.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("공급자 생성 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "공급자 생성에 실패했습니다",
    };
  }
}

/**
 * 공급자 수정
 */
export async function updateSupplier(
  id: string,
  input: Partial<SupplierInput>
): Promise<{ success: boolean; supplier?: Supplier; error?: string }> {
  try {
    const user = await getCurrentUser();

    // 기존 공급자 확인
    const existing = await getSupplierById(id);
    if (!existing) {
      return { success: false, error: "공급자를 찾을 수 없습니다" };
    }

    // 수정
    const updateData: Record<string, unknown> = {
      ...input,
      contactEmail: input.contactEmail || null,
      updatedAt: new Date(),
    };
    if (input.rating !== undefined) {
      updateData.rating = String(input.rating);
    }

    const orgId = user?.organizationId || TEMP_ORG_ID;
    const [updated] = await db
      .update(suppliers)
      .set(updateData)
      .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, orgId)))
      .returning();

    // 활동 로깅
    if (user) {
      await logActivity({
        user,
        action: "UPDATE",
        entityType: "supplier",
        entityId: id,
        description: `공급업체 수정`,
      });
    }

    revalidatePath("/dashboard/suppliers");
    return { success: true, supplier: updated };
  } catch (error) {
    console.error("공급자 수정 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "공급자 수정에 실패했습니다",
    };
  }
}

/**
 * 공급자 삭제
 */
export async function deleteSupplier(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;
    const existing = await getSupplierById(id);
    if (!existing) {
      return { success: false, error: "공급자를 찾을 수 없습니다" };
    }

    await db
      .delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, orgId)));

    // 활동 로깅
    if (user) {
      await logActivity({
        user,
        action: "DELETE",
        entityType: "supplier",
        entityId: id,
        description: `공급업체 삭제`,
      });
    }

    revalidatePath("/dashboard/suppliers");
    return { success: true };
  } catch (error) {
    console.error("공급자 삭제 오류:", error);
    return { success: false, error: "공급자 삭제에 실패했습니다" };
  }
}

/**
 * 공급자 일괄 삭제
 */
export async function deleteSuppliers(
  ids: string[]
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    if (ids.length === 0) {
      return { success: false, deletedCount: 0, error: "삭제할 공급자가 없습니다" };
    }

    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;

    await db
      .delete(suppliers)
      .where(and(sql`${suppliers.id} IN ${ids}`, eq(suppliers.organizationId, orgId)));

    // 활동 로깅
    if (user) {
      await logActivity({
        user,
        action: "DELETE",
        entityType: "supplier",
        entityId: ids.join(","),
        description: `공급업체 ${ids.length}건 일괄 삭제`,
      });
    }

    revalidatePath("/dashboard/suppliers");
    return { success: true, deletedCount: ids.length };
  } catch (error) {
    console.error("공급자 일괄 삭제 오류:", error);
    return { success: false, deletedCount: 0, error: "공급자 삭제에 실패했습니다" };
  }
}

/**
 * 공급자 통계
 */
export async function getSupplierStats(): Promise<{
  total: number;
  avgRating: number;
  avgLeadTime: number;
}> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || TEMP_ORG_ID;
  const result = await db
    .select({
      count: sql<number>`count(*)`,
      avgRating: sql<number>`avg(${suppliers.rating})`,
      avgLeadTime: sql<number>`avg(${suppliers.avgLeadTime})`,
    })
    .from(suppliers)
    .where(eq(suppliers.organizationId, orgId));

  return {
    total: Number(result[0]?.count || 0),
    avgRating: Number(result[0]?.avgRating || 0),
    avgLeadTime: Number(result[0]?.avgLeadTime || 7),
  };
}

/**
 * 공급자 선택 목록 (드롭다운용)
 */
export async function getSupplierOptions(): Promise<{ id: string; name: string }[]> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || TEMP_ORG_ID;
  const result = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
    })
    .from(suppliers)
    .where(eq(suppliers.organizationId, orgId))
    .orderBy(asc(suppliers.name));

  return result;
}
