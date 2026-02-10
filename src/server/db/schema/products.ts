import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { suppliers } from "./suppliers";

export const abcGradeEnum = pgEnum("abc_grade", ["A", "B", "C"]);
export const xyzGradeEnum = pgEnum("xyz_grade", ["X", "Y", "Z"]);
export const fmrGradeEnum = pgEnum("fmr_grade", ["F", "M", "R"]);
export const orderMethodEnum = pgEnum("order_method", ["fixed_quantity", "fixed_period"]);

// 제품/SKU
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  sku: text("sku").notNull(), // SKU 코드
  name: text("name").notNull(), // 제품명
  category: text("category"), // 카테고리
  description: text("description"),
  unit: text("unit").default("EA"), // 단위 (EA, BOX, KG 등)
  // 가격 정보
  unitPrice: integer("unit_price").default(0), // 판매단가 (원)
  costPrice: integer("cost_price").default(0), // 원가 (원)
  // 분류 등급
  abcGrade: abcGradeEnum("abc_grade"),
  xyzGrade: xyzGradeEnum("xyz_grade"),
  fmrGrade: fmrGradeEnum("fmr_grade"),
  // 발주 관련
  orderMethod: orderMethodEnum("order_method"), // 정량발주(fixed_quantity) / 정기발주(fixed_period)
  moq: integer("moq").default(1), // 최소발주수량
  leadTime: integer("lead_time").default(7), // 리드타임 (일)
  leadTimeStddev: numeric("lead_time_stddev", { precision: 5, scale: 2 }), // 리드타임 표준편차
  // 재고 관련
  safetyStock: integer("safety_stock").default(0), // 안전재고
  reorderPoint: integer("reorder_point").default(0), // 발주점
  targetStock: integer("target_stock"), // 목표재고
  // 공급자 (기본)
  primarySupplierId: uuid("primary_supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
  }),
  // 메타데이터
  imageUrl: text("image_url"),
  barcode: text("barcode"),
  metadata: jsonb("metadata").default({}),
  isActive: timestamp("is_active").defaultNow(), // null이면 비활성/단종
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 공급자-제품 매핑 (공급자별 단가, MOQ 등)
export const supplierProducts = pgTable("supplier_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id")
    .references(() => suppliers.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  supplierProductCode: text("supplier_product_code"), // 공급자측 품목코드
  unitPrice: integer("unit_price").default(0), // 이 공급자로부터의 매입단가
  moq: integer("moq").default(1), // 이 공급자의 MOQ
  leadTime: integer("lead_time"), // 이 공급자의 리드타임
  isPrimary: timestamp("is_primary"), // null이 아니면 주 공급자
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type SupplierProduct = typeof supplierProducts.$inferSelect;
export type NewSupplierProduct = typeof supplierProducts.$inferInsert;
