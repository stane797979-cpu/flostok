/**
 * GET /api/debug/auth
 *
 * 인증 상태 디버깅 엔드포인트
 * 프로덕션에서 데이터가 0으로 표시되는 문제 진단용
 *
 * TODO: 문제 해결 후 삭제
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import postgres from "postgres";

export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
      // DATABASE_URL 앞부분만 노출 (비밀번호 마스킹)
      databaseUrlPrefix: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@").slice(0, 80) + "..."
        : "NOT SET",
    },
  };

  // 1. Supabase Auth 확인
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    result.supabaseAuth = {
      hasUser: !!user,
      userId: user?.id?.slice(0, 8) + "...",
      email: user?.email,
      error: authError?.message || null,
    };
  } catch (e) {
    result.supabaseAuth = { error: e instanceof Error ? e.message : String(e) };
  }

  // 2. DB 직접 연결 테스트 (Drizzle 우회)
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    result.dbTest = { error: "DATABASE_URL이 설정되지 않았습니다" };
    result.diagnosis = "DATABASE_URL 환경 변수 미설정";
    return NextResponse.json(result, { status: 500 });
  }

  let sql: ReturnType<typeof postgres> | null = null;
  try {
    const isPgBouncer = dbUrl.includes("pgbouncer=true") || dbUrl.includes(":6543");
    sql = postgres(dbUrl, {
      max: 1,
      connect_timeout: 15,
      idle_timeout: 10,
      ...(isPgBouncer ? { prepare: false } : {}),
    });

    // 간단한 연결 테스트
    const pingResult = await sql`SELECT 1 as ping, now() as server_time`;
    result.dbConnection = {
      status: "connected",
      serverTime: pingResult[0]?.server_time,
    };

    // users 테이블 조회 테스트
    const userRows = await sql`SELECT count(*) as cnt FROM users`;
    result.dbUserCount = Number(userRows[0]?.cnt) || 0;

    // organizations 테이블 조회
    const orgRows = await sql`
      SELECT o.id, o.name,
        (SELECT count(*) FROM products p WHERE p.organization_id = o.id) as product_count,
        (SELECT count(*) FROM inventory i WHERE i.organization_id = o.id) as inventory_count
      FROM organizations o
      LIMIT 10
    `;
    result.organizations = orgRows.map((r) => ({
      id: r.id,
      name: r.name,
      productCount: Number(r.product_count),
      inventoryCount: Number(r.inventory_count),
    }));

    // 현재 로그인 사용자의 DB 레코드 확인
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const dbUsers = await sql`
        SELECT id, auth_id, organization_id, email, role, deleted_at
        FROM users
        WHERE auth_id = ${user.id} OR email = ${user.email || ''}
        LIMIT 5
      `;
      result.matchingUsers = dbUsers.map((u) => ({
        id: String(u.id).slice(0, 8) + "...",
        authId: u.auth_id ? String(u.auth_id).slice(0, 8) + "..." : null,
        organizationId: u.organization_id,
        email: u.email,
        role: u.role,
        deletedAt: u.deleted_at,
      }));

      if (dbUsers.length === 0) {
        result.diagnosis = "DB에 해당 사용자가 없습니다. authId/email 매칭 실패.";
      } else {
        const orgId = dbUsers[0].organization_id;
        const orgData = (result.organizations as Array<Record<string, unknown>>)?.find(
          (o) => o.id === orgId
        );
        if (orgData && Number(orgData.productCount) === 0) {
          result.diagnosis = `사용자 조직(${orgId})에 제품이 0건입니다. 데이터가 다른 조직에 있을 수 있습니다.`;
        } else {
          result.diagnosis = "인증 + DB 매핑 정상. 쿼리 로직 문제일 수 있습니다.";
        }
      }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errStack = e instanceof Error ? e.stack?.split("\n").slice(0, 3).join("\n") : undefined;
    result.dbTest = {
      error: errMsg,
      stack: errStack,
      hint: errMsg.includes("timeout")
        ? "DB 연결 타임아웃 — Railway→Supabase 경로 문제"
        : errMsg.includes("password")
          ? "DB 비밀번호 불일치 — Railway 환경 변수 확인 필요"
          : errMsg.includes("does not exist")
            ? "테이블 미존재 — 마이그레이션 필요"
            : "알 수 없는 DB 에러",
    };
    result.diagnosis = "DB 연결/쿼리 실패: " + errMsg;
  } finally {
    if (sql) await sql.end().catch(() => {});
  }

  return NextResponse.json(result);
}
