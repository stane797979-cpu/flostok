import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { products } from "./products";

// 예측 방법
export const forecastMethodEnum = pgEnum("forecast_method", [
  "sma_3", // 단순이동평균 3개월
  "sma_6", // 단순이동평균 6개월
  "wma", // 가중이동평균
  "ses", // 단순지수평활
  "holt", // 이중지수평활 (트렌드)
  "holt_winters", // 삼중지수평활 (계절성)
  "manual", // 수동 입력
]);

// 수요 예측
export const demandForecasts = pgTable("demand_forecasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  period: date("period").notNull(), // 예측 대상 기간 (월 단위)
  method: forecastMethodEnum("method").notNull(),
  forecastQuantity: integer("forecast_quantity").notNull(), // 예측 수량
  actualQuantity: integer("actual_quantity"), // 실제 판매 수량 (사후 기록)
  // 정확도 (실제 데이터 수집 후 계산)
  mape: numeric("mape", { precision: 6, scale: 2 }), // 평균절대백분율오차 (%)
  mae: numeric("mae", { precision: 10, scale: 2 }), // 평균절대오차
  // 계절 인덱스 (해당 월)
  seasonalIndex: numeric("seasonal_index", { precision: 5, scale: 3 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DemandForecast = typeof demandForecasts.$inferSelect;
export type NewDemandForecast = typeof demandForecasts.$inferInsert;
