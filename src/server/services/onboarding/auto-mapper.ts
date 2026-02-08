/**
 * 자동 컬럼 매핑 알고리즘
 *
 * 원본 Excel 헤더와 FlowStok 필드 정의를 비교하여
 * 최적의 매핑을 자동으로 생성합니다.
 */

import type {
  OnboardingDataType,
  FlowStokField,
  MappingEntry,
  AnalyzedHeader,
} from "@/types/onboarding";
import { FIELD_DEFINITIONS } from "./field-definitions";

interface MatchCandidate {
  dbField: string;
  confidence: number;
  required: boolean;
  defaultValue?: unknown;
}

/**
 * 두 문자열 간의 매칭 confidence를 계산
 */
function calculateConfidence(
  header: string,
  field: FlowStokField
): number {
  const headerLower = header.toLowerCase().trim();

  for (const alias of field.aliases) {
    // 1. 정확 일치 (100)
    if (header === alias) return 100;

    // 2. 대소문자 무시 일치 (95)
    if (headerLower === alias.toLowerCase()) return 95;
  }

  for (const alias of field.aliases) {
    const aliasLower = alias.toLowerCase();

    // 3. 포함 매칭 (80)
    // 원본 헤더에 alias가 포함되거나, alias에 원본 헤더가 포함
    if (headerLower.includes(aliasLower) && aliasLower.length >= 2) return 80;
    if (aliasLower.includes(headerLower) && headerLower.length >= 2) return 75;
  }

  // 4. 공백/특수문자 제거 후 비교 (70)
  const headerClean = headerLower.replace(/[\s_\-().]/g, "");
  for (const alias of field.aliases) {
    const aliasClean = alias.toLowerCase().replace(/[\s_\-().]/g, "");
    if (headerClean === aliasClean) return 70;
  }

  return 0;
}

/**
 * 데이터 타입 기반 추론 (confidence 50~60)
 */
function inferByDataType(
  header: AnalyzedHeader,
  field: FlowStokField
): number {
  if (field.type === "date" && header.inferredType === "date") return 55;
  if (field.type === "number" && header.inferredType === "number") return 40;
  return 0;
}

/**
 * 자동 매핑 생성
 *
 * @param headers - 분석된 헤더 목록
 * @param dataType - 데이터 유형
 * @returns 매핑 항목 배열
 */
export function autoMap(
  headers: AnalyzedHeader[],
  dataType: OnboardingDataType
): MappingEntry[] {
  const fields = FIELD_DEFINITIONS[dataType];
  if (!fields) return [];

  // 각 헤더에 대해 가장 적합한 필드 후보를 찾음
  const headerCandidates = new Map<string, MatchCandidate[]>();

  for (const header of headers) {
    const candidates: MatchCandidate[] = [];

    for (const field of fields) {
      const aliasConfidence = calculateConfidence(header.name, field);
      const typeConfidence = inferByDataType(header, field);
      const confidence = Math.max(aliasConfidence, typeConfidence);

      if (confidence > 0) {
        candidates.push({
          dbField: field.dbField,
          confidence,
          required: field.required,
          defaultValue: field.defaultValue,
        });
      }
    }

    // confidence 내림차순 정렬
    candidates.sort((a, b) => b.confidence - a.confidence);
    headerCandidates.set(header.name, candidates);
  }

  // 탐욕 알고리즘: confidence가 높은 매핑부터 확정
  const assignedFields = new Set<string>();
  const result: MappingEntry[] = [];

  // 모든 (헤더, 후보) 쌍을 confidence 순으로 정렬
  const allPairs: Array<{
    headerName: string;
    candidate: MatchCandidate;
  }> = [];

  for (const [headerName, candidates] of headerCandidates) {
    for (const candidate of candidates) {
      allPairs.push({ headerName, candidate });
    }
  }

  allPairs.sort((a, b) => b.candidate.confidence - a.candidate.confidence);

  const assignedHeaders = new Set<string>();

  for (const { headerName, candidate } of allPairs) {
    if (assignedHeaders.has(headerName)) continue;
    if (assignedFields.has(candidate.dbField)) continue;

    if (candidate.confidence >= 60) {
      assignedHeaders.add(headerName);
      assignedFields.add(candidate.dbField);

      result.push({
        excelColumn: headerName,
        dbField: candidate.dbField,
        confidence: candidate.confidence,
        isAutoMapped: true,
        required: candidate.required,
        defaultValue: candidate.defaultValue,
      });
    }
  }

  // 매핑되지 않은 헤더를 빈 매핑으로 추가
  for (const header of headers) {
    if (!assignedHeaders.has(header.name)) {
      result.push({
        excelColumn: header.name,
        dbField: "",
        confidence: 0,
        isAutoMapped: false,
        required: false,
      });
    }
  }

  return result;
}

/**
 * 매핑 검증: 필수 필드가 모두 매핑되었는지 확인
 */
export function validateMappings(
  mappings: MappingEntry[],
  dataType: OnboardingDataType
): { valid: boolean; missingFields: FlowStokField[] } {
  const fields = FIELD_DEFINITIONS[dataType];
  const mappedDbFields = new Set(
    mappings.filter((m) => m.dbField).map((m) => m.dbField)
  );

  const missingFields = fields.filter(
    (f) => f.required && !mappedDbFields.has(f.dbField)
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
