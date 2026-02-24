CREATE INDEX "users_org_active_idx" ON "users" USING btree ("organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "suppliers_org_active_idx" ON "suppliers" USING btree ("organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "products_org_active_idx" ON "products" USING btree ("organization_id") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "purchase_orders_org_active_idx" ON "purchase_orders" USING btree ("organization_id") WHERE deleted_at IS NULL;