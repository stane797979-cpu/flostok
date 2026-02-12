import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  date,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";

// 결품 원인
export const stockoutCauseEnum = pgEnum("stockout_cause", [
  "delivery_delay", // 납기지연
  "demand_surge", // 수요급증
  "supply_shortage", // 공급부족
  "forecast_error", // 예측오류
  "quality_issue", // 품질이슈
  "other", // 기타
]);

// 결품 조치 상태
export const stockoutActionStatusEnum = pgEnum("stockout_action_status", [
  "normalized", // 정상화
  "inbound_waiting", // 입고대기
  "order_in_progress", // 발주진행
  "no_action", // 미조치
]);

// 결품 기록
export const stockoutRecords = pgTable("stockout_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  referenceDate: date("reference_date").notNull(), // 기준일
  baseStock: integer("base_stock").default(0), // 기초재고
  outboundQty: integer("outbound_qty").default(0), // 출고량
  closingStock: integer("closing_stock").default(0), // 기말재고
  isStockout: boolean("is_stockout").default(false).notNull(),
  stockoutStartDate: date("stockout_start_date"),
  stockoutEndDate: date("stockout_end_date"),
  durationDays: integer("duration_days"),
  cause: stockoutCauseEnum("cause"),
  actionStatus: stockoutActionStatusEnum("action_status").default("no_action"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("stockout_records_org_date_idx").on(table.organizationId, table.referenceDate),
  index("stockout_records_org_product_idx").on(table.organizationId, table.productId),
]);

export type StockoutRecord = typeof stockoutRecords.$inferSelect;
export type NewStockoutRecord = typeof stockoutRecords.$inferInsert;
