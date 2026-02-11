/**
 * Excel 파일 파싱 유틸리티
 */

import type { ExcelImportError, ExcelColumnMapping } from "./types";

/**
 * XLSX 라이브러리 lazy 로딩
 */
let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * Excel 파일 버퍼를 워크북으로 파싱
 */
export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<import("xlsx").WorkBook> {
  const XLSX = await getXLSX();
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

/**
 * 시트 데이터를 JSON으로 변환
 */
export async function sheetToJson<T extends Record<string, unknown>>(
  workbook: import("xlsx").WorkBook,
  sheetName?: string
): Promise<T[]> {
  const XLSX = await getXLSX();
  const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) {
    throw new Error(`시트를 찾을 수 없습니다: ${sheetName || "첫 번째 시트"}`);
  }

  return XLSX.utils.sheet_to_json<T>(sheet, {
    raw: false,
    defval: undefined,
  });
}

/**
 * Excel 날짜를 Date 객체로 변환
 */
export async function parseExcelDate(value: unknown): Promise<Date | null> {
  if (!value) return null;

  // 이미 Date 객체인 경우
  if (value instanceof Date) {
    return value;
  }

  // 숫자인 경우 (Excel 시리얼 날짜)
  if (typeof value === "number") {
    // Excel 날짜 시리얼 -> JS Date
    // Excel은 1900-01-01을 1로 계산 (1904 시스템 제외)
    const XLSX = await getXLSX();
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
    return null;
  }

  // 문자열인 경우
  if (typeof value === "string") {
    const trimmed = value.trim();

    // YYYY-MM-DD 형식
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(trimmed);
    }

    // YYYY/MM/DD 형식
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
      return new Date(trimmed.replace(/\//g, "-"));
    }

    // DD-MM-YYYY 또는 DD/MM/YYYY 형식
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(trimmed)) {
      const parts = trimmed.split(/[-/]/);
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }

    // 일반 파싱 시도
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

/**
 * 날짜를 YYYY-MM-DD 문자열로 변환
 */
export function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 숫자 값 파싱
 */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return isNaN(value) ? null : value;
  }

  if (typeof value === "string") {
    // 쉼표 제거 및 공백 제거
    const cleaned = value.replace(/,/g, "").trim();
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * 필수 필드 검증
 */
export function validateRequired(
  row: Record<string, unknown>,
  rowIndex: number,
  mappings: ExcelColumnMapping[]
): ExcelImportError[] {
  const errors: ExcelImportError[] = [];

  for (const mapping of mappings) {
    if (mapping.required) {
      const value = row[mapping.excelColumn];
      if (value === undefined || value === null || value === "") {
        errors.push({
          row: rowIndex + 2, // +2: 헤더(1) + 0-인덱스(1)
          column: mapping.excelColumn,
          value,
          message: `필수 필드가 비어있습니다: ${mapping.excelColumn}`,
        });
      }
    }
  }

  return errors;
}

/**
 * 컬럼 매핑에 따라 데이터 변환
 */
export function transformRow<T extends Record<string, unknown>>(
  row: Record<string, unknown>,
  mappings: ExcelColumnMapping[]
): T {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    let value = row[mapping.excelColumn];

    // 값이 없으면 기본값 사용
    if (value === undefined || value === null || value === "") {
      value = mapping.defaultValue;
    }

    // 변환 함수 적용
    if (mapping.transform && value !== undefined) {
      value = mapping.transform(value);
    }

    result[mapping.dbField] = value;
  }

  return result as T;
}

/**
 * 시트 이름 목록 반환
 */
export function getSheetNames(workbook: import("xlsx").WorkBook): string[] {
  return workbook.SheetNames;
}

/**
 * 헤더 행 추출
 */
export async function getHeaders(workbook: import("xlsx").WorkBook, sheetName?: string): Promise<string[]> {
  const XLSX = await getXLSX();
  const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) return [];

  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headers: string[] = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    const cell = sheet[cellAddress];
    headers.push(cell ? String(cell.v) : `Column${col + 1}`);
  }

  return headers;
}
