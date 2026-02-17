/**
 * 입고 데이터(inbound_records) → 재고이력(inventory_history) + 현재고(inventory) 동기화
 *
 * import-inbound-data.ts 로 넣은 입고 데이터가
 * inventory_history와 inventory에 반영되지 않은 문제를 해결합니다.
 *
 * 사용법: npx tsx scripts/sync-inbound-to-inventory.ts
 */

import "dotenv/config";
import { db } from "../src/server/db/index.js";
import {
  inboundRecords,
  inventoryHistory,
  inventory,
  products,
  warehouses,
} from "../src/server/db/schema/index.js";
import { eq, and, sql, asc } from "drizzle-orm";

const BATCH_SIZE = 100;

async function main() {
  console.log("=== 입고 → 재고이력/현재고 동기화 시작 ===\n");

  // 1. 조직 ID 가져오기
  const [firstProduct] = await db
    .select({ organizationId: products.organizationId })
    .from(products)
    .limit(1);

  if (!firstProduct) {
    console.error("제품이 없습니다.");
    process.exit(1);
  }
  const orgId = firstProduct.organizationId;
  console.log(`조직 ID: ${orgId}`);

  // 2. 기본 창고 가져오기
  const [defaultWarehouse] = await db
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.organizationId, orgId), eq(warehouses.isDefault, true)))
    .limit(1);

  if (!defaultWarehouse) {
    console.error("기본 창고가 없습니다.");
    process.exit(1);
  }
  const warehouseId = defaultWarehouse.id;
  console.log(`창고 ID: ${warehouseId}`);

  // 3. 모든 입고 데이터를 날짜순으로 가져오기
  const allInbound = await db
    .select({
      id: inboundRecords.id,
      productId: inboundRecords.productId,
      warehouseId: inboundRecords.warehouseId,
      date: inboundRecords.date,
      receivedQuantity: inboundRecords.receivedQuantity,
    })
    .from(inboundRecords)
    .where(eq(inboundRecords.organizationId, orgId))
    .orderBy(asc(inboundRecords.date), asc(inboundRecords.createdAt));

  console.log(`입고 레코드: ${allInbound.length}건`);

  if (allInbound.length === 0) {
    console.log("입고 데이터가 없습니다.");
    process.exit(0);
  }

  // 4. 기존 inventory_history 중 inbound 타입 삭제 (중복 방지)
  const deleted = await db
    .delete(inventoryHistory)
    .where(and(
      eq(inventoryHistory.organizationId, orgId),
      eq(inventoryHistory.changeType, "inbound"),
    ))
    .returning({ id: inventoryHistory.id });
  console.log(`기존 입고이력 삭제: ${deleted.length}건`);

  // 5. 제품별 누적 재고 추적하며 inventory_history 생성
  const productStock = new Map<string, number>(); // productId → 누적 수량
  const historyValues: Array<typeof inventoryHistory.$inferInsert> = [];

  for (const rec of allInbound) {
    const before = productStock.get(rec.productId) || 0;
    const after = before + rec.receivedQuantity;
    productStock.set(rec.productId, after);

    historyValues.push({
      organizationId: orgId,
      warehouseId: rec.warehouseId || warehouseId,
      productId: rec.productId,
      date: rec.date,
      stockBefore: before,
      stockAfter: after,
      changeAmount: rec.receivedQuantity,
      changeType: "inbound",
      referenceId: rec.id,
      referenceType: "inbound_record",
      notes: "입고 데이터 동기화",
    });
  }

  // 6. 배치 INSERT (inventory_history)
  let inserted = 0;
  for (let i = 0; i < historyValues.length; i += BATCH_SIZE) {
    const batch = historyValues.slice(i, i + BATCH_SIZE);
    await db.insert(inventoryHistory).values(batch);
    inserted += batch.length;
    if (inserted % 1000 === 0 || inserted === historyValues.length) {
      console.log(`  이력 INSERT: ${inserted} / ${historyValues.length}`);
    }
  }
  console.log(`\n재고이력 생성 완료: ${inserted}건`);

  // 7. inventory 테이블 업데이트 (제품별 현재고)
  let updatedCount = 0;
  for (const [productId, totalQty] of productStock) {
    // 기존 inventory 레코드가 있으면 currentStock에 합산, 없으면 생성
    const [existing] = await db
      .select({ id: inventory.id, currentStock: inventory.currentStock })
      .from(inventory)
      .where(and(
        eq(inventory.organizationId, orgId),
        eq(inventory.productId, productId),
      ))
      .limit(1);

    if (existing) {
      // 기존 재고에 입고 총량 반영 (이미 반영된 양이 있을 수 있으므로,
      // 입고 총량을 그대로 세팅하지 않고 현재 값을 유지)
      // 하지만 이 스크립트는 최초 동기화이므로 입고 총량을 세팅
      await db
        .update(inventory)
        .set({
          currentStock: totalQty,
          availableStock: totalQty,
          lastUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, existing.id));
    } else {
      await db
        .insert(inventory)
        .values({
          organizationId: orgId,
          warehouseId: warehouseId,
          productId: productId,
          currentStock: totalQty,
          availableStock: totalQty,
          reservedStock: 0,
          incomingStock: 0,
          status: "optimal",
        });
    }
    updatedCount++;
  }
  console.log(`현재고 업데이트: ${updatedCount}개 제품`);

  // 8. 검증
  const [historyCount] = await db
    .select({ c: sql<number>`count(*)` })
    .from(inventoryHistory)
    .where(and(
      eq(inventoryHistory.organizationId, orgId),
      eq(inventoryHistory.changeType, "inbound"),
    ));
  console.log(`\n=== 검증 ===`);
  console.log(`inventory_history (입고): ${historyCount.c}건`);

  const invRows = await db
    .select({
      totalProducts: sql<number>`count(*)`,
      totalStock: sql<number>`sum(current_stock)`,
    })
    .from(inventory)
    .where(eq(inventory.organizationId, orgId));
  console.log(`inventory 제품수: ${invRows[0].totalProducts}개`);
  console.log(`inventory 총 현재고: ${invRows[0].totalStock}개`);

  // 날짜 범위 확인
  const [dateRange] = await db
    .select({
      minDate: sql<string>`min(date)`,
      maxDate: sql<string>`max(date)`,
    })
    .from(inventoryHistory)
    .where(and(
      eq(inventoryHistory.organizationId, orgId),
      eq(inventoryHistory.changeType, "inbound"),
    ));
  console.log(`이력 날짜 범위: ${dateRange.minDate} ~ ${dateRange.maxDate}`);

  console.log("\n=== 동기화 완료 ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
