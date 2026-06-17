import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: string[] = [];

    await db.execute(sql`ALTER TABLE "sales_records" ADD COLUMN IF NOT EXISTS "outbound_number" text`);
    results.push("sales_records.outbound_number: OK");

    await db.execute(sql`ALTER TABLE "inventory_history" ADD COLUMN IF NOT EXISTS "outbound_number" text`);
    results.push("inventory_history.outbound_number: OK");

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
