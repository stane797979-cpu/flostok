CREATE TYPE "public"."onboarding_data_type" AS ENUM('products', 'sales', 'inventory', 'suppliers', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."onboarding_file_status" AS ENUM('uploaded', 'analyzed', 'mapped', 'imported', 'error');--> statement-breakpoint
CREATE TYPE "public"."onboarding_status" AS ENUM('draft', 'uploaded', 'analyzing', 'mapping', 'previewing', 'importing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "column_mapping_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"data_type" "onboarding_data_type" NOT NULL,
	"mappings" jsonb NOT NULL,
	"source_headers" jsonb,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_base64" text NOT NULL,
	"data_type" "onboarding_data_type" NOT NULL,
	"selected_sheet" text,
	"sheet_names" jsonb,
	"analyzed_headers" jsonb,
	"row_count" integer,
	"column_mappings" jsonb,
	"mapping_profile_id" uuid,
	"status" "onboarding_file_status" DEFAULT 'uploaded' NOT NULL,
	"import_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"company_info" jsonb DEFAULT '{}'::jsonb,
	"status" "onboarding_status" DEFAULT 'draft' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"import_summary" jsonb,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_superadmin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "column_mapping_profiles" ADD CONSTRAINT "column_mapping_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_files" ADD CONSTRAINT "onboarding_files_session_id_onboarding_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."onboarding_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_sessions" ADD CONSTRAINT "onboarding_sessions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mapping_profiles_org_type_idx" ON "column_mapping_profiles" USING btree ("organization_id","data_type");--> statement-breakpoint
CREATE INDEX "onboarding_files_session_idx" ON "onboarding_files" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "onboarding_sessions_org_idx" ON "onboarding_sessions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "onboarding_sessions_status_idx" ON "onboarding_sessions" USING btree ("organization_id","status");