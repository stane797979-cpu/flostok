/**
 * 재고 변동 기반 자동 알림 트리거
 *
 * processInventoryTransaction() 후에 fire-and-forget으로 호출.
 * 품절/위험/부족/과다 등 상태 전환 시 자동 알림 생성.
 * 같은 제품에 대해 미읽은 동일 유형 알림이 있으면 중복 생성하지 않음.
 */

import { db } from "@/server/db";
import { alerts, products } from "@/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";

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

/**
 * 재고 변동 후 자동 알림을 배치로 생성합니다.
 * N+1 쿼리 없이 3개의 쿼리(기존 알림 조회 + 제품 조회 + 알림 INSERT)로 처리합니다.
 * fire-and-forget으로 호출되므로 에러가 발생해도 메인 작업에 영향을 주지 않습니다.
 */
export async function checkAndCreateInventoryAlertsBatch(
  contexts: InventoryAlertContext[]
): Promise<void> {
  try {
    if (contexts.length === 0) return;

    // 알림 대상 상태인 항목만 필터링 + 템플릿 매핑
    const alertable = contexts
      .filter(ctx => ALERTABLE_STATUSES.has(ctx.newStatus))
      .map(ctx => ({ ctx, template: ALERT_TEMPLATES[ctx.newStatus]! }))
      .filter(({ template }) => template !== undefined);

    if (alertable.length === 0) return;

    // organizationId는 배치 내 모두 동일하다고 가정 (호출부 구조상 보장됨)
    const organizationId = alertable[0].ctx.organizationId;
    const productIds = [...new Set(alertable.map(({ ctx }) => ctx.productId))];

    // 쿼리 1: 미읽은 기존 알림 일괄 조회
    const existingAlerts = await db
      .select({
        productId: alerts.productId,
        type: alerts.type,
      })
      .from(alerts)
      .where(
        and(
          eq(alerts.organizationId, organizationId),
          inArray(alerts.productId, productIds),
          eq(alerts.isRead, false)
        )
      );

    // (productId, type) 조합으로 중복 체크용 Set 구성
    const existingSet = new Set(
      existingAlerts.map(a => `${a.productId}::${a.type}`)
    );

    // 신규 알림이 필요한 항목만 추려냄
    const needsAlert = alertable.filter(
      ({ ctx, template }) =>
        !existingSet.has(`${ctx.productId}::${template.type}`)
    );

    if (needsAlert.length === 0) return;

    // 쿼리 2: 신규 알림 대상 제품 정보 일괄 조회
    const needsProductIds = [
      ...new Set(needsAlert.map(({ ctx }) => ctx.productId)),
    ];
    const productRows = await db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(inArray(products.id, needsProductIds));

    const productMap = new Map(productRows.map(p => [p.id, p]));

    // 삽입할 알림 배열 계산 (메모리 내 중복 제거 포함)
    const seenInsert = new Set<string>();
    const insertValues = needsAlert.flatMap(({ ctx, template }) => {
      const product = productMap.get(ctx.productId);
      if (!product) return [];

      // 같은 배치 내 (productId, type) 중복 방지
      const key = `${ctx.productId}::${template.type}`;
      if (seenInsert.has(key)) return [];
      seenInsert.add(key);

      return [
        {
          organizationId: ctx.organizationId,
          type: template.type,
          severity: template.severity,
          productId: ctx.productId,
          title: template.title,
          message: template.message(product.name, product.sku, ctx.stockAfter),
          actionUrl: `/dashboard/inventory?productId=${ctx.productId}`,
        },
      ];
    });

    if (insertValues.length === 0) return;

    // 쿼리 3: 알림 배치 INSERT
    await db.insert(alerts).values(insertValues);
  } catch (error) {
    // fire-and-forget: 에러 로깅만 하고 메인 작업에 영향 없음
    console.error("재고 알림 배치 생성 실패:", error);
  }
}
