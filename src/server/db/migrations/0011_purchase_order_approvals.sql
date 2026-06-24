CREATE TYPE "public"."approval_step_status" AS ENUM('waiting', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "purchase_order_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"role_name" text NOT NULL,
	"approver_id" uuid,
	"approver_name" text,
	"status" "approval_step_status" DEFAULT 'waiting' NOT NULL,
	"comment" text,
	"acted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_order_approvals" ADD CONSTRAINT "purchase_order_approvals_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_approvals" ADD CONSTRAINT "purchase_order_approvals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_approvals" ADD CONSTRAINT "purchase_order_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "po_approvals_po_idx" ON "purchase_order_approvals" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "po_approvals_org_idx" ON "purchase_order_approvals" USING btree ("organization_id");
