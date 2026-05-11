import { NextResponse } from 'next/server'
import { db } from '@/server/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`)
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (error) {
    console.error('ping 실패:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
