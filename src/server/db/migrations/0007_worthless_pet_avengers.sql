CREATE INDEX "products_org_sku_idx" ON "products" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE INDEX "products_org_grade_idx" ON "products" USING btree ("organization_id","abc_grade","xyz_grade");--> statement-breakpoint
CREATE INDEX "products_org_category_idx" ON "products" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "supplier_products_supplier_idx" ON "supplier_products" USING btree ("supplier_id","product_id");--> statement-breakpoint
CREATE INDEX "supplier_products_product_idx" ON "supplier_products" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_org_product_idx" ON "inventory" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "inventory_org_status_idx" ON "inventory" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "inventory_history_org_date_idx" ON "inventory_history" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "inventory_history_product_date_idx" ON "inventory_history" USING btree ("product_id","date");--> statement-breakpoint
CREATE INDEX "inventory_history_org_type_idx" ON "inventory_history" USING btree ("organization_id","change_type");--> statement-breakpoint
CREATE INDEX "inventory_lots_org_product_idx" ON "inventory_lots" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "inventory_lots_product_status_idx" ON "inventory_lots" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "purchase_order_items_po_idx" ON "purchase_order_items" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_items_product_idx" ON "purchase_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_org_status_idx" ON "purchase_orders" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "purchase_orders_org_date_idx" ON "purchase_orders" USING btree ("organization_id","order_date");--> statement-breakpoint
CREATE INDEX "purchase_orders_supplier_idx" ON "purchase_orders" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "sales_records_org_date_idx" ON "sales_records" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "sales_records_product_date_idx" ON "sales_records" USING btree ("product_id","date");--> statement-breakpoint
CREATE INDEX "inbound_records_org_date_idx" ON "inbound_records" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "inbound_records_product_date_idx" ON "inbound_records" USING btree ("product_id","date");--> statement-breakpoint
CREATE INDEX "inbound_records_po_idx" ON "inbound_records" USING btree ("purchase_order_id");