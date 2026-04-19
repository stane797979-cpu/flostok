import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);

async function applyIndexes() {
  try {
    console.log('Creating indexes...');

    await sql.unsafe(`
      CREATE INDEX IF NOT EXISTS "products_org_sku_idx" ON "products" USING btree ("organization_id","sku");
      CREATE INDEX IF NOT EXISTS "products_org_grade_idx" ON "products" USING btree ("organization_id","abc_grade","xyz_grade");
      CREATE INDEX IF NOT EXISTS "products_org_category_idx" ON "products" USING btree ("organization_id","category");
      CREATE INDEX IF NOT EXISTS "inventory_history_org_date_idx" ON "inventory_history" USING btree ("organization_id","date");
      CREATE INDEX IF NOT EXISTS "inventory_history_product_date_idx" ON "inventory_history" USING btree ("product_id","date");
      CREATE INDEX IF NOT EXISTS "inventory_history_org_type_idx" ON "inventory_history" USING btree ("organization_id","change_type");
      CREATE INDEX IF NOT EXISTS "sales_records_org_date_idx" ON "sales_records" USING btree ("organization_id","date");
      CREATE INDEX IF NOT EXISTS "sales_records_product_date_idx" ON "sales_records" USING btree ("product_id","date");
      CREATE INDEX IF NOT EXISTS "supplier_products_supplier_idx" ON "supplier_products" USING btree ("supplier_id","product_id");
      CREATE INDEX IF NOT EXISTS "supplier_products_product_idx" ON "supplier_products" USING btree ("product_id");
      CREATE UNIQUE INDEX IF NOT EXISTS "inventory_org_product_idx" ON "inventory" USING btree ("organization_id","product_id");
      CREATE INDEX IF NOT EXISTS "inventory_org_status_idx" ON "inventory" USING btree ("organization_id","status");
      CREATE INDEX IF NOT EXISTS "purchase_order_items_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");
      CREATE INDEX IF NOT EXISTS "purchase_order_items_product_idx" ON "purchase_order_items" USING btree ("product_id");
      CREATE INDEX IF NOT EXISTS "purchase_orders_org_status_idx" ON "purchase_orders" USING btree ("organization_id","status");
      CREATE INDEX IF NOT EXISTS "purchase_orders_org_date_idx" ON "purchase_orders" USING btree ("organization_id","order_date");
      CREATE INDEX IF NOT EXISTS "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");
      CREATE INDEX IF NOT EXISTS "inbound_records_org_date_idx" ON "inbound_records" USING btree ("organization_id","date");
      CREATE INDEX IF NOT EXISTS "inbound_records_product_date_idx" ON "inbound_records" USING btree ("product_id","date");
      CREATE INDEX IF NOT EXISTS "inbound_records_po_idx" ON "inbound_records" USING btree ("purchase_order_id");
      CREATE INDEX IF NOT EXISTS "inventory_lots_org_product_idx" ON "inventory_lots" USING btree ("organization_id","product_id");
      CREATE INDEX IF NOT EXISTS "inventory_lots_product_status_idx" ON "inventory_lots" USING btree ("product_id","status");
    `);

    console.log('✓ All 22 indexes created successfully!');

  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyIndexes();
