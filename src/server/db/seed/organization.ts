/**
 * 조직 시드 데이터
 *
 * 실제 가입된 조직이 있으면 첫 번째 조직을 반환하고,
 * 없으면 데모 조직을 새로 생성합니다.
 * → 시드 재실행 시 데이터가 엉뚱한 조직에 들어가는 문제 방지
 */

import { db } from "../index";
import { organizations, users, type Organization } from "../schema";
import { DEFAULT_ORDER_POLICY } from "@/types/organization-settings";
import type { OrganizationSettings } from "@/types/organization-settings";
import { not, eq } from "drizzle-orm";

const SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000000";

export async function seedOrganization(): Promise<Organization> {
  // 실제 가입된 조직(System 제외)이 있으면 그 조직 사용
  const existingOrg = await db
    .select()
    .from(organizations)
    .where(not(eq(organizations.id, SYSTEM_ORG_ID)))
    .limit(1);

  if (existingOrg.length > 0) {
    console.log(`✅ 기존 조직 사용: ${existingOrg[0].name} (${existingOrg[0].id})`);
    return existingOrg[0];
  }

  // 가입된 조직이 없으면 데모 조직 생성
  const settings: OrganizationSettings = {
    orderPolicy: DEFAULT_ORDER_POLICY,
    notifications: {
      email: true,
      sms: false,
    },
    currency: "KRW",
    timezone: "Asia/Seoul",
  };

  const [org] = await db
    .insert(organizations)
    .values({
      name: "스마트 구매 데모 회사",
      slug: "smart-demo",
      plan: "enterprise",
      settings,
    })
    .returning();

  console.log(`🆕 데모 조직 생성: ${org.name} (${org.id})`);
  return org;
}
