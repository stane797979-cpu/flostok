/**
 * Excel 파일 파싱 유틸리티
 */

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  data: Record<string, unknown>[];
  rowCount: number;
}

export interface ParsedExcelFile {
  sheets: ParsedSheet[];
  sheetNames: string[];
}

/**
 * XLSX 라이브러리 lazy 로딩
 */
let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * Excel 파일 파싱
 * @param buffer - 파일 Buffer
 * @returns 파싱된 Excel 데이터
 */
export async function parseExcelFile(buffer: Buffer): Promise<ParsedExcelFile> {
  try {
    const XLSX = await getXLSX();
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        raw: false, // 날짜/숫자를 문자열로 변환
        defval: null, // 빈 셀은 null로
      });

      // 헤더 추출 (첫 번째 행의 키)
      const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

      return {
        sheetName,
        headers,
        data: jsonData,
        rowCount: jsonData.length,
      };
    });

    return {
      sheets,
      sheetNames: workbook.SheetNames,
    };
  } catch (error) {
    throw new Error(`Excel 파일 파싱 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
  }
}

/**
 * 특정 시트 선택
 * @param parsedFile - 파싱된 Excel 파일
 * @param sheetName - 시트 이름 (없으면 첫 번째 시트)
 */
export function selectSheet(parsedFile: ParsedExcelFile, sheetName?: string): ParsedSheet {
  if (parsedFile.sheets.length === 0) {
    throw new Error("Excel 파일에 시트가 없습니다");
  }

  if (!sheetName) {
    return parsedFile.sheets[0];
  }

  const sheet = parsedFile.sheets.find((s) => s.sheetName === sheetName);
  if (!sheet) {
    throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`);
  }

  return sheet;
}

/**
 * 헤더 매핑 검증
 * @param sheet - 파싱된 시트
 * @param requiredHeaders - 필수 헤더 목록
 */
export function validateHeaders(sheet: ParsedSheet, requiredHeaders: string[]): void {
  const missingHeaders = requiredHeaders.filter((header) => !sheet.headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`필수 컬럼이 없습니다: ${missingHeaders.join(", ")}`);
  }
}

/**
 * 헤더 매핑 (유연한 컬럼명 지원)
 * @param sheet - 파싱된 시트
 * @param headerMap - 헤더 매핑 (표준명 -> 가능한 컬럼명들)
 */
export function mapHeaders(
  sheet: ParsedSheet,
  headerMap: Record<string, string[]>
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const [standardName, possibleNames] of Object.entries(headerMap)) {
    const found = possibleNames.find((name) => sheet.headers.includes(name));
    if (found) {
      mapping[standardName] = found;
    }
  }

  return mapping;
}
