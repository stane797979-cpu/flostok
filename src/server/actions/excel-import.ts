"use server";

/**
 * Excel 데이터 임포트 Server Actions
 */

import { importSalesData, importProductData, createSalesTemplate, createProductTemplate } from "@/server/services/excel";
import type { ExcelImportResult, SalesRecordExcelRow, ProductExcelRow } from "@/server/services/excel";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

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

    // 행 수 체크 (500행 제한)
    const MAX_UPLOAD_ROWS = 500;
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", sheetRows: MAX_UPLOAD_ROWS + 2 });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const previewRows = XLSX.utils.sheet_to_json(firstSheet);
    if (previewRows.length > MAX_UPLOAD_ROWS) {
      return {
        success: false,
        message: `한 번에 최대 ${MAX_UPLOAD_ROWS}행까지 업로드 가능합니다. 파일을 나누어 업로드해 주세요.`,
        totalRows: previewRows.length,
        successCount: 0,
        errorCount: 0,
        errors: [],
      };
    }

    let result: ExcelImportResult<SalesRecordExcelRow | ProductExcelRow>;

    if (input.type === "sales") {
      result = await importSalesData({
        organizationId: user.organizationId,
        buffer,
        sheetName: input.sheetName,
        duplicateHandling: input.duplicateHandling,
        deductInventory: true,
      });
    } else {
      result = await importProductData({
        organizationId: user.organizationId,
        buffer,
        sheetName: input.sheetName,
        duplicateHandling: input.duplicateHandling,
      });
    }

    const typeLabel = input.type === "sales" ? "판매 데이터" : "제품 데이터";

    // 활동 로그 기록 (성공 건수가 있을 때만)
    if (result.success && result.successCount > 0) {
      await logActivity({
        user,
        action: "IMPORT",
        entityType: "excel_import",
        description: `Excel 임포트 (${result.successCount}/${result.totalRows}건 성공)`,
      });
    }

    return {
      success: result.success,
      message: result.success
        ? `${typeLabel} ${result.successCount}건 임포트 완료`
        : `${typeLabel} 임포트 중 ${result.errorCount}건 오류 발생`,
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
