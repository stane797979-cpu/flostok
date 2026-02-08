"use server";

/**
 * 기타 입고 Excel 임포트/템플릿 Server Actions
 */

import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import {
  importOtherInboundData,
  createOtherInboundTemplate,
  type OtherInboundImportResult,
} from "@/server/services/excel/other-inbound-import";

/**
 * 기타 입고 Excel 양식 다운로드
 */
export async function getOtherInboundTemplate(): Promise<{
  success: boolean;
  data?: string;
  error?: string;
}> {
  try {
    const buffer = createOtherInboundTemplate();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { success: true, data: btoa(binary) };
  } catch (error) {
    console.error("기타입고 양식 생성 오류:", error);
    return { success: false, error: "양식 생성에 실패했습니다" };
  }
}

/**
 * 기타 입고 Excel 파일 임포트
 */
export async function importOtherInboundExcel(input: {
  fileBase64: string;
  fileName: string;
}): Promise<OtherInboundImportResult> {
  try {
    const user = await requireAuth();

    // Base64 -> ArrayBuffer
    const base64Data = input.fileBase64.split(",")[1] || input.fileBase64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const result = await importOtherInboundData({
      organizationId: user.organizationId,
      buffer: bytes.buffer,
    });

    if (result.successCount > 0) {
      logActivity({
        user,
        action: "IMPORT",
        entityType: "inbound_record",
        description: `기타입고 Excel 임포트 (${result.successCount}/${result.totalRows}건 성공)`,
      });
    }

    return result;
  } catch (error) {
    console.error("기타입고 Excel 임포트 오류:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Excel 처리 중 오류가 발생했습니다",
      totalRows: 0,
      successCount: 0,
      errorCount: 1,
      errors: [{ row: 0, message: error instanceof Error ? error.message : "알 수 없는 오류" }],
    };
  }
}
