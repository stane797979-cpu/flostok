import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

// 조직 (멀티테넌시의 기본 단위)
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(), // URL 친화적 식별자
  logoUrl: text("logo_url"),
  plan: text("plan").default("enterprise").notNull(), // free, starter, pro, enterprise
  settings: jsonb("settings").default({}), // 조직별 설정 (리드타임 기본값, 안전재고 배수 등)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
