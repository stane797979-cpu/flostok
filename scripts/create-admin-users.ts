/**
 * admin1, admin2, admin3 계정 생성 스크립트
 *
 * 실행: npx tsx scripts/create-admin-users.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../src/server/db/schema";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;
const ORG_ID = "00000000-0000-0000-0000-000000000001";

const supabaseAdmin = createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const queryClient = postgres(DATABASE_URL);
const db = drizzle(queryClient);

const ADMIN_USERS = [
  { email: "admin1@stocklogis.com", name: "관리자1", password: "admin1234" },
  { email: "admin2@stocklogis.com", name: "관리자2", password: "admin1234" },
  { email: "admin3@stocklogis.com", name: "관리자3", password: "admin1234" },
];

async function createAdminUsers() {
  console.log("🔐 관리자 계정 생성 시작...\n");

  for (const admin of ADMIN_USERS) {
    try {
      // 1. Supabase Auth에 사용자 생성 (이미 있으면 찾기)
      let authId: string;

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: admin.email,
          password: admin.password,
          email_confirm: true,
        });

      if (authError) {
        if (authError.message.includes("already")) {
          console.log(`⚠️  ${admin.email} - Auth에 이미 존재. 기존 유저 찾는 중...`);
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existing = listData?.users?.find((u) => u.email === admin.email);
          if (!existing) {
            console.error(`❌ ${admin.email} - Auth 유저를 찾을 수 없습니다.`);
            continue;
          }
          authId = existing.id;
        } else {
          console.error(`❌ ${admin.email} Auth 생성 실패:`, authError.message);
          continue;
        }
      } else {
        authId = authData.user!.id;
      }

      // 2. DB users 테이블에 추가
      await db
        .insert(users)
        .values({
          authId,
          organizationId: ORG_ID,
          email: admin.email,
          name: admin.name,
          role: "admin",
          isSuperadmin: false,
        })
        .onConflictDoNothing();

      console.log(`✅ ${admin.email} - 완료 (Auth ID: ${authId})`);
    } catch (error) {
      console.error(`❌ ${admin.email} 생성 실패:`, error);
    }
  }

  console.log("\n🎉 관리자 계정 생성 완료!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("이메일: admin1@stocklogis.com / admin2@stocklogis.com / admin3@stocklogis.com");
  console.log("비밀번호: admin1234");
  console.log("역할: admin");
  console.log("조직: 스마트 구매 데모 회사");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await queryClient.end();
  process.exit(0);
}

createAdminUsers();
