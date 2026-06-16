-- ============================================================================
-- FloStok SaaS - Row Level Security (RLS) 정책
--
-- 목적: 멀티테넌시를 위한 organization_id 기반 데이터 격리
-- 적용: Supabase PostgreSQL의 auth.uid()를 통한 사용자 인증
--
-- 구조:
-- 1. RLS 활성화 (모든 테이블)
-- 2. 헬퍼 함수 (current_user_org_id)
-- 3. 테이블별 정책 (SELECT, INSERT, UPDATE, DELETE)
-- ============================================================================

-- ============================================================================
-- 1. RLS 활성화
-- ============================================================================

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

-- ============================================================================
-- 2. 헬퍼 함수: 현재 사용자의 organization_id 조회
-- ============================================================================

CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- 함수 설명 주석
COMMENT ON FUNCTION current_user_org_id() IS '현재 로그인한 사용자의 organization_id를 반환합니다. Supabase Auth의 auth.uid()를 기반으로 users 테이블을 조회합니다.';

-- ============================================================================
-- 3. RLS 정책 (테이블별)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 organizations (조직)
-- ----------------------------------------------------------------------------
-- 사용자는 자신이 속한 조직만 조회/수정 가능

DROP POLICY IF EXISTS "organizations_select_policy" ON organizations;
CREATE POLICY "organizations_select_policy"
  ON organizations
  FOR SELECT
  USING (id = current_user_org_id());

DROP POLICY IF EXISTS "organizations_update_policy" ON organizations;
CREATE POLICY "organizations_update_policy"
  ON organizations
  FOR UPDATE
  USING (id = current_user_org_id());

-- 조직 생성은 애플리케이션 로직에서 처리 (가입 시)
-- 조직 삭제는 admin 권한이 있는 사용자만 가능 (별도 처리)

-- ----------------------------------------------------------------------------
-- 3.2 users (사용자)
-- ----------------------------------------------------------------------------
-- 사용자는 같은 조직의 사용자만 조회 가능
-- 자신의 프로필만 수정 가능

DROP POLICY IF EXISTS "users_select_policy" ON users;
CREATE POLICY "users_select_policy"
  ON users
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "users_update_policy" ON users;
CREATE POLICY "users_update_policy"
  ON users
  FOR UPDATE
  USING (auth_id = auth.uid());

-- 사용자 생성/삭제는 애플리케이션 로직에서 처리

-- ----------------------------------------------------------------------------
-- 3.3 suppliers (공급자)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "suppliers_select_policy" ON suppliers;
CREATE POLICY "suppliers_select_policy"
  ON suppliers
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "suppliers_insert_policy" ON suppliers;
CREATE POLICY "suppliers_insert_policy"
  ON suppliers
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "suppliers_update_policy" ON suppliers;
CREATE POLICY "suppliers_update_policy"
  ON suppliers
  FOR UPDATE
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "suppliers_delete_policy" ON suppliers;
CREATE POLICY "suppliers_delete_policy"
  ON suppliers
  FOR DELETE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.4 products (제품)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "products_select_policy" ON products;
CREATE POLICY "products_select_policy"
  ON products
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "products_insert_policy" ON products;
CREATE POLICY "products_insert_policy"
  ON products
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "products_update_policy" ON products;
CREATE POLICY "products_update_policy"
  ON products
  FOR UPDATE
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "products_delete_policy" ON products;
CREATE POLICY "products_delete_policy"
  ON products
  FOR DELETE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.5 supplier_products (공급자-제품 매핑)
-- ----------------------------------------------------------------------------
-- 같은 조직의 공급자/제품에 속한 매핑만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "supplier_products_select_policy" ON supplier_products;
CREATE POLICY "supplier_products_select_policy"
  ON supplier_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_products.supplier_id
        AND suppliers.organization_id = current_user_org_id()
    )
  );

DROP POLICY IF EXISTS "supplier_products_insert_policy" ON supplier_products;
CREATE POLICY "supplier_products_insert_policy"
  ON supplier_products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_products.supplier_id
        AND suppliers.organization_id = current_user_org_id()
    )
  );

DROP POLICY IF EXISTS "supplier_products_update_policy" ON supplier_products;
CREATE POLICY "supplier_products_update_policy"
  ON supplier_products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_products.supplier_id
        AND suppliers.organization_id = current_user_org_id()
    )
  );

DROP POLICY IF EXISTS "supplier_products_delete_policy" ON supplier_products;
CREATE POLICY "supplier_products_delete_policy"
  ON supplier_products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM suppliers
      WHERE suppliers.id = supplier_products.supplier_id
        AND suppliers.organization_id = current_user_org_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 3.6 inventory (재고)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "inventory_select_policy" ON inventory;
CREATE POLICY "inventory_select_policy"
  ON inventory
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inventory_insert_policy" ON inventory;
CREATE POLICY "inventory_insert_policy"
  ON inventory
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inventory_update_policy" ON inventory;
CREATE POLICY "inventory_update_policy"
  ON inventory
  FOR UPDATE
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inventory_delete_policy" ON inventory;
CREATE POLICY "inventory_delete_policy"
  ON inventory
  FOR DELETE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.7 inventory_history (재고 이력)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가 가능 (수정/삭제 불가 - 이력 데이터)

DROP POLICY IF EXISTS "inventory_history_select_policy" ON inventory_history;
CREATE POLICY "inventory_history_select_policy"
  ON inventory_history
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inventory_history_insert_policy" ON inventory_history;
CREATE POLICY "inventory_history_insert_policy"
  ON inventory_history
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

-- 이력 데이터는 수정/삭제 불가

-- ----------------------------------------------------------------------------
-- 3.8 purchase_orders (발주서)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "purchase_orders_select_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_select_policy"
  ON purchase_orders
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "purchase_orders_insert_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_insert_policy"
  ON purchase_orders
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "purchase_orders_update_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_update_policy"
  ON purchase_orders
  FOR UPDATE
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "purchase_orders_delete_policy" ON purchase_orders;
CREATE POLICY "purchase_orders_delete_policy"
  ON purchase_orders
  FOR DELETE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.9 purchase_order_items (발주 항목)
-- ----------------------------------------------------------------------------
-- 같은 조직의 발주서에 속한 항목만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "purchase_order_items_select_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_select_policy"
  ON purchase_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = purchase_order_items.purchase_order_id
        AND purchase_orders.organization_id = current_user_org_id()
    )
  );

DROP POLICY IF EXISTS "purchase_order_items_insert_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_insert_policy"
  ON purchase_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = purchase_order_items.purchase_order_id
        AND purchase_orders.organization_id = current_user_org_id()
    )
  );

DROP POLICY IF EXISTS "purchase_order_items_update_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_update_policy"
  ON purchase_order_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = purchase_order_items.purchase_order_id
        AND purchase_orders.organization_id = current_user_org_id()
    )
  );

DROP POLICY IF EXISTS "purchase_order_items_delete_policy" ON purchase_order_items;
CREATE POLICY "purchase_order_items_delete_policy"
  ON purchase_order_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders
      WHERE purchase_orders.id = purchase_order_items.purchase_order_id
        AND purchase_orders.organization_id = current_user_org_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 3.10 sales_records (판매 기록)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가 가능 (수정/삭제 불가 - 거래 기록)

DROP POLICY IF EXISTS "sales_records_select_policy" ON sales_records;
CREATE POLICY "sales_records_select_policy"
  ON sales_records
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "sales_records_insert_policy" ON sales_records;
CREATE POLICY "sales_records_insert_policy"
  ON sales_records
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

-- 판매 기록은 수정/삭제 불가 (감사 추적)

-- ----------------------------------------------------------------------------
-- 3.11 demand_forecasts (수요 예측)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "demand_forecasts_select_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_select_policy"
  ON demand_forecasts
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "demand_forecasts_insert_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_insert_policy"
  ON demand_forecasts
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "demand_forecasts_update_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_update_policy"
  ON demand_forecasts
  FOR UPDATE
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "demand_forecasts_delete_policy" ON demand_forecasts;
CREATE POLICY "demand_forecasts_delete_policy"
  ON demand_forecasts
  FOR DELETE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.12 inbound_records (입고 기록)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가/수정 가능 (삭제 불가 - 거래 기록)

DROP POLICY IF EXISTS "inbound_records_select_policy" ON inbound_records;
CREATE POLICY "inbound_records_select_policy"
  ON inbound_records
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inbound_records_insert_policy" ON inbound_records;
CREATE POLICY "inbound_records_insert_policy"
  ON inbound_records
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inbound_records_update_policy" ON inbound_records;
CREATE POLICY "inbound_records_update_policy"
  ON inbound_records
  FOR UPDATE
  USING (organization_id = current_user_org_id());

-- 입고 기록은 삭제 불가 (감사 추적)

-- ----------------------------------------------------------------------------
-- 3.13 alerts (알림)
-- ----------------------------------------------------------------------------
-- 같은 조직의 알림만 조회/추가/수정/삭제 가능

DROP POLICY IF EXISTS "alerts_select_policy" ON alerts;
CREATE POLICY "alerts_select_policy"
  ON alerts
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "alerts_insert_policy" ON alerts;
CREATE POLICY "alerts_insert_policy"
  ON alerts
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "alerts_update_policy" ON alerts;
CREATE POLICY "alerts_update_policy"
  ON alerts
  FOR UPDATE
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "alerts_delete_policy" ON alerts;
CREATE POLICY "alerts_delete_policy"
  ON alerts
  FOR DELETE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.14 inventory_lots (재고 LOT)
-- ----------------------------------------------------------------------------
-- 같은 조직의 데이터만 조회/추가/수정 가능

ALTER TABLE inventory_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_lots_select_policy" ON inventory_lots;
CREATE POLICY "inventory_lots_select_policy"
  ON inventory_lots
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inventory_lots_insert_policy" ON inventory_lots;
CREATE POLICY "inventory_lots_insert_policy"
  ON inventory_lots
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "inventory_lots_update_policy" ON inventory_lots;
CREATE POLICY "inventory_lots_update_policy"
  ON inventory_lots
  FOR UPDATE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.15 activity_logs (활동 로그)
-- ----------------------------------------------------------------------------
-- 같은 조직의 로그만 조회/추가 가능 (수정/삭제 불가 - 감사 로그)

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_select_policy" ON activity_logs;
CREATE POLICY "activity_logs_select_policy"
  ON activity_logs
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "activity_logs_insert_policy" ON activity_logs;
CREATE POLICY "activity_logs_insert_policy"
  ON activity_logs
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

-- 활동 로그는 수정/삭제 불가 (감사 추적)

-- ----------------------------------------------------------------------------
-- 3.16 subscriptions (구독)
-- ----------------------------------------------------------------------------
-- 같은 조직의 구독 정보만 조회/추가/수정 가능

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_policy" ON subscriptions;
CREATE POLICY "subscriptions_select_policy"
  ON subscriptions
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "subscriptions_insert_policy" ON subscriptions;
CREATE POLICY "subscriptions_insert_policy"
  ON subscriptions
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "subscriptions_update_policy" ON subscriptions;
CREATE POLICY "subscriptions_update_policy"
  ON subscriptions
  FOR UPDATE
  USING (organization_id = current_user_org_id());

-- ----------------------------------------------------------------------------
-- 3.17 payment_history (결제 내역)
-- ----------------------------------------------------------------------------
-- 같은 조직의 결제 내역만 조회/추가 가능 (수정/삭제 불가 - 금융 기록)

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_history_select_policy" ON payment_history;
CREATE POLICY "payment_history_select_policy"
  ON payment_history
  FOR SELECT
  USING (organization_id = current_user_org_id());

DROP POLICY IF EXISTS "payment_history_insert_policy" ON payment_history;
CREATE POLICY "payment_history_insert_policy"
  ON payment_history
  FOR INSERT
  WITH CHECK (organization_id = current_user_org_id());

-- 결제 내역은 수정/삭제 불가 (금융 감사)

-- ============================================================================
-- 4. 인덱스 (RLS 성능 최적화)
-- ============================================================================

-- organization_id 기반 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_org_id ON suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_org_id ON inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_org_id ON inventory_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_id ON purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_org_id ON sales_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_org_id ON demand_forecasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbound_records_org_id ON inbound_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org_id ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lots_org_id ON inventory_lots(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_org_id ON payment_history(organization_id);

-- auth_id 기반 사용자 조회 성능 향상 (로그인 시)
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- 외래키 조인 성능 향상
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_product_id ON supplier_products(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON purchase_order_items(product_id);

-- ============================================================================
-- 5. 권한 부여 (Supabase 서비스 역할)
-- ============================================================================

-- 서비스 역할은 RLS 우회 가능 (백엔드 로직용)
-- 익명 사용자는 접근 불가
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- 인증된 사용자는 RLS 정책에 따라 접근
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- 헬퍼 함수 실행 권한
GRANT EXECUTE ON FUNCTION current_user_org_id() TO authenticated;

-- ============================================================================
-- 완료
-- ============================================================================
-- 이 파일을 Supabase SQL Editor에서 실행하거나,
-- Supabase CLI를 통해 마이그레이션으로 적용하세요:
--
-- supabase db reset (로컬 개발)
-- supabase db push (원격 적용)
-- ============================================================================
