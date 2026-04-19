import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!);

async function analyzePerformance() {
  try {
    console.log('Analyzing index usage and performance...\n');

    // 1. 인덱스 크기 확인
    console.log('📊 Index sizes:');
    const indexSizes = await sql`
      SELECT
        schemaname,
        relname as tablename,
        indexrelname as indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
        AND (
          indexrelname LIKE '%_org_%_idx'
          OR indexrelname LIKE '%_product_%_idx'
          OR indexrelname LIKE '%_po_idx'
          OR indexrelname LIKE '%_supplier_idx'
        )
      ORDER BY pg_relation_size(indexrelid) DESC
      LIMIT 10;
    `;

    indexSizes.forEach((row: any) => {
      console.log(`   ${row.tablename}.${row.indexname}: ${row.index_size}`);
    });

    // 2. 테이블별 인덱스 수
    console.log('\n📋 Indexes per table:');
    const indexCount = await sql`
      SELECT
        tablename,
        COUNT(*) as index_count
      FROM pg_indexes
      WHERE schemaname = 'public'
      GROUP BY tablename
      HAVING COUNT(*) > 1
      ORDER BY index_count DESC;
    `;

    indexCount.forEach((row: any) => {
      console.log(`   ${row.tablename}: ${row.index_count} indexes`);
    });

    // 3. EXPLAIN 분석 (샘플 쿼리)
    console.log('\n🔍 Sample query analysis (organizationId + date filter):');
    const orgId = await sql`SELECT id FROM organizations LIMIT 1`;

    if (orgId.length > 0) {
      const explain = await sql`
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT * FROM sales_records
        WHERE organization_id = ${orgId[0].id}
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        LIMIT 100;
      `;

      explain.forEach((row: any) => {
        console.log(`   ${row['QUERY PLAN']}`);
      });
    }

    console.log('\n✓ Analysis complete');

  } catch (error) {
    console.error('Error analyzing performance:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

analyzePerformance();
