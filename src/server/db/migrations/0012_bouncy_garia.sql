-- Step 1: warehouses 테이블 생성
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'MAIN' NOT NULL,
	"address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_org_code_unique" ON "warehouses" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "warehouses_org_idx" ON "warehouses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "warehouses_org_active_idx" ON "warehouses" USING btree ("organization_id","is_active");--> statement-breakpoint

-- Step 2: 모든 조직에 기본 창고 생성
INSERT INTO warehouses (organization_id, code, name, type, is_active, is_default)
SELECT id, 'MAIN', '본사 창고', 'MAIN', TRUE, TRUE
FROM organizations;
--> statement-breakpoint

-- Step 3: inventory 테이블에 warehouse_id 추가 (nullable로 시작)
ALTER TABLE "inventory" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint

-- Step 4: 기존 inventory 데이터에 기본 창고 할당
UPDATE inventory
SET warehouse_id = (
  SELECT w.id
  FROM warehouses w
  WHERE w.organization_id = inventory.organization_id
    AND w.is_default = TRUE
  LIMIT 1
);
--> statement-breakpoint

-- Step 5: inventory.warehouse_id에 NOT NULL 제약 추가
ALTER TABLE "inventory" ALTER COLUMN "warehouse_id" SET NOT NULL;--> statement-breakpoint

-- Step 6: inventory FK 및 인덱스 추가
DROP INDEX IF EXISTS "inventory_org_product_idx";--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_org_warehouse_product_idx" ON "inventory" USING btree ("organization_id","warehouse_id","product_id");--> statement-breakpoint
CREATE INDEX "inventory_warehouse_status_idx" ON "inventory" USING btree ("warehouse_id","status");--> statement-breakpoint

-- Step 7: inventory_history 테이블에 warehouse_id 추가 (nullable로 시작)
ALTER TABLE "inventory_history" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint

-- Step 8: 기존 inventory_history 데이터에 기본 창고 할당
UPDATE inventory_history
SET warehouse_id = (
  SELECT w.id
  FROM warehouses w
  WHERE w.organization_id = inventory_history.organization_id
    AND w.is_default = TRUE
  LIMIT 1
);
--> statement-breakpoint

-- Step 9: inventory_history.warehouse_id에 NOT NULL 제약 추가
ALTER TABLE "inventory_history" ALTER COLUMN "warehouse_id" SET NOT NULL;--> statement-breakpoint

-- Step 10: inventory_history FK 및 인덱스 추가
ALTER TABLE "inventory_history" ADD CONSTRAINT "inventory_history_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_history_warehouse_date_idx" ON "inventory_history" USING btree ("warehouse_id","date");--> statement-breakpoint

-- Step 11: inventory_lots 테이블에 warehouse_id 추가 (nullable로 시작)
ALTER TABLE "inventory_lots" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint

-- Step 12: 기존 inventory_lots 데이터에 기본 창고 할당
UPDATE inventory_lots
SET warehouse_id = (
  SELECT w.id
  FROM warehouses w
  WHERE w.organization_id = inventory_lots.organization_id
    AND w.is_default = TRUE
  LIMIT 1
);
--> statement-breakpoint

-- Step 13: inventory_lots.warehouse_id에 NOT NULL 제약 추가
ALTER TABLE "inventory_lots" ALTER COLUMN "warehouse_id" SET NOT NULL;--> statement-breakpoint

-- Step 14: inventory_lots FK 및 인덱스 추가
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_lots_warehouse_product_idx" ON "inventory_lots" USING btree ("warehouse_id","product_id");--> statement-breakpoint

-- Step 15: inbound_records 테이블에 warehouse_id 추가 (nullable로 시작)
ALTER TABLE "inbound_records" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint

-- Step 16: 기존 inbound_records 데이터에 기본 창고 할당
UPDATE inbound_records
SET warehouse_id = (
  SELECT w.id
  FROM warehouses w
  WHERE w.organization_id = inbound_records.organization_id
    AND w.is_default = TRUE
  LIMIT 1
);
--> statement-breakpoint

-- Step 17: inbound_records.warehouse_id에 NOT NULL 제약 추가
ALTER TABLE "inbound_records" ALTER COLUMN "warehouse_id" SET NOT NULL;--> statement-breakpoint

-- Step 18: inbound_records FK 및 인덱스 추가
ALTER TABLE "inbound_records" ADD CONSTRAINT "inbound_records_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbound_records_warehouse_date_idx" ON "inbound_records" USING btree ("warehouse_id","date");--> statement-breakpoint

-- Step 19: purchase_orders 테이블에 destination_warehouse_id 추가 (nullable로 시작)
ALTER TABLE "purchase_orders" ADD COLUMN "destination_warehouse_id" uuid;--> statement-breakpoint

-- Step 20: 기존 purchase_orders 데이터에 기본 창고 할당
UPDATE purchase_orders
SET destination_warehouse_id = (
  SELECT w.id
  FROM warehouses w
  WHERE w.organization_id = purchase_orders.organization_id
    AND w.is_default = TRUE
  LIMIT 1
);
--> statement-breakpoint

-- Step 21: purchase_orders.destination_warehouse_id에 NOT NULL 제약 추가
ALTER TABLE "purchase_orders" ALTER COLUMN "destination_warehouse_id" SET NOT NULL;--> statement-breakpoint

-- Step 22: purchase_orders FK 및 인덱스 추가
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_destination_warehouse_id_warehouses_id_fk" FOREIGN KEY ("destination_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_orders_dest_warehouse_idx" ON "purchase_orders" USING btree ("destination_warehouse_id");--> statement-breakpoint

-- Step 23: outbound_requests 테이블에 source_warehouse_id 추가 (nullable로 시작)
ALTER TABLE "outbound_requests" ADD COLUMN "source_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD COLUMN "target_warehouse_id" uuid;--> statement-breakpoint

-- Step 24: 기존 outbound_requests 데이터에 기본 창고 할당
UPDATE outbound_requests
SET source_warehouse_id = (
  SELECT w.id
  FROM warehouses w
  WHERE w.organization_id = outbound_requests.organization_id
    AND w.is_default = TRUE
  LIMIT 1
);
--> statement-breakpoint

-- Step 25: outbound_requests.source_warehouse_id에 NOT NULL 제약 추가
ALTER TABLE "outbound_requests" ALTER COLUMN "source_warehouse_id" SET NOT NULL;--> statement-breakpoint

-- Step 26: outbound_requests FK 및 인덱스 추가
ALTER TABLE "outbound_requests" ADD CONSTRAINT "outbound_requests_source_warehouse_id_warehouses_id_fk" FOREIGN KEY ("source_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD CONSTRAINT "outbound_requests_target_warehouse_id_warehouses_id_fk" FOREIGN KEY ("target_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_requests_source_warehouse_idx" ON "outbound_requests" USING btree ("source_warehouse_id");