import { pgTable, uuid, text, timestamp, integer, numeric, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";

// 공급자
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  code: text("code"), // 공급자 코드
  businessNumber: text("business_number"), // 사업자번호 (XXX-XX-XXXXX)
  contactName: text("contact_name"), // 담당자명
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  // 거래 조건
  paymentTerms: text("payment_terms"), // 결제조건 (예: "월말마감 익월말")
  minOrderAmount: integer("min_order_amount").default(0), // 최소발주금액 (원)
  // 리드타임 (일)
  avgLeadTime: integer("avg_lead_time").default(7), // 평균
  minLeadTime: integer("min_lead_time").default(3), // 최소
  maxLeadTime: integer("max_lead_time").default(14), // 최대
  leadTimeStddev: numeric("lead_time_stddev", { precision: 5, scale: 2 }), // 리드타임 표준편차
  // 평가
  rating: numeric("rating", { precision: 3, scale: 1 }).default("0"), // 종합 평점 (0-100)
  notes: text("notes"),
  metadata: jsonb("metadata").default({}),
  isActive: timestamp("is_active").defaultNow(), // null이면 비활성
  // Soft Delete
  deletedAt: timestamp("deleted_at", { withTimezone: true }), // null이면 활성
  deletedBy: uuid("deleted_by"), // 삭제 실행자
  deletionReason: text("deletion_reason"), // 삭제 사유
  deletionMetadata: jsonb("deletion_metadata").default({}), // 삭제 전 스냅샷
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("suppliers_org_idx").on(table.organizationId),
  // 부분 인덱스: soft-delete 쿼리 성능 최적화 (deleted_at IS NULL인 행만 인덱싱)
  index("suppliers_org_active_idx").on(table.organizationId).where(sql`deleted_at IS NULL`),
]);

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
