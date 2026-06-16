/**
 * 재고 변동 기반 자동 알림 트리거
 *
 * processInventoryTransaction() 후에 fire-and-forget으로 호출.
 * 품절/위험/부족/과다 등 상태 전환 시 자동 알림 생성.
 * 같은 제품에 대해 미읽은 동일 유형 알림이 있으면 중복 생성하지 않음.
 */

import { db } from "@/server/db";
import { alerts, products } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

interface InventoryAlertContext {
  organizationId: string;
  productId: string;
  stockBefore: number;
  stockAfter: number;
  newStatus: string;
}

type AlertType =
  | "stock_critical"
  | "stock_shortage"
  | "stock_excess";

interface AlertTemplate {
  type: AlertType;
  severity: "info" | "warning" | "critical";
  title: string;
  message: (productName: string, sku: string, stock: number) => string;
}

/** 재고 상태별 알림 템플릿 */
const ALERT_TEMPLATES: Record<string, AlertTemplate> = {
  out_of_stock: {
    type: "stock_critical",
    severity: "critical",
    title: "품절 발생",
    message: (name, sku, stock) =>
      `[${sku}] ${name} 재고가 소진되었습니다 (현재고: ${stock}개). 즉시 발주가 필요합니다.`,
  },
  critical: {
    type: "stock_critical",
    severity: "critical",
    title: "재고 위험",
    message: (name, sku, stock) =>
      `[${sku}] ${name} 재고가 위험 수준입니다 (현재고: ${stock}개). 긴급 발주를 검토하세요.`,
  },
  shortage: {
    type: "stock_shortage",
    severity: "warning",
    title: "재고 부족",
    message: (name, sku, stock) =>
      `[${sku}] ${name} 재고가 안전재고 미만입니다 (현재고: ${stock}개). 발주를 검토하세요.`,
  },
  excess: {
    type: "stock_excess",
    severity: "info",
    title: "재고 과다",
    message: (name, sku, stock) =>
      `[${sku}] ${name} 재고가 과다합니다 (현재고: ${stock}개). 재고 최적화를 검토하세요.`,
  },
  overstock: {
    type: "stock_excess",
    severity: "warning",
    title: "재고 과잉",
    message: (name, sku, stock) =>
      `[${sku}] ${name} 재고가 과잉 수준입니다 (현재고: ${stock}개). 과잉 재고 처리를 검토하세요.`,
  },
};

/** 알림을 생성해야 하는 상태 목록 */
const ALERTABLE_STATUSES = new Set([
  "out_of_stock",
  "critical",
  "shortage",
  "excess",
  "overstock",
]);

/**
 * 재고 변동 후 자동 알림을 생성합니다.
 * fire-and-forget으로 호출되므로 에러가 발생해도 메인 작업에 영향을 주지 않습니다.
 */
export async function checkAndCreateInventoryAlert(
  context: InventoryAlertContext
): Promise<void> {
  try {
    const { organizationId, productId, newStatus } = context;

    // 알림 대상 상태가 아니면 무시
    if (!ALERTABLE_STATUSES.has(newStatus)) {
      return;
    }

    const template = ALERT_TEMPLATES[newStatus];
    if (!template) {
      return;
    }

    // 같은 제품에 대해 미읽은 동일 유형 알림이 있으면 중복 생성하지 않음
    const existingAlert = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.organizationId, organizationId),
          eq(alerts.productId, productId),
          eq(alerts.type, template.type),
          eq(alerts.isRead, false)
        )
      )
      .limit(1);

    if (existingAlert.length > 0) {
      return;
    }

    // 제품 정보 조회
    const [product] = await db
      .select({ sku: products.sku, name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return;
    }

    // 알림 생성
    await db.insert(alerts).values({
      organizationId,
      type: template.type,
      severity: template.severity,
      productId,
      title: template.title,
      message: template.message(product.name, product.sku, context.stockAfter),
      actionUrl: `/dashboard/inventory?productId=${productId}`,
    });
  } catch (error) {
    // fire-and-forget: 에러 로깅만 하고 메인 작업에 영향 없음
    console.error("재고 알림 자동 생성 실패:", error);
  }
}
