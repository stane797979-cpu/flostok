CREATE INDEX "inventory_history_org_outbound_idx" ON "inventory_history" USING btree ("organization_id","date") WHERE change_amount < 0;--> statement-breakpoint
CREATE INDEX "inventory_history_org_product_outbound_idx" ON "inventory_history" USING btree ("organization_id","product_id","date") WHERE change_amount < 0;--> statement-breakpoint
CREATE INDEX "inventory_lots_warehouse_status_received_idx" ON "inventory_lots" USING btree ("warehouse_id","status","received_date") WHERE remaining_quantity > 0;--> statement-breakpoint
CREATE INDEX "inbound_records_org_idx" ON "inbound_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscriptions_org_status_idx" ON "subscriptions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "activity_logs_org_entity_id_idx" ON "activity_logs" USING btree ("organization_id","entity_id");--> statement-breakpoint
CREATE INDEX "stockout_records_org_active_idx" ON "stockout_records" USING btree ("organization_id","is_stockout") WHERE stockout_end_date IS NULL;--> statement-breakpoint
CREATE INDEX "import_shipments_org_idx" ON "import_shipments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "import_shipments_org_product_idx" ON "import_shipments" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "import_shipments_po_idx" ON "import_shipments" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "import_shipments_org_eta_idx" ON "import_shipments" USING btree ("organization_id","eta_date");--> statement-breakpoint
ALTER TABLE "kpi_monthly_snapshots" ADD CONSTRAINT "kpi_monthly_snapshots_org_period_uniq" UNIQUE("organization_id","period");