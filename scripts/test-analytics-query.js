const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const orgId = '00000000-0000-0000-0000-000000000001';
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startDate = sixMonthsAgo.toISOString().split('T')[0];

  console.log('startDate:', startDate);

  const [allProducts, salesByProduct, monthlySales] = await Promise.all([
    pool.query('SELECT id, sku, name FROM products WHERE organization_id = $1', [orgId]),
    pool.query(
      'SELECT product_id, COALESCE(SUM(total_amount), 0) as total_revenue FROM sales_records WHERE organization_id = $1 AND date >= $2 GROUP BY product_id',
      [orgId, startDate]
    ),
    pool.query(
      "SELECT product_id, TO_CHAR(date::date, 'YYYY-MM') as month, COALESCE(SUM(quantity), 0) as total_quantity FROM sales_records WHERE organization_id = $1 AND date >= $2 GROUP BY product_id, TO_CHAR(date::date, 'YYYY-MM')",
      [orgId, startDate]
    ),
  ]);

  console.log('Products:', allProducts.rows.length);
  console.log('Sales by product:', salesByProduct.rows.length);
  console.log('Monthly sales rows:', monthlySales.rows.length);

  // 매출 0인 제품 확인
  const revenueMap = new Map(salesByProduct.rows.map(s => [s.product_id, Number(s.total_revenue)]));
  const noRevenue = allProducts.rows.filter(p => !revenueMap.has(p.id) || revenueMap.get(p.id) === 0);
  console.log('Products with no revenue:', noRevenue.length);

  // 월별 분포 확인
  const months = new Set(monthlySales.rows.map(r => r.month));
  console.log('Monthly periods:', [...months].sort());

  pool.end();
})().catch(e => { console.error('ERROR:', e.message); pool.end(); });
