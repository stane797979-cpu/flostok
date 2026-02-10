CREATE TYPE "public"."order_method" AS ENUM('fixed_quantity', 'fixed_period');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "order_method" "order_method";