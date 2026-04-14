/**
 * 재고 시드 데이터
 *
 * 다양한 재고 상태를 가진 현실적인 재고 데이터
 */

import { db } from "../index";
import { sql } from "drizzle-orm";
import { type Product } from "../schema";
import { classifyInventoryStatus } from "@/server/services/scm/inventory-status";

interface InventoryScenario {
  stockRatio: number; // reorderPoint 대비 재고 비율
  description: string;
}

// 제품별 재고 시나리오 (다양한 상태 분포)
const INVENTORY_SCENARIOS: Record<string, InventoryScenario> = {
  // A등급: 다양한 상태
  "SKU-A001": { stockRatio: 1.5, description: "적정 재고" },
  "SKU-A002": { stockRatio: 0.3, description: "부족 - 긴급 발주 필요" },
  "SKU-A003": { stockRatio: 1.2, description: "적정 재고" },
  "SKU-A004": { stockRatio: 0.6, description: "주의 - 발주 검토 필요" },
  "SKU-A005": { stockRatio: 0, description: "품절" },
  "SKU-A006": { stockRatio: 3.5, description: "과다 - 시즌 대비" },

  // B등급
  "SKU-B001": { stockRatio: 1.0, description: "적정 재고" },
  "SKU-B002": { stockRatio: 2.0, description: "여유 재고" },
  "SKU-B003": { stockRatio: 0.4, description: "위험 수준" },
  "SKU-B004": { stockRatio: 1.3, description: "적정 재고" },
  "SKU-B005": { stockRatio: 0.8, description: "주의 수준" },

  // C등급
  "SKU-C001": { stockRatio: 2.5, description: "과다 - 저회전" },
  "SKU-C002": { stockRatio: 1.1, description: "적정 재고" },
  "SKU-C003": { stockRatio: 0.5, description: "부족" },
  "SKU-C004": { stockRatio: 5.0, description: "과잉 - 단종 예정" },
  "SKU-C005": { stockRatio: 4.0, description: "과다 - 저회전" },
};

export async function seedInventory(organizationId: string, productList: Product[]): Promise<void> {
  for (const product of productList) {
    const scenario = INVENTORY_SCENARIOS[product.sku] || { stockRatio: 1.0, description: "기본" };

    // 재고 수량 계산
    const currentStock = Math.round((product.reorderPoint || 100) * scenario.stockRatio);

    // 재고 상태 분류
    const statusResult = classifyInventoryStatus({
      currentStock,
      safetyStock: product.safetyStock || 0,
      reorderPoint: product.reorderPoint || 0,
    });

    // 재고 금액 계산
    const inventoryValue = currentStock * (product.costPrice || 0);

    const warehouseId = process.env._SEED_WAREHOUSE_ID;
    if (!warehouseId) throw new Error("_SEED_WAREHOUSE_ID 환경변수 없음");

    // Drizzle 스키마에 warehouseId 없으므로 raw SQL로 삽입
    await db.execute(sql`
      INSERT INTO inventory
        (organization_id, product_id, warehouse_id, current_stock, available_stock,
         reserved_stock, incoming_stock, status, inventory_value)
      VALUES
        (${organizationId}, ${product.id}, ${warehouseId}, ${currentStock}, ${currentStock},
         0, 0, ${statusResult.key}, ${inventoryValue})
    `);

    const statusEmoji = getStatusEmoji(statusResult.key);
    console.log(
      `  ${statusEmoji} ${product.sku}: ${currentStock}개 (${statusResult.status.label}) - ${scenario.description}`
    );
  }
}

function getStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    out_of_stock: "⚫",
    critical: "🔴",
    shortage: "🟠",
    caution: "🟡",
    optimal: "🟢",
    excess: "🔵",
    overstock: "🟣",
  };
  return emojiMap[status] || "⚪";
}
