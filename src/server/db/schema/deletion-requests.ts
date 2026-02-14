import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// 삭제 요청 상태
export const deletionRequestStatusEnum = pgEnum("deletion_request_status", [
  "pending", // 승인 대기
  "approved", // 승인됨
  "rejected", // 거부됨
  "completed", // 삭제 완료
  "cancelled", // 취소됨
]);

// 삭제 요청 (승인 워크플로우)
export const deletionRequests = pgTable(
  "deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),

    // 삭제 대상
    entityType: text("entity_type").notNull(), // "product" | "supplier" | "purchase_order"
    entityId: uuid("entity_id").notNull(),
    entityName: text("entity_name"), // 표시용 이름 (SKU, 공급자명 등)
    entitySnapshot: jsonb("entity_snapshot").notNull(), // 삭제 전 전체 데이터 스냅샷

    // 의존성 정보
    dependencyCheck: jsonb("dependency_check"), // { dependencies: [...], impactLevel, ... }
    impactLevel: text("impact_level"), // "low" | "medium" | "high"

    // 워크플로우
    status: deletionRequestStatusEnum("status").default("pending").notNull(),
    reason: text("reason").notNull(), // 삭제 사유

    // 요청자
    requestedById: uuid("requested_by_id")
      .references(() => users.id, { onDelete: "set null" }),
    requestedByName: text("requested_by_name"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // 승인자
    approvedById: uuid("approved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedByName: text("approved_by_name"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    // 거부자
    rejectedById: uuid("rejected_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    rejectedByName: text("rejected_by_name"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),

    // 완료
    completedAt: timestamp("completed_at", { withTimezone: true }),

    notes: text("notes"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("deletion_requests_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    index("deletion_requests_entity_idx").on(
      table.entityType,
      table.entityId
    ),
    index("deletion_requests_requested_by_idx").on(table.requestedById),
  ]
);

export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type NewDeletionRequest = typeof deletionRequests.$inferInsert;
