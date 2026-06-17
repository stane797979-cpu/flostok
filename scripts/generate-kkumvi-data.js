/**
 * 꿈비 유아용품 테스트 데이터 생성 스크립트
 * 출력 파일: data-kkumvi/ 폴더
 *   01_제품마스터.xlsx
 *   02_거래처마스터.xlsx
 *   03_입고데이터_1년.xlsx   (발주 기반 입고)
 *   04_출고데이터_1년.xlsx
 */

const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

// ── 출력 폴더 ────────────────────────────────────────────────────────────────
const OUT_DIR = path.resolve(__dirname, "../data-kkumvi");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

// ── 마스터 데이터 ─────────────────────────────────────────────────────────────
const SUPPLIERS = [
  {
    code: "SUP-KV-001",
    name: "꿈비산업",
    representative: "김동현",
    businessNo: "123-45-67890",
    address: "경기도 화성시 팔탄면 산단로 123",
    phone: "031-123-4567",
    email: "order@kkumbi-ind.com",
    fax: "031-123-4568",
    paymentTerms: "월 2회 정산 (15일/말일)",
    leadTimeDays: 7,
    category: "완제품",
    memo: "꿈비 카시트 전담 공급사",
  },
  {
    code: "SUP-KV-002",
    name: "베이비로드",
    representative: "이수정",
    businessNo: "234-56-78901",
    address: "인천시 남동구 논현동 산업로 45",
    phone: "032-234-5678",
    email: "purchase@babyroad.co.kr",
    fax: "032-234-5679",
    paymentTerms: "익월 말일 일괄",
    leadTimeDays: 10,
    category: "완제품",
    memo: "유모차/웨건 전문 공급사",
  },
  {
    code: "SUP-KV-003",
    name: "아이편한세상",
    representative: "박준혁",
    businessNo: "345-67-89012",
    address: "경기도 부천시 오정구 소사로 78",
    phone: "032-345-6789",
    email: "info@aicomfy.com",
    fax: "032-345-6790",
    paymentTerms: "납품 후 30일",
    leadTimeDays: 5,
    category: "완제품",
    memo: "바운서/스윙 제조사",
  },
  {
    code: "SUP-KV-004",
    name: "스위트베이비",
    representative: "최은지",
    businessNo: "456-78-90123",
    address: "경기도 광주시 초월읍 용수리 90",
    phone: "031-456-7890",
    email: "supply@sweetbaby.kr",
    fax: "031-456-7891",
    paymentTerms: "월 1회 정산 (말일)",
    leadTimeDays: 14,
    category: "완제품",
    memo: "아기침대/범퍼침대 전문",
  },
  {
    code: "SUP-KV-005",
    name: "클린맘",
    representative: "한미영",
    businessNo: "567-89-01234",
    address: "서울시 금천구 가산동 디지털로9길 41",
    phone: "02-567-8901",
    email: "biz@cleanmom.co.kr",
    fax: "02-567-8902",
    paymentTerms: "납품 후 45일",
    leadTimeDays: 7,
    category: "소모품/전자",
    memo: "젖병소독기·살균 제품 전담",
  },
];

const PRODUCTS = [
  {
    sku: "KV-CAR-001",
    name: "꿈비 신생아 카시트 클라우드X",
    category: "카시트",
    unit: "EA",
    unitPrice: 298000,
    costPrice: 185000,
    safetyStock: 30,
    leadTime: 7,
    moq: 10,
    supplierCode: "SUP-KV-001",
    supplierName: "꿈비산업",
    initStock: 80,
  },
  {
    sku: "KV-STR-002",
    name: "꿈비 경량 접이식 유모차 에어S",
    category: "유모차",
    unit: "EA",
    unitPrice: 189000,
    costPrice: 112000,
    safetyStock: 20,
    leadTime: 10,
    moq: 5,
    supplierCode: "SUP-KV-002",
    supplierName: "베이비로드",
    initStock: 50,
  },
  {
    sku: "KV-BNC-003",
    name: "꿈비 전동 바운서 드림스윙",
    category: "바운서",
    unit: "EA",
    unitPrice: 159000,
    costPrice: 95000,
    safetyStock: 15,
    leadTime: 5,
    moq: 5,
    supplierCode: "SUP-KV-003",
    supplierName: "아이편한세상",
    initStock: 40,
  },
  {
    sku: "KV-BED-004",
    name: "꿈비 다용도 범퍼침대 코지홈",
    category: "아기침대",
    unit: "EA",
    unitPrice: 135000,
    costPrice: 82000,
    safetyStock: 20,
    leadTime: 14,
    moq: 10,
    supplierCode: "SUP-KV-004",
    supplierName: "스위트베이비",
    initStock: 60,
  },
  {
    sku: "KV-STR-005",
    name: "꿈비 UV-C 젖병소독기 클린버블",
    category: "소독기",
    unit: "EA",
    unitPrice: 89000,
    costPrice: 52000,
    safetyStock: 25,
    leadTime: 7,
    moq: 20,
    supplierCode: "SUP-KV-005",
    supplierName: "클린맘",
    initStock: 100,
  },
];

// ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────
function dateStr(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── 1. 제품마스터 ─────────────────────────────────────────────────────────────
function generateProductMaster() {
  const rows = PRODUCTS.map((p) => ({
    SKU: p.sku,
    제품명: p.name,
    카테고리: p.category,
    단위: p.unit,
    판매단가: p.unitPrice,
    원가: p.costPrice,
    재고수량: p.initStock,
    안전재고: p.safetyStock,
    리드타임: p.leadTime,
    MOQ: p.moq,
    공급업체코드: p.supplierCode,
    공급업체명: p.supplierName,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 6 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 6 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "제품마스터");
  XLSX.writeFile(wb, path.join(OUT_DIR, "01_제품마스터.xlsx"));
  console.log("01_제품마스터.xlsx 생성 완료 (" + rows.length + "건)");
}

// ── 2. 거래처마스터 ────────────────────────────────────────────────────────────
function generateSupplierMaster() {
  const rows = SUPPLIERS.map((s) => ({
    거래처코드: s.code,
    거래처명: s.name,
    대표자: s.representative,
    사업자번호: s.businessNo,
    주소: s.address,
    전화번호: s.phone,
    이메일: s.email,
    팩스: s.fax,
    결제조건: s.paymentTerms,
    기본리드타임: s.leadTimeDays,
    분류: s.category,
    메모: s.memo,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
    { wch: 30 }, { wch: 16 }, { wch: 26 }, { wch: 16 },
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "거래처마스터");
  XLSX.writeFile(wb, path.join(OUT_DIR, "02_거래처마스터.xlsx"));
  console.log("02_거래처마스터.xlsx 생성 완료 (" + rows.length + "건)");
}

// ── 3. 입고(발주) 데이터 1년 ──────────────────────────────────────────────────
// 발주번호: PO-YYYYMMDD-NNN
function generateInboundData() {
  const rows = [];
  const start = new Date("2025-07-01");
  const end = new Date("2026-06-17");

  let poSeq = 1;

  // 제품별 발주 스케줄 생성
  // 각 제품은 대략 리드타임 주기로 발주 → 3~6주 간격
  for (const p of PRODUCTS) {
    let currentDate = new Date(start);
    const intervalDays = Math.max(p.leadTime * 3, 21); // 최소 3주 간격

    while (currentDate <= end) {
      const orderDate = new Date(currentDate);
      const expectedDelivery = addDays(orderDate, p.leadTime);
      const actualDelivery = addDays(expectedDelivery, randInt(-1, 2)); // ±1~2일 편차

      const dateTag = orderDate.toISOString().slice(0, 10).replace(/-/g, "");
      const poNumber = `PO-${dateTag}-${String(poSeq).padStart(3, "0")}`;
      const qty = randInt(p.moq, p.moq * 4);

      rows.push({
        발주번호: poNumber,
        SKU: p.sku,
        제품명: p.name,
        공급업체코드: p.supplierCode,
        공급업체명: p.supplierName,
        발주일: dateStr(orderDate),
        납품예정일: dateStr(expectedDelivery),
        실제입고일: dateStr(actualDelivery <= end ? actualDelivery : end),
        발주수량: qty,
        입고수량: qty,
        단가: p.costPrice,
        금액: qty * p.costPrice,
        입고유형: "발주입고",
        LOT번호: `LOT-${dateTag}-${p.sku.slice(-3)}`,
        적치위치: `A-0${PRODUCTS.indexOf(p) + 1}-01`,
        비고: "",
      });

      poSeq++;
      currentDate = addDays(currentDate, intervalDays + randInt(-3, 3));
    }
  }

  // 날짜 오름차순 정렬
  rows.sort((a, b) => a.발주번호.localeCompare(b.발주번호));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 20 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "입고데이터");
  XLSX.writeFile(wb, path.join(OUT_DIR, "03_입고데이터_1년.xlsx"));
  console.log("03_입고데이터_1년.xlsx 생성 완료 (" + rows.length + "건)");
  return rows;
}

// ── 4. 출고(판매) 데이터 1년 ─────────────────────────────────────────────────
function generateOutboundData() {
  const rows = [];
  const channels = ["자사몰", "네이버스마트스토어", "쿠팡", "카카오쇼핑", "오프라인매장"];
  const outboundTypes = ["판매", "판매", "판매", "판매", "판매", "반품", "샘플"];

  const start = new Date("2025-07-01");
  const end = new Date("2026-06-16");

  // 월별 시즌 계수 (유아용품: 봄/가을 시즌업)
  const seasonFactor = [1.1, 1.0, 1.3, 1.5, 1.4, 1.0, 0.9, 0.9, 1.2, 1.4, 1.3, 1.1];

  for (const p of PRODUCTS) {
    let d = new Date(start);
    while (d <= end) {
      const month = d.getMonth(); // 0-11
      const factor = seasonFactor[month];

      // 일평균 판매수량 (제품별 다름)
      const baseDaily = {
        "KV-CAR-001": 3,
        "KV-STR-002": 5,
        "KV-BNC-003": 4,
        "KV-BED-004": 4,
        "KV-STR-005": 8,
      }[p.sku] || 3;

      // 주말은 1.3배, 평일은 기본
      const dow = d.getDay(); // 0=일,6=토
      const weekendBoost = (dow === 0 || dow === 6) ? 1.3 : 1.0;
      const qty = Math.max(1, Math.round(baseDaily * factor * weekendBoost * (0.7 + Math.random() * 0.6)));

      const type = outboundTypes[Math.floor(Math.random() * outboundTypes.length)];
      const channel = channels[Math.floor(Math.random() * channels.length)];

      rows.push({
        SKU: p.sku,
        날짜: dateStr(d),
        수량: type === "샘플" ? 1 : Math.max(1, qty),
        단가: type === "판매" ? p.unitPrice : 0,
        채널: type === "판매" ? channel : "",
        출고유형: type,
        비고: type === "반품" ? "고객 반품" : (type === "샘플" ? "마케팅 샘플" : ""),
      });

      d = addDays(d, 1);
    }
  }

  // 날짜 오름차순
  rows.sort((a, b) => (a.날짜 > b.날짜 ? 1 : a.날짜 < b.날짜 ? -1 : 0));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    { wch: 18 }, { wch: 10 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "출고데이터");
  XLSX.writeFile(wb, path.join(OUT_DIR, "04_출고데이터_1년.xlsx"));
  console.log("04_출고데이터_1년.xlsx 생성 완료 (" + rows.length + "건)");
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
generateProductMaster();
generateSupplierMaster();
generateInboundData();
generateOutboundData();

console.log("\n모든 파일 생성 완료! 위치: " + OUT_DIR);
console.log("\n[업로드 순서]");
console.log("1. 01_제품마스터.xlsx → 제품관리 > 양식 다운로드 후 업로드 (제품+재고 동시 등록)");
console.log("2. 거래처는 FloStok 공급자관리 화면에서 수동 등록 (또는 02_거래처마스터.xlsx 참고)");
console.log("3. 03_입고데이터_1년.xlsx → 발주관리 > 발주현황에서 '입고처리'로 등록");
console.log("4. 04_출고데이터_1년.xlsx → 출고관리 > 출고요청 > 엑셀 업로드");
