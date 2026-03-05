import { NextResponse } from 'next/server'
import postgres from 'postgres'

/**
 * GET /api/debug/db
 *
 * DB 연결 진단 — Drizzle 우회하여 postgres.js로 직접 연결 테스트
 * 프로덕션 문제 디버깅용 (배포 후 제거 필요)
 */
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || ''

  // 숨겨진 문자 감지
  const trimmed = dbUrl.trim()
  const passwordMatch = dbUrl.match(/:([^@]+)@/)
  const password = passwordMatch ? passwordMatch[1] : 'NOT_FOUND'

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    DATABASE_URL_SET: !!dbUrl,
    DATABASE_URL_LENGTH: dbUrl.length,
    DATABASE_URL_TRIMMED_LENGTH: trimmed.length,
    HAS_HIDDEN_CHARS: dbUrl.length !== trimmed.length,
    PASSWORD_LENGTH: password.length,
    PASSWORD_CHARS: password.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '),
    DATABASE_URL_PREVIEW: dbUrl
      ? dbUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')
      : 'NOT_SET',
    DATABASE_URL_LAST_5_CHARS: dbUrl.slice(-5).split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '),
  }

  if (!dbUrl) {
    results.error = 'DATABASE_URL is not set'
    return NextResponse.json(results, { status: 500 })
  }

  // postgres.js로 직접 연결 테스트 (Drizzle 우회)
  const client = postgres(dbUrl, {
    max: 1,
    connect_timeout: 15,
    idle_timeout: 5,
    prepare: false,
  })

  try {
    const rows = await client`SELECT NOW() as now, current_database() as db_name, current_user as db_user`
    results.db_connection = 'OK'
    results.db_now = rows[0]?.now
    results.db_name = rows[0]?.db_name
    results.db_user = rows[0]?.db_user
  } catch (err: unknown) {
    results.db_connection = 'FAILED'
    const e = err as Record<string, unknown>
    results.db_error = {
      message: e?.message || String(err),
      code: e?.code,
      severity: e?.severity,
      routine: e?.routine,
      detail: e?.detail,
    }
    await client.end().catch(() => {})
    return NextResponse.json(results, { status: 500 })
  }

  // 테이블 카운트
  try {
    const counts = await client`
      SELECT
        (SELECT count(*) FROM organizations) as orgs,
        (SELECT count(*) FROM users) as users,
        (SELECT count(*) FROM products) as products,
        (SELECT count(*) FROM inventory) as inventory
    `
    results.table_counts = {
      organizations: Number(counts[0]?.orgs ?? 0),
      users: Number(counts[0]?.users ?? 0),
      products: Number(counts[0]?.products ?? 0),
      inventory: Number(counts[0]?.inventory ?? 0),
    }
  } catch (err: unknown) {
    results.table_counts_error = (err as Error)?.message || String(err)
  }

  await client.end().catch(() => {})

  return NextResponse.json(results, {
    status: 200,
    headers: { 'Cache-Control': 'no-cache, no-store' },
  })
}
