ALTER TABLE "suppliers" ADD COLUMN "representative" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "fax" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "rating";
