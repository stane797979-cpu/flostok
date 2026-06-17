/**
 * 꿈비 거래처 FloStok 업로드용 엑셀 생성
 * 컬럼 순서: supplier-excel.ts COLUMNS 기준 12개
 *   1  거래처명*
 *   2  거래처코드
 *   3  대표자
 *   4  사업자번호
 *   5  주소
 *   6  전화번호
 *   7  이메일
 *   8  팩스
 *   9  결제조건
 *  10  기본리드타임(일)
 *  11  분류
 *  12  메모
 */

const ExcelJS = require("exceljs");
const path = require("path");

const OUT = path.resolve(__dirname, "../data-kkumvi/02_거래처마스터_업로드용.xlsx");

const SUPPLIERS = [
  {
    name: "꿈비산업",
    code: "SUP-KV-001",
    representative: "이정훈",
    businessNumber: "123-45-67890",
    address: "경기도 화성시 팔탄면 산단로 123",
    contactPhone: "031-123-4567",
    contactEmail: "order@kkumbi-ind.com",
    fax: "031-123-4568",
    paymentTerms: "월 2회 정산 (15일/말일)",
    avgLeadTime: 7,
    category: "완제품",
    notes: "담당SKU:KV-CAR-001 / 카시트 전담 공급사 / 담당자:김동현",
  },
  {
    name: "베이비로드",
    code: "SUP-KV-002",
    representative: "조현우",
    businessNumber: "234-56-78901",
    address: "인천시 남동구 논현동 산업로 45",
    contactPhone: "032-234-5678",
    contactEmail: "purchase@babyroad.co.kr",
    fax: "032-234-5679",
    paymentTerms: "익월 말일 일괄",
    avgLeadTime: 10,
    category: "완제품",
    notes: "담당SKU:KV-STR-002 / 유모차·웨건 전문 공급사 / 담당자:이수정",
  },
  {
    name: "아이편한세상",
    code: "SUP-KV-003",
    representative: "강민준",
    businessNumber: "345-67-89012",
    address: "경기도 부천시 오정구 소사로 78",
    contactPhone: "032-345-6789",
    contactEmail: "info@aicomfy.com",
    fax: "032-345-6790",
    paymentTerms: "납품 후 30일",
    avgLeadTime: 5,
    category: "완제품",
    notes: "담당SKU:KV-BNC-003 / 바운서·스윙 제조사 / 담당자:박준혁",
  },
  {
    name: "스위트베이비",
    code: "SUP-KV-004",
    representative: "윤채린",
    businessNumber: "456-78-90123",
    address: "경기도 광주시 초월읍 용수리 90",
    contactPhone: "031-456-7890",
    contactEmail: "supply@sweetbaby.kr",
    fax: "031-456-7891",
    paymentTerms: "월 1회 정산 (말일)",
    avgLeadTime: 14,
    category: "완제품",
    notes: "담당SKU:KV-BED-004 / 아기침대·범퍼침대 전문 / 담당자:최은지",
  },
  {
    name: "클린맘",
    code: "SUP-KV-005",
    representative: "서태양",
    businessNumber: "567-89-01234",
    address: "서울시 금천구 가산동 디지털로9길 41",
    contactPhone: "02-567-8901",
    contactEmail: "biz@cleanmom.co.kr",
    fax: "02-567-8902",
    paymentTerms: "납품 후 45일",
    avgLeadTime: 7,
    category: "소모품/전자",
    notes: "담당SKU:KV-STR-005 / 젖병소독기·살균 전담 / 담당자:한미영",
  },
];

const COLUMNS = [
  { key: "name",           header: "거래처명*",       width: 24 },
  { key: "code",           header: "거래처코드",       width: 16 },
  { key: "representative", header: "대표자",           width: 14 },
  { key: "businessNumber", header: "사업자번호",       width: 18 },
  { key: "address",        header: "주소",             width: 36 },
  { key: "contactPhone",   header: "전화번호",         width: 18 },
  { key: "contactEmail",   header: "이메일",           width: 28 },
  { key: "fax",            header: "팩스",             width: 16 },
  { key: "paymentTerms",   header: "결제조건",         width: 22 },
  { key: "avgLeadTime",    header: "기본리드타임(일)", width: 18 },
  { key: "category",       header: "분류",             width: 14 },
  { key: "notes",          header: "메모",             width: 36 },
];

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Flostok";
  wb.created = new Date();

  const ws = wb.addWorksheet("거래처 등록");

  // 헤더 행
  const headerRow = ws.addRow(COLUMNS.map((c) => c.header));
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top:    { style: "thin", color: { argb: "FF1E3A5F" } },
      bottom: { style: "thin", color: { argb: "FF1E3A5F" } },
      left:   { style: "thin", color: { argb: "FF1E3A5F" } },
      right:  { style: "thin", color: { argb: "FF1E3A5F" } },
    };
  });
  COLUMNS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  // 데이터 행
  SUPPLIERS.forEach((s, idx) => {
    const row = ws.addRow([
      s.name,
      s.code,
      s.representative,
      s.businessNumber,
      s.address,
      s.contactPhone,
      s.contactEmail,
      s.fax,
      s.paymentTerms,
      s.avgLeadTime,
      s.category,
      s.notes,
    ]);
    row.height = 18;
    const isEven = (idx + 1) % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" } };
      cell.border = {
        top:    { style: "hair", color: { argb: "FFE2E8F0" } },
        bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        left:   { style: "hair", color: { argb: "FFE2E8F0" } },
        right:  { style: "hair", color: { argb: "FFE2E8F0" } },
      };
      cell.font = { size: 10 };
      cell.alignment = { vertical: "middle" };
    });
    row.getCell(10).numFmt = "0";
  });

  // 안내 시트
  const guide = wb.addWorksheet("작성 가이드");
  guide.getColumn(1).width = 22;
  guide.getColumn(2).width = 60;

  const titleRow = guide.addRow(["항목", "설명"]);
  titleRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  titleRow.height = 20;

  const guideRows = [
    ["거래처명*",       "필수. 동일명 존재 시 건너뜀"],
    ["거래처코드",      "고유 식별 코드 (선택)"],
    ["대표자",          "대표자 이름 (선택)"],
    ["사업자번호",      "XXX-XX-XXXXX 형식 (선택)"],
    ["주소",            "전체 주소 (선택)"],
    ["전화번호",        "전화번호 (선택)"],
    ["이메일",          "이메일 형식 (선택)"],
    ["팩스",            "팩스번호 (선택)"],
    ["결제조건",        "예: 월말마감 익월말, 납품 후 30일 (선택)"],
    ["기본리드타임(일)","정수. 기본값 7 (선택)"],
    ["분류",            "예: 완제품, 소모품, 원자재 (선택)"],
    ["메모",            "자유 메모 (선택)"],
    ["", ""],
    ["업로드 규칙",     "1행(헤더)은 수정하지 마세요"],
    ["",                "거래처명이 동일하면 건너뜁니다"],
    ["",                "* 표시 항목만 필수입니다"],
  ];
  guideRows.forEach((r) => {
    const row = guide.addRow(r);
    row.font = { size: 10 };
    row.height = 16;
    if (r[0] === "업로드 규칙") row.font = { size: 10, bold: true };
  });

  await wb.xlsx.writeFile(OUT);
  console.log("생성 완료:", OUT);
  console.log("거래처 5개 입력됨:");
  SUPPLIERS.forEach((s) => console.log(` - ${s.code} ${s.name} | LT:${s.avgLeadTime}일 | 분류:${s.category}`));
}

main().catch(console.error);
