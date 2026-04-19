/**
 * FloStok 검증용 - 과거 1년치 입고/출고 데이터 생성
 * 기존 01_제품마스터_100SKU.xlsx 기반으로 365일 데이터 생성
 *
 * 현실적 패턴 반영:
 * - 월별 계절성 (3~5월 상승, 7~8월 하락, 11~12월 피크)
 * - 요일별 변동 (금 상승, 주말 하락)
 * - 랜덤 이벤트 (결품, 대량주문, 공급 지연 등)
 */

const XLSX = require("xlsx");
const fs = require("fs");

// ─── 기존 제품 마스터 읽기 ──────────────────────────
const masterPath = "d:/Claude work/website/scripts/test-data/01_제품마스터_100SKU.xlsx";
const wb = XLSX.readFile(masterPath);
const products = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
console.log(`제품 마스터 로드: ${products.length}개 SKU`);

// ─── 설정 ──────────────────────────────────────────
const END_DATE = new Date("2026-02-15"); // 검증 기간 직전까지
const START_DATE = new Date("2025-02-16"); // 1년 전
const TOTAL_DAYS = 365;

// ─── 유틸 ──────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}
function formatDate(d) {
  return d.toISOString().slice(0, 10);
}
function getDayOfWeek(d) {
  return d.getDay(); // 0=일, 1=월, ..., 6=토
}

// 월별 계절성 계수 (1월~12월)
const MONTHLY_FACTOR = {
  0: 0.85,  // 1월 (설 연휴)
  1: 0.80,  // 2월 (설 연휴)
  2: 1.05,  // 3월 (상승기)
  3: 1.10,  // 4월 (성수기)
  4: 1.15,  // 5월 (성수기)
  5: 1.00,  // 6월
  6: 0.85,  // 7월 (하절기)
  7: 0.80,  // 8월 (휴가)
  8: 1.05,  // 9월 (추석)
  9: 1.10,  // 10월 (성수기)
  10: 1.20, // 11월 (피크-블프)
  11: 1.25, // 12월 (연말 피크)
};

// 요일별 계수 (일=0 ~ 토=6)
const DAY_FACTOR = {
  0: 0.40, // 일요일
  1: 1.05, // 월
  2: 1.00, // 화
  3: 0.95, // 수
  4: 1.00, // 목
  5: 1.15, // 금
  6: 0.60, // 토
};

// 판매 채널
const CHANNELS = ["온라인-자사몰", "온라인-쿠팡", "온라인-네이버", "오프라인-매장", "B2B-직납", "B2B-도매"];
// 공급자
const SUPPLIERS = ["한국볼트공업", "대한알루미늄", "NSK코리아", "SMC코리아", "미쓰비시전기", "대한전선", "SK윤활유", "한국안전"];

// ─── 날짜 배열 생성 ──────────────────────────────────
const dates = [];
for (let i = 0; i < TOTAL_DAYS; i++) {
  const d = new Date(START_DATE);
  d.setDate(d.getDate() + i);
  dates.push(d);
}

// ─── 출고(판매) 데이터 생성 ──────────────────────────
console.log("출고(판매) 데이터 생성 중...");
const outboundData = [];
let outSeq = 1;

// 트렌드: 1년간 소폭 성장 (시작 0.9 → 끝 1.1)
function getTrendFactor(dayIndex) {
  return 0.9 + (dayIndex / TOTAL_DAYS) * 0.2;
}

for (const product of products) {
  const avgDaily = product["일평균판매량"] || 10;

  for (let dayIdx = 0; dayIdx < TOTAL_DAYS; dayIdx++) {
    const date = dates[dayIdx];
    const dow = getDayOfWeek(date);
    const month = date.getMonth();

    // 주말 출고 없는 확률 (측정기기/공구 등 저빈도)
    if (dow === 0 && Math.random() < 0.7) continue; // 일요일 70% 쉼
    if (dow === 6 && Math.random() < 0.4) continue; // 토요일 40% 쉼
    if (avgDaily < 3 && Math.random() < 0.35) continue; // 저빈도 제품

    const seasonFactor = MONTHLY_FACTOR[month];
    const dayFactor = DAY_FACTOR[dow];
    const trendFactor = getTrendFactor(dayIdx);
    // 랜덤 이벤트 (5% 확률로 대량주문 x2~3배)
    const eventFactor = Math.random() < 0.05 ? randFloat(2.0, 3.0) : 1.0;
    // 노이즈
    const noise = randFloat(0.5, 1.5);

    const qty = Math.max(1, Math.round(avgDaily * seasonFactor * dayFactor * trendFactor * eventFactor * noise));
    const channel = CHANNELS[rand(0, CHANNELS.length - 1)];

    outboundData.push({
      No: outSeq++,
      판매일: formatDate(date),
      SKU: product["SKU"],
      제품명: product["제품명"],
      카테고리: product["카테고리"],
      판매수량: qty,
      판매단가: product["판매단가"],
      판매금액: qty * product["판매단가"],
      판매채널: channel,
      비고: eventFactor > 1.5 ? "대량주문" : "",
    });
  }
}
console.log(`출고 데이터: ${outboundData.length}건`);

// ─── 입고 데이터 생성 ──────────────────────────────
console.log("입고 데이터 생성 중...");
const inboundData = [];
let inSeq = 1;

for (const product of products) {
  const avgDaily = product["일평균판매량"] || 10;
  const leadTime = product["리드타임일"] || 7;
  const moq = product["MOQ"] || 1;
  const safetyStock = product["안전재고"] || 30;

  // 시뮬레이션: 재고가 발주점 아래로 떨어지면 리드타임 후 입고
  let stock = product["초기재고"] || product["발주점"] * 1.5;
  let pendingOrders = []; // { arrivalDay, qty }

  // 해당 제품의 일별 출고량 맵
  const dailySales = {};
  for (const row of outboundData) {
    if (row["SKU"] === product["SKU"]) {
      dailySales[row["판매일"]] = (dailySales[row["판매일"]] || 0) + row["판매수량"];
    }
  }

  for (let dayIdx = 0; dayIdx < TOTAL_DAYS; dayIdx++) {
    const date = dates[dayIdx];
    const dateStr = formatDate(date);
    const dow = getDayOfWeek(date);

    // 입고 도착 처리
    const arrivals = pendingOrders.filter(o => o.arrivalDay === dayIdx);
    for (const arrival of arrivals) {
      const rejectedQty = Math.random() < 0.03 ? rand(1, Math.max(1, Math.ceil(arrival.qty * 0.05))) : 0;
      const acceptedQty = arrival.qty - rejectedQty;

      inboundData.push({
        No: inSeq++,
        입고일: dateStr,
        SKU: product["SKU"],
        제품명: product["제품명"],
        카테고리: product["카테고리"],
        예상수량: arrival.qty,
        실입고수량: arrival.qty,
        합격수량: acceptedQty,
        불합격수량: rejectedQty,
        검수결과: rejectedQty > 0 ? "부분합격" : "합격",
        적치위치: `${["A", "B", "C", "D"][rand(0, 3)]}-${rand(1, 5)}-${rand(1, 10)}`,
        LOT번호: `LOT${dateStr.replace(/-/g, "")}-${String(rand(1, 999)).padStart(3, "0")}`,
        공급자: SUPPLIERS[rand(0, SUPPLIERS.length - 1)],
        비고: rejectedQty > 0 ? "일부불합격" : "",
      });

      stock += acceptedQty;
    }
    pendingOrders = pendingOrders.filter(o => o.arrivalDay !== dayIdx);

    // 출고 차감
    const sold = dailySales[dateStr] || 0;
    stock = Math.max(0, stock - sold);

    // 발주 판단 (평일만, 재고 < 발주점)
    if (dow >= 1 && dow <= 5 && stock < (product["발주점"] || safetyStock * 2)) {
      // 발주량 = MOQ 단위로 올림 (목표: 안전재고 x 2)
      const targetStock = safetyStock * 2.5;
      const orderQty = Math.max(moq, Math.ceil((targetStock - stock) / moq) * moq);

      // 리드타임 + 약간의 변동
      const actualLeadTime = leadTime + rand(-1, 2);
      const arrivalDay = dayIdx + Math.max(1, actualLeadTime);

      if (arrivalDay < TOTAL_DAYS) {
        pendingOrders.push({ arrivalDay, qty: orderQty });
      }
    }
  }
}
console.log(`입고 데이터: ${inboundData.length}건`);

// ─── 월별 요약 통계 생성 ──────────────────────────────
console.log("월별 요약 통계 생성 중...");
const monthlySummary = [];
const months = {};

for (const row of outboundData) {
  const ym = row["판매일"].slice(0, 7);
  if (!months[ym]) months[ym] = { sales: 0, qty: 0, skus: new Set() };
  months[ym].sales += row["판매금액"];
  months[ym].qty += row["판매수량"];
  months[ym].skus.add(row["SKU"]);
}

for (const [ym, data] of Object.entries(months).sort()) {
  monthlySummary.push({
    년월: ym,
    총판매금액: data.sales,
    총판매수량: data.qty,
    활성SKU수: data.skus.size,
    일평균판매금액: Math.round(data.sales / 30),
    일평균판매수량: Math.round(data.qty / 30),
  });
}

// ─── 엑셀 파일 생성 ──────────────────────────────────
function createWorkbook(data, sheetName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  const colWidths = Object.keys(data[0]).map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...data.slice(0, 50).map((row) => String(row[key] || "").length)
    );
    return { wch: Math.min(maxLen + 2, 30) };
  });
  ws["!cols"] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

const outputDir = "d:/Claude work/website/scripts/test-data";

// 1년치 출고
const wbOut = createWorkbook(outboundData, "출고1년");
XLSX.writeFile(wbOut, `${outputDir}/04_출고데이터_1년.xlsx`);
console.log("✅ 04_출고데이터_1년.xlsx");

// 1년치 입고
const wbIn = createWorkbook(inboundData, "입고1년");
XLSX.writeFile(wbIn, `${outputDir}/05_입고데이터_1년.xlsx`);
console.log("✅ 05_입고데이터_1년.xlsx");

// 월별 요약
const wbSummary = createWorkbook(monthlySummary, "월별요약");
XLSX.writeFile(wbSummary, `${outputDir}/06_월별요약통계.xlsx`);
console.log("✅ 06_월별요약통계.xlsx");

// ─── 요약 ──────────────────────────────────────────
console.log("\n═══════════════════════════════════════════");
console.log("  FloStok 검증용 과거 1년 데이터 요약");
console.log("═══════════════════════════════════════════");
console.log(`📤 출고(판매): ${outboundData.length.toLocaleString()}건`);
console.log(`📥 입고: ${inboundData.length.toLocaleString()}건`);
console.log(`📊 월별 요약: ${monthlySummary.length}개월`);
console.log(`📅 기간: ${formatDate(START_DATE)} ~ ${formatDate(END_DATE)}`);
console.log(`\n데이터 특징:`);
console.log(`  - 월별 계절성 (설/추석 하락, 11-12월 피크)`);
console.log(`  - 연간 성장 트렌드 (+20%)`);
console.log(`  - 요일별 변동 (금↑, 주말↓)`);
console.log(`  - 대량주문 이벤트 (5% 확률)`);
console.log(`  - 입고 불합격 (3% 확률)`);
console.log(`  - 발주점 기반 자동 입고 시뮬레이션`);

// 월별 매출 미니 차트
console.log(`\n월별 매출 추이:`);
for (const m of monthlySummary) {
  const bar = "█".repeat(Math.round(m.총판매금액 / monthlySummary[0].총판매금액 * 15));
  console.log(`  ${m.년월} ${bar} ${(m.총판매금액 / 1000000).toFixed(1)}M`);
}
console.log("═══════════════════════════════════════════");
