import { pgTable, uuid, text, timestamp, pgEnum, boolean, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "viewer", "warehouse"]);

// 사용자
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id").unique().notNull(), // Supabase Auth UID
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").default("viewer").notNull(),
  isSuperadmin: boolean("is_superadmin").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // 탈퇴일 (soft delete)
  withdrawalReason: text("withdrawal_reason"), // 탈퇴 사유
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_org_idx").on(table.organizationId),
]);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
