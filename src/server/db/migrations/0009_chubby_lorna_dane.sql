-- Custom SQL migration file, put your code below! --
ALTER TABLE "sales_records" ADD COLUMN IF NOT EXISTS "outbound_number" text;
ALTER TABLE "inventory_history" ADD COLUMN IF NOT EXISTS "outbound_number" text;