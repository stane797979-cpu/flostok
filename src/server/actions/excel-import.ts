"use server";

/**
 * Excel 데이터 임포트 Server Actions
 */

import { importSalesData, importProductData, createSalesTemplate, createProductTemplate, importOtherInboundData, createOtherInboundTemplate } from "@/server/services/excel";
import type { ExcelImportResult, ProductExcelRow } from "@/server/services/excel";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import { revalidatePath } from "next/cache";

export type ImportType = "sales" | "products" | "inbound";

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
      // sales_records에 직접 저장 (재고 차감 없음 — 기초 데이터 적재용)
      const result = await importSalesData({
        organizationId: user.organizationId,
        buffer,
        sheetName: input.sheetName,
        duplicateHandling: input.duplicateHandling ?? "skip",
        deductInventory: false,
      });

      if (result.successCount > 0) {
        await logActivity({
          user,
          action: "IMPORT",
          entityType: "excel_import",
          description: `판매(출고) 데이터 Excel 임포트 (${result.successCount}/${result.totalRows}건 성공)`,
        });
        revalidatePath("/dashboard/psi");
      }

      return {
        success: result.successCount > 0 || result.totalRows > 0,
        message: result.successCount > 0
          ? `판매 데이터 ${result.successCount}건 저장 완료`
          : `업로드 중 ${result.errorCount}건 오류 발생`,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors.map((e) => ({ row: e.row, column: e.column, message: e.message })),
      };
    }

    if (input.type === "inbound") {
      const result = await importOtherInboundData({
        organizationId: user.organizationId,
        buffer,
      });

      if (result.successCount > 0) {
        await logActivity({
          user,
          action: "IMPORT",
          entityType: "excel_import",
          description: `입고 데이터 Excel 임포트 (${result.successCount}/${result.totalRows}건 성공)`,
        });
        revalidatePath("/dashboard/inbound");
      }

      return {
        success: result.success,
        message: result.message,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors.map((e) => ({ row: e.row, message: e.message })),
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
  } else if (type === "inbound") {
    const user = await requireAuth();
    buffer = await createOtherInboundTemplate(user.organizationId);
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
