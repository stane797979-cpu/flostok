-- FlowStok RLS 적용 스크립트
-- 실행: node로 이 파일을 읽어서 Supabase에 전송

-- 1. 헬퍼 함수 생성
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $func$
  SELECT organization_id
  FROM users
  WHERE auth_id = auth.uid()::text
  LIMIT 1;
$func$;

-- 2. RLS 활성화 (17개 테이블)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- 3. organizations
DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
CREATE POLICY "organizations_select_policy" ON organizations FOR SELECT USING (id = current_user_org_id());
DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
CREATE POLICY "organizations_update_policy" ON organizations FOR UPDATE USING (id = current_user_org_id());

-- 4. users
DROP POLICY IF EXISTS "users_select_policy" ON users;
CREATE POLICY "users_select_policy" ON users FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "users_update_policy" ON users;
CREATE POLICY "users_update_policy" ON users FOR UPDATE USING (auth_id = auth.uid()::text);

-- 5. suppliers
DROP POLICY IF EXISTS "suppliers_select_policy" ON suppliers;
CREATE POLICY "suppliers_select_policy" ON suppliers FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "suppliers_insert_policy" ON suppliers;
CREATE POLICY "suppliers_insert_policy" ON suppliers FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "suppliers_update_policy" ON suppliers;
CREATE POLICY "suppliers_update_policy" ON suppliers FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "suppliers_delete_policy" ON suppliers;
CREATE POLICY "suppliers_delete_policy" ON suppliers FOR DELETE USING (organization_id = current_user_org_id());

-- 6. products
DROP POLICY IF EXISTS "products_select_policy" ON products;
CREATE POLICY "products_select_policy" ON products FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "products_insert_policy" ON products;
CREATE POLICY "products_insert_policy" ON products FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "products_update_policy" ON products;
CREATE POLICY "products_update_policy" ON products FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "products_delete_policy" ON products;
CREATE POLICY "products_delete_policy" ON products FOR DELETE USING (organization_id = current_user_org_id());

-- 7. supplier_products (FK)
DROP POLICY IF EXISTS "supplier_products_select_policy" ON supplier_products;
CREATE POLICY "supplier_products_select_policy" ON supplier_products FOR SELECT USING (EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.organization_id = current_user_org_id()));
DROP POLICY IF EXISTS "supplier_products_insert_policy" ON supplier_products;
CREATE POLICY "supplier_products_insert_policy" ON supplier_products FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.organization_id = current_user_org_id()));
DROP POLICY IF EXISTS "supplier_products_update_policy" ON supplier_products;
CREATE POLICY "supplier_products_update_policy" ON supplier_products FOR UPDATE USING (EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.organization_id = current_user_org_id()));
DROP POLICY IF EXISTS "supplier_products_delete_policy" ON supplier_products;
CREATE POLICY "supplier_products_delete_policy" ON supplier_products FOR DELETE USING (EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.organization_id = current_user_org_id()));

-- 8. inventory
DROP POLICY IF EXISTS "inventory_select_policy" ON inventory;
CREATE POLICY "inventory_select_policy" ON inventory FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inventory_insert_policy" ON inventory;
CREATE POLICY "inventory_insert_policy" ON inventory FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inventory_update_policy" ON inventory;
CREATE POLICY "inventory_update_policy" ON inventory FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inventory_delete_policy" ON inventory;
CREATE POLICY "inventory_delete_policy" ON inventory FOR DELETE USING (organization_id = current_user_org_id());

-- 9. inventory_history (SELECT, INSERT only)
DROP POLICY IF EXISTS "inventory_history_select_policy" ON inventory_history;
CREATE POLICY "inventory_history_select_policy" ON inventory_history FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inventory_history_insert_policy" ON inventory_history;
CREATE POLICY "inventory_history_insert_policy" ON inventory_history FOR INSERT WITH CHECK (organization_id = current_user_org_id());

-- 10. purchase_orders
DROP POLICY IF EXISTS "purchase_orders_select_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_select_policy" ON purchase_orders FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "purchase_orders_insert_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_insert_policy" ON purchase_orders FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "purchase_orders_update_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_update_policy" ON purchase_orders FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "purchase_orders_delete_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_delete_policy" ON purchase_orders FOR DELETE USING (organization_id = current_user_org_id());

-- 11. purchase_order_items (FK)
DROP POLICY IF EXISTS "purchase_order_items_select_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_select_policy" ON purchase_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.organization_id = current_user_org_id()));
DROP POLICY IF EXISTS "purchase_order_items_insert_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_insert_policy" ON purchase_order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.organization_id = current_user_org_id()));
DROP POLICY IF EXISTS "purchase_order_items_update_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_update_policy" ON purchase_order_items FOR UPDATE USING (EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.organization_id = current_user_org_id()));
DROP POLICY IF EXISTS "purchase_order_items_delete_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_delete_policy" ON purchase_order_items FOR DELETE USING (EXISTS (SELECT 1 FROM purchase_orders WHERE purchase_orders.id = purchase_order_items.purchase_order_id AND purchase_orders.organization_id = current_user_org_id()));

-- 12. sales_records (SELECT, INSERT only)
DROP POLICY IF EXISTS "sales_records_select_policy" ON sales_records;
CREATE POLICY "sales_records_select_policy" ON sales_records FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "sales_records_insert_policy" ON sales_records;
CREATE POLICY "sales_records_insert_policy" ON sales_records FOR INSERT WITH CHECK (organization_id = current_user_org_id());

-- 13. demand_forecasts
DROP POLICY IF EXISTS "demand_forecasts_select_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_select_policy" ON demand_forecasts FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "demand_forecasts_insert_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_insert_policy" ON demand_forecasts FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "demand_forecasts_update_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_update_policy" ON demand_forecasts FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "demand_forecasts_delete_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_delete_policy" ON demand_forecasts FOR DELETE USING (organization_id = current_user_org_id());

-- 14. inbound_records (no DELETE)
DROP POLICY IF EXISTS "inbound_records_select_policy" ON inbound_records;
CREATE POLICY "inbound_records_select_policy" ON inbound_records FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inbound_records_insert_policy" ON inbound_records;
CREATE POLICY "inbound_records_insert_policy" ON inbound_records FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inbound_records_update_policy" ON inbound_records;
CREATE POLICY "inbound_records_update_policy" ON inbound_records FOR UPDATE USING (organization_id = current_user_org_id());

-- 15. alerts
DROP POLICY IF EXISTS "alerts_select_policy" ON alerts;
CREATE POLICY "alerts_select_policy" ON alerts FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "alerts_insert_policy" ON alerts;
CREATE POLICY "alerts_insert_policy" ON alerts FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "alerts_update_policy" ON alerts;
CREATE POLICY "alerts_update_policy" ON alerts FOR UPDATE USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "alerts_delete_policy" ON alerts;
CREATE POLICY "alerts_delete_policy" ON alerts FOR DELETE USING (organization_id = current_user_org_id());

-- 16. inventory_lots (no DELETE)
DROP POLICY IF EXISTS "inventory_lots_select_policy" ON inventory_lots;
CREATE POLICY "inventory_lots_select_policy" ON inventory_lots FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inventory_lots_insert_policy" ON inventory_lots;
CREATE POLICY "inventory_lots_insert_policy" ON inventory_lots FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "inventory_lots_update_policy" ON inventory_lots;
CREATE POLICY "inventory_lots_update_policy" ON inventory_lots FOR UPDATE USING (organization_id = current_user_org_id());

-- 17. activity_logs (SELECT, INSERT only)
DROP POLICY IF EXISTS "activity_logs_select_policy" ON activity_logs;
CREATE POLICY "activity_logs_select_policy" ON activity_logs FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "activity_logs_insert_policy" ON activity_logs;
CREATE POLICY "activity_logs_insert_policy" ON activity_logs FOR INSERT WITH CHECK (organization_id = current_user_org_id());

-- 18. subscriptions (no DELETE)
DROP POLICY IF EXISTS "subscriptions_select_policy" ON subscriptions;
CREATE POLICY "subscriptions_select_policy" ON subscriptions FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "subscriptions_insert_policy" ON subscriptions;
CREATE POLICY "subscriptions_insert_policy" ON subscriptions FOR INSERT WITH CHECK (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "subscriptions_update_policy" ON subscriptions;
CREATE POLICY "subscriptions_update_policy" ON subscriptions FOR UPDATE USING (organization_id = current_user_org_id());

-- 19. payment_history (SELECT, INSERT only)
DROP POLICY IF EXISTS "payment_history_select_policy" ON payment_history;
CREATE POLICY "payment_history_select_policy" ON payment_history FOR SELECT USING (organization_id = current_user_org_id());
DROP POLICY IF EXISTS "payment_history_insert_policy" ON payment_history;
CREATE POLICY "payment_history_insert_policy" ON payment_history FOR INSERT WITH CHECK (organization_id = current_user_org_id());

-- 20. 권한 설정
GRANT EXECUTE ON FUNCTION current_user_org_id() TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
