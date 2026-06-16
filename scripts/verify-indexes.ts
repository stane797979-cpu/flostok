import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!);

async function verifyIndexes() {
  try {
    console.log('Checking created indexes...\n');

    const result = await sql`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE '%_org_%_idx'
          OR indexname LIKE '%_product_%_idx'
          OR indexname LIKE '%_po_idx'
          OR indexname LIKE '%_supplier_idx'
          OR indexname LIKE '%_status_idx'
          OR indexname LIKE '%_date_idx'
          OR indexname LIKE '%_grade_idx'
          OR indexname LIKE '%_category_idx'
        )
      ORDER BY tablename, indexname;
    `;

    console.log(`Found ${result.length} performance indexes:\n`);

    let currentTable = '';
    result.forEach((row: any) => {
      if (row.tablename !== currentTable) {
        if (currentTable !== '') console.log('');
        console.log(`📋 ${row.tablename}:`);
        currentTable = row.tablename;
      }
      console.log(`   ✓ ${row.indexname}`);
    });

    console.log(`\n✓ Total: ${result.length} indexes verified`);

  } catch (error) {
    console.error('Error verifying indexes:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

verifyIndexes();
