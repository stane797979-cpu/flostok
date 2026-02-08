/**
 * 조직 시드 데이터
 */

import { db } from "../index";
import { organizations, type Organization } from "../schema";
import { DEFAULT_ORDER_POLICY } from "@/types/organization-settings";
import type { OrganizationSettings } from "@/types/organization-settings";

export async function seedOrganization(): Promise<Organization> {
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
      id: "00000000-0000-0000-0000-000000000001", // TEMP_ORG_ID와 일치
      name: "스마트 구매 데모 회사",
      slug: "smart-demo",
      plan: "enterprise",
      settings,
    })
    .returning();

  return org;
}
