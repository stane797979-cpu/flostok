"use server";

/**
 * Excel 데이터 임포트 Server Actions
 */

import { z } from "zod";
import {
  importSalesData,
  importProductData,
  importSupplierData,
  importOutboundData,
  importTransferData,
  createSalesTemplate,
  createProductTemplate,
  createSupplierTemplate,
  createOutboundTemplate,
  createTransferTemplate,
} from "@/server/services/excel";
import type { ExcelImportResult, SalesRecordExcelRow, ProductExcelRow, SupplierExcelRow } from "@/server/services/excel";
import type { TransferExcelRow } from "@/server/services/excel/transfer-import";
import { parseExcelBuffer, sheetToJson } from "@/server/services/excel/parser";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";

export type ImportType = "sales" | "products" | "suppliers" | "outbound" | "transfer";

/** Zod 런타임 검증 스키마 */
const importExcelSchema = z.object({
  type: z.enum(["sales", "products", "suppliers", "outbound", "transfer"]),
  fileBase64: z.string().min(1, "파일 데이터가 비어있습니다"),
  fileName: z.string().min(1, "파일명이 필요합니다"),
  sheetName: z.string().optional(),
  duplicateHandling: z.enum(["skip", "update", "error"]).optional(),
});

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
export async function importExcelFile(rawInput: ImportExcelInput): Promise<ImportExcelResult> {
  try {
    // 런타임 입력 검증
    const parsed = importExcelSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.errors[0]?.message || "입력 데이터가 올바르지 않습니다",
        totalRows: 0,
        successCount: 0,
        errorCount: 1,
        errors: [{ row: 0, message: parsed.error.errors[0]?.message || "유효성 검사 실패" }],
      };
    }
    const input = parsed.data;

    const user = await requireAuth();

    // Base64 -> ArrayBuffer 변환
    const base64Data = input.fileBase64.split(",")[1] || input.fileBase64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    // 행 수 체크 (500행 제한) — 기존 parser.ts의 안정적인 함수 재사용
    const MAX_UPLOAD_ROWS = 500;
    const checkWorkbook = await parseExcelBuffer(buffer);
    const checkRows = await sheetToJson(checkWorkbook, input.sheetName);
    if (checkRows.length > MAX_UPLOAD_ROWS) {
      return {
        success: false,
        message: `한 번에 최대 ${MAX_UPLOAD_ROWS}행까지 업로드 가능합니다. 현재 ${checkRows.length}행입니다. 파일을 나누어 업로드해 주세요.`,
        totalRows: checkRows.length,
        successCount: 0,
        errorCount: 0,
        errors: [],
      };
    }

    let result: ExcelImportResult<SalesRecordExcelRow | ProductExcelRow | SupplierExcelRow | TransferExcelRow>;

    if (input.type === "transfer") {
      // 재고이동: transferInventory 직접 호출 → 즉시 재고 반영
      result = await importTransferData({
        organizationId: user.organizationId,
        userId: user.id,
        buffer,
        sheetName: input.sheetName,
      });
    } else if (input.type === "outbound") {
      // 출고: outbound_requests (pending) 생성 — 재고 차감 안 함
      const { getDefaultWarehouse } = await import("./warehouses");
      const defaultWarehouse = await getDefaultWarehouse();
      if (!defaultWarehouse) {
        return {
          success: false,
          message: "기본 창고를 찾을 수 없습니다. 창고를 먼저 등록해주세요.",
          totalRows: 0,
          successCount: 0,
          errorCount: 1,
          errors: [{ row: 0, message: "기본 창고 없음" }],
        };
      }

      result = await importOutboundData({
        organizationId: user.organizationId,
        userId: user.id,
        buffer,
        sheetName: input.sheetName,
        sourceWarehouseId: defaultWarehouse.id,
      });
    } else if (input.type === "sales") {
      result = await importSalesData({
        organizationId: user.organizationId,
        buffer,
        sheetName: input.sheetName,
        duplicateHandling: input.duplicateHandling,
        deductInventory: true,
      });
    } else if (input.type === "suppliers") {
      result = await importSupplierData({
        organizationId: user.organizationId,
        buffer,
        sheetName: input.sheetName,
        duplicateHandling: input.duplicateHandling,
      });
    } else {
      result = await importProductData({
        organizationId: user.organizationId,
        buffer,
        sheetName: input.sheetName,
        duplicateHandling: input.duplicateHandling,
      });
    }

    const typeLabels: Record<ImportType, string> = { sales: "판매 데이터", products: "제품 데이터", suppliers: "공급자 데이터", outbound: "출고 데이터", transfer: "재고이동" };
    const typeLabel = typeLabels[input.type];

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
        ? input.type === "outbound"
          ? `출고 요청 ${result.successCount}건 생성 완료 (창고 확정 대기)`
          : input.type === "transfer"
            ? `재고이동 ${result.successCount}건 처리 완료`
            : `${typeLabel} ${result.successCount}건 임포트 완료`
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

  if (type === "transfer") {
    buffer = await createTransferTemplate();
  } else if (type === "outbound") {
    buffer = await createOutboundTemplate();
  } else if (type === "sales") {
    buffer = await createSalesTemplate();
  } else if (type === "suppliers") {
    buffer = await createSupplierTemplate();
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
