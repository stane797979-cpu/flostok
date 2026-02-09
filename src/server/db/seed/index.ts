/**
 * 시드 데이터 메인 스크립트
 *
 * 실행: npx tsx src/server/db/seed/index.ts
 *
 * 주의:
 * - 개발 환경에서만 사용
 * - 기존 데이터를 삭제하고 새로 생성합니다
 */

import { db } from "../index";
import {
  organizations,
  users,
  suppliers,
  products,
  inventory,
  salesRecords,
  inventoryHistory,
} from "../schema";
import { seedOrganization } from "./organization";
import { seedSuppliers } from "./suppliers";
import { seedProducts } from "./products";
import { seedInventory } from "./inventory";
import { seedSalesRecords } from "./sales-records";

const SYSTEM_ORG_ID = "00000000-0000-0000-0000-000000000000";

async function clearDatabase() {
  console.log("🗑️  기존 데이터 삭제 중...");

  // 순서 중요: 외래키 참조 순서 역순으로 삭제
  await db.delete(inventoryHistory);
  await db.delete(salesRecords);
  await db.delete(inventory);
  await db.delete(products);
  await db.delete(suppliers);
  await db.delete(organizations);

  console.log("✅ 기존 데이터 삭제 완료");
}

async function seed() {
  console.log("🌱 시드 데이터 생성 시작...\n");

  try {
    // 1. 기존 데이터 삭제
    await clearDatabase();

    // 1.5. System 조직 + 슈퍼관리자 생성
    await db.insert(organizations).values({
      id: SYSTEM_ORG_ID,
      name: "System",
      slug: "system",
      plan: "enterprise",
    }).onConflictDoNothing();

    await db.insert(users).values({
      authId: "dev-auth-id",
      organizationId: SYSTEM_ORG_ID,
      email: "admin@stocklogis.com",
      name: "슈퍼관리자",
      role: "admin",
      isSuperadmin: true,
    }).onConflictDoNothing();

    console.log("🛡️  System 조직 + 슈퍼관리자 생성 완료\n");

    // 2. 조직 생성
    const org = await seedOrganization();
    console.log(`\n📁 조직 생성: ${org.name} (${org.id})\n`);

    // 3. 공급자 생성
    const supplierList = await seedSuppliers(org.id);
    console.log(`👥 공급자 ${supplierList.length}개 생성\n`);

    // 4. 제품 생성
    const productList = await seedProducts(org.id, supplierList);
    console.log(`📦 제품 ${productList.length}개 생성\n`);

    // 5. 재고 생성
    await seedInventory(org.id, productList);
    console.log(`📊 재고 데이터 생성 완료\n`);

    // 6. 판매 기록 생성 (최근 90일)
    await seedSalesRecords(org.id, productList);
    console.log(`💰 판매 기록 생성 완료\n`);

    console.log("✅ 시드 데이터 생성 완료!");
    console.log(`
=================================
조직 ID: ${org.id}
공급자: ${supplierList.length}개
제품: ${productList.length}개
=================================
`);

    process.exit(0);
  } catch (error) {
    console.error("❌ 시드 데이터 생성 실패:", error);
    process.exit(1);
  }
}

seed();
