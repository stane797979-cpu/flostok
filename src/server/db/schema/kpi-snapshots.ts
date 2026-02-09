import { pgTable, uuid, text, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// KPI 월별 스냅샷 (통합지표)
export const kpiMonthlySnapshots = pgTable("kpi_monthly_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  period: date("period").notNull(), // 월 첫째날 (2026-01-01)
  // KPI 값
  turnoverRate: numeric("turnover_rate", { precision: 8, scale: 4 }), // 재고회전율
  stockoutRate: numeric("stockout_rate", { precision: 6, scale: 4 }), // 결품률
  onTimeDeliveryRate: numeric("on_time_delivery_rate", { precision: 6, scale: 4 }), // 납기준수율
  fulfillmentRate: numeric("fulfillment_rate", { precision: 6, scale: 4 }), // 발주충족률
  actualShipmentRate: numeric("actual_shipment_rate", { precision: 6, scale: 4 }), // 실출고율
  // 코멘트
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type KpiMonthlySnapshot = typeof kpiMonthlySnapshots.$inferSelect;
export type NewKpiMonthlySnapshot = typeof kpiMonthlySnapshots.$inferInsert;
