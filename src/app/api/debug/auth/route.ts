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
import { db } from "@/server/db";
import { users, organizations, products, inventory } from "@/server/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
    },
  };

  try {
    // 1. Supabase Auth 확인
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    result.supabaseAuth = {
      hasUser: !!user,
      userId: user?.id?.slice(0, 8) + "...",
      email: user?.email,
      error: authError?.message || null,
    };

    if (!user) {
      result.diagnosis = "Supabase Auth에서 사용자를 찾을 수 없습니다. 로그인 상태를 확인하세요.";
      return NextResponse.json(result);
    }

    // 2. DB users 테이블에서 authId로 조회
    const [dbUserByAuth] = await db
      .select({
        id: users.id,
        authId: users.authId,
        organizationId: users.organizationId,
        email: users.email,
        role: users.role,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1);

    result.dbUserByAuthId = dbUserByAuth
      ? {
          found: true,
          id: dbUserByAuth.id.slice(0, 8) + "...",
          organizationId: dbUserByAuth.organizationId,
          email: dbUserByAuth.email,
          role: dbUserByAuth.role,
          deletedAt: dbUserByAuth.deletedAt,
        }
      : { found: false };

    // 3. DB users 테이블에서 이메일로 조회
    if (!dbUserByAuth && user.email) {
      const [dbUserByEmail] = await db
        .select({
          id: users.id,
          authId: users.authId,
          organizationId: users.organizationId,
          email: users.email,
        })
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      result.dbUserByEmail = dbUserByEmail
        ? {
            found: true,
            id: dbUserByEmail.id.slice(0, 8) + "...",
            authId: dbUserByEmail.authId?.slice(0, 8) + "..." || "null",
            organizationId: dbUserByEmail.organizationId,
          }
        : { found: false };
    }

    // 4. 해당 조직의 데이터 존재 확인
    const orgId = dbUserByAuth?.organizationId;
    if (orgId) {
      const [orgInfo] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      const [productCount] = await db
        .select({ count: count() })
        .from(products)
        .where(eq(products.organizationId, orgId));

      const [inventoryCount] = await db
        .select({ count: count() })
        .from(inventory)
        .where(eq(inventory.organizationId, orgId));

      result.organizationData = {
        orgName: orgInfo?.name || "NOT FOUND",
        orgId,
        productCount: productCount?.count || 0,
        inventoryCount: inventoryCount?.count || 0,
      };
    }

    // 5. 전체 조직 목록 (데이터 비교용)
    const allOrgs = await db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .limit(10);

    const orgDataCounts = await Promise.all(
      allOrgs.map(async (org) => {
        const [pc] = await db.select({ count: count() }).from(products).where(eq(products.organizationId, org.id));
        return { orgId: org.id, orgName: org.name, productCount: pc?.count || 0 };
      })
    );

    result.allOrganizations = orgDataCounts;

    // 6. 진단
    if (!dbUserByAuth) {
      result.diagnosis = "DB users 테이블에 해당 authId의 사용자가 없습니다. OAuth 콜백 동기화 실패 가능성.";
    } else if (!orgId) {
      result.diagnosis = "사용자의 organizationId가 없습니다.";
    } else if ((result.organizationData as Record<string, unknown>)?.productCount === 0) {
      result.diagnosis = `사용자 조직(${orgId})에 제품 데이터가 없습니다. 데이터가 다른 조직에 있을 수 있습니다.`;
    } else {
      result.diagnosis = "인증 및 데이터 매핑이 정상입니다. 다른 원인을 확인하세요.";
    }

    return NextResponse.json(result);
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.diagnosis = "예외 발생 — DB 연결 또는 쿼리 오류 가능성";
    return NextResponse.json(result, { status: 500 });
  }
}
