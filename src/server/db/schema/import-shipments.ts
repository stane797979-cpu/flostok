import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";
import { purchaseOrders } from "./purchase-orders";

// 입항스케줄 (수입 기업용)
export const importShipments = pgTable("import_shipments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, {
    onDelete: "set null",
  }),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  // 서류 번호
  blNumber: text("bl_number"), // B/L#
  containerNumber: text("container_number"), // CNTR#
  invoiceNumber: text("invoice_number"), // Invoice#
  customsDeclarationNumber: text("customs_declaration_number"), // 신고필증#
  // 수량
  containerQty: integer("container_qty"), // 컨테이너수량
  cartonQty: integer("carton_qty"), // 카톤수
  quantity: integer("quantity").notNull(), // 수량
  // 금액 (달러)
  unitPriceUsd: numeric("unit_price_usd", { precision: 10, scale: 2 }),
  invoiceAmountUsd: numeric("invoice_amount_usd", { precision: 12, scale: 2 }),
  // 날짜
  etaDate: date("eta_date"), // 입항예정일
  ataDate: date("ata_date"), // 입항일 (실제)
  warehouseEtaDate: date("warehouse_eta_date"), // 창고입고예정일
  warehouseActualDate: date("warehouse_actual_date"), // 창고실입고일
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ImportShipment = typeof importShipments.$inferSelect;
export type NewImportShipment = typeof importShipments.$inferInsert;
