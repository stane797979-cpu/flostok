import ExcelJS from "exceljs";
import { type Supplier } from "@/server/db/schema";

const COLUMNS = [
  { key: "name",           header: "공급업체명*",    width: 24 },
  { key: "code",           header: "공급업체코드",    width: 16 },
  { key: "businessNumber", header: "사업자번호",      width: 18 },
  { key: "contactName",    header: "담당자명",        width: 14 },
  { key: "contactPhone",   header: "연락처",          width: 18 },
  { key: "contactEmail",   header: "이메일",          width: 28 },
  { key: "address",        header: "주소",            width: 36 },
  { key: "paymentTerms",   header: "결제조건",        width: 22 },
  { key: "minOrderAmount", header: "최소발주금액(원)", width: 18 },
  { key: "avgLeadTime",    header: "평균리드타임(일)", width: 18 },
  { key: "minLeadTime",    header: "최소리드타임(일)", width: 18 },
  { key: "maxLeadTime",    header: "최대리드타임(일)", width: 18 },
  { key: "rating",         header: "평점(0-100)",     width: 14 },
  { key: "notes",          header: "비고",            width: 32 },
] as const;

function applyHeaderRow(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1);
  COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1E3A5F" } },
      bottom: { style: "thin", color: { argb: "FF1E3A5F" } },
      left: { style: "thin", color: { argb: "FF1E3A5F" } },
      right: { style: "thin", color: { argb: "FF1E3A5F" } },
    };
    ws.getColumn(i + 1).width = col.width;
  });
  headerRow.height = 22;
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
}

function applyDataRow(row: ExcelJS.Row, rowIndex: number) {
  const isEven = rowIndex % 2 === 0;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" },
    };
    cell.border = {
      top: { style: "hair", color: { argb: "FFE2E8F0" } },
      bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      left: { style: "hair", color: { argb: "FFE2E8F0" } },
      right: { style: "hair", color: { argb: "FFE2E8F0" } },
    };
    cell.font = { size: 10 };
    cell.alignment = { vertical: "middle", wrapText: false };
  });
  row.height = 18;
}

/** 현재 공급업체 데이터 엑셀 다운로드 */
export async function generateSupplierExcel(supplierList: Supplier[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Flostok";
  wb.created = new Date();

  const ws = wb.addWorksheet("공급업체 목록");
  applyHeaderRow(ws);

  supplierList.forEach((s, i) => {
    const row = ws.addRow([
      s.name,
      s.code ?? "",
      s.businessNumber ?? "",
      s.contactName ?? "",
      s.contactPhone ?? "",
      s.contactEmail ?? "",
      s.address ?? "",
      s.paymentTerms ?? "",
      s.minOrderAmount ?? 0,
      s.avgLeadTime ?? 7,
      s.minLeadTime ?? 3,
      s.maxLeadTime ?? 14,
      s.rating ? Number(s.rating) : 0,
      s.notes ?? "",
    ]);
    applyDataRow(row, i + 1);
    // 숫자 컬럼 포맷
    row.getCell(9).numFmt  = "#,##0";
    row.getCell(10).numFmt = "0";
    row.getCell(11).numFmt = "0";
    row.getCell(12).numFmt = "0";
    row.getCell(13).numFmt = "0.0";
  });

  // 안내 시트
  addGuideSheet(wb);

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}

/** 빈 업로드용 템플릿 엑셀 */
export async function generateSupplierTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Flostok";
  wb.created = new Date();

  const ws = wb.addWorksheet("공급업체 등록");
  applyHeaderRow(ws);

  // 샘플 행 3개
  const samples = [
    ["(주)샘플전자", "SUP-001", "123-45-67890", "김담당", "010-1234-5678", "sample@example.com", "서울시 강남구", "월말마감 익월말", 100000, 7, 3, 14, 80, "주력 공급처"],
    ["글로벌무역", "SUP-002", "234-56-78901", "이무역", "02-1234-5678", "", "경기도 성남시", "선불", 0, 14, 10, 21, 60, ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];
  samples.forEach((data, i) => {
    const row = ws.addRow(data);
    applyDataRow(row, i + 1);
    if (i < 2) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { ...cell.font, color: { argb: "FF94A3B8" }, italic: true };
      });
    }
    row.getCell(9).numFmt  = "#,##0";
    row.getCell(10).numFmt = "0";
    row.getCell(11).numFmt = "0";
    row.getCell(12).numFmt = "0";
    row.getCell(13).numFmt = "0.0";
  });

  addGuideSheet(wb);

  return wb.xlsx.writeBuffer() as Promise<Buffer>;
}

function addGuideSheet(wb: ExcelJS.Workbook) {
  const guide = wb.addWorksheet("작성 가이드");
  guide.getColumn(1).width = 22;
  guide.getColumn(2).width = 60;

  const titleRow = guide.addRow(["항목", "설명"]);
  titleRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } } as ExcelJS.FillPattern;
  titleRow.height = 20;

  const rows: [string, string][] = [
    ["공급업체명*", "필수 항목. 중복 시 기존 데이터에 업데이트됩니다."],
    ["공급업체코드", "고유 식별 코드 (선택). 없으면 자동 생성하지 않습니다."],
    ["사업자번호", "XXX-XX-XXXXX 형식 권장 (선택)"],
    ["담당자명", "거래 담당자 이름 (선택)"],
    ["연락처", "전화번호 (선택)"],
    ["이메일", "이메일 형식 맞춰 입력 (선택)"],
    ["주소", "전체 주소 (선택)"],
    ["결제조건", "예: 월말마감 익월말, 선불, 30일 등 (선택)"],
    ["최소발주금액(원)", "숫자만 입력. 없으면 0 (선택)"],
    ["평균리드타임(일)", "정수 입력. 기본값 7 (선택)"],
    ["최소리드타임(일)", "정수 입력. 기본값 3 (선택)"],
    ["최대리드타임(일)", "정수 입력. 기본값 14 (선택)"],
    ["평점(0-100)", "0~100 숫자. 기본값 0 (선택)"],
    ["비고", "자유 메모 (선택)"],
    ["", ""],
    ["업로드 규칙", "* 표시 항목은 필수입니다."],
    ["", "* 동일한 공급업체명이 있으면 해당 행은 건너뜁니다."],
    ["", "* 1행(헤더)은 수정하지 마세요."],
    ["", "* 샘플 데이터(회색 행)는 업로드 전 삭제하거나 덮어쓰세요."],
  ];

  rows.forEach((r, i) => {
    const row = guide.addRow(r);
    row.font = { size: 10 };
    row.height = 16;
    if (r[0] === "업로드 규칙") {
      row.font = { size: 10, bold: true };
    }
    if (i % 2 === 0 && r[0]) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } } as ExcelJS.FillPattern;
    }
  });
}

/** 엑셀 행 → SupplierInput 파싱 */
export function parseSupplierRow(row: ExcelJS.Row): {
  name: string;
  code?: string;
  businessNumber?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  paymentTerms?: string;
  minOrderAmount: number;
  avgLeadTime: number;
  minLeadTime: number;
  maxLeadTime: number;
  rating: number;
  notes?: string;
} | null {
  const get = (col: number) => {
    const v = row.getCell(col).value;
    if (v === null || v === undefined) return "";
    return String(v).trim();
  };
  const getNum = (col: number, def: number) => {
    const v = row.getCell(col).value;
    const n = Number(v);
    return isNaN(n) ? def : n;
  };

  const name = get(1);
  if (!name) return null;

  return {
    name,
    code: get(2) || undefined,
    businessNumber: get(3) || undefined,
    contactName: get(4) || undefined,
    contactPhone: get(5) || undefined,
    contactEmail: get(6) || undefined,
    address: get(7) || undefined,
    paymentTerms: get(8) || undefined,
    minOrderAmount: getNum(9, 0),
    avgLeadTime: getNum(10, 7),
    minLeadTime: getNum(11, 3),
    maxLeadTime: getNum(12, 14),
    rating: Math.min(100, Math.max(0, getNum(13, 0))),
    notes: get(14) || undefined,
  };
}
