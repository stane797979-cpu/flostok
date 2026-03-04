/**
 * 2년치 입출고 시드 데이터 생성 스크립트
 *
 * 실행: npx tsx scripts/seed-2year-data.ts
 *
 * 생성 항목:
 * 1. 제품 보정 (safety_stock, cost_price, reorder_point, primary_supplier_id)
 * 2. 판매 기록 (sales_records) — 2년치 일별 데이터
 * 3. 입고 기록 (inbound_records) — 발주 기반 입고
 * 4. 재고 변동 이력 (inventory_history) — 입출고 추적
 * 5. 발주서 (purchase_orders + purchase_order_items) — 월 2~4회
 * 6. 현재 재고 (inventory) — 최종 잔고 반영
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, sql } from "drizzle-orm";
import {
  products,
  supplierProducts,
  suppliers,
  salesRecords,
  inboundRecords,
  inventoryHistory,
  inventory,
  purchaseOrders,
  purchaseOrderItems,
  warehouses,
} from "../src/server/db/schema";

// DB 연결
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL 환경변수가 필요합니다");
const client = postgres(DATABASE_URL, { max: 1, connect_timeout: 30 });
const db = drizzle(client);

const ORG_ID = "00000000-0000-0000-0000-000000000001";

// ─── 유틸리티 ──────────────────────────
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

// 계절 패턴 (1~12월 판매 가중치)
function seasonalMultiplier(month: number): number {
  // 1월: 0.7, 3월: 1.0, 6월: 0.8, 9월: 1.1, 11월: 1.3, 12월: 1.5 (연말 특수)
  const factors = [0.7, 0.8, 1.0, 1.0, 0.9, 0.8, 0.7, 0.85, 1.1, 1.0, 1.3, 1.5];
  return factors[month] ?? 1.0;
}

// 주중/주말 판매 패턴
function weekdayMultiplier(dayOfWeek: number): number {
  // 0=일, 6=토: 주말은 판매 적음
  if (dayOfWeek === 0) return 0.3;
  if (dayOfWeek === 6) return 0.5;
  return 1.0;
}

// 7단계 재고상태 분류
function classifyStatus(currentStock: number, safetyStock: number, reorderPoint: number): string {
  if (currentStock === 0) return "out_of_stock";
  if (currentStock < safetyStock * 0.5) return "critical";
  if (currentStock < safetyStock) return "shortage";
  if (currentStock < reorderPoint) return "caution";
  if (currentStock < safetyStock * 3.0) return "optimal";
  if (currentStock < safetyStock * 5.0) return "excess";
  return "overstock";
}

// ─── 제품별 시나리오 정의 ───────────────
interface ProductScenario {
  avgDailySales: number;  // 일평균 판매량
  salesVariance: number;  // 판매량 변동계수 (0~1)
  costRate: number;       // 판매가 대비 원가 비율 (0~1)
  leadTimeDays: number;   // 리드타임(일)
  safetyStockDays: number; // 안전재고 일수
  category: string;
}

// 카테고리별 기본 시나리오
const CATEGORY_SCENARIOS: Record<string, ProductScenario> = {
  "MC": { // 기계부품: 안정적 수요, 긴 리드타임
    avgDailySales: 8, salesVariance: 0.3, costRate: 0.65,
    leadTimeDays: 10, safetyStockDays: 5, category: "기계부품"
  },
  "EL": { // 전자부품: 높은 수요, 짧은 리드타임
    avgDailySales: 15, salesVariance: 0.4, costRate: 0.55,
    leadTimeDays: 5, safetyStockDays: 3, category: "전자부품"
  },
  "TL": { // 공구류: 낮은 수요, 안정적
    avgDailySales: 4, salesVariance: 0.2, costRate: 0.6,
    leadTimeDays: 7, safetyStockDays: 4, category: "공구류"
  },
  "OF": { // 사무용품: 높은 수요, 짧은 리드타임
    avgDailySales: 20, salesVariance: 0.3, costRate: 0.5,
    leadTimeDays: 3, safetyStockDays: 2, category: "사무용품"
  },
  "TEXL": { // 테스트 제품: 다양한 패턴
    avgDailySales: 6, salesVariance: 0.5, costRate: 0.6,
    leadTimeDays: 7, safetyStockDays: 4, category: "테스트"
  },
};

function getScenario(sku: string): ProductScenario {
  for (const [prefix, scenario] of Object.entries(CATEGORY_SCENARIOS)) {
    if (sku.startsWith(prefix)) return scenario;
  }
  return CATEGORY_SCENARIOS["TEXL"];
}

// ─── 메인 실행 ──────────────────────────
async function main() {
  console.log("🔄 2년치 시드 데이터 생성 시작...");
  console.log("조직 ID:", ORG_ID);

  // ── 1. 현재 데이터 조회 ──
  console.log("\n📋 기존 데이터 조회 중...");

  const allProducts = await db.select().from(products)
    .where(and(eq(products.organizationId, ORG_ID), sql`${products.deletedAt} IS NULL`));
  console.log(`  제품: ${allProducts.length}건`);

  const allSuppliers = await db.select().from(suppliers)
    .where(eq(suppliers.organizationId, ORG_ID));
  console.log(`  공급자: ${allSuppliers.length}건`);

  const allWarehouses = await db.select().from(warehouses)
    .where(and(eq(warehouses.organizationId, ORG_ID), eq(warehouses.isActive, true)));
  console.log(`  창고: ${allWarehouses.length}건`);

  const existingSupplierProducts = await db.select().from(supplierProducts);
  console.log(`  공급자-제품 매핑: ${existingSupplierProducts.length}건`);

  if (allProducts.length === 0 || allSuppliers.length === 0 || allWarehouses.length === 0) {
    console.error("❌ 기본 데이터가 부족합니다. 제품, 공급자, 창고가 필요합니다.");
    process.exit(1);
  }

  // ── 2. 기존 트랜잭션 데이터 정리 ──
  console.log("\n🧹 기존 트랜잭션 데이터 정리 중...");

  await db.delete(salesRecords).where(eq(salesRecords.organizationId, ORG_ID));
  console.log("  ✓ 판매 기록 삭제");

  await db.delete(inventoryHistory).where(eq(inventoryHistory.organizationId, ORG_ID));
  console.log("  ✓ 재고 이력 삭제");

  await db.delete(inboundRecords).where(eq(inboundRecords.organizationId, ORG_ID));
  console.log("  ✓ 입고 기록 삭제");

  // 발주 항목 → 발주서 순서로 삭제
  const existingPOs = await db.select({ id: purchaseOrders.id })
    .from(purchaseOrders).where(eq(purchaseOrders.organizationId, ORG_ID));
  if (existingPOs.length > 0) {
    const poIds = existingPOs.map(po => po.id);
    for (const poId of poIds) {
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
    }
    await db.delete(purchaseOrders).where(eq(purchaseOrders.organizationId, ORG_ID));
  }
  console.log("  ✓ 발주서 삭제");

  // ── 3. 제품 데이터 보정 ──
  console.log("\n🔧 제품 데이터 보정 중...");

  // TEXL 제품에 공급자 할당 (primary_supplier_id가 null인 경우)
  const productsWithoutSupplier = allProducts.filter(p => !p.primarySupplierId);
  if (productsWithoutSupplier.length > 0) {
    for (let i = 0; i < productsWithoutSupplier.length; i++) {
      const supplier = allSuppliers[i % allSuppliers.length];
      await db.update(products)
        .set({ primarySupplierId: supplier.id })
        .where(eq(products.id, productsWithoutSupplier[i].id));

      // supplier_products 매핑도 추가
      const existingMapping = existingSupplierProducts.find(
        sp => sp.supplierId === supplier.id && sp.productId === productsWithoutSupplier[i].id
      );
      if (!existingMapping) {
        await db.insert(supplierProducts).values({
          supplierId: supplier.id,
          productId: productsWithoutSupplier[i].id,
          unitPrice: productsWithoutSupplier[i].unitPrice || randomInt(5000, 50000),
          moq: productsWithoutSupplier[i].moq || 10,
          isPrimary: new Date(),
        });
      }
    }
    console.log(`  ✓ ${productsWithoutSupplier.length}개 제품에 공급자 할당`);
  }

  // 모든 제품의 safety_stock, cost_price, reorder_point 보정
  for (const p of allProducts) {
    const scenario = getScenario(p.sku);
    const unitPrice = p.unitPrice || randomInt(5000, 100000);
    const costPrice = Math.round(unitPrice * scenario.costRate);
    const safetyStock = Math.max(1, Math.round(scenario.avgDailySales * scenario.safetyStockDays));
    const reorderPoint = Math.max(
      safetyStock + 1,
      Math.round(scenario.avgDailySales * scenario.leadTimeDays + safetyStock)
    );
    const targetStock = Math.round(scenario.avgDailySales * 30); // 30일 목표재고
    const moq = p.moq || Math.max(10, Math.round(scenario.avgDailySales * 3));

    await db.update(products).set({
      unitPrice,
      costPrice,
      safetyStock,
      reorderPoint,
      targetStock,
      moq,
      leadTime: scenario.leadTimeDays,
    }).where(eq(products.id, p.id));

    // 실시간 업데이트용
    (p as Record<string, unknown>).unitPrice = unitPrice;
    (p as Record<string, unknown>).costPrice = costPrice;
    (p as Record<string, unknown>).safetyStock = safetyStock;
    (p as Record<string, unknown>).reorderPoint = reorderPoint;
    (p as Record<string, unknown>).moq = moq;
    (p as Record<string, unknown>).leadTime = scenario.leadTimeDays;
  }
  console.log(`  ✓ ${allProducts.length}개 제품 보정 완료`);

  // ── 4. 공급자 rating 보정 ──
  for (const s of allSuppliers) {
    await db.update(suppliers).set({
      rating: randomInt(70, 98),
      avgLeadTime: randomInt(3, 14),
    }).where(eq(suppliers.id, s.id));
  }
  console.log(`  ✓ ${allSuppliers.length}개 공급자 rating 보정`);

  // ── 5. 2년치 데이터 생성 ──
  console.log("\n📊 2년치 트랜잭션 데이터 생성 중...");

  const startDate = new Date("2024-03-01");
  const endDate = new Date("2026-03-03");
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`  기간: ${dateStr(startDate)} ~ ${dateStr(endDate)} (${totalDays}일)`);

  const mainWarehouse = allWarehouses.find(w => w.type === "MAIN") || allWarehouses[0];
  const subWarehouse = allWarehouses.find(w => w.type === "REGIONAL") || allWarehouses[1] || mainWarehouse;

  // 제품별 시뮬레이션 상태
  interface ProductState {
    stock: Record<string, number>; // warehouseId → 재고
    pendingOrders: Array<{ date: Date; qty: number; warehouseId: string; poId?: string }>;
    totalSold: number;
    lastOrderDate: Date | null;
  }

  const productStates = new Map<string, ProductState>();
  for (const p of allProducts) {
    const scenario = getScenario(p.sku);
    const initialStock = Math.round(scenario.avgDailySales * randomInt(15, 45));
    productStates.set(p.id, {
      stock: {
        [mainWarehouse.id]: Math.round(initialStock * 0.7),
        [subWarehouse.id]: Math.round(initialStock * 0.3),
      },
      pendingOrders: [],
      totalSold: 0,
      lastOrderDate: null,
    });
  }

  // 배치 insert를 위한 버퍼
  let salesBatch: Array<typeof salesRecords.$inferInsert> = [];
  let inboundBatch: Array<typeof inboundRecords.$inferInsert> = [];
  let historyBatch: Array<typeof inventoryHistory.$inferInsert> = [];
  let poBatch: Array<typeof purchaseOrders.$inferInsert> = [];
  let poItemsBatch: Array<{ poId: string; items: Array<typeof purchaseOrderItems.$inferInsert> }> = [];

  let poCounter = 1;

  async function flushBatches() {
    // FK 순서 중요: PO → PO items → inbound → sales → history
    if (poBatch.length > 0) {
      for (let i = 0; i < poBatch.length; i += 100) {
        await db.insert(purchaseOrders).values(poBatch.slice(i, i + 100));
      }
      poBatch = [];
    }
    if (poItemsBatch.length > 0) {
      for (const po of poItemsBatch) {
        if (po.items.length > 0) {
          await db.insert(purchaseOrderItems).values(po.items);
        }
      }
      poItemsBatch = [];
    }
    if (inboundBatch.length > 0) {
      for (let i = 0; i < inboundBatch.length; i += 500) {
        await db.insert(inboundRecords).values(inboundBatch.slice(i, i + 500));
      }
      inboundBatch = [];
    }
    if (salesBatch.length > 0) {
      for (let i = 0; i < salesBatch.length; i += 500) {
        await db.insert(salesRecords).values(salesBatch.slice(i, i + 500));
      }
      salesBatch = [];
    }
    if (historyBatch.length > 0) {
      for (let i = 0; i < historyBatch.length; i += 500) {
        await db.insert(inventoryHistory).values(historyBatch.slice(i, i + 500));
      }
      historyBatch = [];
    }
  }

  // 일별 시뮬레이션
  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const currentDate = addDays(startDate, dayOffset);
    const month = currentDate.getMonth();
    const dayOfWeek = currentDate.getDay();
    const dStr = dateStr(currentDate);
    const seasonMult = seasonalMultiplier(month);
    const weekdayMult = weekdayMultiplier(dayOfWeek);

    // 월 진행률 (0~1) - 서서히 성장하는 트렌드
    const progressRatio = dayOffset / totalDays;
    const growthFactor = 0.8 + progressRatio * 0.4; // 0.8 → 1.2 (2년간 50% 성장)

    for (const p of allProducts) {
      const state = productStates.get(p.id)!;
      const scenario = getScenario(p.sku);

      // ── 입고 처리 (pending orders 도착) ──
      const arrivedOrders = state.pendingOrders.filter(o => o.date <= currentDate);
      for (const order of arrivedOrders) {
        const wId = order.warehouseId;
        const stockBefore = state.stock[wId] || 0;
        state.stock[wId] = stockBefore + order.qty;

        historyBatch.push({
          organizationId: ORG_ID,
          warehouseId: wId,
          productId: p.id,
          date: dStr,
          stockBefore,
          stockAfter: state.stock[wId],
          changeAmount: order.qty,
          changeType: "inbound",
          referenceId: order.poId || null,
          referenceType: order.poId ? "purchase_order" : null,
          notes: `입고 ${order.qty}개`,
        });

        inboundBatch.push({
          organizationId: ORG_ID,
          warehouseId: wId,
          productId: p.id,
          purchaseOrderId: order.poId || null,
          date: dStr,
          expectedQuantity: order.qty,
          receivedQuantity: order.qty,
          acceptedQuantity: order.qty,
          rejectedQuantity: 0,
          qualityResult: "pass",
          lotNumber: `LOT-${dStr.replace(/-/g, "")}-${p.sku}`,
          notes: `${p.name} 입고`,
        });
      }
      state.pendingOrders = state.pendingOrders.filter(o => o.date > currentDate);

      // ── 판매 발생 (평일만 또는 주말 소량) ──
      const baseSales = scenario.avgDailySales * seasonMult * weekdayMult * growthFactor;
      const variance = 1 + (Math.random() - 0.5) * scenario.salesVariance * 2;
      let dailySales = Math.max(0, Math.round(baseSales * variance));

      // 가끔 대형 주문 (5% 확률)
      if (Math.random() < 0.05 && dayOfWeek >= 1 && dayOfWeek <= 5) {
        dailySales += Math.round(scenario.avgDailySales * randomInt(3, 8));
      }

      // 판매량은 총 재고를 초과할 수 없음
      const totalStock = Object.values(state.stock).reduce((a, b) => a + b, 0);
      dailySales = Math.min(dailySales, totalStock);

      if (dailySales > 0) {
        // 창고별 출고 비율 (메인 70%, 서브 30%)
        const mainSales = Math.min(
          Math.round(dailySales * 0.7),
          state.stock[mainWarehouse.id] || 0
        );
        const subSales = Math.min(
          dailySales - mainSales,
          state.stock[subWarehouse.id] || 0
        );
        const actualMainSales = mainSales;
        const actualSubSales = subSales;
        const actualTotal = actualMainSales + actualSubSales;

        if (actualTotal > 0) {
          // 판매 채널
          const channels = ["온라인", "오프라인", "B2B"];
          const channel = channels[randomInt(0, 2)];

          salesBatch.push({
            organizationId: ORG_ID,
            productId: p.id,
            date: dStr,
            quantity: actualTotal,
            unitPrice: p.unitPrice || 0,
            totalAmount: actualTotal * (p.unitPrice || 0),
            channel,
          });

          // 메인 창고 출고
          if (actualMainSales > 0) {
            const stockBefore = state.stock[mainWarehouse.id];
            state.stock[mainWarehouse.id] -= actualMainSales;
            historyBatch.push({
              organizationId: ORG_ID,
              warehouseId: mainWarehouse.id,
              productId: p.id,
              date: dStr,
              stockBefore,
              stockAfter: state.stock[mainWarehouse.id],
              changeAmount: -actualMainSales,
              changeType: "sale",
              notes: `판매 출고 ${actualMainSales}개 (${channel})`,
            });
          }

          // 서브 창고 출고
          if (actualSubSales > 0 && subWarehouse.id !== mainWarehouse.id) {
            const stockBefore = state.stock[subWarehouse.id] || 0;
            state.stock[subWarehouse.id] = (state.stock[subWarehouse.id] || 0) - actualSubSales;
            historyBatch.push({
              organizationId: ORG_ID,
              warehouseId: subWarehouse.id,
              productId: p.id,
              date: dStr,
              stockBefore,
              stockAfter: state.stock[subWarehouse.id],
              changeAmount: -actualSubSales,
              changeType: "sale",
              notes: `판매 출고 ${actualSubSales}개 (${channel})`,
            });
          }

          state.totalSold += actualTotal;
        }
      }

      // ── 발주 판단 (재고가 발주점 이하 & 최근 발주 후 5일 경과) ──
      const currentTotal = Object.values(state.stock).reduce((a, b) => a + b, 0);
      const reorderPoint = p.reorderPoint || Math.round(scenario.avgDailySales * scenario.leadTimeDays + (p.safetyStock || 0));
      const daysSinceLastOrder = state.lastOrderDate
        ? Math.floor((currentDate.getTime() - state.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (currentTotal <= reorderPoint && daysSinceLastOrder >= 5 && dayOfWeek >= 1 && dayOfWeek <= 5) {
        // 발주 수량 = 30일 목표재고 - 현재고 + 파이프라인 물량
        const pendingQty = state.pendingOrders.reduce((sum, o) => sum + o.qty, 0);
        const targetQty = Math.round(scenario.avgDailySales * growthFactor * 30);
        let orderQty = Math.max(0, targetQty - currentTotal - pendingQty);

        // MOQ 적용
        const moq = p.moq || 10;
        orderQty = Math.max(moq, Math.ceil(orderQty / moq) * moq);

        if (orderQty > 0) {
          const supplierId = p.primarySupplierId || allSuppliers[0].id;
          const leadTime = (p.leadTime || scenario.leadTimeDays) + randomInt(-1, 3); // 변동
          const arrivalDate = addDays(currentDate, Math.max(1, leadTime));
          const poNumber = `PO-${currentDate.getFullYear()}-${String(poCounter++).padStart(4, "0")}`;

          // 메인 창고 70%, 서브 30%
          const mainQty = Math.round(orderQty * 0.7);
          const subQty = orderQty - mainQty;

          const poId = crypto.randomUUID();

          poBatch.push({
            id: poId,
            organizationId: ORG_ID,
            destinationWarehouseId: mainWarehouse.id,
            orderNumber: poNumber,
            supplierId,
            status: "completed",
            totalAmount: orderQty * (p.costPrice || 0),
            orderDate: dStr,
            expectedDate: dateStr(arrivalDate),
            actualDate: dateStr(arrivalDate),
            notes: `자동발주 - ${p.name} ${orderQty}개`,
          });

          poItemsBatch.push({
            poId,
            items: [{
              purchaseOrderId: poId,
              productId: p.id,
              quantity: orderQty,
              unitPrice: p.costPrice || 0,
              totalPrice: orderQty * (p.costPrice || 0),
              receivedQuantity: orderQty,
            }],
          });

          // 입고 예정 등록
          state.pendingOrders.push({
            date: arrivalDate,
            qty: mainQty,
            warehouseId: mainWarehouse.id,
            poId,
          });
          if (subQty > 0 && subWarehouse.id !== mainWarehouse.id) {
            state.pendingOrders.push({
              date: addDays(arrivalDate, 1), // 서브 창고는 1일 후
              qty: subQty,
              warehouseId: subWarehouse.id,
              poId,
            });
          }

          state.lastOrderDate = currentDate;
        }
      }
    }

    // 7일마다 배치 flush
    if (dayOffset % 7 === 6 || dayOffset === totalDays - 1) {
      await flushBatches();
      const pct = Math.round((dayOffset / totalDays) * 100);
      process.stdout.write(`\r  진행: ${pct}% (${dayOffset + 1}/${totalDays}일)`);
    }
  }

  console.log("\n  ✓ 트랜잭션 데이터 생성 완료");

  // ── 6. 최종 재고 반영 ──
  console.log("\n📦 최종 재고 반영 중...");

  for (const p of allProducts) {
    const state = productStates.get(p.id)!;
    const scenario = getScenario(p.sku);
    const safetyStock = p.safetyStock || Math.round(scenario.avgDailySales * scenario.safetyStockDays);
    const reorderPoint = p.reorderPoint || Math.round(scenario.avgDailySales * scenario.leadTimeDays + safetyStock);

    for (const wh of allWarehouses) {
      const currentStock = Math.max(0, state.stock[wh.id] || 0);
      const inventoryValue = currentStock * (p.costPrice || 0);
      const avgDaily = scenario.avgDailySales;
      const daysOfInv = avgDaily > 0 ? (currentStock / avgDaily).toFixed(2) : null;
      const status = classifyStatus(currentStock, safetyStock, reorderPoint);

      // UPSERT
      await db.execute(sql`
        INSERT INTO inventory (
          id, organization_id, warehouse_id, product_id,
          current_stock, available_stock, status,
          inventory_value, days_of_inventory,
          last_updated_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${ORG_ID}, ${wh.id}, ${p.id},
          ${currentStock}, ${currentStock}, ${status}::inventory_status,
          ${inventoryValue}, ${daysOfInv},
          now(), now(), now()
        )
        ON CONFLICT (organization_id, warehouse_id, product_id)
        DO UPDATE SET
          current_stock = ${currentStock},
          available_stock = ${currentStock},
          status = ${status}::inventory_status,
          inventory_value = ${inventoryValue},
          days_of_inventory = ${daysOfInv},
          last_updated_at = now(),
          updated_at = now()
      `);
    }
  }
  console.log(`  ✓ ${allProducts.length * allWarehouses.length}개 재고 레코드 UPSERT`);

  // ── 7. 결과 통계 ──
  console.log("\n📈 최종 통계:");

  const [salesCount] = await db.select({ count: sql<number>`count(*)` }).from(salesRecords).where(eq(salesRecords.organizationId, ORG_ID));
  const [historyCount] = await db.select({ count: sql<number>`count(*)` }).from(inventoryHistory).where(eq(inventoryHistory.organizationId, ORG_ID));
  const [inboundCount] = await db.select({ count: sql<number>`count(*)` }).from(inboundRecords).where(eq(inboundRecords.organizationId, ORG_ID));
  const [poCount] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, ORG_ID));
  const [invCount] = await db.select({ count: sql<number>`count(*)` }).from(inventory).where(eq(inventory.organizationId, ORG_ID));

  console.log(`  판매 기록: ${Number(salesCount?.count || 0).toLocaleString()}건`);
  console.log(`  재고 이력: ${Number(historyCount?.count || 0).toLocaleString()}건`);
  console.log(`  입고 기록: ${Number(inboundCount?.count || 0).toLocaleString()}건`);
  console.log(`  발주서: ${Number(poCount?.count || 0).toLocaleString()}건`);
  console.log(`  현재 재고: ${Number(invCount?.count || 0).toLocaleString()}건`);

  // 재고 상태 분포
  const statusDist = await db.select({
    status: inventory.status,
    count: sql<number>`count(*)`,
  }).from(inventory)
    .where(eq(inventory.organizationId, ORG_ID))
    .groupBy(inventory.status);

  console.log("\n  📊 재고 상태 분포:");
  for (const row of statusDist) {
    console.log(`    ${row.status}: ${row.count}건`);
  }

  console.log("\n✅ 2년치 시드 데이터 생성 완료!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 에러:", err);
  process.exit(1);
});
