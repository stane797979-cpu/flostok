import { db } from "../index";
import { sql } from "drizzle-orm";

async function main() {
  const r = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public'
    ORDER BY table_name
  `);
  console.log("테이블 목록:", JSON.stringify(r));

  const cols = await db.execute(sql`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name='inventory'
    ORDER BY ordinal_position
  `);
  console.log("\ninventory 컬럼:", JSON.stringify(cols));
  process.exit(0);
}

main().catch(console.error);
