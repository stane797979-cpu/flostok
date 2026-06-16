import { pgTable, uuid, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";

// 알림 유형
export const alertTypeEnum = pgEnum("alert_type", [
  "stock_critical", // 재고 위험
  "stock_shortage", // 재고 부족
  "stock_excess", // 재고 과다
  "order_delay", // 발주 지연
  "demand_surge", // 수요 급증
  "demand_drop", // 수요 급감
  "price_change", // 가격 변동
  "supplier_issue", // 공급자 이슈
  "order_pending", // 발주 승인 대기
  "inbound_expected", // 입고 예정
  "system", // 시스템 알림
]);

// 알림 심각도
export const alertSeverityEnum = pgEnum("alert_severity", [
  "info", // 정보
  "warning", // 경고
  "critical", // 긴급
]);

// 알림
export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  type: alertTypeEnum("type").notNull(),
  severity: alertSeverityEnum("severity").default("info").notNull(),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"), // 클릭 시 이동할 URL
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // 만료 시간
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
