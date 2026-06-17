const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.hcduybfzxobkqqjqaltm:SmartProcure2026Secure@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});
const ORG = "836007fe-007b-4f73-af91-78cca38d305d";
async function main() {
  const client = await pool.connect();
  try {
    const r1 = await client.query(
      "SELECT status, count(*) FROM inventory WHERE organization_id=$1 GROUP BY status", [ORG]
    );
    console.log("inventory status 집계:", r1.rows);

    const r2 = await client.query(
      `SELECT p.sku, i.current_stock, i.status, p.safety_stock, p.reorder_point
       FROM inventory i JOIN products p ON i.product_id=p.id
       WHERE i.organization_id=$1 ORDER BY p.sku`, [ORG]
    );
    console.log("\nSKU별 재고:");
    for (const r of r2.rows) {
      console.log(`  ${r.sku}: stock=${r.current_stock} status=${r.status} safety=${r.safety_stock} reorder=${r.reorder_point}`);
    }
  } finally { client.release(); await pool.end(); }
}
main().catch(console.error);
