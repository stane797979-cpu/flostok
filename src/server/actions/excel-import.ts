"use server";

/**
 * Excel 데이터 임포트 Server Actions
 */

import { importSalesData, importProductData, createSalesTemplate, createProductTemplate } from "@/server/services/excel";
import type { ExcelImportResult, SalesRecordExcelRow, ProductExcelRow } from "@/server/services/excel";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import { db } from "@/server/db";
import { outboundRequests, outboundRequestItems, products } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function generateRequestNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `OR-${dateStr}-${random}`;
}

export type ImportType = "sales" | "products";

export interface ImportExcelInput {
  type: ImportType;
  fileBase64: string;
  fileName: string;
  sheetName?: string;
  duplicateHandling?: "skip" | "update" | "error";
}

export interface ImportExcelResult {
  success: boolean;
  message: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    column?: string;
    message: string;
  }>;
}

/**
 * Excel 파일 임포트
 */
export async function importExcelFile(input: ImportExcelInput): Promise<ImportExcelResult> {
  try {
    const user = await requireAuth();

    // Base64 -> ArrayBuffer 변환
    const base64Data = input.fileBase64.split(",")[1] || input.fileBase64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    if (input.type === "sales") {
      // 엑셀 파싱으로 SKU/수량 추출 후 outbound_requests 생성
      const result = await importSalesData({
        organizationId: user.organizationId,
        buffer,
        sheetName: input.sheetName,
        duplicateHandling: input.duplicateHandling,
        deductInventory: false, // 재고 차감은 창고 확정 시 처리
      });

      if (result.success && result.successCount > 0) {
        // SKU → productId 매핑
        const orgProducts = await db
          .select({ id: products.id, sku: products.sku })
          .from(products)
          .where(eq(products.organizationId, user.organizationId));
        const skuMap = new Map(orgProducts.map((p) => [p.sku, p.id]));

        // 날짜별·SKU별로 집계된 data를 outbound_request로 묶기
        const itemsMap = new Map<string, { productId: string; quantity: number }>();
        for (const row of result.data as SalesRecordExcelRow[]) {
          const productId = skuMap.get(row.sku);
          if (!productId) continue;
          const existing = itemsMap.get(productId);
          if (existing) {
            existing.quantity += row.quantity;
          } else {
            itemsMap.set(productId, { productId, quantity: row.quantity });
          }
        }

        const items = Array.from(itemsMap.values());
        if (items.length > 0) {
          const [request] = await db
            .insert(outboundRequests)
            .values({
              organizationId: user.organizationId,
              requestNumber: generateRequestNumber(),
              status: "pending",
              outboundType: "OUTBOUND_SALE",
              requestedById: user.id,
              notes: `엑셀 업로드: ${input.fileName}`,
            })
            .returning();

          await db.insert(outboundRequestItems).values(
            items.map((item) => ({
              outboundRequestId: request.id,
              productId: item.productId,
              requestedQuantity: item.quantity,
            }))
          );

          revalidatePath("/dashboard/outbound");
          revalidatePath("/dashboard/warehouse/outbound");
        }

        await logActivity({
          user,
          action: "IMPORT",
          entityType: "excel_import",
          description: `출고 업로드 (${result.successCount}건 → 출고요청 생성)`,
        });
      }

      return {
        success: result.success,
        message: result.success
          ? `출고 요청 ${result.successCount}건 등록 완료`
          : `업로드 중 ${result.errorCount}건 오류 발생`,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors.map((e) => ({ row: e.row, column: e.column, message: e.message })),
      };
    }

    const result = await importProductData({
      organizationId: user.organizationId,
      buffer,
      sheetName: input.sheetName,
      duplicateHandling: input.duplicateHandling,
    });

    if (result.success && result.successCount > 0) {
      await logActivity({
        user,
        action: "IMPORT",
        entityType: "excel_import",
        description: `제품 데이터 Excel 임포트 (${result.successCount}/${result.totalRows}건 성공)`,
      });
    }

    return {
      success: result.success,
      message: result.success
        ? `제품 데이터 ${result.successCount}건 임포트 완료`
        : `임포트 중 ${result.errorCount}건 오류 발생`,
      totalRows: result.totalRows,
      successCount: result.successCount,
      errorCount: result.errorCount,
      errors: result.errors.map((e) => ({
        row: e.row,
        column: e.column,
        message: e.message,
      })),
    };
  } catch (error) {
    console.error("Excel import error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Excel 파일 처리 중 오류가 발생했습니다",
      totalRows: 0,
      successCount: 0,
      errorCount: 1,
      errors: [
        {
          row: 0,
          message: error instanceof Error ? error.message : "알 수 없는 오류",
        },
      ],
    };
  }
}

/**
 * Excel 템플릿 다운로드 URL 생성
 */
export async function getExcelTemplateBase64(type: ImportType): Promise<string> {
  let buffer: ArrayBuffer;

  if (type === "sales") {
    buffer = await createSalesTemplate();
  } else {
    buffer = await createProductTemplate();
  }

  // ArrayBuffer -> Base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}
