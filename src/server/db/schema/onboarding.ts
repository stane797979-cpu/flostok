import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// ── Enums ──

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "draft",
  "uploaded",
  "analyzing",
  "mapping",
  "previewing",
  "importing",
  "completed",
  "failed",
]);

export const onboardingFileStatusEnum = pgEnum("onboarding_file_status", [
  "uploaded",
  "analyzed",
  "mapped",
  "imported",
  "error",
]);

export const onboardingDataTypeEnum = pgEnum("onboarding_data_type", [
  "products",
  "sales",
  "inventory",
  "suppliers",
  "inbound",
]);

// ── 온보딩 세션 ──

export const onboardingSessions = pgTable(
  "onboarding_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    /** 컨설팅 대상 회사명 */
    companyName: text("company_name").notNull(),
    /** 회사 상세 정보: { industry, employeeCount, skuCount, currentSystem, notes } */
    companyInfo: jsonb("company_info").default({}),
    status: onboardingStatusEnum("status").default("draft").notNull(),
    /** 현재 위자드 단계 (1~5) */
    currentStep: integer("current_step").default(1).notNull(),
    /** 최종 임포트 결과 요약 */
    importSummary: jsonb("import_summary"),
    createdById: uuid("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgIdx: index("onboarding_sessions_org_idx").on(table.organizationId),
    statusIdx: index("onboarding_sessions_status_idx").on(
      table.organizationId,
      table.status
    ),
  })
);

// ── 온보딩 파일 ──

export const onboardingFiles = pgTable(
  "onboarding_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => onboardingSessions.id, { onDelete: "cascade" })
      .notNull(),
    fileName: text("file_name").notNull(),
    /** 파일 크기 (bytes) */
    fileSize: integer("file_size").notNull(),
    /** Base64 인코딩된 파일 데이터 (임시 저장) */
    fileBase64: text("file_base64").notNull(),
    dataType: onboardingDataTypeEnum("data_type").notNull(),
    /** 선택된 시트명 */
    selectedSheet: text("selected_sheet"),
    /** 시트 이름 목록: string[] */
    sheetNames: jsonb("sheet_names"),
    /** 헤더 분석 결과: AnalyzedHeader[] */
    analyzedHeaders: jsonb("analyzed_headers"),
    /** 데이터 행 수 */
    rowCount: integer("row_count"),
    /** 컬럼 매핑 설정: MappingEntry[] */
    columnMappings: jsonb("column_mappings"),
    /** 사용된 매핑 프로필 ID */
    mappingProfileId: uuid("mapping_profile_id"),
    status: onboardingFileStatusEnum("status").default("uploaded").notNull(),
    /** 임포트 결과: { totalRows, successCount, errorCount, errors[] } */
    importResult: jsonb("import_result"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    sessionIdx: index("onboarding_files_session_idx").on(table.sessionId),
  })
);

// ── 컬럼 매핑 프로필 ──

export const columnMappingProfiles = pgTable(
  "column_mapping_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    /** 프로필 이름: "A회사 제품마스터 매핑" */
    name: text("name").notNull(),
    description: text("description"),
    dataType: onboardingDataTypeEnum("data_type").notNull(),
    /** 매핑 설정: MappingEntry[] */
    mappings: jsonb("mappings").notNull(),
    /** 원본 헤더 목록: string[] */
    sourceHeaders: jsonb("source_headers"),
    usageCount: integer("usage_count").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgDataTypeIdx: index("mapping_profiles_org_type_idx").on(
      table.organizationId,
      table.dataType
    ),
  })
);

// ── Types ──

export type OnboardingSession = typeof onboardingSessions.$inferSelect;
export type NewOnboardingSession = typeof onboardingSessions.$inferInsert;

export type OnboardingFile = typeof onboardingFiles.$inferSelect;
export type NewOnboardingFile = typeof onboardingFiles.$inferInsert;

export type ColumnMappingProfile = typeof columnMappingProfiles.$inferSelect;
export type NewColumnMappingProfile = typeof columnMappingProfiles.$inferInsert;
