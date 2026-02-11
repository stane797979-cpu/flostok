/**
 * 매핑 실행기
 *
 * MappingEntry 설정에 따라 원본 Excel 데이터를
 * FlowStok 구조로 변환하고 검증합니다.
 */

import {
  parseExcelBuffer,
  sheetToJson,
  parseExcelDate,
  formatDateToString,
  parseNumber,
} from "@/server/services/excel/parser";
import type { ExcelImportError } from "@/server/services/excel/types";
import type { MappingEntry, OnboardingDataType } from "@/types/onboarding";
import { FIELD_DEFINITIONS } from "./field-definitions";

/** 변환 결과 */
export interface TransformResult {
  /** 변환된 데이터 행 */
  rows: Record<string, unknown>[];
  /** 행별 에러 */
  errors: ExcelImportError[];
  /** 전체 행 수 */
  totalRows: number;
  /** 성공 행 수 */
  successCount: number;
  /** 에러 행 수 */
  errorCount: number;
}

/**
 * Base64 → ArrayBuffer 변환
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 단일 행을 매핑 설정에 따라 변환
 */
async function transformRow(
  row: Record<string, unknown>,
  mappings: MappingEntry[],
  dataType: OnboardingDataType,
  rowIndex: number
): Promise<{ data: Record<string, unknown> | null; errors: ExcelImportError[] }> {
  const errors: ExcelImportError[] = [];
  const result: Record<string, unknown> = {};
  const rowNum = rowIndex + 2; // 헤더(1행) + 0-인덱스

  const fields = FIELD_DEFINITIONS[dataType];
  const fieldMap = new Map(fields.map((f) => [f.dbField, f]));

  for (const mapping of mappings) {
    if (!mapping.dbField) continue; // 미매핑 컬럼 건너뛰기

    let value = row[mapping.excelColumn];
    const field = fieldMap.get(mapping.dbField);

    // 값이 없으면 기본값 사용
    if (value === undefined || value === null || value === "") {
      if (mapping.required) {
        errors.push({
          row: rowNum,
          column: mapping.excelColumn,
          value,
          message: `필수 필드가 비어있습니다: ${field?.label || mapping.dbField}`,
        });
        continue;
      }
      value = mapping.defaultValue ?? field?.defaultValue;
    }

    // 타입별 변환
    if (field && value !== undefined && value !== null) {
      switch (field.type) {
        case "number": {
          const num = parseNumber(value);
          if (num === null && value !== undefined && value !== null && value !== "") {
            errors.push({
              row: rowNum,
              column: mapping.excelColumn,
              value,
              message: `숫자 변환 실패: ${field.label}`,
            });
            continue;
          }
          value = num;
          break;
        }
        case "date": {
          const date = await parseExcelDate(value);
          if (!date) {
            errors.push({
              row: rowNum,
              column: mapping.excelColumn,
              value,
              message: `날짜 변환 실패: ${field.label}`,
            });
            continue;
          }
          value = formatDateToString(date);
          break;
        }
        case "text": {
          value = String(value).trim();
          break;
        }
      }
    }

    result[mapping.dbField] = value;
  }

  // 에러가 없으면 데이터 반환
  const hasBlockingError = errors.some((e) =>
    mappings.find(
      (m) => m.excelColumn === e.column && m.required
    )
  );

  return {
    data: hasBlockingError ? null : result,
    errors,
  };
}

/**
 * 매핑 설정에 따라 Excel 데이터를 FlowStok 구조로 변환
 *
 * @param fileBase64 - Base64 인코딩된 파일
 * @param sheetName - 시트명
 * @param mappings - 컬럼 매핑 설정
 * @param dataType - 데이터 유형
 * @param previewOnly - 미리보기 모드 (처음 N행만)
 * @param previewRows - 미리보기 행 수 (기본 20)
 */
export async function executeMapping(
  fileBase64: string,
  sheetName: string | undefined,
  mappings: MappingEntry[],
  dataType: OnboardingDataType,
  previewOnly = false,
  previewRows = 20
): Promise<TransformResult> {
  const buffer = base64ToArrayBuffer(fileBase64);
  const workbook = await parseExcelBuffer(buffer);
  const allRows = await sheetToJson<Record<string, unknown>>(workbook, sheetName);

  const rowsToProcess = previewOnly
    ? allRows.slice(0, previewRows)
    : allRows;

  const activeMappings = mappings.filter((m) => m.dbField);
  const transformedRows: Record<string, unknown>[] = [];
  const allErrors: ExcelImportError[] = [];

  for (let i = 0; i < rowsToProcess.length; i++) {
    const { data, errors } = await transformRow(
      rowsToProcess[i],
      activeMappings,
      dataType,
      i
    );
    allErrors.push(...errors);
    if (data) {
      transformedRows.push(data);
    }
  }

  return {
    rows: transformedRows,
    errors: allErrors,
    totalRows: previewOnly ? allRows.length : rowsToProcess.length,
    successCount: transformedRows.length,
    errorCount: rowsToProcess.length - transformedRows.length,
  };
}
