import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

// 관리자 전용 마이그레이션 엔드포인트
// 호출: POST /api/admin/migrate  (Authorization: Bearer ADMIN_SECRET)
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.execute(sql`ALTER TABLE "sales_records" ADD COLUMN IF NOT EXISTS "outbound_number" text`);
    await db.execute(sql`ALTER TABLE "inventory_history" ADD COLUMN IF NOT EXISTS "outbound_number" text`);

    return NextResponse.json({ success: true, message: "Migration completed" });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
