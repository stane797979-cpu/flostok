"use server";

import { db } from "@/server/db";
import { customers, type Customer } from "@/server/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import ExcelJS from "exceljs";

const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * 거래처 입력 스키마
 */
const customerSchema = z.object({
  name: z.string().min(1, "거래처명은 필수입니다"),
  code: z.string().optional(),
  representative: z.string().optional(),
  businessNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  fax: z.string().optional(),
  address: z.string().optional(),
  channel: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;

/**
 * 거래처 목록 조회
 */
export async function getCustomers(options?: {
  search?: string;
  sortBy?: "name" | "createdAt";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}): Promise<{ customers: Customer[]; total: number }> {
  const { search, sortBy = "name", sortOrder = "asc", limit = 50, offset = 0 } = options || {};

  const user = await getCurrentUser();
  const orgId = user?.organizationId || TEMP_ORG_ID;
  const conditions = [eq(customers.organizationId, orgId)];

  if (search) {
    conditions.push(
      sql`(${customers.name} ILIKE ${`%${search}%`} OR ${customers.code} ILIKE ${`%${search}%`})`
    );
  }

  const orderByColumn = {
    name: customers.name,
    createdAt: customers.createdAt,
  }[sortBy];

  const orderBy = sortOrder === "asc" ? asc(orderByColumn) : desc(orderByColumn);

  const [customerList, countResult] = await Promise.all([
    db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(and(...conditions)),
  ]);

  return {
    customers: customerList,
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * 거래처 상세 조회
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || TEMP_ORG_ID;
  const result = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.organizationId, orgId)))
    .limit(1);

  return result[0] || null;
}

/**
 * 거래처 생성
 */
export async function createCustomer(
  input: CustomerInput
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;

    const validated = customerSchema.parse(input);

    const [newCustomer] = await db
      .insert(customers)
      .values({
        ...validated,
        organizationId: orgId,
        contactEmail: validated.contactEmail || null,
      })
      .returning();

    if (user) {
      await logActivity({
        user,
        action: "CREATE",
        entityType: "customer",
        entityId: newCustomer.id,
        description: `${validated.name} 거래처 등록`,
      });
    }

    revalidatePath("/dashboard/customers");
    return { success: true, customer: newCustomer };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError;
      return { success: false, error: zodError.issues[0]?.message || "유효성 검사 실패" };
    }
    console.error("거래처 생성 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "거래처 생성에 실패했습니다",
    };
  }
}

/**
 * 거래처 수정
 */
export async function updateCustomer(
  id: string,
  input: Partial<CustomerInput>
): Promise<{ success: boolean; customer?: Customer; error?: string }> {
  try {
    const user = await getCurrentUser();

    const existing = await getCustomerById(id);
    if (!existing) {
      return { success: false, error: "거래처를 찾을 수 없습니다" };
    }

    const updateData: Record<string, unknown> = {
      ...input,
      contactEmail: input.contactEmail || null,
      updatedAt: new Date(),
    };

    const orgId = user?.organizationId || TEMP_ORG_ID;
    const [updated] = await db
      .update(customers)
      .set(updateData)
      .where(and(eq(customers.id, id), eq(customers.organizationId, orgId)))
      .returning();

    if (user) {
      await logActivity({
        user,
        action: "UPDATE",
        entityType: "customer",
        entityId: id,
        description: `거래처 수정`,
      });
    }

    revalidatePath("/dashboard/customers");
    return { success: true, customer: updated };
  } catch (error) {
    console.error("거래처 수정 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "거래처 수정에 실패했습니다",
    };
  }
}

/**
 * 거래처 삭제
 */
export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    const orgId = user?.organizationId || TEMP_ORG_ID;
    const existing = await getCustomerById(id);
    if (!existing) {
      return { success: false, error: "거래처를 찾을 수 없습니다" };
    }

    await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.organizationId, orgId)));

    if (user) {
      await logActivity({
        user,
        action: "DELETE",
        entityType: "customer",
        entityId: id,
        description: `거래처 삭제`,
      });
    }

    revalidatePath("/dashboard/customers");
    return { success: true };
  } catch (error) {
    console.error("거래처 삭제 오류:", error);
    return { success: false, error: "거래처 삭제에 실패했습니다" };
  }
}

/**
 * 거래처 선택 목록 (드롭다운용)
 */
export async function getCustomerOptions(): Promise<{ id: string; name: string }[]> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || TEMP_ORG_ID;
  const result = await db
    .select({
      id: customers.id,
      name: customers.name,
    })
    .from(customers)
    .where(eq(customers.organizationId, orgId))
    .orderBy(asc(customers.name));

  return result;
}

/**
 * 거래처 엑셀 다운로드 (현재 데이터)
 */
export async function exportCustomersExcel(): Promise<{ data: number[]; filename: string }> {
  const { customers: list } = await getCustomers({ limit: 9999 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("거래처 목록");

  // 헤더
  ws.columns = [
    { header: "거래처명", key: "name", width: 20 },
    { header: "거래처코드", key: "code", width: 15 },
    { header: "대표자", key: "representative", width: 12 },
    { header: "사업자번호", key: "businessNumber", width: 16 },
    { header: "담당자명", key: "contactName", width: 12 },
    { header: "전화번호", key: "contactPhone", width: 16 },
    { header: "이메일", key: "contactEmail", width: 24 },
    { header: "팩스", key: "fax", width: 16 },
    { header: "주소", key: "address", width: 30 },
    { header: "채널", key: "channel", width: 12 },
    { header: "결제조건", key: "paymentTerms", width: 20 },
    { header: "메모", key: "notes", width: 30 },
  ];

  // 헤더 스타일
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // 데이터 행
  list.forEach((c) => {
    ws.addRow({
      name: c.name,
      code: c.code ?? "",
      representative: c.representative ?? "",
      businessNumber: c.businessNumber ?? "",
      contactName: c.contactName ?? "",
      contactPhone: c.contactPhone ?? "",
      contactEmail: c.contactEmail ?? "",
      fax: c.fax ?? "",
      address: c.address ?? "",
      channel: c.channel ?? "",
      paymentTerms: c.paymentTerms ?? "",
      notes: c.notes ?? "",
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return { data: Array.from(new Uint8Array(buf as ArrayBuffer)), filename: `거래처_${date}.xlsx` };
}

/**
 * 거래처 엑셀 템플릿 다운로드 (빈 양식)
 */
export async function downloadCustomerTemplate(): Promise<{ data: number[]; filename: string }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("거래처 등록");

  ws.columns = [
    { header: "거래처명*", key: "name", width: 20 },
    { header: "거래처코드", key: "code", width: 15 },
    { header: "대표자", key: "representative", width: 12 },
    { header: "사업자번호", key: "businessNumber", width: 16 },
    { header: "담당자명", key: "contactName", width: 12 },
    { header: "전화번호", key: "contactPhone", width: 16 },
    { header: "이메일", key: "contactEmail", width: 24 },
    { header: "팩스", key: "fax", width: 16 },
    { header: "주소", key: "address", width: 30 },
    { header: "채널", key: "channel", width: 12 },
    { header: "결제조건", key: "paymentTerms", width: 20 },
    { header: "메모", key: "notes", width: 30 },
  ];

  // 헤더 스타일
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // 예시 행 (연한 색으로 표시)
  const exampleRow = ws.addRow({
    name: "(예시) 쿠팡",
    code: "CUS-001",
    representative: "홍길동",
    businessNumber: "123-45-67890",
    contactName: "김철수",
    contactPhone: "02-1234-5678",
    contactEmail: "order@example.com",
    fax: "02-1234-5679",
    address: "서울시 강남구 테헤란로 123",
    channel: "온라인몰",
    paymentTerms: "월말마감 익월말",
    notes: "메모 입력",
  });
  exampleRow.font = { color: { argb: "FF94A3B8" } };

  const buf = await wb.xlsx.writeBuffer();
  return { data: Array.from(new Uint8Array(buf as ArrayBuffer)), filename: "거래처_등록양식.xlsx" };
}
