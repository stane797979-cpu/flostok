import { pgTable, uuid, text, timestamp, integer, date, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";

// 판매 기록
export const salesRecords = pgTable("sales_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(), // 판매일
  quantity: integer("quantity").notNull(), // 판매수량
  unitPrice: integer("unit_price"), // 판매단가 (원)
  totalAmount: integer("total_amount"), // 총 판매금액 (원)
  channel: text("channel"), // 판매 채널 (온라인, 오프라인, B2B 등)
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("sales_records_org_date_idx").on(table.organizationId, table.date),
  index("sales_records_product_date_idx").on(table.productId, table.date),
  index("sales_records_org_product_date_idx").on(table.organizationId, table.productId, table.date),
]);

export type SalesRecord = typeof salesRecords.$inferSelect;
export type NewSalesRecord = typeof salesRecords.$inferInsert;
