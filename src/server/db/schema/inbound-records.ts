import { pgTable, uuid, text, timestamp, integer, pgEnum, date, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";
import { warehouses } from "./warehouses";
import { purchaseOrders } from "./purchase-orders";
import { users } from "./users";

// 품질 검수 결과
export const qualityResultEnum = pgEnum("quality_result", [
  "pass", // 합격
  "fail", // 불합격
  "partial", // 부분 합격
  "pending", // 검수 대기
]);

// 입고 기록
export const inboundRecords = pgTable("inbound_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  warehouseId: uuid("warehouse_id")
    .references(() => warehouses.id, { onDelete: "cascade" })
    .notNull(),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
    onDelete: "set null",
  }),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  date: date("date").notNull(), // 입고일
  expectedQuantity: integer("expected_quantity"), // 예상 수량
  receivedQuantity: integer("received_quantity").notNull(), // 실제 입고 수량
  acceptedQuantity: integer("accepted_quantity"), // 합격 수량
  rejectedQuantity: integer("rejected_quantity").default(0), // 불합격 수량
  qualityResult: qualityResultEnum("quality_result").default("pending"),
  inspectedById: uuid("inspected_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  inspectedAt: timestamp("inspected_at", { withTimezone: true }),
  location: text("location"), // 창고 내 적치 위치
  lotNumber: text("lot_number"), // LOT 번호
  expiryDate: date("expiry_date"), // 유통기한 (해당시)
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("inbound_records_org_date_idx").on(table.organizationId, table.date),
  index("inbound_records_product_date_idx").on(table.productId, table.date),
  index("inbound_records_po_idx").on(table.purchaseOrderId),
  index("inbound_records_warehouse_date_idx").on(table.warehouseId, table.date),
]);

export type InboundRecord = typeof inboundRecords.$inferSelect;
export type NewInboundRecord = typeof inboundRecords.$inferInsert;
