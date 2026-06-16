import { pgTable, uuid, text, timestamp, numeric, date } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";
import { abcGradeEnum, xyzGradeEnum } from "./products";

// ABC-XYZ 등급 변동 이력 (수요변동성관리)
export const gradeHistory = pgTable("grade_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  period: date("period").notNull(), // 월 첫째날 (2026-01-01)
  abcGrade: abcGradeEnum("abc_grade"),
  xyzGrade: xyzGradeEnum("xyz_grade"),
  combinedGrade: text("combined_grade"), // "AX", "BY" 등
  salesValue: numeric("sales_value", { precision: 12, scale: 0 }), // 해당 기간 매출액
  coefficientOfVariation: numeric("coefficient_of_variation", {
    precision: 5,
    scale: 2,
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type GradeHistory = typeof gradeHistory.$inferSelect;
export type NewGradeHistory = typeof gradeHistory.$inferInsert;
