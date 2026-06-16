import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * 활동 로그 — 솔루션 내 모든 입출력의 연/월/일/시간 기록
 *
 * action: CREATE | UPDATE | DELETE | IMPORT | EXPORT
 * entityType: product | supplier | inventory | purchase_order |
 *             sales_record | inbound_record | outbound_record |
 *             organization_settings | excel_import | excel_export
 */
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    userName: text("user_name"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    description: text("description").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgCreatedAtIdx: index("activity_logs_org_created_at_idx").on(
      table.organizationId,
      table.createdAt
    ),
    entityTypeIdx: index("activity_logs_entity_type_idx").on(
      table.organizationId,
      table.entityType
    ),
  })
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
