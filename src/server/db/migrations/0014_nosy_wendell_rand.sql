ALTER TABLE "outbound_requests" ADD COLUMN "customer_type" text;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD COLUMN "recipient_company" text;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD COLUMN "recipient_name" text;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD COLUMN "recipient_address" text;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD COLUMN "recipient_phone" text;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD COLUMN "courier_name" text;--> statement-breakpoint
ALTER TABLE "outbound_requests" ADD COLUMN "tracking_number" text;