import {
  pgTable,
  uuid,
  integer,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";

/**
 * PSI 계획 데이터 (S&OP 물량 + 입고계획)
 * SKU별 월별로 S&OP 물량과 입고계획을 저장
 * 엑셀 업로드 또는 수동 입력으로 관리
 */
export const psiPlans = pgTable(
  "psi_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    /** 월 기준일 (YYYY-MM-01) */
    period: date("period").notNull(),
    /** S&OP 물량 (공급계획 수량) */
    sopQuantity: integer("sop_quantity").default(0).notNull(),
    /** 입고계획 수량 */
    inboundPlanQuantity: integer("inbound_plan_quantity").default(0).notNull(),
    /** 출고계획 수량 (수동 엑셀 업로드) */
    outboundPlanQuantity: integer("outbound_plan_quantity").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("psi_plans_org_product_period_idx").on(
      table.organizationId,
      table.productId,
      table.period
    ),
  ]
);

export type PSIPlan = typeof psiPlans.$inferSelect;
export type NewPSIPlan = typeof psiPlans.$inferInsert;
