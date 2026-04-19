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
import { sql } from "drizzle-orm";
import { eq, not } from "drizzle-orm";
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

async function clearDatabase(orgId: string) {
  console.log(`🗑️  기존 데이터 삭제 중... (조직: ${orgId})`);

  // 해당 조직의 데이터만 삭제 (다른 조직 데이터 보호)
  await db.delete(inventoryHistory).where(eq(inventoryHistory.organizationId, orgId));
  await db.delete(salesRecords).where(eq(salesRecords.organizationId, orgId));
  await db.delete(inventory).where(eq(inventory.organizationId, orgId));
  await db.delete(products).where(eq(products.organizationId, orgId));
  await db.delete(suppliers).where(eq(suppliers.organizationId, orgId));

  console.log("✅ 기존 데이터 삭제 완료");
}

async function seed() {
  console.log("🌱 시드 데이터 생성 시작...\n");

  try {
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

    // 2. 조직 확인/생성
    const org = await seedOrganization();
    console.log(`\n📁 조직: ${org.name} (${org.id})\n`);

    // 3. 해당 조직의 기존 데이터만 삭제
    await clearDatabase(org.id);

    // 4. 기본 창고 생성 (warehouse_id NOT NULL 제약 대응)
    const warehouseRows = await db.execute(sql`
      INSERT INTO warehouses (organization_id, name, code, is_active)
      VALUES (${org.id}, '본사 창고', 'WH-MAIN', true)
      RETURNING id
    `);
    const warehouseId = (warehouseRows[0] as { id: string })?.id;
    if (!warehouseId) throw new Error("창고 생성 실패");
    console.log(`🏭 창고 생성: ${warehouseId}\n`);
    process.env._SEED_WAREHOUSE_ID = warehouseId;

    // 5. 공급자 생성
    const supplierList = await seedSuppliers(org.id);
    console.log(`👥 공급자 ${supplierList.length}개 생성\n`);

    // 6. 제품 생성
    const productList = await seedProducts(org.id, supplierList);
    console.log(`📦 제품 ${productList.length}개 생성\n`);

    // 7. 재고 생성
    await seedInventory(org.id, productList);
    console.log(`📊 재고 데이터 생성 완료\n`);

    // 8. 판매 기록 생성 (최근 90일)
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
