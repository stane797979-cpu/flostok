/**
 * FloStok 검증용 테스트 데이터 생성
 * - 100 SKU 제품 마스터
 * - 7일치 입고 데이터
 * - 7일치 출고(판매) 데이터
 *
 * 출력: Excel 파일 3개 (products.xlsx, inbound.xlsx, outbound.xlsx)
 */

const XLSX = require("xlsx");

// ─── 카테고리별 제품 정의 ──────────────────────────────
const CATEGORIES = [
  {
    category: "전자부품",
    prefix: "EL",
    items: [
      { name: "저항 1KΩ 1/4W", unit: "EA", costRange: [5, 20], priceRange: [15, 50], dailySale: [50, 200] },
      { name: "커패시터 100μF", unit: "EA", costRange: [10, 30], priceRange: [25, 70], dailySale: [30, 150] },
      { name: "LED 5mm 적색", unit: "EA", costRange: [8, 25], priceRange: [20, 60], dailySale: [40, 180] },
      { name: "트랜지스터 2N2222", unit: "EA", costRange: [15, 40], priceRange: [35, 80], dailySale: [20, 100] },
      { name: "다이오드 1N4007", unit: "EA", costRange: [5, 15], priceRange: [12, 35], dailySale: [60, 250] },
      { name: "IC 555 타이머", unit: "EA", costRange: [50, 150], priceRange: [100, 300], dailySale: [10, 50] },
      { name: "릴레이 12V 5핀", unit: "EA", costRange: [200, 500], priceRange: [400, 900], dailySale: [5, 30] },
      { name: "퓨즈 2A 250V", unit: "EA", costRange: [20, 50], priceRange: [40, 100], dailySale: [15, 60] },
      { name: "커넥터 JST 2핀", unit: "EA", costRange: [30, 80], priceRange: [60, 150], dailySale: [25, 120] },
      { name: "PCB 기판 100x150mm", unit: "EA", costRange: [500, 1200], priceRange: [1000, 2500], dailySale: [3, 15] },
    ],
  },
  {
    category: "기계부품",
    prefix: "MC",
    items: [
      { name: "볼트 M6x20 SUS304", unit: "EA", costRange: [15, 40], priceRange: [30, 80], dailySale: [100, 400] },
      { name: "너트 M6 SUS304", unit: "EA", costRange: [8, 20], priceRange: [15, 45], dailySale: [100, 400] },
      { name: "와셔 M6 평와셔", unit: "EA", costRange: [3, 10], priceRange: [8, 25], dailySale: [150, 500] },
      { name: "스프링 와셔 M8", unit: "EA", costRange: [5, 15], priceRange: [12, 35], dailySale: [80, 300] },
      { name: "베어링 6001ZZ", unit: "EA", costRange: [800, 2000], priceRange: [1500, 3500], dailySale: [5, 25] },
      { name: "오링 P-20 NBR", unit: "EA", costRange: [30, 80], priceRange: [60, 150], dailySale: [20, 80] },
      { name: "리니어 가이드 200mm", unit: "EA", costRange: [5000, 12000], priceRange: [10000, 22000], dailySale: [1, 5] },
      { name: "스텝모터 NEMA17", unit: "EA", costRange: [3000, 8000], priceRange: [6000, 15000], dailySale: [2, 8] },
      { name: "타이밍벨트 GT2 1m", unit: "EA", costRange: [500, 1200], priceRange: [1000, 2200], dailySale: [3, 12] },
      { name: "커플링 5x8mm", unit: "EA", costRange: [800, 2000], priceRange: [1500, 3800], dailySale: [2, 10] },
    ],
  },
  {
    category: "포장재",
    prefix: "PK",
    items: [
      { name: "골판지 박스 소 300x200x150", unit: "EA", costRange: [150, 300], priceRange: [300, 600], dailySale: [50, 200] },
      { name: "골판지 박스 중 400x300x250", unit: "EA", costRange: [250, 500], priceRange: [500, 1000], dailySale: [30, 120] },
      { name: "골판지 박스 대 500x400x350", unit: "EA", costRange: [400, 800], priceRange: [800, 1500], dailySale: [15, 60] },
      { name: "에어캡 롤 33cm x 50m", unit: "ROLL", costRange: [3000, 6000], priceRange: [6000, 11000], dailySale: [3, 15] },
      { name: "택배봉투 25x35cm", unit: "EA", costRange: [30, 60], priceRange: [60, 120], dailySale: [100, 400] },
      { name: "스티로폼 박스 5kg용", unit: "EA", costRange: [500, 1000], priceRange: [1000, 2000], dailySale: [10, 40] },
      { name: "OPP 테이프 48mm", unit: "EA", costRange: [800, 1500], priceRange: [1500, 2800], dailySale: [8, 30] },
      { name: "충전재 크라프트지", unit: "KG", costRange: [1000, 2500], priceRange: [2000, 4500], dailySale: [5, 20] },
      { name: "라벨지 100x150mm 500매", unit: "BOX", costRange: [5000, 10000], priceRange: [10000, 18000], dailySale: [2, 8] },
      { name: "밴딩끈 15mm 1000m", unit: "ROLL", costRange: [8000, 15000], priceRange: [15000, 28000], dailySale: [1, 5] },
    ],
  },
  {
    category: "사무용품",
    prefix: "OF",
    items: [
      { name: "A4용지 80g 500매", unit: "BOX", costRange: [8000, 12000], priceRange: [12000, 20000], dailySale: [5, 20] },
      { name: "볼펜 검정 0.5mm", unit: "EA", costRange: [200, 500], priceRange: [500, 1000], dailySale: [10, 50] },
      { name: "클리어파일 A4 10매입", unit: "SET", costRange: [500, 1000], priceRange: [1000, 2000], dailySale: [5, 25] },
      { name: "포스트잇 76x76mm", unit: "EA", costRange: [300, 600], priceRange: [600, 1200], dailySale: [8, 35] },
      { name: "바인더클립 32mm 12개", unit: "BOX", costRange: [400, 800], priceRange: [800, 1500], dailySale: [3, 15] },
      { name: "화이트보드 마커 4색", unit: "SET", costRange: [1500, 3000], priceRange: [3000, 5500], dailySale: [2, 10] },
      { name: "스카치테이프 18mm", unit: "EA", costRange: [300, 600], priceRange: [600, 1100], dailySale: [10, 40] },
      { name: "가위 175mm 사무용", unit: "EA", costRange: [1000, 2500], priceRange: [2500, 4500], dailySale: [1, 5] },
      { name: "풀 스틱 35g", unit: "EA", costRange: [300, 600], priceRange: [600, 1100], dailySale: [5, 20] },
      { name: "스테이플러 침 10호", unit: "BOX", costRange: [200, 400], priceRange: [400, 800], dailySale: [3, 12] },
    ],
  },
  {
    category: "안전용품",
    prefix: "SF",
    items: [
      { name: "안전화 235~290mm", unit: "PAIR", costRange: [15000, 30000], priceRange: [30000, 55000], dailySale: [1, 5] },
      { name: "안전모 백색", unit: "EA", costRange: [3000, 6000], priceRange: [6000, 12000], dailySale: [2, 8] },
      { name: "보안경 투명", unit: "EA", costRange: [1500, 3000], priceRange: [3000, 6000], dailySale: [3, 12] },
      { name: "면장갑 12켤레", unit: "SET", costRange: [2000, 4000], priceRange: [4000, 7000], dailySale: [5, 20] },
      { name: "방진마스크 KF94 50매", unit: "BOX", costRange: [10000, 20000], priceRange: [20000, 35000], dailySale: [3, 10] },
      { name: "귀마개 EP-20", unit: "PAIR", costRange: [200, 500], priceRange: [500, 1000], dailySale: [10, 40] },
      { name: "안전조끼 형광 오렌지", unit: "EA", costRange: [3000, 6000], priceRange: [6000, 11000], dailySale: [1, 5] },
      { name: "소화기 ABC 3.3kg", unit: "EA", costRange: [15000, 25000], priceRange: [25000, 45000], dailySale: [0, 3] },
      { name: "안전테이프 황/흑 50m", unit: "ROLL", costRange: [2000, 4000], priceRange: [4000, 7000], dailySale: [2, 8] },
      { name: "응급처치세트 25인용", unit: "SET", costRange: [20000, 40000], priceRange: [40000, 70000], dailySale: [0, 2] },
    ],
  },
  {
    category: "화학자재",
    prefix: "CH",
    items: [
      { name: "이소프로필알코올 1L", unit: "EA", costRange: [3000, 5000], priceRange: [5000, 9000], dailySale: [5, 20] },
      { name: "접착제 에폭시 50ml", unit: "EA", costRange: [2000, 4000], priceRange: [4000, 7500], dailySale: [3, 12] },
      { name: "윤활유 WD-40 360ml", unit: "EA", costRange: [3000, 5000], priceRange: [5000, 9000], dailySale: [3, 15] },
      { name: "세정제 전자부품용 500ml", unit: "EA", costRange: [5000, 8000], priceRange: [8000, 14000], dailySale: [2, 8] },
      { name: "그리스 리튬 400g", unit: "EA", costRange: [3000, 6000], priceRange: [6000, 10000], dailySale: [2, 10] },
      { name: "실리콘 실란트 310ml", unit: "EA", costRange: [2000, 4000], priceRange: [4000, 7000], dailySale: [3, 12] },
      { name: "솔벤트 톨루엔 1L", unit: "EA", costRange: [4000, 7000], priceRange: [7000, 12000], dailySale: [1, 5] },
      { name: "방청제 스프레이 420ml", unit: "EA", costRange: [3000, 5000], priceRange: [5000, 9000], dailySale: [2, 8] },
      { name: "열전도 페이스트 30g", unit: "EA", costRange: [1000, 2500], priceRange: [2500, 4500], dailySale: [3, 15] },
      { name: "플럭스 로진 100ml", unit: "EA", costRange: [2000, 4000], priceRange: [4000, 7000], dailySale: [2, 10] },
    ],
  },
  {
    category: "공구",
    prefix: "TL",
    items: [
      { name: "드라이버 +/- 세트 6P", unit: "SET", costRange: [3000, 6000], priceRange: [6000, 11000], dailySale: [2, 8] },
      { name: "렌치 육각 세트 9P", unit: "SET", costRange: [5000, 10000], priceRange: [10000, 18000], dailySale: [1, 5] },
      { name: "니퍼 150mm", unit: "EA", costRange: [3000, 6000], priceRange: [6000, 11000], dailySale: [1, 5] },
      { name: "롱노즈 플라이어 150mm", unit: "EA", costRange: [3000, 6000], priceRange: [6000, 11000], dailySale: [1, 5] },
      { name: "줄자 5m 자동감김", unit: "EA", costRange: [2000, 4000], priceRange: [4000, 7000], dailySale: [2, 8] },
      { name: "커터칼 대형 18mm", unit: "EA", costRange: [500, 1200], priceRange: [1200, 2200], dailySale: [5, 20] },
      { name: "글루건 40W", unit: "EA", costRange: [3000, 6000], priceRange: [6000, 11000], dailySale: [1, 4] },
      { name: "글루건 스틱 11mm 20본", unit: "SET", costRange: [1000, 2000], priceRange: [2000, 3500], dailySale: [3, 12] },
      { name: "전동드릴 비트세트 10P", unit: "SET", costRange: [5000, 10000], priceRange: [10000, 18000], dailySale: [1, 5] },
      { name: "인두기 40W 세라믹", unit: "EA", costRange: [5000, 12000], priceRange: [12000, 22000], dailySale: [0, 3] },
    ],
  },
  {
    category: "케이블/배선",
    prefix: "CB",
    items: [
      { name: "USB-C 케이블 1m", unit: "EA", costRange: [500, 1200], priceRange: [1200, 2500], dailySale: [10, 40] },
      { name: "전원케이블 2.5sq 1m", unit: "M", costRange: [300, 600], priceRange: [600, 1100], dailySale: [20, 80] },
      { name: "랜케이블 CAT6 3m", unit: "EA", costRange: [500, 1000], priceRange: [1000, 2000], dailySale: [8, 30] },
      { name: "점퍼와이어 M-M 40P", unit: "SET", costRange: [500, 1000], priceRange: [1000, 2000], dailySale: [5, 20] },
      { name: "열수축튜브 세트 300P", unit: "SET", costRange: [2000, 4000], priceRange: [4000, 7000], dailySale: [2, 8] },
      { name: "케이블타이 200mm 100P", unit: "SET", costRange: [500, 1000], priceRange: [1000, 2000], dailySale: [10, 40] },
      { name: "터미널블록 6P", unit: "EA", costRange: [300, 600], priceRange: [600, 1200], dailySale: [5, 20] },
      { name: "와이어 커넥터 12P", unit: "SET", costRange: [200, 500], priceRange: [500, 1000], dailySale: [8, 30] },
      { name: "전선관 16mm PVC 1m", unit: "M", costRange: [200, 400], priceRange: [400, 800], dailySale: [10, 40] },
      { name: "배선덕트 25x25 1m", unit: "M", costRange: [500, 1000], priceRange: [1000, 2000], dailySale: [5, 20] },
    ],
  },
  {
    category: "측정기기",
    prefix: "MS",
    items: [
      { name: "디지털 캘리퍼 150mm", unit: "EA", costRange: [8000, 15000], priceRange: [15000, 28000], dailySale: [0, 3] },
      { name: "디지털 온도계 -50~300", unit: "EA", costRange: [5000, 10000], priceRange: [10000, 18000], dailySale: [1, 4] },
      { name: "디지털 멀티미터", unit: "EA", costRange: [8000, 15000], priceRange: [15000, 28000], dailySale: [0, 3] },
      { name: "레이저 거리측정기 40m", unit: "EA", costRange: [20000, 40000], priceRange: [40000, 70000], dailySale: [0, 2] },
      { name: "수평기 300mm", unit: "EA", costRange: [3000, 6000], priceRange: [6000, 11000], dailySale: [1, 4] },
      { name: "전자저울 0.01g~500g", unit: "EA", costRange: [15000, 30000], priceRange: [30000, 55000], dailySale: [0, 2] },
      { name: "조도계 디지털", unit: "EA", costRange: [20000, 40000], priceRange: [40000, 70000], dailySale: [0, 1] },
      { name: "소음측정기 디지털", unit: "EA", costRange: [15000, 30000], priceRange: [30000, 55000], dailySale: [0, 1] },
      { name: "두께측정기 디지털", unit: "EA", costRange: [30000, 60000], priceRange: [60000, 100000], dailySale: [0, 1] },
      { name: "토크렌치 1/4인치", unit: "EA", costRange: [25000, 50000], priceRange: [50000, 90000], dailySale: [0, 2] },
    ],
  },
  {
    category: "소모품",
    prefix: "CN",
    items: [
      { name: "건전지 AA 4P 알카라인", unit: "SET", costRange: [1000, 2000], priceRange: [2000, 3500], dailySale: [10, 40] },
      { name: "건전지 AAA 4P 알카라인", unit: "SET", costRange: [1000, 2000], priceRange: [2000, 3500], dailySale: [8, 30] },
      { name: "청소용 와이퍼 100매", unit: "BOX", costRange: [3000, 6000], priceRange: [6000, 10000], dailySale: [3, 12] },
      { name: "에어더스터 350ml", unit: "EA", costRange: [3000, 5000], priceRange: [5000, 9000], dailySale: [3, 12] },
      { name: "정전기방지 매트 A4", unit: "EA", costRange: [5000, 10000], priceRange: [10000, 18000], dailySale: [1, 5] },
      { name: "사포 #220 10매", unit: "SET", costRange: [1000, 2000], priceRange: [2000, 3500], dailySale: [3, 12] },
      { name: "마스킹테이프 24mm", unit: "EA", costRange: [500, 1000], priceRange: [1000, 2000], dailySale: [5, 20] },
      { name: "절연테이프 흑색 19mm", unit: "EA", costRange: [300, 600], priceRange: [600, 1200], dailySale: [8, 30] },
      { name: "세척솔 나일론 세트", unit: "SET", costRange: [2000, 4000], priceRange: [4000, 7000], dailySale: [2, 8] },
      { name: "흡착패드 진공용 10P", unit: "SET", costRange: [3000, 6000], priceRange: [6000, 10000], dailySale: [1, 5] },
    ],
  },
];

// ─── 유틸 함수 ──────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// 요일별 변동 계수 (월~일)
const DAY_FACTORS = [1.1, 1.05, 1.0, 0.95, 1.15, 0.7, 0.5];

// ─── 날짜 설정 ──────────────────────────────────────
const START_DATE = new Date("2026-02-16"); // 월요일
const DATES = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(START_DATE);
  d.setDate(d.getDate() + i);
  DATES.push(d.toISOString().slice(0, 10));
}

// ─── 1. 제품 마스터 생성 ──────────────────────────────
const productsList = [];
let skuNum = 1;

for (const cat of CATEGORIES) {
  for (const item of cat.items) {
    const sku = `${cat.prefix}-${String(skuNum).padStart(4, "0")}`;
    const costPrice = rand(item.costRange[0], item.costRange[1]);
    const unitPrice = rand(item.priceRange[0], item.priceRange[1]);
    const leadTime = rand(3, 14);
    const avgDailySale = randFloat(item.dailySale[0], item.dailySale[1], 0);
    const safetyStock = Math.ceil(avgDailySale * rand(3, 7));
    const reorderPoint = Math.ceil(avgDailySale * leadTime + safetyStock);
    const moq = rand(1, 5) * (avgDailySale > 50 ? 50 : avgDailySale > 10 ? 10 : 1);

    productsList.push({
      SKU: sku,
      제품명: item.name,
      카테고리: cat.category,
      단위: item.unit,
      원가: costPrice,
      판매단가: unitPrice,
      리드타임일: leadTime,
      안전재고: safetyStock,
      발주점: reorderPoint,
      MOQ: moq,
      일평균판매량: parseInt(avgDailySale),
      초기재고: Math.ceil(reorderPoint * randFloat(0.8, 2.0)),
    });
    skuNum++;
  }
}

console.log(`제품 마스터: ${productsList.length}개 생성`);

// ─── 2. 입고 데이터 생성 ──────────────────────────────
const inboundData = [];
let inboundSeq = 1;

for (const product of productsList) {
  // 7일 중 2~4일 입고 발생 (모든 SKU가 매일 입고되진 않음)
  const inboundDays = rand(2, 4);
  const selectedDays = [];

  while (selectedDays.length < inboundDays) {
    const dayIdx = rand(0, 6);
    if (!selectedDays.includes(dayIdx)) selectedDays.push(dayIdx);
  }
  selectedDays.sort((a, b) => a - b);

  for (const dayIdx of selectedDays) {
    const baseQty = product.일평균판매량 * randFloat(1.0, 2.5, 1);
    const receivedQty = Math.max(product.MOQ, Math.ceil(baseQty / product.MOQ) * product.MOQ);
    const rejectedQty = Math.random() < 0.05 ? rand(1, Math.ceil(receivedQty * 0.1)) : 0;
    const acceptedQty = receivedQty - rejectedQty;

    inboundData.push({
      No: inboundSeq++,
      입고일: DATES[dayIdx],
      SKU: product.SKU,
      제품명: product.제품명,
      카테고리: product.카테고리,
      예상수량: receivedQty,
      실입고수량: receivedQty,
      합격수량: acceptedQty,
      불합격수량: rejectedQty,
      검수결과: rejectedQty > 0 ? "부분합격" : "합격",
      적치위치: `${["A", "B", "C", "D"][rand(0, 3)]}-${rand(1, 5)}-${rand(1, 10)}`,
      LOT번호: `LOT${DATES[dayIdx].replace(/-/g, "")}-${String(rand(1, 999)).padStart(3, "0")}`,
      비고: "",
    });
  }
}

console.log(`입고 데이터: ${inboundData.length}건 생성`);

// ─── 3. 출고(판매) 데이터 생성 ──────────────────────────
const outboundData = [];
let outboundSeq = 1;
const CHANNELS = ["온라인-자사몰", "온라인-쿠팡", "온라인-네이버", "오프라인-매장", "B2B-직납", "B2B-도매"];

for (const product of productsList) {
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    // 토/일은 출고 없는 경우도 있음
    if (dayIdx >= 5 && Math.random() < 0.3) continue;
    // 측정기기/공구 등 저빈도 제품은 매일 출고 안 될 수 있음
    if (product.일평균판매량 < 3 && Math.random() < 0.4) continue;

    const dayFactor = DAY_FACTORS[dayIdx];
    const baseQty = product.일평균판매량 * dayFactor * randFloat(0.6, 1.4, 1);
    const quantity = Math.max(1, Math.round(baseQty));
    const channel = CHANNELS[rand(0, CHANNELS.length - 1)];
    const totalAmount = quantity * product.판매단가;

    outboundData.push({
      No: outboundSeq++,
      판매일: DATES[dayIdx],
      SKU: product.SKU,
      제품명: product.제품명,
      카테고리: product.카테고리,
      판매수량: quantity,
      판매단가: product.판매단가,
      판매금액: totalAmount,
      판매채널: channel,
      비고: "",
    });
  }
}

console.log(`출고(판매) 데이터: ${outboundData.length}건 생성`);

// ─── 4. 엑셀 파일 생성 ──────────────────────────────
function createWorkbook(data, sheetName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // 열 너비 자동 조정
  const colWidths = Object.keys(data[0]).map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...data.slice(0, 100).map((row) => String(row[key] || "").length)
    );
    return { wch: Math.min(maxLen + 2, 30) };
  });
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

const outputDir = "d:/Claude work/website/scripts/test-data";
const fs = require("fs");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 제품 마스터
const wbProducts = createWorkbook(productsList, "제품마스터");
XLSX.writeFile(wbProducts, `${outputDir}/01_제품마스터_100SKU.xlsx`);
console.log("✅ 01_제품마스터_100SKU.xlsx 생성 완료");

// 입고 데이터
const wbInbound = createWorkbook(inboundData, "입고데이터");
XLSX.writeFile(wbInbound, `${outputDir}/02_입고데이터_7일.xlsx`);
console.log("✅ 02_입고데이터_7일.xlsx 생성 완료");

// 출고(판매) 데이터
const wbOutbound = createWorkbook(outboundData, "출고데이터");
XLSX.writeFile(wbOutbound, `${outputDir}/03_출고데이터_7일.xlsx`);
console.log("✅ 03_출고데이터_7일.xlsx 생성 완료");

// ─── 5. 요약 출력 ──────────────────────────────────
console.log("\n═══════════════════════════════════════");
console.log("  FloStok 검증용 테스트 데이터 요약");
console.log("═══════════════════════════════════════");
console.log(`📦 제품 마스터: ${productsList.length} SKU (${CATEGORIES.length}개 카테고리)`);
console.log(`📥 입고 데이터: ${inboundData.length}건 (${DATES[0]} ~ ${DATES[6]})`);
console.log(`📤 출고 데이터: ${outboundData.length}건 (${DATES[0]} ~ ${DATES[6]})`);
console.log(`\n카테고리별 SKU:`);
for (const cat of CATEGORIES) {
  console.log(`  ${cat.category}: ${cat.items.length}개`);
}
console.log(`\n📁 파일 위치: ${outputDir}/`);
console.log("═══════════════════════════════════════");
