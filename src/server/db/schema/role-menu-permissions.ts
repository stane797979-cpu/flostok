import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { userRoleEnum } from "./users";

// 역할별 메뉴 권한 (조직별 커스터마이징)
export const roleMenuPermissions = pgTable(
  "role_menu_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    role: userRoleEnum("role").notNull(),
    menuKey: text("menu_key").notNull(),
    isAllowed: boolean("is_allowed").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("role_menu_permissions_unique_idx").on(
      table.organizationId,
      table.role,
      table.menuKey
    ),
  ]
);

export type RoleMenuPermission = typeof roleMenuPermissions.$inferSelect;
export type NewRoleMenuPermission = typeof roleMenuPermissions.$inferInsert;
