const { Pool } = require("pg");
const pool = new Pool({
  connectionString: "postgresql://postgres.hcduybfzxobkqqjqaltm:SmartProcure2026Secure@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});
async function main() {
  const client = await pool.connect();
  try {
    const orgs = await client.query("SELECT id, name FROM organizations ORDER BY created_at");
    console.log("조직 목록:");
    for (const r of orgs.rows) console.log(`  ${r.id}  ${r.name}`);

    const users = await client.query("SELECT u.id, u.email, u.organization_id, o.name as org_name FROM users u LEFT JOIN organizations o ON u.organization_id = o.id ORDER BY u.created_at");
    console.log("\n유저 목록:");
    for (const r of users.rows) console.log(`  ${r.email}  →  org: ${r.org_name} (${r.organization_id})`);

    const inv = await client.query("SELECT organization_id, count(*) FROM inventory GROUP BY organization_id");
    console.log("\n재고 데이터 조직별:");
    for (const r of inv.rows) console.log(`  ${r.organization_id}: ${r.count}건`);

    const sr = await client.query("SELECT organization_id, count(*) FROM sales_records GROUP BY organization_id");
    console.log("\n출고 데이터 조직별:");
    for (const r of sr.rows) console.log(`  ${r.organization_id}: ${r.count}건`);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
