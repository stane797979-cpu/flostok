"use server";

import { db } from "@/server/db";
import { salesRecords, products, type SalesRecord } from "@/server/db/schema";
import { eq, and, desc, asc, sql, gte, lte } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { processInventoryTransaction } from "./inventory";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

/**
 * 판매 기록 입력 스키마
 */
const salesRecordSchema = z.object({
  productId: z.string().uuid("유효한 제품 ID가 아닙니다"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)"),
  quantity: z.coerce.number().min(1, "수량은 1 이상이어야 합니다"),
  unitPrice: z.coerce.number().min(0).optional(),
  channel: z.string().optional(),
  notes: z.string().optional(),
});

export type SalesRecordInput = z.infer<typeof salesRecordSchema>;

/**
 * 판매 기록 목록 조회
 */
export async function getSalesRecords(options?: {
  productId?: string;
  startDate?: string;
  endDate?: string;
  channel?: string;
  sortBy?: "date" | "quantity" | "totalAmount";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<{
  records: (SalesRecord & { product: { sku: string; name: string } })[];
  total: number;
}> {
  const {
    productId,
    startDate,
    endDate,
    channel,
    sortBy = "date",
    sortOrder = "desc",
    limit = 50,
    offset = 0,
  } = options || {};

  const user = await requireAuth();
  const conditions = [eq(salesRecords.organizationId, user.organizationId)];

  if (productId) {
    conditions.push(eq(salesRecords.productId, productId));
  }
  if (startDate) {
    conditions.push(gte(salesRecords.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(salesRecords.date, endDate));
  }
  if (channel) {
    conditions.push(eq(salesRecords.channel, channel));
  }

  const orderByColumn = {
    date: salesRecords.date,
    quantity: salesRecords.quantity,
    totalAmount: salesRecords.totalAmount,
  }[sortBy];

  const orderBy = sortOrder === "asc" ? asc(orderByColumn) : desc(orderByColumn);

  const [records, countResult] = await Promise.all([
    db
      .select({
        salesRecord: salesRecords,
        product: {
          sku: products.sku,
          name: products.name,
        },
      })
      .from(salesRecords)
      .innerJoin(products, eq(salesRecords.productId, products.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(salesRecords)
      .where(and(...conditions)),
  ]);

  return {
    records: records.map((row) => ({
      ...row.salesRecord,
      product: row.product,
    })),
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 판매 기록 생성 (재고 자동 차감)
 */
export async function createSalesRecord(
  input: SalesRecordInput
): Promise<{ success: boolean; record?: SalesRecord; error?: string }> {
  try {
    const validated = salesRecordSchema.parse(input);
    const user = await requireAuth();

    // 제품 정보 조회
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, validated.productId), eq(products.organizationId, user.organizationId)))
      .limit(1);

    if (!product) {
      return { success: false, error: "제품을 찾을 수 없습니다" };
    }

    const unitPrice = validated.unitPrice ?? product.unitPrice ?? 0;
    const totalAmount = unitPrice * validated.quantity;

    // 트랜잭션으로 재고 차감 및 판매 기록 생성
    const newRecord = await db.transaction(async (tx) => {
      // 재고 차감 (판매 출고) — tx를 전달해 같은 트랜잭션 내에서 실행
      const inventoryResult = await processInventoryTransaction(
        {
          productId: validated.productId,
          changeType: "OUTBOUND_SALE",
          quantity: validated.quantity,
          notes: `판매: ${validated.date}`,
        },
        { user, product, tx, skipRevalidate: true, skipActivityLog: true }
      );

      if (!inventoryResult.success) {
        throw new Error(inventoryResult.error || "재고 차감 실패");
      }

      // 판매 기록 생성
      const [record] = await tx
        .insert(salesRecords)
        .values({
          organizationId: user.organizationId,
          productId: validated.productId,
          date: validated.date,
          quantity: validated.quantity,
          unitPrice,
          totalAmount,
          channel: validated.channel,
          notes: validated.notes,
        })
        .returning();

      return record;
    });

    await logActivity({
      user,
      action: "CREATE",
      entityType: "sales_record",
      entityId: newRecord.id,
      description: `판매 기록 생성`,
    });

    // 재고 차감(processInventoryTransaction)에서 skipRevalidate: true로 생략했으므로 여기서 통합 처리
    revalidatePath("/analytics");
    revalidatePath("/dashboard/inventory");
    revalidateTag(`analytics-${user.organizationId}`);
    revalidateTag(`inventory-${user.organizationId}`);
    revalidateTag(`kpi-${user.organizationId}`);
    return { success: true, record: newRecord };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("판매 기록 생성 오류:", error);
    return { success: false, error: "판매 기록 생성에 실패했습니다" };
  }
}

/**
 * 판매 기록 삭제 (재고 복구 없음 - 조정으로 처리)
 */
export async function deleteSalesRecord(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const user = await requireAuth();

    const [existing] = await db
      .select()
      .from(salesRecords)
      .where(and(eq(salesRecords.id, id), eq(salesRecords.organizationId, user.organizationId)))
      .limit(1);

    if (!existing) {
      return { success: false, error: "판매 기록을 찾을 수 없습니다" };
    }

    await db.delete(salesRecords).where(eq(salesRecords.id, id));

    await logActivity({
      user,
      action: "DELETE",
      entityType: "sales_record",
      entityId: id,
      description: `판매 기록 삭제`,
    });

    revalidatePath("/analytics");
    revalidateTag(`analytics-${user.organizationId}`);
    return {
      success: true,
      message:
        "판매 기록이 삭제되었습니다. 재고는 자동 원복되지 않으므로 재고 조정을 통해 수동으로 처리해주세요.",
    };
  } catch (error) {
    console.error("판매 기록 삭제 오류:", error);
    return { success: false, error: "판매 기록 삭제에 실패했습니다" };
  }
}

/**
 * 일별 판매 통계
 */
export async function getDailySalesStats(options?: {
  productId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  data: Array<{
    date: string;
    totalQuantity: number;
    totalAmount: number;
    orderCount: number;
  }>;
}> {
  const { productId, startDate, endDate } = options || {};

  const user = await requireAuth();
  const conditions = [eq(salesRecords.organizationId, user.organizationId)];

  if (productId) {
    conditions.push(eq(salesRecords.productId, productId));
  }
  if (startDate) {
    conditions.push(gte(salesRecords.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(salesRecords.date, endDate));
  }

  const result = await db
    .select({
      date: salesRecords.date,
      totalQuantity: sql<number>`sum(${salesRecords.quantity})`,
      totalAmount: sql<number>`sum(${salesRecords.totalAmount})`,
      orderCount: sql<number>`count(*)`,
    })
    .from(salesRecords)
    .where(and(...conditions))
    .groupBy(salesRecords.date)
    .orderBy(asc(salesRecords.date));

  return {
    data: result.map((row) => ({
      date: row.date,
      totalQuantity: Number(row.totalQuantity),
      totalAmount: Number(row.totalAmount),
      orderCount: Number(row.orderCount),
    })),
  };
}

/**
 * 제품별 판매 통계
 */
export async function getProductSalesStats(options?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{
  data: Array<{
    productId: string;
    productName: string;
    sku: string;
    totalQuantity: number;
    totalAmount: number;
    orderCount: number;
  }>;
}> {
  const { startDate, endDate, limit = 20 } = options || {};

  const user = await requireAuth();
  const conditions = [eq(salesRecords.organizationId, user.organizationId)];

  if (startDate) {
    conditions.push(gte(salesRecords.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(salesRecords.date, endDate));
  }

  const result = await db
    .select({
      productId: salesRecords.productId,
      productName: products.name,
      sku: products.sku,
      totalQuantity: sql<number>`sum(${salesRecords.quantity})`,
      totalAmount: sql<number>`sum(${salesRecords.totalAmount})`,
      orderCount: sql<number>`count(*)`,
    })
    .from(salesRecords)
    .innerJoin(products, eq(salesRecords.productId, products.id))
    .where(and(...conditions))
    .groupBy(salesRecords.productId, products.name, products.sku)
    .orderBy(desc(sql`sum(${salesRecords.totalAmount})`))
    .limit(limit);

  return {
    data: result.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      totalQuantity: Number(row.totalQuantity),
      totalAmount: Number(row.totalAmount),
      orderCount: Number(row.orderCount),
    })),
  };
}

/**
 * 판매 채널 목록 조회
 */
export async function getSalesChannels(): Promise<string[]> {
  const user = await requireAuth();

  const result = await db
    .selectDistinct({ channel: salesRecords.channel })
    .from(salesRecords)
    .where(
      and(eq(salesRecords.organizationId, user.organizationId), sql`${salesRecords.channel} IS NOT NULL`)
    )
    .orderBy(asc(salesRecords.channel));

  return result.map((r) => r.channel).filter((c): c is string => c !== null);
}

/**
 * 일평균 판매량 계산 (제품별)
 */
export async function getAverageDailySales(
  productId: string,
  periodDays: number = 30
): Promise<number> {
  const user = await requireAuth();
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  const startDateStr = startDate.toISOString().split("T")[0];

  const result = await db
    .select({
      totalQuantity: sql<number>`sum(${salesRecords.quantity})`,
    })
    .from(salesRecords)
    .where(
      and(
        eq(salesRecords.organizationId, user.organizationId),
        eq(salesRecords.productId, productId),
        gte(salesRecords.date, startDateStr),
        lte(salesRecords.date, endDate)
      )
    );

  const total = Number(result[0]?.totalQuantity || 0);
  return Math.round((total / periodDays) * 100) / 100;
}
