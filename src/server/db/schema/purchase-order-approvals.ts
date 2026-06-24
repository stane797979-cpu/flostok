import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { purchaseOrders } from "./purchase-orders";
import { users } from "./users";
import { organizations } from "./organizations";

export const approvalStepStatusEnum = pgEnum("approval_step_status", [
  "waiting",   // 앞 단계 미완료 대기
  "pending",   // 현재 검토 차례
  "approved",  // 승인
  "rejected",  // 반려
]);

// 결재라인 단계 테이블
export const purchaseOrderApprovals = pgTable("purchase_order_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .references(() => purchaseOrders.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  stepOrder: integer("step_order").notNull(), // 1, 2, 3, 4 순서
  roleName: text("role_name").notNull(),      // "구매담당", "팀장", "재무부서", "대표이사"
  approverId: uuid("approver_id").references(() => users.id, { onDelete: "set null" }),
  approverName: text("approver_name"),        // 결재자 이름 (스냅샷)
  status: approvalStepStatusEnum("status").default("waiting").notNull(),
  comment: text("comment"),
  actedAt: timestamp("acted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PurchaseOrderApproval = typeof purchaseOrderApprovals.$inferSelect;
export type NewPurchaseOrderApproval = typeof purchaseOrderApprovals.$inferInsert;
