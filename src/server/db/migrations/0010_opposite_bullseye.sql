CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "suppliers_org_idx" ON "suppliers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "inventory_history_org_product_date_idx" ON "inventory_history" USING btree ("organization_id","product_id","date");--> statement-breakpoint
CREATE INDEX "alerts_org_read_idx" ON "alerts" USING btree ("organization_id","is_read");--> statement-breakpoint
CREATE INDEX "alerts_org_created_idx" ON "alerts" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "stockout_records_org_date_idx" ON "stockout_records" USING btree ("organization_id","reference_date");--> statement-breakpoint
CREATE INDEX "stockout_records_org_product_idx" ON "stockout_records" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "kpi_monthly_snapshots_org_period_idx" ON "kpi_monthly_snapshots" USING btree ("organization_id","period");