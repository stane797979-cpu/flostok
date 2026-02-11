CREATE TYPE "public"."outbound_request_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'warehouse';--> statement-breakpoint
CREATE TABLE "outbound_request_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbound_request_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"requested_quantity" integer NOT NULL,
	"confirmed_quantity" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_number" text NOT NULL,
	"status" "outbound_request_status" DEFAULT 'pending' NOT NULL,
	"outbound_type" text NOT NULL,
	"requested_by_id" uuid,
	"confirmed_by_id" uuid,
	"confirmed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_menu_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"menu_key" text NOT NULL,
	"is_allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_request_items" ADD CONSTRAINT "outbound_request_items_outbound_request_id_outbound_requests_id_fk" FOREIGN KEY ("outbound_request_id") REFERENCES "public"."outbound_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_request_items" ADD CONSTRAINT "outbound_request_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD CONSTRAINT "outbound_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD CONSTRAINT "outbound_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD CONSTRAINT "outbound_requests_confirmed_by_id_users_id_fk" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_request_items_request_idx" ON "outbound_request_items" USING btree ("outbound_request_id");--> statement-breakpoint
CREATE INDEX "outbound_request_items_product_idx" ON "outbound_request_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "outbound_requests_org_status_idx" ON "outbound_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "outbound_requests_org_date_idx" ON "outbound_requests" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "role_menu_permissions_unique_idx" ON "role_menu_permissions" USING btree ("organization_id","role","menu_key");