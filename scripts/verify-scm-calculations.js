/**
 * SCM 산출값 DB 검증 스크립트
 * 실제 DB에 저장된 safetyStock, reorderPoint 값을
 * 공식으로 역산한 값과 비교합니다.
 *
 * 실행: node scripts/verify-scm-calculations.js
 */

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.hcduybfzxobkqqjqaltm:SmartProcure2026Secure@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

const ORG = "836007fe-007b-4f73-af91-78cca38d305d";

// ── 산출 함수 (safety-stock.ts, reorder-point.ts 동일 로직) ──────────────

function getZScore(serviceLevel) {
  const table = { 0.9:1.28, 0.91:1.34, 0.92:1.41, 0.93:1.48, 0.94:1.55,
    0.95:1.65, 0.96:1.75, 0.97:1.88, 0.98:2.05, 0.99:2.33, 0.995:2.58, 0.999:3.09 };
  if (serviceLevel < 0.9) return 1.28;
  if (serviceLevel >= 0.999) return 3.09;
  const rounded = Math.round(serviceLevel * 1000) / 1000;
  if (table[rounded]) return table[rounded];
  const levels = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < levels.length - 1; i++) {
    if (serviceLevel >= levels[i] && serviceLevel < levels[i + 1]) {
      const ratio = (serviceLevel - levels[i]) / (levels[i + 1] - levels[i]);
      return table[levels[i]] + ratio * (table[levels[i + 1]] - table[levels[i]]);
    }
  }
  return 1.65;
}

function calcSafetyStock(avgDemand, demandStdDev, leadTimeDays, leadTimeStdDev, serviceLevel) {
  const z = getZScore(serviceLevel || 0.95);
  if (leadTimeStdDev > 0) {
    return Math.ceil(z * Math.sqrt(leadTimeDays * demandStdDev ** 2 + avgDemand ** 2 * leadTimeStdDev ** 2));
  }
  return Math.ceil(z * demandStdDev * Math.sqrt(leadTimeDays));
}

function calcROP(avgDemand, leadTimeDays, safetyStock) {
  return Math.ceil(avgDemand * leadTimeDays) + safetyStock;
}

// ── 색상 출력 ──────────────────────────────────────────────────────────────
const C = { green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m" };
const ok  = (s) => `${C.green}✓${C.reset} ${s}`;
const ng  = (s) => `${C.red}✗${C.reset} ${s}`;
const warn = (s) => `${C.yellow}△${C.reset} ${s}`;

// ── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  try {
    console.log(`\n${C.bold}=== SCM 산출값 DB 검증 ===${C.reset}\n`);

    // 1. 제품 + 최근 90일 일평균 판매량 집계
    const { rows } = await client.query(`
      SELECT
        p.id, p.sku, p.name,
        p.safety_stock, p.reorder_point,
        COALESCE(p.lead_time, 7)           AS lead_time_days,
        COALESCE(p.lead_time_stddev, 0)    AS lead_time_std_dev,
        -- 최근 90일 일평균 판매량
        COALESCE(
          (SELECT SUM(sr.quantity)::numeric / 90
           FROM sales_records sr
           WHERE sr.product_id = p.id
             AND sr.organization_id = $1
             AND sr.date >= NOW() - INTERVAL '90 days'),
          0
        ) AS avg_demand,
        -- 일평균의 표준편차 (월별 집계 기반)
        COALESCE(
          (SELECT STDDEV(monthly_qty)
           FROM (
             SELECT DATE_TRUNC('month', sr.date) AS mo,
                    SUM(sr.quantity)::numeric / 30 AS monthly_qty
             FROM sales_records sr
             WHERE sr.product_id = p.id
               AND sr.organization_id = $1
               AND sr.date >= NOW() - INTERVAL '180 days'
             GROUP BY 1
           ) sub),
          0
        ) AS demand_std_dev
      FROM products p
      WHERE p.organization_id = $1
        AND p.safety_stock > 0
        AND p.reorder_point > 0
      ORDER BY p.sku
    `, [ORG]);

    if (rows.length === 0) {
      console.log(warn("검증할 품목이 없습니다. safety_stock 또는 reorder_point가 설정된 품목이 없습니다."));
      return;
    }

    console.log(`${C.dim}총 ${rows.length}개 품목 검증${C.reset}\n`);
    console.log(
      "SKU".padEnd(16),
      "제품명".padEnd(24),
      "안전재고(DB)".padStart(10),
      "산출값".padStart(8),
      "차이".padStart(6),
      "ROP(DB)".padStart(10),
      "ROP산출".padStart(8),
      "차이".padStart(6)
    );
    console.log("─".repeat(100));

    let ssOk = 0, ssNg = 0, ropOk = 0, ropNg = 0, skipped = 0;
    const issues = [];

    for (const r of rows) {
      const avgDemand = parseFloat(r.avg_demand) || 0;
      const stdDev    = parseFloat(r.demand_std_dev) || 0;
      const ltDays    = parseInt(r.lead_time_days) || 0;
      const ltStdDev  = parseFloat(r.lead_time_std_dev) || 0;
      const sl        = parseFloat(r.service_level) || 0.95;
      const dbSS      = parseInt(r.safety_stock);
      const dbROP     = parseInt(r.reorder_point);

      if (avgDemand === 0 || stdDev === 0 || ltDays === 0) {
        skipped++;
        console.log(
          r.sku.padEnd(16),
          r.name.substring(0, 22).padEnd(24),
          String(dbSS).padStart(10),
          "N/A".padStart(8),
          "-".padStart(6),
          String(dbROP).padStart(10),
          "N/A".padStart(8),
          `${C.dim}(데이터 부족)${C.reset}`.padStart(6)
        );
        continue;
      }

      const calcSS  = calcSafetyStock(avgDemand, stdDev, ltDays, ltStdDev, sl);
      const calcRop = calcROP(avgDemand, ltDays, dbSS); // ROP는 설정된 SS 기준
      const ssDiff  = dbSS - calcSS;
      const ropDiff = dbROP - calcRop;

      const ssMatch  = Math.abs(ssDiff) <= 5;  // 5개 이내 오차 허용
      const ropMatch = Math.abs(ropDiff) <= 5;

      if (ssMatch) ssOk++; else { ssNg++; issues.push({ sku: r.sku, name: r.name, type: "안전재고", db: dbSS, calc: calcSS, diff: ssDiff }); }
      if (ropMatch) ropOk++; else { ropNg++; issues.push({ sku: r.sku, name: r.name, type: "ROP", db: dbROP, calc: calcRop, diff: ropDiff }); }

      const ssIcon  = ssMatch  ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
      const ropIcon = ropMatch ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;

      console.log(
        r.sku.padEnd(16),
        r.name.substring(0, 22).padEnd(24),
        String(dbSS).padStart(10),
        String(calcSS).padStart(8),
        `${ssIcon}${ssDiff >= 0 ? "+" : ""}${ssDiff}`.padStart(8),
        String(dbROP).padStart(10),
        String(calcRop).padStart(8),
        `${ropIcon}${ropDiff >= 0 ? "+" : ""}${ropDiff}`.padStart(8),
      );
    }

    // 요약
    console.log("\n" + "─".repeat(100));
    console.log(`\n${C.bold}[ 검증 결과 요약 ]${C.reset}`);
    console.log(`  안전재고: ${C.green}일치 ${ssOk}건${C.reset} / ${C.red}불일치 ${ssNg}건${C.reset} / ${C.dim}데이터부족 ${skipped}건${C.reset}`);
    console.log(`  재발주점: ${C.green}일치 ${ropOk}건${C.reset} / ${C.red}불일치 ${ropNg}건${C.reset}`);

    if (issues.length > 0) {
      console.log(`\n${C.yellow}[ 불일치 상세 (오차 5 초과) ]${C.reset}`);
      for (const issue of issues) {
        console.log(`  ${issue.sku} ${issue.name} — ${issue.type}: DB ${issue.db} / 산출 ${issue.calc} (차이 ${issue.diff >= 0 ? "+" : ""}${issue.diff})`);
        if (Math.abs(issue.diff) > 20) {
          console.log(`    ${C.red}→ 수동 조정 또는 공식 파라미터 불일치 가능성${C.reset}`);
        } else {
          console.log(`    ${C.dim}→ 소폭 조정 (반올림 방식 차이 또는 수동 미세조정)${C.reset}`);
        }
      }
    } else if (ssNg === 0 && ropNg === 0) {
      console.log(`\n${C.green}${C.bold}모든 품목 산출값 정합성 확인 완료${C.reset}`);
    }

    console.log();

  } catch (err) {
    console.error(`${C.red}오류:${C.reset}`, err.message);
    if (err.message.includes("column") || err.message.includes("does not exist")) {
      console.log(`\n${C.yellow}힌트: demand_std_dev, lead_time_std_dev 컬럼이 없을 수 있습니다.${C.reset}`);
      console.log("products 테이블 컬럼 확인 후 쿼리를 수정하세요.");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main();
