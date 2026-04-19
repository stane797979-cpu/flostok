import { Client } from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

const sql = `
-- Create psi_plans table
CREATE TABLE IF NOT EXISTS "psi_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"period" date NOT NULL,
	"sop_quantity" integer DEFAULT 0 NOT NULL,
	"inbound_plan_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "psi_plans" DROP CONSTRAINT IF EXISTS "psi_plans_organization_id_organizations_id_fk";
ALTER TABLE "psi_plans" ADD CONSTRAINT "psi_plans_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "psi_plans" DROP CONSTRAINT IF EXISTS "psi_plans_product_id_products_id_fk";
ALTER TABLE "psi_plans" ADD CONSTRAINT "psi_plans_product_id_products_id_fk"
  FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS "psi_plans_org_product_period_idx"
  ON "psi_plans" USING btree ("organization_id","product_id","period");
`;

async function createTable() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(sql);
    console.log('✅ psi_plans table created successfully');

    // Verify table exists
    const result = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'psi_plans'
      ORDER BY ordinal_position;
    `);

    console.log('\nTable structure:');
    console.table(result.rows);

  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createTable();
