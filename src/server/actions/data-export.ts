"use server";

/**
 * 데이터 익스포트 Server Actions
 * - 제품 목록 Excel 다운로드
 * - 판매 데이터 Excel 다운로드
 */

import { db } from "@/server/db";
import { products, salesRecords } from "@/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateProductsExcel, generateSalesExcel } from "@/server/services/excel";
import { requireAuth } from "./auth-helpers";

function isDevMode(): boolean {
  const url = process.env.DATABASE_URL || "";
  return !url || url.includes("dummy");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 제품 목록 Excel 익스포트
 */
export async function exportProductsToExcel(): Promise<{
  success: boolean;
  data?: {
    buffer: string;
    filename: string;
  };
  error?: string;
}> {
  try {
    await requireAuth();

    if (isDevMode()) {
      return { success: false, error: "DB 미연결 상태입니다. 제품 데이터가 없습니다." };
    }

    const user = await requireAuth();

    const productList = await db
      .select({
        sku: products.sku,
        name: products.name,
        category: products.category,
        unit: products.unit,
        unitPrice: products.unitPrice,
        costPrice: products.costPrice,
        safetyStock: products.safetyStock,
        reorderPoint: products.reorderPoint,
        leadTime: products.leadTime,
        moq: products.moq,
        abcGrade: products.abcGrade,
        xyzGrade: products.xyzGrade,
        isActive: products.isActive,
      })
      .from(products)
      .where(eq(products.organizationId, user.organizationId))
      .orderBy(products.sku);

    if (productList.length === 0) {
      return { success: false, error: "익스포트할 제품 데이터가 없습니다" };
    }

    const buffer = await generateProductsExcel(productList);
    const today = new Date().toISOString().split("T")[0]!.replace(/-/g, "");

    return {
      success: true,
      data: {
        buffer: arrayBufferToBase64(buffer),
        filename: `제품목록_${today}.xlsx`,
      },
    };
  } catch (error) {
    console.error("제품 Excel 익스포트 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "제품 목록 다운로드에 실패했습니다",
    };
  }
}

/**
 * 판매 데이터 Excel 익스포트
 */
export async function exportSalesToExcel(): Promise<{
  success: boolean;
  data?: {
    buffer: string;
    filename: string;
  };
  error?: string;
}> {
  try {
    await requireAuth();

    if (isDevMode()) {
      return { success: false, error: "DB 미연결 상태입니다. 판매 데이터가 없습니다." };
    }

    const user = await requireAuth();

    const salesData = await db
      .select({
        date: salesRecords.date,
        sku: products.sku,
        productName: products.name,
        quantity: salesRecords.quantity,
        unitPrice: salesRecords.unitPrice,
        totalAmount: salesRecords.totalAmount,
        channel: salesRecords.channel,
        notes: salesRecords.notes,
      })
      .from(salesRecords)
      .innerJoin(products, eq(salesRecords.productId, products.id))
      .where(eq(salesRecords.organizationId, user.organizationId))
      .orderBy(desc(salesRecords.date));

    if (salesData.length === 0) {
      return { success: false, error: "익스포트할 판매 데이터가 없습니다" };
    }

    const buffer = await generateSalesExcel(salesData);
    const today = new Date().toISOString().split("T")[0]!.replace(/-/g, "");

    return {
      success: true,
      data: {
        buffer: arrayBufferToBase64(buffer),
        filename: `판매데이터_${today}.xlsx`,
      },
    };
  } catch (error) {
    console.error("판매 Excel 익스포트 오류:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "판매 데이터 다운로드에 실패했습니다",
    };
  }
}
