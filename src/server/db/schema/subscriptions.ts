import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * 구독 정보
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  plan: text("plan").notNull(), // free, starter, pro, enterprise
  status: text("status").notNull(), // active, canceled, expired, pending, failed
  billingCycle: text("billing_cycle").notNull(), // monthly, yearly
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
