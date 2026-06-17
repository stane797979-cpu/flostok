/**
 * Excel 임포트/익스포트 공통 타입
 */

export interface ExcelImportResult<T> {
  success: boolean;
  data: T[];
  errors: ExcelImportError[];
  totalRows: number;
  successCount: number;
  errorCount: number;
}

export interface ExcelImportError {
  row: number;
  column?: string;
  value?: unknown;
  message: string;
}

export interface ExcelColumnMapping {
  /** Excel 컬럼명 */
  excelColumn: string;
  /** DB 필드명 */
  dbField: string;
  /** 필수 여부 */
  required: boolean;
  /** 기본값 */
  defaultValue?: unknown;
  /** 변환 함수 */
  transform?: (value: unknown) => unknown;
  /** 유효성 검증 함수 */
  validate?: (value: unknown) => boolean | string;
}

/**
 * 판매 데이터 Excel 행
 */
export interface SalesRecordExcelRow {
  /** SKU 코드 */
  sku: string;
  /** 판매일 (YYYY-MM-DD) */
  date: string;
  /** 판매수량 */
  quantity: number;
  /** 판매단가 (선택) */
  unitPrice?: number;
  /** 판매채널 (선택) */
  channel?: string;
  /** 출고유형 (선택): 판매/폐기/이동/손망실/반품/샘플/조정 */
  outboundType?: string;
  /** 출고번호 (선택): 직접 지정 시 사용, 미입력 시 자동생성 */
  outboundNumber?: string;
  /** 비고 (선택) */
  notes?: string;
}

/**
 * 제품 데이터 Excel 행
 */
export interface ProductExcelRow {
  /** SKU 코드 */
  sku: string;
  /** 제품명 */
  name: string;
  /** 카테고리 (선택) */
  category?: string;
  /** 단위 (선택) */
  unit?: string;
  /** 판매단가 (선택) */
  unitPrice?: number;
  /** 원가 (선택) */
  costPrice?: number;
  /** 현재 재고수량 (선택) */
  currentStock?: number;
  /** 안전재고 (선택) */
  safetyStock?: number;
  /** 리드타임 (선택) */
  leadTime?: number;
  /** MOQ (선택) */
  moq?: number;
}

/**
 * 재고 데이터 Excel 행
 */
export interface InventoryExcelRow {
  /** SKU 코드 */
  sku: string;
  /** 현재고 */
  currentStock: number;
  /** 가용재고 (선택) */
  availableStock?: number;
  /** 예약재고 (선택) */
  reservedStock?: number;
}

/**
 * 공급자 데이터 Excel 행
 */
export interface SupplierExcelRow {
  /** 공급자 코드 */
  code: string;
  /** 공급자명 */
  name: string;
  /** 담당자명 (선택) */
  contactName?: string;
  /** 이메일 (선택) */
  email?: string;
  /** 전화번호 (선택) */
  phone?: string;
}
