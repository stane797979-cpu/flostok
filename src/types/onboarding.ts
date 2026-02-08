/** 온보딩 데이터 유형 */
export type OnboardingDataType =
  | "products"
  | "sales"
  | "inventory"
  | "suppliers"
  | "inbound";

/** 컨설팅 대상 회사 정보 */
export interface CompanyInfo {
  /** 업종 */
  industry: string;
  /** 직원 규모 */
  employeeCount: string;
  /** 관리 SKU 수 */
  skuCount: string;
  /** 현재 재고관리 방식 */
  currentSystem: string;
  /** 추가 메모 */
  notes?: string;
}

/** 헤더 분석 결과 */
export interface AnalyzedHeader {
  /** 원본 컬럼명 */
  name: string;
  /** 샘플 값 (처음 5개) */
  sampleValues: unknown[];
  /** 추론된 데이터 타입 */
  inferredType: "text" | "number" | "date" | "unknown";
  /** 비어있는 셀 수 */
  nullCount: number;
  /** 고유값 수 */
  uniqueCount: number;
}

/** FlowStok 대상 필드 정의 */
export interface FlowStokField {
  /** DB 컬럼명 */
  dbField: string;
  /** 한국어 표시명 */
  label: string;
  /** 설명 */
  description: string;
  /** 필수 여부 */
  required: boolean;
  /** 데이터 타입 */
  type: "text" | "number" | "date" | "enum";
  /** enum인 경우 허용 값 */
  enumValues?: string[];
  /** 자동 매핑용 별칭 */
  aliases: string[];
  /** 기본값 */
  defaultValue?: unknown;
}

/** 매핑 항목 */
export interface MappingEntry {
  /** 원본 Excel 컬럼명 */
  excelColumn: string;
  /** FlowStok DB 필드명 (빈 문자열이면 미매핑) */
  dbField: string;
  /** 자동 매핑 신뢰도 (0~100) */
  confidence: number;
  /** 자동 매핑 여부 */
  isAutoMapped: boolean;
  /** 필수 필드 여부 */
  required: boolean;
  /** 기본값 */
  defaultValue?: unknown;
}

/** 업로드된 파일 클라이언트 상태 */
export interface UploadedFileInfo {
  /** DB ID (저장 후) */
  id?: string;
  /** 클라이언트 File 객체 */
  file?: File;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** 데이터 유형 */
  dataType: OnboardingDataType;
  /** 선택된 시트명 */
  selectedSheet?: string;
  /** 시트 이름 목록 */
  sheetNames?: string[];
  /** 헤더 분석 결과 */
  analyzedHeaders?: AnalyzedHeader[];
  /** 데이터 행 수 */
  rowCount?: number;
  /** 상태 */
  status: "uploaded" | "analyzed" | "mapped" | "imported" | "error";
}

/** 위자드 전체 상태 */
export interface WizardState {
  currentStep: number;
  sessionId?: string;
  companyInfo: CompanyInfo;
  files: UploadedFileInfo[];
  /** fileId → MappingEntry[] */
  mappings: Record<string, MappingEntry[]>;
}

/** 임포트 결과 요약 (파일 단위) */
export interface FileImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    column?: string;
    value?: unknown;
    message: string;
  }>;
}

/** 세션 전체 임포트 결과 요약 */
export interface SessionImportSummary {
  [dataType: string]: FileImportResult;
}

// ── Select 옵션 상수 ──

export const INDUSTRY_OPTIONS = [
  { value: "manufacturing", label: "제조업" },
  { value: "distribution", label: "유통/도매" },
  { value: "retail", label: "소매/리테일" },
  { value: "food", label: "식품/음료" },
  { value: "cosmetics", label: "화장품/뷰티" },
  { value: "electronics", label: "전자/IT" },
  { value: "fashion", label: "패션/의류" },
  { value: "medical", label: "의료/제약" },
  { value: "other", label: "기타" },
] as const;

export const EMPLOYEE_COUNT_OPTIONS = [
  { value: "1-10", label: "1~10명" },
  { value: "11-50", label: "11~50명" },
  { value: "51-200", label: "51~200명" },
  { value: "201-500", label: "201~500명" },
  { value: "500+", label: "500명 이상" },
] as const;

export const SKU_COUNT_OPTIONS = [
  { value: "1-100", label: "100개 이하" },
  { value: "100-500", label: "100~500개" },
  { value: "500-2000", label: "500~2,000개" },
  { value: "2000-10000", label: "2,000~10,000개" },
  { value: "10000+", label: "10,000개 이상" },
] as const;

export const CURRENT_SYSTEM_OPTIONS = [
  { value: "excel", label: "엑셀/스프레드시트" },
  { value: "erp", label: "ERP 시스템" },
  { value: "wms", label: "WMS (창고관리시스템)" },
  { value: "manual", label: "수기 관리" },
  { value: "other", label: "기타" },
] as const;

export const DATA_TYPE_LABELS: Record<OnboardingDataType, string> = {
  products: "제품 마스터",
  sales: "판매 데이터",
  inventory: "재고 현황",
  suppliers: "공급자 정보",
  inbound: "입고 기록",
};
