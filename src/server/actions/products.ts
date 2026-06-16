"use server";

import { db } from "@/server/db";
import { products, type Product } from "@/server/db/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

/**
 * 제품 입력 스키마
 */
const productSchema = z.object({
  sku: z.string().min(1, "SKU는 필수입니다"),
  name: z.string().min(1, "제품명은 필수입니다"),
  category: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().default("EA"),
  unitPrice: z.coerce.number().min(0).default(0),
  costPrice: z.coerce.number().min(0).default(0),
  abcGrade: z.enum(["A", "B", "C"]).optional(),
  xyzGrade: z.enum(["X", "Y", "Z"]).optional(),
  moq: z.coerce.number().min(1).default(1),
  leadTime: z.coerce.number().min(0).default(7),
  safetyStock: z.coerce.number().min(0).default(0),
  reorderPoint: z.coerce.number().min(0).default(0),
  targetStock: z.coerce.number().min(0).optional(),
  primarySupplierId: z.string().uuid().optional(),
  imageUrl: z.string().url().optional(),
  barcode: z.string().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

/**
 * 제품 목록 조회
 */
export async function getProducts(options?: {
  search?: string;
  category?: string;
  abcGrade?: "A" | "B" | "C";
  xyzGrade?: "X" | "Y" | "Z";
  sortBy?: "name" | "sku" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<{ products: Product[]; total: number }> {
  const {
    search,
    category,
    abcGrade,
    xyzGrade,
    sortBy = "createdAt",
    sortOrder = "desc",
    limit = 50,
    offset = 0,
  } = options || {};

  // WHERE 조건 구성
  const user = await requireAuth();
  const conditions = [eq(products.organizationId, user.organizationId)];

  if (search) {
    conditions.push(
      sql`(${products.name} ILIKE ${`%${search}%`} OR ${products.sku} ILIKE ${`%${search}%`})`
    );
  }
  if (category) {
    conditions.push(eq(products.category, category));
  }
  if (abcGrade) {
    conditions.push(eq(products.abcGrade, abcGrade));
  }
  if (xyzGrade) {
    conditions.push(eq(products.xyzGrade, xyzGrade));
  }

  // 정렬 설정
  const orderByColumn = {
    name: products.name,
    sku: products.sku,
    createdAt: products.createdAt,
    updatedAt: products.updatedAt,
  }[sortBy];

  const orderBy = sortOrder === "asc" ? asc(orderByColumn) : desc(orderByColumn);

  // 쿼리 실행
  const [productList, countResult] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(and(...conditions)),
  ]);

  return {
    products: productList,
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 제품 상세 조회
 */
export async function getProductById(id: string): Promise<Product | null> {
  const user = await requireAuth();
  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.organizationId, user.organizationId)))
    .limit(1);

  return result[0] || null;
}

/**
 * SKU로 제품 조회
 */
export async function getProductBySku(sku: string): Promise<Product | null> {
  const user = await requireAuth();
  const result = await db
    .select()
    .from(products)
    .where(and(eq(products.sku, sku), eq(products.organizationId, user.organizationId)))
    .limit(1);

  return result[0] || null;
}

/**
 * 제품 생성
 */
export async function createProduct(
  input: ProductInput
): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const user = await requireAuth();

    // 유효성 검사
    const validated = productSchema.parse(input);

    // SKU 중복 체크
    const existing = await getProductBySku(validated.sku);
    if (existing) {
      return { success: false, error: "이미 존재하는 SKU입니다" };
    }

    // 제품 등록 제한 확인
    const { checkProductLimit } = await import("@/server/services/subscription/limits");
    const limit = await checkProductLimit(user.organizationId);
    if (!limit.allowed) {
      return {
        success: false,
        error: `제품 등록 한도를 초과했습니다. 현재 플랜(${limit.plan})에서는 최대 ${limit.limit}개의 제품을 등록할 수 있습니다. (현재: ${limit.current}개)`,
      };
    }

    // 생성
    const [newProduct] = await db
      .insert(products)
      .values({
        ...validated,
        organizationId: user.organizationId,
      })
      .returning();

    revalidatePath("/products");

    await logActivity({
      user,
      action: "CREATE",
      entityType: "product",
      entityId: newProduct.id,
      description: `${validated.sku} ${validated.name} 제품 등록`,
    });

    return { success: true, product: newProduct };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return { success: false, error: zodError.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("제품 생성 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "제품 생성에 실패했습니다",
    };
  }
}

/**
 * 제품 수정
 */
export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const user = await requireAuth();

    // 기존 제품 확인
    const existing = await getProductById(id);
    if (!existing) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    // SKU 변경 시 중복 체크
    if (input.sku && input.sku !== existing.sku) {
      const duplicate = await getProductBySku(input.sku);
      if (duplicate) {
        return { success: false, error: "이미 존재하는 SKU입니다" };
      }
    }

    // 수정
    const [updated] = await db
      .update(products)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.organizationId, user.organizationId)))
      .returning();

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);

    await logActivity({
      user,
      action: "UPDATE",
      entityType: "product",
      entityId: id,
      description: `${updated.sku} ${updated.name} 제품 수정`,
    });

    return { success: true, product: updated };
  } catch (error) {
    console.error("제품 수정 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "제품 수정에 실패했습니다",
    };
  }
}

/**
 * 제품 삭제
 */
export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const existing = await getProductById(id);
    if (!existing) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.organizationId, user.organizationId)));

    revalidatePath("/products");

    await logActivity({
      user,
      action: "DELETE",
      entityType: "product",
      entityId: id,
      description: `${existing.sku} ${existing.name} 제품 삭제`,
    });

    return { success: true };
  } catch (error) {
    console.error("제품 삭제 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "제품 삭제에 실패했습니다",
    };
  }
}

/**
 * 제품 일괄 삭제
 */
export async function deleteProducts(
  ids: string[]
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const user = await requireAuth();
    if (ids.length === 0) {
      return { success: false, deletedCount: 0, error: "삭제할 제품이 없습니다" };
    }

    const _result = await db
      .delete(products)
      .where(and(sql`${products.id} IN ${ids}`, eq(products.organizationId, user.organizationId)));

    revalidatePath("/products");

    await logActivity({
      user,
      action: "DELETE",
      entityType: "product",
      entityId: ids.join(","),
      description: `제품 ${ids.length}건 일괄 삭제`,
    });

    return { success: true, deletedCount: ids.length };
  } catch (error) {
    console.error("제품 일괄 삭제 오류:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error instanceof Error ? error.message : "제품 삭제에 실패했습니다",
    };
  }
}

/**
 * 카테고리 목록 조회
 */
export async function getCategories(): Promise<string[]> {
  const user = await requireAuth();
  const result = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.organizationId, user.organizationId), sql`${products.category} IS NOT NULL`))
    .orderBy(asc(products.category));

  return result.map((r) => r.category).filter((c): c is string => c !== null);
}

/**
 * 제품 통계
 */
export async function getProductStats(): Promise<{
  total: number;
  byAbcGrade: Record<string, number>;
  byXyzGrade: Record<string, number>;
  byCategory: Record<string, number>;
}> {
  const user = await requireAuth();
  const [totalResult, abcResult, xyzResult, categoryResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.organizationId, user.organizationId)),
    db
      .select({
        grade: products.abcGrade,
        count: sql<number>`count(*)`,
      })
      .from(products)
      .where(eq(products.organizationId, user.organizationId))
      .groupBy(products.abcGrade),
    db
      .select({
        grade: products.xyzGrade,
        count: sql<number>`count(*)`,
      })
      .from(products)
      .where(eq(products.organizationId, user.organizationId))
      .groupBy(products.xyzGrade),
    db
      .select({
        category: products.category,
        count: sql<number>`count(*)`,
      })
      .from(products)
      .where(eq(products.organizationId, user.organizationId))
      .groupBy(products.category),
  ]);

  const byAbcGrade: Record<string, number> = {};
  abcResult.forEach((r) => {
    if (r.grade) byAbcGrade[r.grade] = Number(r.count);
  });

  const byXyzGrade: Record<string, number> = {};
  xyzResult.forEach((r) => {
    if (r.grade) byXyzGrade[r.grade] = Number(r.count);
  });

  const byCategory: Record<string, number> = {};
  categoryResult.forEach((r) => {
    if (r.category) byCategory[r.category] = Number(r.count);
  });

  return {
    total: Number(totalResult[0]?.count || 0),
    byAbcGrade,
    byXyzGrade,
    byCategory,
  };
}
