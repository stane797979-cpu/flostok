import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// 거래처 (판매처)
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  code: text("code"), // 거래처코드
  businessNumber: text("business_number"), // 사업자번호 (XXX-XX-XXXXX)
  representative: text("representative"), // 대표자
  contactName: text("contact_name"), // 담당자명
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  fax: text("fax"), // 팩스번호
  address: text("address"),
  channel: text("channel"), // 채널 (온라인몰/오픈마켓/홈쇼핑/도매/직영/기타)
  // 거래 조건
  paymentTerms: text("payment_terms"), // 결제조건 (예: "월말마감 익월말")
  notes: text("notes"),
  isActive: timestamp("is_active").defaultNow(), // null이면 비활성
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
