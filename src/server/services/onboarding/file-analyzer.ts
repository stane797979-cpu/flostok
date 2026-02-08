/**
 * Excel 파일 분석 서비스
 *
 * 업로드된 xlsx 파일의 구조를 분석하여
 * 시트 목록, 헤더, 데이터 타입, 샘플 데이터를 추출합니다.
 */

import {
  parseExcelBuffer,
  getSheetNames,
  getHeaders,
  sheetToJson,
  parseExcelDate,
} from "@/server/services/excel/parser";
import type { AnalyzedHeader } from "@/types/onboarding";

/** 파일 분석 결과 */
export interface FileAnalysisResult {
  sheetNames: string[];
  selectedSheet: string;
  headers: AnalyzedHeader[];
  sampleData: Record<string, unknown>[];
  rowCount: number;
}

/**
 * 값의 데이터 타입을 추론
 */
function inferType(
  values: unknown[]
): "text" | "number" | "date" | "unknown" {
  const nonNull = values.filter(
    (v) => v !== null && v !== undefined && v !== ""
  );
  if (nonNull.length === 0) return "unknown";

  let dateCount = 0;
  let numberCount = 0;

  for (const val of nonNull) {
    // Date 객체
    if (val instanceof Date) {
      dateCount++;
      continue;
    }

    const str = String(val).trim();

    // 날짜 패턴 (YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY 등)
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(str) || /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
      dateCount++;
      continue;
    }

    // Excel 시리얼 날짜 (30000~50000 범위)
    if (typeof val === "number" && val > 25000 && val < 60000) {
      const parsed = parseExcelDate(val);
      if (parsed) {
        dateCount++;
        continue;
      }
    }

    // 숫자 (쉼표 포함)
    const cleaned = str.replace(/,/g, "");
    if (cleaned !== "" && !isNaN(Number(cleaned))) {
      numberCount++;
      continue;
    }
  }

  const total = nonNull.length;
  // 80% 이상이 해당 타입이면 그 타입으로 추론
  if (dateCount / total >= 0.8) return "date";
  if (numberCount / total >= 0.8) return "number";
  return "text";
}

/**
 * Base64 문자열을 ArrayBuffer로 변환
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Node.js 환경
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(base64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  // 브라우저 환경
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Excel 파일을 분석하여 구조 정보를 반환
 *
 * @param fileBase64 - Base64 인코딩된 파일
 * @param sheetName - 분석할 시트명 (미지정 시 첫 번째 시트)
 * @param sampleRows - 샘플 데이터 행 수 (기본 5)
 */
export function analyzeExcelFile(
  fileBase64: string,
  sheetName?: string,
  sampleRows = 5
): FileAnalysisResult {
  const buffer = base64ToArrayBuffer(fileBase64);
  const workbook = parseExcelBuffer(buffer);
  const sheetNames = getSheetNames(workbook);

  if (sheetNames.length === 0) {
    throw new Error("파일에 시트가 없습니다");
  }

  const selectedSheet = sheetName || sheetNames[0];
  const headerNames = getHeaders(workbook, selectedSheet);

  if (headerNames.length === 0) {
    throw new Error("선택된 시트에 헤더가 없습니다");
  }

  // 전체 데이터
  const allRows = sheetToJson<Record<string, unknown>>(workbook, selectedSheet);
  const rowCount = allRows.length;

  // 샘플 데이터 (분석용으로 최대 100행 읽기)
  const analyzeRows = allRows.slice(0, Math.min(100, allRows.length));
  const sampleData = allRows.slice(0, sampleRows);

  // 각 헤더별 분석
  const headers: AnalyzedHeader[] = headerNames.map((name) => {
    const columnValues = analyzeRows.map((row) => row[name]);
    const nonNullValues = columnValues.filter(
      (v) => v !== null && v !== undefined && v !== ""
    );
    const uniqueValues = new Set(
      nonNullValues.map((v) => String(v))
    );

    return {
      name,
      sampleValues: columnValues.slice(0, sampleRows),
      inferredType: inferType(columnValues),
      nullCount: columnValues.length - nonNullValues.length,
      uniqueCount: uniqueValues.size,
    };
  });

  return {
    sheetNames,
    selectedSheet,
    headers,
    sampleData,
    rowCount,
  };
}
