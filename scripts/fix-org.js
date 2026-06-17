const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.hcduybfzxobkqqjqaltm:SmartProcure2026Secure@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

const WRONG_ORG = "00000000-0000-0000-0000-000000000000";
const RIGHT_ORG = "836007fe-007b-4f73-af91-78cca38d305d";

async function main() {
  const client = await pool.connect();
  try {
    // 잘못된 조직 데이터 삭제
    console.log("[1] 잘못된 조직 데이터 삭제...");
    await client.query(`DELETE FROM inventory_history WHERE organization_id = $1`, [WRONG_ORG]);
    await client.query(`DELETE FROM inventory_lots WHERE organization_id = $1`, [WRONG_ORG]);
    await client.query(`DELETE FROM inbound_records WHERE organization_id = $1`, [WRONG_ORG]);
    await client.query(`DELETE FROM sales_records WHERE organization_id = $1`, [WRONG_ORG]);
    await client.query(`DELETE FROM inventory WHERE organization_id = $1`, [WRONG_ORG]);
    await client.query(`DELETE FROM products WHERE organization_id = $1`, [WRONG_ORG]);
    console.log("  완료");

    // 올바른 조직 데이터 확인
    console.log("\n[2] 올바른 조직 데이터 현황:");
    const inv = await client.query(
      `SELECT p.sku, i.current_stock, i.status, p.safety_stock, p.reorder_point
       FROM inventory i JOIN products p ON i.product_id = p.id
       WHERE i.organization_id = $1 ORDER BY p.sku`,
      [RIGHT_ORG]
    );
    for (const r of inv.rows) {
      console.log(`  ${r.sku}: 현재고 ${r.current_stock} | 안전재고 ${r.safety_stock} | 발주점 ${r.reorder_point} | 상태: ${r.status}`);
    }

    const srCount = await client.query(`SELECT count(*) FROM sales_records WHERE organization_id = $1`, [RIGHT_ORG]);
    const inCount = await client.query(`SELECT count(*) FROM inbound_records WHERE organization_id = $1`, [RIGHT_ORG]);
    console.log(`\n  출고: ${srCount.rows[0].count}건, 입고: ${inCount.rows[0].count}건`);

  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
