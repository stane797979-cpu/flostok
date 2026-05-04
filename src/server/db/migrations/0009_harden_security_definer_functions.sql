-- ============================================================================
-- 보안 강화: SECURITY DEFINER 함수 권한 정리
-- ============================================================================
-- 목적: Supabase Security Advisor 경고 해결
--   1. Public Can Execute SECURITY DEFINER Function
--   2. Signed-In Users Can Execute SECURITY DEFINER Function
--
-- 변경 사항:
--   - current_user_org_id() 의 PUBLIC/anon 실행 권한 제거
--   - search_path 명시로 search-path 하이재킹 방지 (Supabase 권장)
--   - authenticated 롤에만 EXECUTE 부여
-- ============================================================================

-- 1. 함수를 안전하게 재생성 (search_path 고정)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp  -- 검색 경로 하이재킹 방지
AS $$
  SELECT organization_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$;

-- 2. 모든 EXECUTE 권한 회수
REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_org_id() FROM anon;
REVOKE ALL ON FUNCTION public.current_user_org_id() FROM authenticated;

-- 3. 로그인 사용자에게만 EXECUTE 권한 부여
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;

-- 4. service_role(서버 사이드)에도 부여 (Server Actions/Cron 등)
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO service_role;

-- ============================================================================
-- 검증: 아래 쿼리로 권한 확인 가능
--
-- SELECT
--   p.proname AS function_name,
--   r.rolname AS grantee,
--   has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
-- FROM pg_proc p
-- CROSS JOIN pg_roles r
-- WHERE p.proname = 'current_user_org_id'
--   AND r.rolname IN ('anon', 'authenticated', 'service_role', 'public');
-- ============================================================================
