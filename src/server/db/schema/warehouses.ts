import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// 창고 유형
export const warehouseTypeEnum = ["MAIN", "REGIONAL", "VIRTUAL", "THIRD_PARTY"] as const;

// 창고
export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    code: text("code").notNull(), // MAIN, SEOUL, BUSAN 등 (영문/숫자/밑줄)
    name: text("name").notNull(), // 본사 창고, 서울 물류센터 등
    type: text("type").default("MAIN").notNull(), // MAIN, REGIONAL, VIRTUAL, THIRD_PARTY
    address: text("address"), // 주소 (선택)
    isActive: boolean("is_active").default(true).notNull(), // 활성 여부
    isDefault: boolean("is_default").default(false).notNull(), // 조직의 기본 창고
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("warehouses_org_code_unique").on(
      table.organizationId,
      table.code
    ),
    index("warehouses_org_idx").on(table.organizationId),
    index("warehouses_org_active_idx").on(table.organizationId, table.isActive),
  ]
);

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
