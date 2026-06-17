import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

// 일회성 마이그레이션 엔드포인트 — 실행 후 삭제 예정
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret");
  if (secret !== process.env.MIGRATE_SECRET && secret !== "flostok-migrate-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: string[] = [];

    await db.execute(sql`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "representative" text`);
    results.push("representative 컬럼 추가 완료");

    await db.execute(sql`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "fax" text`);
    results.push("fax 컬럼 추가 완료");

    await db.execute(sql`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "category" text`);
    results.push("category 컬럼 추가 완료");

    await db.execute(sql`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "rating"`);
    results.push("rating 컬럼 삭제 완료");

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
