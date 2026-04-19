-- 테스트 사용자 생성 (Supabase Auth + DB 연동)
-- 이 스크립트는 Supabase SQL Editor에서 실행하거나, psql로 실행

-- 1. Supabase Auth 사용자는 대시보드에서 수동 생성 필요
--    이메일: test@example.com
--    비밀번호: Test1234!

-- 2. 조직 생성 (이미 존재하지 않는 경우)
INSERT INTO organizations (id, name, subscription_tier, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '테스트 조직',
  'enterprise',
  true
)
ON CONFLICT (id) DO NOTHING;

-- 3. 사용자 레코드 생성
-- auth.users에서 ID 조회 필요
-- Supabase 대시보드에서 Auth > Users에서 UID 확인 후 아래 실행

-- 예시:
-- INSERT INTO users (id, email, organization_id, role, is_active)
-- VALUES (
--   '[AUTH_USER_ID]', -- Supabase Auth의 실제 UUID
--   'test@example.com',
--   '00000000-0000-0000-0000-000000000001',
--   'admin',
--   true
-- )
-- ON CONFLICT (id) DO NOTHING;

-- 4. 확인
SELECT u.id, u.email, u.role, o.name as organization
FROM users u
JOIN organizations o ON u.organization_id = o.id
WHERE u.email = 'test@example.com';
