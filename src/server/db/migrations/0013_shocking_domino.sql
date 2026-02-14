CREATE TYPE "public"."deletion_request_status" AS ENUM('pending', 'approved', 'rejected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_name" text,
	"entity_snapshot" jsonb NOT NULL,
	"dependency_check" jsonb,
	"impact_level" text,
	"status" "deletion_request_status" DEFAULT 'pending' NOT NULL,
	"reason" text NOT NULL,
	"requested_by_id" uuid,
	"requested_by_name" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by_id" uuid,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	"rejected_by_id" uuid,
	"rejected_by_name" text,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"completed_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "deletion_reason" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "deletion_metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deletion_reason" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "deletion_metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "deletion_reason" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "deletion_metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deletion_requests" ADD CONSTRAINT "deletion_requests_rejected_by_id_users_id_fk" FOREIGN KEY ("rejected_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deletion_requests_org_status_idx" ON "deletion_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "deletion_requests_entity_idx" ON "deletion_requests" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "deletion_requests_requested_by_idx" ON "deletion_requests" USING btree ("requested_by_id");