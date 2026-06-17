const ExcelJS = require("exceljs");

// 목표 등급 설계
// KV-CAR-001: 단가 298000 → A등급(고매출) + X등급(CV<0.3, 안정)
// KV-STR-002: 단가 189000 → A등급(고매출) + Y등급(CV 0.5~0.9, 계절변동)
// KV-BNC-003: 단가 159000 → B등급(중매출) + X등급(CV<0.3, 안정)
// KV-BED-004: 단가 135000 → B등급(중매출) + Z등급(CV>1.0, 불규칙/간헐)
// KV-STR-005: 단가  89000 → C등급(저매출) + Y등급(CV 0.5~0.9, 변동)

// ABC 등급은 총매출 기여도 기준 (상위80%=A, 80~95%=B, 95~100%=C)
// 목표 월평균 출고량:
//   KV-CAR-001: 120 (단가 높아서 매출 큼)
//   KV-STR-002: 100 (단가 높음)
//   KV-BNC-003:  60
//   KV-BED-004:  40
//   KV-STR-005:  80 (수량 많지만 단가 낮아 C)

// 월별 출고량 패턴 (12개월 + 현재월)
// 2025-07 ~ 2026-06

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rndNorm(mean, cv) {
  // Box-Muller
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(1, Math.round(mean + z * mean * cv));
}

const MONTHS = [
  "2025-07","2025-08","2025-09","2025-10","2025-11","2025-12",
  "2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"
];
const MONTH_DAYS = [31,31,30,31,30,31,31,28,31,30,31,17]; // 2026-06은 17일까지

// 제품별 월별 총 출고량 설계
function getMonthlyQty(sku, monthIdx) {
  switch(sku) {
    case "KV-CAR-001": // AX: 안정적 고매출, CV ~0.15
      return rndNorm(120, 0.12);
    
    case "KV-STR-002": // AY: 계절 변동, 여름/겨울 피크
      const seasonA = [1.0, 1.2, 0.9, 1.1, 1.4, 1.8, 0.6, 0.7, 0.8, 1.0, 1.3, 1.5];
      return rndNorm(100 * seasonA[monthIdx], 0.15);
    
    case "KV-BNC-003": // BX: 안정적 중매출
      return rndNorm(60, 0.12);
    
    case "KV-BED-004": // BZ: 불규칙, 간헐적 대량 주문
      const r = Math.random();
      if (r < 0.35) return 0; // 35% 확률로 무출고
      if (r < 0.55) return rnd(5, 15); // 소량
      if (r < 0.80) return rnd(30, 70); // 중간
      return rnd(100, 200); // 대량 스파이크
    
    case "KV-STR-005": // CY: 변동 있는 저매출(수량은 많지만 단가 낮아 C)
      const seasonC = [1.0, 0.8, 1.1, 1.0, 1.5, 1.3, 0.6, 0.7, 0.9, 1.1, 1.2, 1.0];
      return rndNorm(80 * seasonC[monthIdx], 0.30);
  }
  return 10;
}

const PRICES = {
  "KV-CAR-001": 298000,
  "KV-STR-002": 189000,
  "KV-BNC-003": 159000,
  "KV-BED-004": 135000,
  "KV-STR-005": 89000,
};

const CHANNELS = ["네이버스마트스토어","오프라인매장","자사몰","카카오쇼핑","쿠팡"];

async function main() {
  const outRows = [];

  for (let mi = 0; mi < MONTHS.length; mi++) {
    const [yr, mo] = MONTHS[mi].split("-").map(Number);
    const daysInMonth = MONTH_DAYS[mi];
    const skus = ["KV-CAR-001","KV-STR-002","KV-BNC-003","KV-BED-004","KV-STR-005"];

    for (const sku of skus) {
      const monthlyTotal = getMonthlyQty(sku, mi);
      if (monthlyTotal <= 0) continue;

      // 월 총량을 일별로 분산 (영업일 기준, 주말 제외)
      const bizDays = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(yr, mo-1, d).getDay();
        if (dow !== 0 && dow !== 6) bizDays.push(d);
      }

      // 출고 발생 일수 (총 영업일의 60~80%)
      const activeDays = Math.max(1, Math.round(bizDays.length * (0.6 + Math.random() * 0.2)));
      const selectedDays = bizDays.sort(() => Math.random()-0.5).slice(0, activeDays).sort((a,b)=>a-b);

      // 각 날짜에 수량 배분
      let remaining = monthlyTotal;
      for (let di = 0; di < selectedDays.length; di++) {
        const d = selectedDays[di];
        const isLast = di === selectedDays.length - 1;
        const qty = isLast ? remaining : Math.max(1, Math.round(remaining * (0.5 + Math.random() * 0.3) / (selectedDays.length - di)));
        const actualQty = Math.min(qty, remaining);
        if (actualQty <= 0) break;
        remaining -= actualQty;

        const dateStr = `${yr}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const channel = CHANNELS[rnd(0, CHANNELS.length-1)];
        outRows.push({ SKU: sku, 날짜: dateStr, 수량: actualQty, 단가: PRICES[sku], 채널: channel, 출고유형: "판매", 비고: "" });
      }

      // 반품: 5% 확률로 소량 반품
      if (Math.random() < 0.05 && daysInMonth > 5) {
        const retDay = rnd(1, daysInMonth);
        const retQty = rnd(1, 3);
        const dateStr = `${yr}-${String(mo).padStart(2,"0")}-${String(retDay).padStart(2,"0")}`;
        outRows.push({ SKU: sku, 날짜: dateStr, 수량: retQty, 단가: 0, 채널: null, 출고유형: "반품", 비고: "고객 반품" });
      }
    }
  }

  // 날짜순 정렬
  outRows.sort((a,b) => a.날짜.localeCompare(b.날짜));

  // 검증: SKU별 월평균/CV 출력
  const monthly = {};
  for (const r of outRows) {
    if (r.출고유형 === "반품") continue;
    const ym = r.날짜.slice(0,7);
    if (!monthly[r.SKU]) monthly[r.SKU] = {};
    monthly[r.SKU][ym] = (monthly[r.SKU][ym] || 0) + r.수량;
  }
  console.log("=== SKU별 검증 ===");
  for (const sku of ["KV-CAR-001","KV-STR-002","KV-BNC-003","KV-BED-004","KV-STR-005"]) {
    const vals = Object.values(monthly[sku] || {}).filter(v => v > 0);
    if (!vals.length) { console.log(sku + ": 데이터없음"); continue; }
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    const variance = vals.reduce((a,b)=>a+Math.pow(b-avg,2),0)/vals.length;
    const cv = Math.sqrt(variance)/avg;
    const totalSales = vals.reduce((a,b)=>a+b,0) * PRICES[sku];
    console.log(`${sku} | 월평균: ${Math.round(avg)} | CV: ${cv.toFixed(2)} | 총매출: ${(totalSales/1000000).toFixed(1)}백만`);
  }

  // 엑셀 생성 (출고)
  const wb = new ExcelJS.Workbook();
  wb.creator = "Flostok";
  const ws = wb.addWorksheet("출고데이터");
  ws.columns = [
    { header: "SKU",    key: "SKU",    width: 14 },
    { header: "날짜",   key: "날짜",   width: 13 },
    { header: "수량",   key: "수량",   width: 8  },
    { header: "단가",   key: "단가",   width: 10 },
    { header: "채널",   key: "채널",   width: 18 },
    { header: "출고유형", key: "출고유형", width: 12 },
    { header: "비고",   key: "비고",   width: 16 },
  ];
  const hRow = ws.getRow(1);
  hRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  hRow.height = 22;
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  outRows.forEach((r, i) => {
    const row = ws.addRow(r);
    row.getCell(3).numFmt = "#,##0";
    row.getCell(4).numFmt = "#,##0";
    const isEven = i % 2 === 0;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" } };
      cell.font = { size: 10 };
      cell.border = { top:{style:"hair",color:{argb:"FFE2E8F0"}}, bottom:{style:"hair",color:{argb:"FFE2E8F0"}}, left:{style:"hair",color:{argb:"FFE2E8F0"}}, right:{style:"hair",color:{argb:"FFE2E8F0"}} };
    });
    row.height = 18;
  });

  await wb.xlsx.writeFile("C:/Users/나/Desktop/04_출고데이터_1년_v2.xlsx");
  console.log(`출고 완료: ${outRows.length}행`);

  // ===== 입고 데이터 =====
  // 출고 월별 합계 기준으로 입고 생성 (출고의 1.05~1.15배, 월 1~3회)
  const inRows = [];
  for (let mi = 0; mi < MONTHS.length; mi++) {
    const [yr, mo] = MONTHS[mi].split("-").map(Number);
    const skus = ["KV-CAR-001","KV-STR-002","KV-BNC-003","KV-BED-004","KV-STR-005"];

    for (const sku of skus) {
      const ym = MONTHS[mi];
      const soldQty = (monthly[sku] || {})[ym] || 0;
      if (soldQty <= 0 && sku === "KV-BED-004") continue; // BZ는 무출고 달엔 입고도 없음
      
      const targetInbound = soldQty > 0 ? Math.round(soldQty * (1.05 + Math.random() * 0.10)) : 0;
      if (targetInbound <= 0) continue;

      // 입고 횟수
      const times = sku === "KV-STR-005" ? 3 : sku === "KV-BED-004" ? 1 : 2;
      const daysInMonth = MONTH_DAYS[mi];
      let remaining = targetInbound;

      for (let t = 0; t < times; t++) {
        const day = Math.min(daysInMonth, rnd(1 + t * Math.floor(daysInMonth/times), Math.floor((t+1) * daysInMonth/times)));
        const qty = t === times-1 ? remaining : Math.round(remaining * (0.4 + Math.random()*0.2));
        if (qty <= 0) continue;
        remaining -= qty;
        const dateStr = `${yr}-${String(mo).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        inRows.push({ SKU: sku, 입고일: dateStr, 입고유형: "조정", 수량: qty, 적치위치: "", LOT번호: "", 유통기한: "", 비고: "기초재고 조정" });
      }
    }
  }

  inRows.sort((a,b) => a.입고일.localeCompare(b.입고일));

  const wb2 = new ExcelJS.Workbook();
  wb2.creator = "Flostok";
  const ws2 = wb2.addWorksheet("기타입고");
  ws2.columns = [
    { header: "SKU",    key: "SKU",    width: 14 },
    { header: "입고일", key: "입고일", width: 13 },
    { header: "입고유형", key: "입고유형", width: 12 },
    { header: "수량",   key: "수량",   width: 8  },
    { header: "적치위치", key: "적치위치", width: 12 },
    { header: "LOT번호", key: "LOT번호", width: 14 },
    { header: "유통기한", key: "유통기한", width: 12 },
    { header: "비고",   key: "비고",   width: 20 },
  ];
  const hRow2 = ws2.getRow(1);
  hRow2.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  hRow2.height = 22;
  ws2.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  inRows.forEach((r, i) => {
    const row = ws2.addRow(r);
    row.getCell(4).numFmt = "#,##0";
    const isEven = i % 2 === 0;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isEven ? "FFF8FAFC" : "FFFFFFFF" } };
      cell.font = { size: 10 };
      cell.border = { top:{style:"hair",color:{argb:"FFE2E8F0"}}, bottom:{style:"hair",color:{argb:"FFE2E8F0"}}, left:{style:"hair",color:{argb:"FFE2E8F0"}}, right:{style:"hair",color:{argb:"FFE2E8F0"}} };
    });
    row.height = 18;
  });

  await wb2.xlsx.writeFile("C:/Users/나/Desktop/03_입고데이터_1년_v2.xlsx");
  console.log(`입고 완료: ${inRows.length}행`);
}

main().catch(console.error);
