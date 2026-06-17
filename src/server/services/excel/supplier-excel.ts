import ExcelJS from "exceljs";
import { type Supplier } from "@/server/db/schema";

const COLUMNS = [
  { key: "name",           header: "거래처명*",       width: 24 },
  { key: "code",           header: "거래처코드",       width: 16 },
  { key: "representative", header: "대표자",           width: 14 },
  { key: "businessNumber", header: "사업자번호",       width: 18 },
  { key: "contactPhone",   header: "전화번호",         width: 18 },
  { key: "contactEmail",   header: "이메일",           width: 30 },
  { key: "address",        header: "주소",             width: 40 },
  { key: "paymentTerms",   header: "결제조건",         width: 22 },
  { key: "category",       header: "분류",             width: 14 },
  { key: "avgLeadTime",    header: "리드타임(일)",     width: 14 },
  { key: "notes",          header: "메모",             width: 36 },
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
      top:    { style: "thin", color: { argb: "FF1E3A5F" } },
      bottom: { style: "thin", color: { argb: "FF1E3A5F" } },
      left:   { style: "thin", color: { argb: "FF1E3A5F" } },
      right:  { style: "thin", color: { argb: "FF1E3A5F" } },
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
      top:    { style: "hair", color: { argb: "FFE2E8F0" } },
      bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
      left:   { style: "hair", color: { argb: "FFE2E8F0" } },
      right:  { style: "hair", color: { argb: "FFE2E8F0" } },
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

  const ws = wb.addWorksheet("거래처 목록");
  applyHeaderRow(ws);

  supplierList.forEach((s, i) => {
    const row = ws.addRow([
      s.name,
      s.code ?? "",
      s.representative ?? "",
      s.businessNumber ?? "",
      s.contactPhone ?? "",
      s.contactEmail ?? "",
      s.address ?? "",
      s.paymentTerms ?? "",
      s.category ?? "",
      s.avgLeadTime ?? 7,
      s.notes ?? "",
    ]);
    applyDataRow(row, i + 1);
    row.getCell(10).numFmt = "0";
  });

  addGuideSheet(wb);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

/** 빈 업로드용 템플릿 엑셀 */
export async function generateSupplierTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Flostok";
  wb.created = new Date();

  const ws = wb.addWorksheet("거래처 등록");
  applyHeaderRow(ws);

  // 샘플 행 2개 (회색 이탤릭 — 업로드 시 자동 무시)
  const samples = [
    ["(주)샘플무역", "SUP-001", "홍길동", "123-45-67890", "02-1234-5678", "sample@example.com", "서울시 강남구 테헤란로 1", "월말마감 익월말", "완제품", 7, "주력 공급처"],
    ["글로벌소싱",   "SUP-002", "김영희", "234-56-78901", "031-234-5678", "",                   "경기도 성남시 분당구 판교로 1", "납품 후 30일", "소모품", 14, ""],
    ["", "", "", "", "", "", "", "", "", "", ""],
  ];
  samples.forEach((data, i) => {
    const row = ws.addRow(data);
    applyDataRow(row, i + 1);
    if (i < 2) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { ...cell.font, color: { argb: "FF94A3B8" }, italic: true };
      });
    }
    row.getCell(10).numFmt = "0";
  });

  addGuideSheet(wb);

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>;
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
    ["거래처명*",   "필수 항목. 동일명 존재 시 건너뜁니다."],
    ["거래처코드",  "고유 식별 코드 (선택)"],
    ["대표자",      "대표자 이름 (선택)"],
    ["사업자번호",  "XXX-XX-XXXXX 형식 권장 (선택)"],
    ["전화번호",    "전화번호 (선택)"],
    ["이메일",      "이메일 형식 (선택)"],
    ["주소",        "전체 주소 (선택)"],
    ["결제조건",    "예: 월말마감 익월말, 납품 후 30일 (선택)"],
    ["분류",        "예: 완제품, 소모품, 원자재 등 (선택)"],
    ["리드타임(일)","정수 입력. 기본값 7 (선택)"],
    ["메모",        "자유 메모 (선택)"],
    ["", ""],
    ["업로드 규칙",     "* 표시 항목만 필수입니다."],
    ["",                "동일한 거래처명이 있으면 해당 행은 건너뜁니다."],
    ["",                "1행(헤더)은 수정하지 마세요."],
    ["",                "샘플 데이터(회색 행)는 자동으로 무시됩니다."],
  ];

  rows.forEach((r, i) => {
    const row = guide.addRow(r);
    row.font = { size: 10 };
    row.height = 16;
    if (r[0] === "업로드 규칙") row.font = { size: 10, bold: true };
    if (i % 2 === 0 && r[0]) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } } as ExcelJS.FillPattern;
    }
  });
}

/** 엑셀 행 → SupplierInput 파싱 */
export function parseSupplierRow(row: ExcelJS.Row): {
  name: string;
  code?: string;
  representative?: string;
  businessNumber?: string;
  address?: string;
  contactPhone?: string;
  contactEmail?: string;
  fax?: string;
  paymentTerms?: string;
  avgLeadTime: number;
  minLeadTime: number;
  maxLeadTime: number;
  category?: string;
  notes?: string;
  minOrderAmount: number;
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

  const avgLeadTime = getNum(10, 7);

  return {
    name,
    code:           get(2)  || undefined,
    representative: get(3)  || undefined,
    businessNumber: get(4)  || undefined,
    contactPhone:   get(5)  || undefined,
    contactEmail:   get(6)  || undefined,
    address:        get(7)  || undefined,
    paymentTerms:   get(8)  || undefined,
    category:       get(9)  || undefined,
    avgLeadTime,
    minLeadTime:    Math.max(1, Math.round(avgLeadTime * 0.7)),
    maxLeadTime:    Math.round(avgLeadTime * 1.5),
    notes:          get(11) || undefined,
    minOrderAmount: 0,
  };
}
