import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, inventory, products } from "@/server/db/schema";
import { eq, count } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/debug-dashboard
 * 대시보드 데이터 0 문제 진단용 임시 엔드포인트
 * 프로덕션에서 어디서 실패하는지 확인
 */
export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    steps: {},
  };

  // Step 1: DB 연결 테스트
  try {
    const [userCount] = await db.select({ count: count() }).from(users);
    results.steps = {
      ...results.steps as object,
      "1_db_connection": { ok: true, userCount: userCount.count },
    };
  } catch (err) {
    results.steps = {
      ...results.steps as object,
      "1_db_connection": { ok: false, error: String(err) },
    };
    return NextResponse.json(results, { status: 200 });
  }

  // Step 2: Supabase Auth 테스트
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    results.steps = {
      ...results.steps as object,
      "2_supabase_auth": {
        ok: !error && !!data.user,
        hasUser: !!data.user,
        userId: data.user?.id?.slice(0, 8) || null,
        email: data.user?.email || null,
        error: error?.message || null,
      },
    };
  } catch (err) {
    results.steps = {
      ...results.steps as object,
      "2_supabase_auth": { ok: false, error: String(err) },
    };
  }

  // Step 3: DB에서 사용자 조회 (auth 없이 첫 번째 사용자)
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      orgId: users.organizationId,
      role: users.role,
      authId: users.authId,
    }).from(users).limit(5);
    results.steps = {
      ...results.steps as object,
      "3_db_users": {
        ok: true,
        count: allUsers.length,
        users: allUsers.map(u => ({
          email: u.email,
          orgId: u.orgId?.slice(0, 8),
          role: u.role,
          hasAuthId: !!u.authId,
          authIdPrefix: u.authId?.slice(0, 8) || null,
        })),
      },
    };
  } catch (err) {
    results.steps = {
      ...results.steps as object,
      "3_db_users": { ok: false, error: String(err) },
    };
  }

  // Step 4: 인벤토리 데이터 확인
  try {
    const [invCount] = await db.select({ count: count() }).from(inventory);
    const [prodCount] = await db.select({ count: count() }).from(products);
    results.steps = {
      ...results.steps as object,
      "4_inventory_data": {
        ok: true,
        inventoryCount: invCount.count,
        productCount: prodCount.count,
      },
    };
  } catch (err) {
    results.steps = {
      ...results.steps as object,
      "4_inventory_data": { ok: false, error: String(err) },
    };
  }

  // Step 5: 환경변수 확인
  results.steps = {
    ...results.steps as object,
    "5_env": {
      DATABASE_URL: !!process.env.DATABASE_URL,
      SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  return NextResponse.json(results, {
    status: 200,
    headers: { "Cache-Control": "no-cache, no-store" },
  });
}
