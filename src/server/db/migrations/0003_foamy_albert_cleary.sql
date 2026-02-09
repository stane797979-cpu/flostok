CREATE TYPE "public"."stockout_action_status" AS ENUM('normalized', 'inbound_waiting', 'order_in_progress', 'no_action');--> statement-breakpoint
CREATE TYPE "public"."stockout_cause" AS ENUM('delivery_delay', 'demand_surge', 'supply_shortage', 'forecast_error', 'quality_issue', 'other');--> statement-breakpoint
CREATE TABLE "grade_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"period" date NOT NULL,
	"abc_grade" "abc_grade",
	"xyz_grade" "xyz_grade",
	"combined_grade" text,
	"sales_value" numeric(12, 0),
	"coefficient_of_variation" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stockout_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"reference_date" date NOT NULL,
	"base_stock" integer DEFAULT 0,
	"outbound_qty" integer DEFAULT 0,
	"closing_stock" integer DEFAULT 0,
	"is_stockout" boolean DEFAULT false NOT NULL,
	"stockout_start_date" date,
	"stockout_end_date" date,
	"duration_days" integer,
	"cause" "stockout_cause",
	"action_status" "stockout_action_status" DEFAULT 'no_action',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid,
	"product_id" uuid NOT NULL,
	"bl_number" text,
	"container_number" text,
	"invoice_number" text,
	"customs_declaration_number" text,
	"container_qty" integer,
	"carton_qty" integer,
	"quantity" integer NOT NULL,
	"unit_price_usd" numeric(10, 2),
	"invoice_amount_usd" numeric(12, 2),
	"eta_date" date,
	"ata_date" date,
	"warehouse_eta_date" date,
	"warehouse_actual_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_monthly_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period" date NOT NULL,
	"turnover_rate" numeric(8, 4),
	"stockout_rate" numeric(6, 4),
	"on_time_delivery_rate" numeric(6, 4),
	"fulfillment_rate" numeric(6, 4),
	"actual_shipment_rate" numeric(6, 4),
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'enterprise';--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "requested_date" date;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "first_receipt_date" date;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "second_receipt_date" date;--> statement-breakpoint
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockout_records" ADD CONSTRAINT "stockout_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stockout_records" ADD CONSTRAINT "stockout_records_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_shipments" ADD CONSTRAINT "import_shipments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_monthly_snapshots" ADD CONSTRAINT "kpi_monthly_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;