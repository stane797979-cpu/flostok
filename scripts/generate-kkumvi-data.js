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
    safetyStock: 50,      // 안전재고 높임
    reorderPoint: 80,     // 발주점: 현재고가 이 이하면 "주의"
    leadTime: 7,
    moq: 10,
    supplierCode: "SUP-KV-001",
    supplierName: "꿈비산업",
    initStock: 60,
    inboundMultiplier: 0.5,  // 입고 적게
    outboundMultiplier: 0.88, // 총 출고 = 총 입고×0.88 → 잔여 ~12개 (안전재고 50 이하 → critical)
  },
  {
    sku: "KV-STR-002",
    name: "꿈비 경량 접이식 유모차 에어S",
    category: "유모차",
    unit: "EA",
    unitPrice: 189000,
    costPrice: 112000,
    safetyStock: 20,
    reorderPoint: 40,
    leadTime: 10,
    moq: 5,
    supplierCode: "SUP-KV-002",
    supplierName: "베이비로드",
    initStock: 300,       // 초기 대량 재고
    inboundMultiplier: 2.5, // 입고 매우 많이
    outboundMultiplier: 0.3, // 출고 적게 → 과잉재고(안전재고×5 이상)
  },
  {
    sku: "KV-BNC-003",
    name: "꿈비 전동 바운서 드림스윙",
    category: "바운서",
    unit: "EA",
    unitPrice: 159000,
    costPrice: 95000,
    safetyStock: 15,
    reorderPoint: 30,
    leadTime: 5,
    moq: 5,
    supplierCode: "SUP-KV-003",
    supplierName: "아이편한세상",
    initStock: 50,
    inboundMultiplier: 1.0,
    outboundMultiplier: 0.75, // 적정 수준 유지
  },
  {
    sku: "KV-BED-004",
    name: "꿈비 다용도 범퍼침대 코지홈",
    category: "아기침대",
    unit: "EA",
    unitPrice: 135000,
    costPrice: 82000,
    safetyStock: 20,
    reorderPoint: 45,
    leadTime: 14,
    moq: 10,
    supplierCode: "SUP-KV-004",
    supplierName: "스위트베이비",
    initStock: 40,
    inboundMultiplier: 0.6,
    outboundMultiplier: 0.88, // 잔여 ~안전재고 이하 → shortage
  },
  {
    sku: "KV-STR-005",
    name: "꿈비 UV-C 젖병소독기 클린버블",
    category: "소독기",
    unit: "EA",
    unitPrice: 89000,
    costPrice: 52000,
    safetyStock: 30,
    reorderPoint: 60,
    leadTime: 7,
    moq: 20,
    supplierCode: "SUP-KV-005",
    supplierName: "클린맘",
    initStock: 30,
    inboundMultiplier: 0.4,  // 입고 매우 적게
    outboundMultiplier: 0.92, // 잔여 ~0 → out_of_stock/critical
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
    발주점: p.reorderPoint,
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
  XLSX.writeFile(wb, path.join(OUT_DIR, "01_제품마스터_V4.xlsx"));
  console.log("01_제품마스터_V4.xlsx 생성 완료 (" + rows.length + "건)");
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
  XLSX.writeFile(wb, path.join(OUT_DIR, "02_거래처마스터_V4.xlsx"));
  console.log("02_거래처마스터_V4.xlsx 생성 완료 (" + rows.length + "건)");
}

// ── 3. 입고(발주) 데이터 1년 V4 ──────────────────────────────────────────────
function generateInboundData() {
  const rows = [];
  const start = new Date("2025-07-01");
  const end = new Date("2026-06-17");

  let poSeq = 1;

  for (const p of PRODUCTS) {
    let currentDate = new Date(start);
    const mult = p.inboundMultiplier || 1.0;
    // multiplier가 낮을수록 발주 간격을 늘려서 입고 횟수 자체를 줄임
    const intervalDays = Math.round(Math.max(p.leadTime * 3, 21) / mult);

    while (currentDate <= end) {
      const orderDate = new Date(currentDate);
      const expectedDelivery = addDays(orderDate, p.leadTime);
      const actualDelivery = addDays(expectedDelivery, randInt(-1, 2));

      const dateTag = orderDate.toISOString().slice(0, 10).replace(/-/g, "");
      const poNumber = `PO-${dateTag}-${String(poSeq).padStart(3, "0")}`;
      // 수량에도 multiplier 반영
      const baseQty = randInt(p.moq, p.moq * 4);
      const qty = Math.max(p.moq, Math.round(baseQty * mult));

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
        입고유형: "조정입고",
        LOT번호: `LOT-${dateTag}-${p.sku.slice(-3)}`,
        적치위치: `A-0${PRODUCTS.indexOf(p) + 1}-01`,
        비고: "",
      });

      poSeq++;
      currentDate = addDays(currentDate, intervalDays + randInt(-3, 3));
    }
  }

  rows.sort((a, b) => a.발주번호.localeCompare(b.발주번호));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 20 }, { wch: 14 }, { wch: 26 }, { wch: 14 }, { wch: 16 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "입고데이터");
  XLSX.writeFile(wb, path.join(OUT_DIR, "03_입고데이터_1년_V4.xlsx"));
  console.log("03_입고데이터_1년_V4.xlsx 생성 완료 (" + rows.length + "건)");
  return rows;
}

// ── 4. 출고(판매) 데이터 1년 V4 ──────────────────────────────────────────────
// 입고 총량(initStock 포함)을 먼저 계산 후, 출고가 그 범위 내에 들어오도록 역산
function generateOutboundData(inboundRows) {
  const rows = [];
  const channels = ["자사몰", "네이버스마트스토어", "쿠팡", "카카오쇼핑", "오프라인매장"];
  const outboundTypes = ["판매", "판매", "판매", "판매", "판매", "반품", "샘플"];

  const start = new Date("2025-07-01");
  const end = new Date("2026-06-16");
  const DAYS = 351; // 2025-07-01 ~ 2026-06-16

  // 시즌 계수 (월별)
  const seasonFactor = [1.1, 1.0, 1.3, 1.5, 1.4, 1.0, 0.9, 0.9, 1.2, 1.4, 1.3, 1.1];
  // 시즌 계수 연간 합 (351일치 가중평균 계산용)
  // Jul=1.0, Aug=0.9, Sep=0.9, Oct=1.2, Nov=1.4, Dec=1.3, Jan=1.1, Feb=1.0, Mar=1.3, Apr=1.5, May=1.4, Jun=1.0
  const monthFactors = [1.1, 1.0, 1.3, 1.5, 1.4, 1.0, 0.9, 0.9, 1.2, 1.4, 1.3, 1.1];
  // 351일간 평균 시즌 계수 근사값
  const avgSeason = monthFactors.reduce((a, b) => a + b, 0) / 12; // ≈ 1.15

  // 주말 비율 보정: 주말 30%, 평일 70% → 평균 ≈ 1.06
  const avgWeekend = 1.0 * 0.7 + 1.3 * 0.3; // ≈ 1.09

  // 랜덤 계수 평균: (0.7~1.3) 평균 = 1.0

  const dateSeqMap = {};
  function nextOutboundNumber(dateString) {
    const key = dateString.replace(/-/g, "");
    dateSeqMap[key] = (dateSeqMap[key] || 0) + 1;
    return `OR-${key}-${String(dateSeqMap[key]).padStart(3, "0")}`;
  }

  for (const p of PRODUCTS) {
    // 1) 이 제품의 총 입고량 계산 (initStock + 입고데이터)
    const totalInbound = p.initStock +
      inboundRows.filter(r => r.SKU === p.sku).reduce((s, r) => s + r.입고수량, 0);

    // 2) 목표 출고 비율 결정 (outboundMultiplier로 재고 상태 연출)
    //    - 1.0 초과: 재고 부족/위험 (입고보다 많이 팔림 → 단, 총 출고는 총 입고 이하로 제한)
    //    - 0.5 이하: 과재고 (적게 팔림)
    //    outboundMultiplier 그대로 비율로 사용하되, 총 출고 ≤ totalInbound * 0.95 제한
    const outMult = p.outboundMultiplier || 1.0;
    // 재고 상태 연출을 위한 목표 총 출고량
    // 단, 절대 totalInbound를 넘을 수 없음 (최대 95%)
    const targetTotal = Math.min(
      Math.round(totalInbound * Math.min(outMult, 0.95)),
      totalInbound - p.initStock // 최소 initStock은 남김
    );

    // 3) 일평균 출고 역산
    const baseDaily = targetTotal / (DAYS * avgSeason * avgWeekend);

    let d = new Date(start);
    let totalOut = 0;

    while (d <= end) {
      const month = d.getMonth();
      const factor = seasonFactor[month];
      const dow = d.getDay();
      const weekendBoost = (dow === 0 || dow === 6) ? 1.3 : 1.0;
      const random = 0.7 + Math.random() * 0.6;
      let qty = Math.max(1, Math.round(baseDaily * factor * weekendBoost * random));

      // 남은 허용 출고량 초과 방지
      const remaining = targetTotal - totalOut;
      if (remaining <= 0) break;
      qty = Math.min(qty, remaining);

      const type = outboundTypes[Math.floor(Math.random() * outboundTypes.length)];
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const ds = dateStr(d);

      rows.push({
        SKU: p.sku,
        날짜: ds,
        수량: type === "샘플" ? Math.min(1, qty) : qty,
        단가: type === "판매" ? p.unitPrice : 0,
        채널: type === "판매" ? channel : "",
        출고유형: type,
        출고번호: nextOutboundNumber(ds),
        비고: type === "반품" ? "고객 반품" : (type === "샘플" ? "마케팅 샘플" : ""),
      });

      totalOut += qty;
      d = addDays(d, 1);
    }

    console.log(`  ${p.sku}: 총입고 ${totalInbound}, 총출고 ${totalOut}, 잔여재고 ${totalInbound - totalOut} (initStock ${p.initStock})`);
  }

  rows.sort((a, b) => (a.날짜 > b.날짜 ? 1 : a.날짜 < b.날짜 ? -1 : 0));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    { wch: 18 }, { wch: 10 }, { wch: 20 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "출고데이터");
  XLSX.writeFile(wb, path.join(OUT_DIR, "04_출고데이터_1년_V4.xlsx"));
  console.log("04_출고데이터_1년_V4.xlsx 생성 완료 (" + rows.length + "건)");
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
generateProductMaster();
generateSupplierMaster();
const inboundRows = generateInboundData();
generateOutboundData(inboundRows);

console.log("\n모든 파일 생성 완료! 위치: " + OUT_DIR);
console.log("\n[업로드 순서]");
console.log("1. 01_제품마스터.xlsx → 제품관리 > 양식 다운로드 후 업로드 (제품+재고 동시 등록)");
console.log("2. 거래처는 FloStok 공급자관리 화면에서 수동 등록 (또는 02_거래처마스터.xlsx 참고)");
console.log("3. 03_입고데이터_1년.xlsx → 발주관리 > 발주현황에서 '입고처리'로 등록");
console.log("4. 04_출고데이터_1년.xlsx → 출고관리 > 출고요청 > 엑셀 업로드");
