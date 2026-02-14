import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";
import { warehouses } from "./warehouses";
import { users } from "./users";

// 출고요청 상태
export const outboundRequestStatusEnum = pgEnum("outbound_request_status", [
  "pending", // 대기 (백오피스에서 생성)
  "confirmed", // 출고완료 (창고에서 확인)
  "cancelled", // 취소
]);

// 출고요청
export const outboundRequests = pgTable(
  "outbound_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    sourceWarehouseId: uuid("source_warehouse_id")
      .references(() => warehouses.id, { onDelete: "cascade" })
      .notNull(),
    targetWarehouseId: uuid("target_warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    requestNumber: text("request_number").notNull(), // OR-YYYYMMDD-XXX
    status: outboundRequestStatusEnum("status").default("pending").notNull(),
    outboundType: text("outbound_type").notNull(), // OUTBOUND_SALE, OUTBOUND_TRANSFER 등
    requestedById: uuid("requested_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedById: uuid("confirmed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("outbound_requests_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    index("outbound_requests_org_date_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("outbound_requests_source_warehouse_idx").on(table.sourceWarehouseId),
  ]
);

// 출고요청 항목
export const outboundRequestItems = pgTable(
  "outbound_request_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outboundRequestId: uuid("outbound_request_id")
      .references(() => outboundRequests.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    requestedQuantity: integer("requested_quantity").notNull(),
    confirmedQuantity: integer("confirmed_quantity"), // 실제 출고 수량 (창고 확인 시)
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("outbound_request_items_request_idx").on(table.outboundRequestId),
    index("outbound_request_items_product_idx").on(table.productId),
  ]
);

export type OutboundRequest = typeof outboundRequests.$inferSelect;
export type NewOutboundRequest = typeof outboundRequests.$inferInsert;
export type OutboundRequestItem = typeof outboundRequestItems.$inferSelect;
export type NewOutboundRequestItem = typeof outboundRequestItems.$inferInsert;
