import { NextResponse } from 'next/server'
import { db } from '@/server/db'
import { sql } from 'drizzle-orm'
import { users, organizations, products, inventory } from '@/server/db/schema'

/**
 * GET /api/debug/db
 *
 * DB 연결 및 데이터 상태 진단 엔드포인트
 * 프로덕션 문제 디버깅용 (배포 후 제거 필요)
 */
export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    DATABASE_URL_HOST: process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL.replace('postgresql://', 'http://')).hostname
      : 'NOT_SET',
  }

  // 1. 기본 연결 테스트
  try {
    const [row] = await db.execute(sql`SELECT NOW() as now, current_database() as db_name`)
    results.db_connection = 'OK'
    results.db_now = row?.now
    results.db_name = row?.db_name
  } catch (err) {
    results.db_connection = 'FAILED'
    results.db_error = err instanceof Error ? err.message : String(err)
    return NextResponse.json(results, { status: 500 })
  }

  // 2. 테이블별 레코드 수 (RLS 무시 - 서버 직접 쿼리)
  try {
    const [orgCount] = await db.select({ count: sql<number>`count(*)` }).from(organizations)
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users)
    const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products)
    const [inventoryCount] = await db.select({ count: sql<number>`count(*)` }).from(inventory)

    results.table_counts = {
      organizations: Number(orgCount?.count ?? 0),
      users: Number(userCount?.count ?? 0),
      products: Number(productCount?.count ?? 0),
      inventory: Number(inventoryCount?.count ?? 0),
    }
  } catch (err) {
    results.table_counts_error = err instanceof Error ? err.message : String(err)
  }

  // 3. 사용자 목록 (이메일만)
  try {
    const allUsers = await db
      .select({ email: users.email, role: users.role, orgId: users.organizationId, authId: users.authId })
      .from(users)
      .limit(10)
    results.users = allUsers.map(u => ({
      email: u.email,
      role: u.role,
      orgId: u.orgId,
      hasAuthId: !!u.authId,
    }))
  } catch (err) {
    results.users_error = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json(results, {
    status: 200,
    headers: { 'Cache-Control': 'no-cache, no-store' },
  })
}
