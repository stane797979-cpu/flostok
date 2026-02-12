CREATE INDEX "sales_records_org_product_date_idx" ON "sales_records" USING btree ("organization_id","product_id","date");--> statement-breakpoint
CREATE INDEX "demand_forecasts_org_period_idx" ON "demand_forecasts" USING btree ("organization_id","period");--> statement-breakpoint
CREATE INDEX "demand_forecasts_org_product_period_idx" ON "demand_forecasts" USING btree ("organization_id","product_id","period");--> statement-breakpoint
CREATE INDEX "grade_history_org_period_idx" ON "grade_history" USING btree ("organization_id","period");--> statement-breakpoint
CREATE INDEX "grade_history_org_product_idx" ON "grade_history" USING btree ("organization_id","product_id");