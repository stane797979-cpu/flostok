/**
 * V4 데이터 초기화 + 재업로드 스크립트
 * 실행: node scripts/seed-v4.js
 */

const { Pool } = require("pg");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const DATABASE_URL = "postgresql://postgres.hcduybfzxobkqqjqaltm:SmartProcure2026Secure@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const DATA_DIR = path.resolve(__dirname, "../data-kkumvi");

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function readXlsx(filename) {
  const wb = XLSX.readFile(path.join(DATA_DIR, filename));
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: "" });
}

function dateStr(v) {
  if (!v) return new Date().toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function num(v, def = 0) {
  const n = Number(String(v).replace(/,/g, "").trim());
  return isNaN(n) ? def : n;
}

function classifyStatus(currentStock, safetyStock, reorderPoint) {
  if (currentStock === 0) return "out_of_stock";
  if (currentStock < safetyStock * 0.5) return "critical";
  if (currentStock < safetyStock) return "shortage";
  if (currentStock < reorderPoint) return "caution";
  if (currentStock < safetyStock * 3.0) return "optimal";
  if (currentStock < safetyStock * 5.0) return "excess";
  return "overstock";
}

async function main() {
  const client = await pool.connect();
  try {
    // ── 0. 조직 ID 조회 ────────────────────────────────────────────────────
    const orgId = "836007fe-007b-4f73-af91-78cca38d305d";
    console.log("조직 ID:", orgId);

    // ── 1. 기존 데이터 삭제 ────────────────────────────────────────────────
    console.log("\n[1] 기존 데이터 삭제 중...");
    await client.query(`DELETE FROM inventory_history WHERE organization_id = $1`, [orgId]);
    await client.query(`DELETE FROM inventory_lots WHERE organization_id = $1`, [orgId]);
    await client.query(`DELETE FROM inbound_records WHERE organization_id = $1`, [orgId]);
    await client.query(`DELETE FROM sales_records WHERE organization_id = $1`, [orgId]);
    await client.query(`DELETE FROM inventory WHERE organization_id = $1`, [orgId]);
    await client.query(`DELETE FROM supplier_products WHERE supplier_id IN (SELECT id FROM suppliers WHERE organization_id = $1)`, [orgId]);
    await client.query(`DELETE FROM products WHERE organization_id = $1`, [orgId]);
    console.log("  삭제 완료");

    // ── 1.5. 공급자 ID 매핑 로드 ───────────────────────────────────────────
    const supplierRes = await client.query(`SELECT id, name FROM suppliers WHERE organization_id = $1`, [orgId]);
    // suppliers 테이블에서 name 컬럼에 코드(SUP-KV-001)가 저장되어 있음
    const supCodeToId = new Map(supplierRes.rows.map(r => [r.name, r.id]));

    // 제품마스터의 공급업체코드 → supplier_id 매핑 준비
    const productSupplierMap = new Map(); // sku → supplierId

    // ── 2. 제품마스터 ──────────────────────────────────────────────────────
    console.log("\n[2] 제품마스터 업로드...");
    const productRows = readXlsx("01_제품마스터_V4.xlsx");
    const productIdMap = new Map(); // sku → { id, safetyStock, reorderPoint }

    for (const row of productRows) {
      const sku = String(row["SKU"] || "").trim();
      if (!sku) continue;
      const safetyStock = num(row["안전재고"]);
      const reorderPoint = num(row["발주점"]);
      const currentStock = num(row["재고수량"]);
      const status = classifyStatus(currentStock, safetyStock, reorderPoint);

      const res = await client.query(
        `INSERT INTO products (organization_id, sku, name, category, unit, unit_price, cost_price, safety_stock, reorder_point, lead_time, moq)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          orgId, sku,
          String(row["제품명"] || "").trim(),
          String(row["카테고리"] || "").trim() || null,
          String(row["단위"] || "EA").trim(),
          num(row["판매단가"]),
          num(row["원가"]),
          safetyStock,
          reorderPoint,
          num(row["리드타임"], 7),
          num(row["MOQ"], 1),
        ]
      );
      const productId = res.rows[0].id;
      productIdMap.set(sku, { id: productId, safetyStock, reorderPoint });

      // 공급업체 코드 저장
      const supCode = String(row["공급업체코드"] || "").trim();
      if (supCode) productSupplierMap.set(sku, supCode);

      // inventory 생성
      await client.query(
        `INSERT INTO inventory (organization_id, product_id, current_stock, available_stock, reserved_stock, incoming_stock, status)
         VALUES ($1,$2,$3,$3,0,0,$4)`,
        [orgId, productId, currentStock, status]
      );
    }
    console.log(`  ${productIdMap.size}개 제품 등록`);

    // ── 2.5. 공급자-제품 연결 ──────────────────────────────────────────────
    console.log("\n[2.5] 공급자-제품 연결...");
    let supLinkCount = 0;
    for (const [sku, supCode] of productSupplierMap.entries()) {
      const supId = supCodeToId.get(supCode);
      if (!supId) { console.warn(`  공급자 코드 없음: ${supCode}`); continue; }
      const prod = productIdMap.get(sku);
      if (!prod) continue;

      // primary_supplier_id 업데이트
      await client.query(`UPDATE products SET primary_supplier_id = $1 WHERE id = $2`, [supId, prod.id]);

      // supplier_products 삽입
      const existing = await client.query(
        `SELECT id FROM supplier_products WHERE supplier_id = $1 AND product_id = $2`,
        [supId, prod.id]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO supplier_products (supplier_id, product_id, unit_price, lead_time) VALUES ($1, $2, 0, 7)`,
          [supId, prod.id]
        );
      }
      supLinkCount++;
    }
    console.log(`  ${supLinkCount}개 제품 공급자 연결 완료`);

    // ── 3. 입고 데이터 ─────────────────────────────────────────────────────
    console.log("\n[3] 입고 데이터 업로드...");
    const inboundRows = readXlsx("03_입고데이터_1년_V4.xlsx");

    // 제품별 누적 재고 추적 (inventory_history용)
    const runningStock = new Map();
    for (const [sku, p] of productIdMap) {
      // 현재 initStock은 제품마스터에서 읽음
      const prodRows = readXlsx("01_제품마스터_V4.xlsx");
      const pr = prodRows.find(r => String(r["SKU"]).trim() === sku);
      runningStock.set(p.id, pr ? num(pr["재고수량"]) : 0);
    }

    let inboundCount = 0;
    for (const row of inboundRows) {
      const sku = String(row["SKU"] || "").trim();
      const prod = productIdMap.get(sku);
      if (!prod) { console.warn(`  SKU 없음: ${sku}`); continue; }

      const qty = num(row["입고수량"] || row["발주수량"]);
      if (qty <= 0) continue;

      const inboundDate = dateStr(row["실제입고일"] || row["입고일"] || row["날짜"]);
      const lotNum = String(row["LOT번호"] || `AUTO-${inboundDate.replace(/-/g,"")}-${Math.random().toString(36).slice(2,7)}`).trim();
      const poNum = String(row["발주번호"] || "").trim() || null;

      // inbound_records
      const recRes = await client.query(
        `INSERT INTO inbound_records (organization_id, product_id, date, expected_quantity, received_quantity, accepted_quantity, rejected_quantity, quality_result, location, lot_number, notes)
         VALUES ($1,$2,$3,$4,$4,$4,0,'pass',$5,$6,$7)
         RETURNING id`,
        [
          orgId, prod.id, inboundDate, qty,
          String(row["적치위치"] || "").trim() || null,
          lotNum,
          poNum ? `발주번호: ${poNum}` : "엑셀 일괄 입고",
        ]
      );
      const recId = recRes.rows[0].id;

      // inventory_lots
      await client.query(
        `INSERT INTO inventory_lots (organization_id, product_id, lot_number, initial_quantity, remaining_quantity, inbound_record_id, received_date, status)
         VALUES ($1,$2,$3,$4,$4,$5,$6,'active')`,
        [orgId, prod.id, lotNum, qty, recId, inboundDate]
      );

      // inventory_history (실제 입고일로)
      const before = runningStock.get(prod.id) ?? 0;
      const after = before + qty;
      await client.query(
        `INSERT INTO inventory_history (organization_id, product_id, date, stock_before, stock_after, change_amount, change_type, notes)
         VALUES ($1,$2,$3,$4,$5,$6,'INBOUND_ADJUSTMENT',$7)`,
        [orgId, prod.id, inboundDate, before, after, qty, "엑셀 일괄 입고"]
      );
      runningStock.set(prod.id, after);
      inboundCount++;
    }
    console.log(`  ${inboundCount}건 입고 등록`);

    // ── 4. inventory 현재고 업데이트 (입고 반영) ──────────────────────────
    console.log("\n[4] 재고 현황 업데이트...");
    for (const [, prod] of productIdMap) {
      const finalStock = runningStock.get(prod.id) ?? 0;
      const status = classifyStatus(finalStock, prod.safetyStock, prod.reorderPoint);
      await client.query(
        `UPDATE inventory SET current_stock=$1, available_stock=$1, reserved_stock=0, status=$2, updated_at=NOW()
         WHERE organization_id=$3 AND product_id=$4`,
        [finalStock, status, orgId, prod.id]
      );
    }
    console.log("  재고 업데이트 완료");

    // ── 5. 출고 데이터 ─────────────────────────────────────────────────────
    console.log("\n[5] 출고 데이터 업로드...");
    const outboundRows = readXlsx("04_출고데이터_1년_V4.xlsx");

    const OUTBOUND_TYPE_MAP = {
      "판매": "OUTBOUND_SALE", "판매출고": "OUTBOUND_SALE",
      "폐기": "OUTBOUND_DISPOSAL",
      "이동": "OUTBOUND_TRANSFER", "이동출고": "OUTBOUND_TRANSFER",
      "손망실": "OUTBOUND_LOSS",
      "반품": "OUTBOUND_RETURN", "반품출고": "OUTBOUND_RETURN",
      "샘플": "OUTBOUND_SAMPLE", "샘플출고": "OUTBOUND_SAMPLE",
      "조정": "OUTBOUND_ADJUSTMENT", "조정출고": "OUTBOUND_ADJUSTMENT",
    };

    // 500행씩 배치 insert
    const CHUNK = 500;
    let outboundCount = 0;
    const toInsert = [];

    for (const row of outboundRows) {
      const sku = String(row["SKU"] || "").trim();
      const prod = productIdMap.get(sku);
      if (!prod) continue;

      const qty = num(row["수량"]);
      if (qty <= 0) continue;

      const saleDate = dateStr(row["날짜"]);
      const unitPrice = num(row["단가"]);
      const channel = String(row["채널"] || "").trim() || null;
      const outboundType = String(row["출고유형"] || "판매").trim();
      const outboundNumber = String(row["출고번호"] || "").trim() || null;
      const notes = String(row["비고"] || "").trim() || null;

      toInsert.push([
        orgId, prod.id, saleDate, qty, unitPrice, qty * unitPrice,
        channel, notes, outboundNumber,
      ]);
    }

    // 출고 수량 합산 (제품별)
    const outboundQtyMap = new Map();
    for (const row of toInsert) {
      const prodId = row[1];
      const qty = row[3];
      outboundQtyMap.set(prodId, (outboundQtyMap.get(prodId) || 0) + qty);
    }

    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const placeholders = chunk.map((_, idx) => {
        const base = idx * 9;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9})`;
      }).join(",");
      const values = chunk.flat();
      await client.query(
        `INSERT INTO sales_records (organization_id, product_id, date, quantity, unit_price, total_amount, channel, notes, outbound_number)
         VALUES ${placeholders}`,
        values
      );
      outboundCount += chunk.length;
      process.stdout.write(`\r  ${outboundCount}/${toInsert.length}건 처리 중...`);
    }
    console.log(`\n  ${outboundCount}건 출고 등록`);

    // ── 6. 출고 반영하여 최종 재고 업데이트 ──────────────────────────────
    console.log("\n[6] 출고 차감 후 최종 재고 업데이트...");
    for (const [, prod] of productIdMap) {
      const totalInbound = runningStock.get(prod.id) ?? 0;
      const totalOutbound = outboundQtyMap.get(prod.id) ?? 0;
      const finalStock = Math.max(0, totalInbound - totalOutbound);
      const status = classifyStatus(finalStock, prod.safetyStock, prod.reorderPoint);
      await client.query(
        `UPDATE inventory SET current_stock=$1, available_stock=$1, reserved_stock=0, status=$2, updated_at=NOW()
         WHERE organization_id=$3 AND product_id=$4`,
        [finalStock, status, orgId, prod.id]
      );
    }
    console.log("  완료");

    // ── 7. 최종 재고상태 확인 ──────────────────────────────────────────────
    console.log("\n[7] 최종 재고 현황:");
    const invRes = await client.query(
      `SELECT p.sku, i.current_stock, i.status, p.safety_stock, p.reorder_point
       FROM inventory i JOIN products p ON i.product_id = p.id
       WHERE i.organization_id = $1 ORDER BY p.sku`,
      [orgId]
    );
    for (const r of invRes.rows) {
      console.log(`  ${r.sku}: 현재고 ${r.current_stock} | 안전재고 ${r.safety_stock} | 발주점 ${r.reorder_point} | 상태: ${r.status}`);
    }

    console.log("\n완료!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
