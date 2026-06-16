/**
 * 수요예측 테스트 스크립트
 * test1 (12개월 랜덤 100~1000)
 */

// ── 랜덤 데이터 생성 (100~1000 정수) ─────────────────────
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const TEST1 = Array.from({ length: 12 }, () => randInt(100, 1000));
const TEST2 = TEST1.slice(6);   // 후반 6개월
const TEST3 = TEST1.slice(9);   // 후반 3개월

const PERIODS = 3; // 3개월 예측

// ── SMA (3개월 슬라이딩) ──────────────────────────────────
function sma(history, periods) {
  const window = 3;

  // 슬라이딩으로 각 월 예측 → MAPE 계산
  const predictions = [];
  const actuals = [];
  for (let i = window; i < history.length; i++) {
    const slice = history.slice(i - window, i);
    const pred = slice.reduce((s, v) => s + v, 0) / window;
    predictions.push(Math.round(pred * 100) / 100);
    actuals.push(history[i]);
  }

  // 다음 N개월 예측 (마지막 3개월 슬라이딩)
  const extended = [...history];
  const forecast = [];
  for (let i = 0; i < periods; i++) {
    const slice = extended.slice(-window);
    const pred = Math.round((slice.reduce((s, v) => s + v, 0) / window) * 100) / 100;
    forecast.push(pred);
    extended.push(pred);
  }

  // MAPE
  const mapeVal = actuals.length === 0 ? null :
    actuals.reduce((s, a, i) => a !== 0 ? s + Math.abs(a - predictions[i]) / a : s, 0) / actuals.length * 100;

  return { window, predictions, actuals, forecast, mapeVal };
}

// ── SES ──────────────────────────────────────────────────
function getAlphaByCV(history) {
  if (history.length < 2) return 0.3;
  const mean = history.reduce((s, v) => s + v, 0) / history.length;
  if (mean === 0) return 0.3;
  const mad = history.reduce((s, v) => s + Math.abs(v - mean), 0) / history.length;
  const cv = (1.25 * mad) / mean;
  if (cv < 0.2) return 0.6;
  if (cv <= 0.5) return 0.4;
  return 0.2;
}

function optimizeAlpha(history, testSize = 3) {
  if (history.length < testSize + 3) return getAlphaByCV(history);
  const train = history.slice(0, -testSize);
  const test = history.slice(-testSize);
  const candidates = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9];
  let bestAlpha = 0.3, bestMape = Infinity;
  for (const a of candidates) {
    let s = train[0];
    for (let i = 1; i < train.length; i++) s = a * train[i] + (1-a) * s;
    const preds = Array(testSize).fill(s);
    const mape = test.reduce((sum, actual, i) =>
      actual !== 0 ? sum + Math.abs(actual - preds[i]) / actual : sum, 0) / testSize * 100;
    if (isFinite(mape) && mape < bestMape) { bestMape = mape; bestAlpha = a; }
  }
  return bestAlpha;
}

function ses(history, periods) {
  const alpha = history.length >= 6 ? optimizeAlpha(history) : 0.3;
  let s = history[0];
  for (let i = 1; i < history.length; i++) s = alpha * history[i] + (1-alpha) * s;
  const forecast = Array(periods).fill(Math.round(s * 100) / 100);
  return { alpha, lastSmoothed: Math.round(s*100)/100, forecast };
}

// ── Holt's ───────────────────────────────────────────────
function holts(history, periods, alpha = 0.3, beta = 0.1) {
  if (history.length < 4) return { alpha, beta, forecast: Array(periods).fill(history[history.length-1]), note: "데이터 부족" };
  let L = history[0];
  let T = history[1] - history[0];
  for (let i = 1; i < history.length; i++) {
    const prevL = L;
    L = alpha * history[i] + (1-alpha) * (L + T);
    T = beta * (L - prevL) + (1-beta) * T;
  }
  const forecast = Array.from({length: periods}, (_, h) =>
    Math.round((L + (h+1)*T) * 100) / 100
  );
  return { alpha, beta, level: Math.round(L*100)/100, trend: Math.round(T*100)/100, forecast };
}

// ── MAPE 포맷 ────────────────────────────────────────────
function formatMape(val) {
  if (val === null || !isFinite(val)) return "-";
  return val.toFixed(1) + "%";
}

// ── SES MAPE (슬라이딩) ───────────────────────────────────
function calcSlidingMape(history, predictFn, window = 3) {
  let sum = 0, count = 0;
  for (let i = window; i < history.length; i++) {
    const pred = predictFn(history.slice(0, i));
    const actual = history[i];
    if (actual !== 0) { sum += Math.abs(actual - pred) / actual; count++; }
  }
  return count === 0 ? null : sum / count * 100;
}

// ── 실행 ─────────────────────────────────────────────────
const datasets = [
  { name: "test1 (12개월)", data: TEST1 },
  { name: "test2 (6개월)",  data: TEST2 },
  { name: "test3 (3개월)",  data: TEST3 },
];

console.log("=".repeat(90));
console.log("수요예측 테스트 결과 (랜덤 100~1000, 3개월 슬라이딩 이동평균)");
console.log("=".repeat(90));
console.log(`\n12개월 원본 데이터: [${TEST1.join(", ")}]`);
console.log(`test2 (후반 6개월): [${TEST2.join(", ")}]`);
console.log(`test3 (후반 3개월): [${TEST3.join(", ")}]`);

for (const { name, data } of datasets) {
  console.log(`\n${"▶"} ${name}`);
  console.log("-".repeat(70));

  const r1 = sma(data, PERIODS);
  const r2 = ses(data, PERIODS);
  const r3 = holts(data, PERIODS);

  // SES 슬라이딩 MAPE
  const sesMape = calcSlidingMape(data, (hist) => {
    let s = hist[0];
    const a = hist.length >= 6 ? optimizeAlpha(hist) : 0.3;
    for (let i = 1; i < hist.length; i++) s = a * hist[i] + (1-a) * s;
    return s;
  });

  // Holt's 슬라이딩 MAPE
  const holtsMape = data.length >= 4 ? calcSlidingMape(data, (hist) => {
    if (hist.length < 4) return hist[hist.length-1];
    let L = hist[0], T = hist[1] - hist[0];
    for (let i = 1; i < hist.length; i++) {
      const pL = L;
      L = 0.3 * hist[i] + 0.7 * (L + T);
      T = 0.1 * (L - pL) + 0.9 * T;
    }
    return L + T;
  }) : null;

  // SMA 슬라이딩 내역 출력
  if (data.length > 3) {
    console.log(`[SMA 슬라이딩 내역] window=3`);
    for (let i = 0; i < r1.actuals.length; i++) {
      const month = i + 4; // 4번째 월부터
      console.log(`  ${month}월: 예측=${r1.predictions[i].toFixed(0).padStart(4)}  실제=${String(r1.actuals[i]).padStart(4)}  오차율=${(Math.abs(r1.actuals[i]-r1.predictions[i])/r1.actuals[i]*100).toFixed(1)}%`);
    }
  }

  console.log(`[SMA]    window=3  다음예측=${r1.forecast.join(", ")}  MAPE=${formatMape(r1.mapeVal)}`);
  console.log(`[SES]    α=${r2.alpha}  다음예측=${r2.forecast.join(", ")}  MAPE=${formatMape(sesMape)}`);
  if (r3.note) {
    console.log(`[Holt's] ${r3.note}  다음예측=${r3.forecast.join(", ")}`);
  } else {
    console.log(`[Holt's] α=${r3.alpha} β=${r3.beta}  수준=${r3.level} 추세=${r3.trend}  다음예측=${r3.forecast.join(", ")}  MAPE=${formatMape(holtsMape)}`);
  }
}

console.log("\n" + "=".repeat(90));
console.log("요약 표");
console.log("=".repeat(90));
console.log("상품\t\t방법\t\t파라미터\t\t예측(+1월)\t예측(+2월)\t예측(+3월)\tMAPE");
console.log("-".repeat(90));

for (const { name, data } of datasets) {
  const r1 = sma(data, PERIODS);
  const r2 = ses(data, PERIODS);
  const r3 = holts(data, PERIODS);
  const tag = name.split(" ")[0];

  const sesMape = calcSlidingMape(data, (hist) => {
    let s = hist[0];
    const a = hist.length >= 6 ? optimizeAlpha(hist) : 0.3;
    for (let i = 1; i < hist.length; i++) s = a * hist[i] + (1-a) * s;
    return s;
  });
  const holtsMape = data.length >= 4 ? calcSlidingMape(data, (hist) => {
    if (hist.length < 4) return hist[hist.length-1];
    let L = hist[0], T = hist[1] - hist[0];
    for (let i = 1; i < hist.length; i++) {
      const pL = L; L = 0.3 * hist[i] + 0.7 * (L + T); T = 0.1 * (L - pL) + 0.9 * T;
    }
    return L + T;
  }) : null;

  console.log(`${tag}\t\tSMA\t\twindow=3\t\t${r1.forecast[0]}\t\t${r1.forecast[1]}\t\t${r1.forecast[2]}\t\t${formatMape(r1.mapeVal)}`);
  console.log(`${tag}\t\tSES\t\tα=${r2.alpha}\t\t\t${r2.forecast[0]}\t\t${r2.forecast[1]}\t\t${r2.forecast[2]}\t\t${formatMape(sesMape)}`);
  console.log(`${tag}\t\tHolt's\t\tα=${r3.alpha} β=${r3.beta}\t\t${r3.forecast[0]}\t\t${r3.forecast[1]}\t\t${r3.forecast[2]}\t\t${r3.note ?? formatMape(holtsMape)}`);
  console.log("-".repeat(90));
}
