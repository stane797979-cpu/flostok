"use server";

/**
 * 데이터 온보딩 Server Actions
 *
 * 온보딩 세션 CRUD, 파일 분석, 매핑, 임포트 실행
 */

import { db } from "@/server/db";
import {
  onboardingSessions,
  onboardingFiles,
  columnMappingProfiles,
  suppliers,
  products,
  inventory,
  inboundRecords,
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "./auth-helpers";
import { logActivity } from "@/server/services/activity-log";
import { analyzeExcelFile } from "@/server/services/onboarding/file-analyzer";
import { autoMap, validateMappings } from "@/server/services/onboarding/auto-mapper";
import { executeMapping } from "@/server/services/onboarding/mapping-executor";
import { importProductData, importSalesData } from "@/server/services/excel";
import type {
  CompanyInfo,
  OnboardingDataType,
  MappingEntry,
  AnalyzedHeader,
} from "@/types/onboarding";

// ── 세션 관리 ──

/** 온보딩 세션 목록 조회 */
export async function getOnboardingSessions() {
  try {
    const user = await requireAuth();
    const sessions = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.organizationId, user.organizationId))
      .orderBy(desc(onboardingSessions.createdAt));
    return { success: true, data: sessions };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 목록 조회 실패",
      data: [],
    };
  }
}

/** 온보딩 세션 상세 조회 (파일 포함) */
export async function getOnboardingSession(sessionId: string) {
  try {
    const user = await requireAuth();

    const [session] = await db
      .select()
      .from(onboardingSessions)
      .where(
        and(
          eq(onboardingSessions.id, sessionId),
          eq(onboardingSessions.organizationId, user.organizationId)
        )
      )
      .limit(1);

    if (!session) {
      return { success: false, error: "세션을 찾을 수 없습니다" };
    }

    const files = await db
      .select()
      .from(onboardingFiles)
      .where(eq(onboardingFiles.sessionId, sessionId));

    return { success: true, data: { session, files } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 조회 실패",
    };
  }
}

/** 온보딩 세션 생성 (Step 1) */
export async function createOnboardingSession(input: {
  companyName: string;
  companyInfo: CompanyInfo;
}) {
  try {
    const user = await requireAuth();

    const [session] = await db
      .insert(onboardingSessions)
      .values({
        organizationId: user.organizationId,
        companyName: input.companyName,
        companyInfo: input.companyInfo,
        status: "draft",
        currentStep: 1,
        createdById: user.id,
      })
      .returning();

    return { success: true, data: session };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 생성 실패",
    };
  }
}

/** 세션 상태/단계 업데이트 */
export async function updateSessionStep(
  sessionId: string,
  step: number,
  status?: string
) {
  try {
    const user = await requireAuth();

    await db
      .update(onboardingSessions)
      .set({
        currentStep: step,
        ...(status ? { status: status as "draft" } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(onboardingSessions.id, sessionId),
          eq(onboardingSessions.organizationId, user.organizationId)
        )
      );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 업데이트 실패",
    };
  }
}

/** 온보딩 세션 삭제 */
export async function deleteOnboardingSession(sessionId: string) {
  try {
    const user = await requireAuth();

    await db
      .delete(onboardingSessions)
      .where(
        and(
          eq(onboardingSessions.id, sessionId),
          eq(onboardingSessions.organizationId, user.organizationId)
        )
      );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 삭제 실패",
    };
  }
}

// ── 파일 관리 ──

/** 파일 업로드 (Step 2) */
export async function uploadOnboardingFile(input: {
  sessionId: string;
  fileName: string;
  fileSize: number;
  fileBase64: string;
  dataType: OnboardingDataType;
}) {
  try {
    await requireAuth();

    const [file] = await db
      .insert(onboardingFiles)
      .values({
        sessionId: input.sessionId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        fileBase64: input.fileBase64,
        dataType: input.dataType,
        status: "uploaded",
      })
      .returning();

    return { success: true, data: file };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "파일 업로드 실패",
    };
  }
}

/** 파일 삭제 */
export async function deleteOnboardingFile(fileId: string) {
  try {
    await requireAuth();

    await db
      .delete(onboardingFiles)
      .where(eq(onboardingFiles.id, fileId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "파일 삭제 실패",
    };
  }
}

/** 파일 데이터 유형 변경 */
export async function updateFileDataType(
  fileId: string,
  dataType: OnboardingDataType
) {
  try {
    await requireAuth();

    await db
      .update(onboardingFiles)
      .set({ dataType })
      .where(eq(onboardingFiles.id, fileId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "데이터 유형 변경 실패",
    };
  }
}

// ── 파일 분석 (Step 3) ──

/** 파일 분석 실행 */
export async function analyzeOnboardingFile(
  fileId: string,
  sheetName?: string
) {
  try {
    await requireAuth();

    // 파일 데이터 조회
    const [file] = await db
      .select()
      .from(onboardingFiles)
      .where(eq(onboardingFiles.id, fileId))
      .limit(1);

    if (!file) {
      return { success: false, error: "파일을 찾을 수 없습니다" };
    }

    const result = await analyzeExcelFile(file.fileBase64, sheetName);

    // 분석 결과 저장
    await db
      .update(onboardingFiles)
      .set({
        selectedSheet: result.selectedSheet,
        sheetNames: result.sheetNames,
        analyzedHeaders: result.headers,
        rowCount: result.rowCount,
        status: "analyzed",
      })
      .where(eq(onboardingFiles.id, fileId));

    // sampleData를 plain object로 변환 (xlsx 파서 객체에 메서드가 있을 수 있음)
    const plainSampleData = result.sampleData
      ? JSON.parse(JSON.stringify(result.sampleData))
      : [];

    return {
      success: true,
      data: {
        sheetNames: result.sheetNames,
        selectedSheet: result.selectedSheet,
        headers: result.headers,
        sampleData: plainSampleData,
        rowCount: result.rowCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "파일 분석 실패",
    };
  }
}

// ── 컬럼 매핑 (Step 4) ──

/** 자동 매핑 생성 */
export async function generateAutoMapping(
  fileId: string
) {
  try {
    await requireAuth();

    const [file] = await db
      .select()
      .from(onboardingFiles)
      .where(eq(onboardingFiles.id, fileId))
      .limit(1);

    if (!file || !file.analyzedHeaders) {
      return { success: false, error: "파일이 분석되지 않았습니다" };
    }

    const headers = file.analyzedHeaders as AnalyzedHeader[];
    const mappings = autoMap(headers, file.dataType as OnboardingDataType);

    return { success: true, data: mappings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "자동 매핑 생성 실패",
    };
  }
}

/** 매핑 저장 */
export async function saveFileMappings(
  fileId: string,
  mappings: MappingEntry[]
) {
  try {
    await requireAuth();

    await db
      .update(onboardingFiles)
      .set({
        columnMappings: mappings,
        status: "mapped",
      })
      .where(eq(onboardingFiles.id, fileId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "매핑 저장 실패",
    };
  }
}

/** 매핑 검증 */
export async function validateFileMappings(
  fileId: string,
  mappings: MappingEntry[]
) {
  try {
    await requireAuth();

    const [file] = await db
      .select()
      .from(onboardingFiles)
      .where(eq(onboardingFiles.id, fileId))
      .limit(1);

    if (!file) {
      return { success: false, error: "파일을 찾을 수 없습니다" };
    }

    const result = validateMappings(
      mappings,
      file.dataType as OnboardingDataType
    );

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "매핑 검증 실패",
    };
  }
}

// ── 미리보기 & 임포트 (Step 5) ──

/** 매핑 미리보기 */
export async function previewMapping(fileId: string) {
  try {
    await requireAuth();

    const [file] = await db
      .select()
      .from(onboardingFiles)
      .where(eq(onboardingFiles.id, fileId))
      .limit(1);

    if (!file || !file.columnMappings) {
      return { success: false, error: "매핑 설정이 없습니다" };
    }

    const result = await executeMapping(
      file.fileBase64,
      file.selectedSheet || undefined,
      file.columnMappings as MappingEntry[],
      file.dataType as OnboardingDataType,
      true, // previewOnly
      20
    );

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "미리보기 실패",
    };
  }
}

/** 임포트 실행 */
export async function executeImport(
  sessionId: string,
  fileId: string,
  duplicateHandling: "skip" | "update" | "error" = "update"
) {
  try {
    const user = await requireAuth();

    const [file] = await db
      .select()
      .from(onboardingFiles)
      .where(eq(onboardingFiles.id, fileId))
      .limit(1);

    if (!file || !file.columnMappings) {
      return { success: false, error: "매핑 설정이 없습니다" };
    }

    const dataType = file.dataType as OnboardingDataType;
    const mappings = file.columnMappings as MappingEntry[];

    // 매핑 적용하여 전체 데이터 변환
    const transformResult = await executeMapping(
      file.fileBase64,
      file.selectedSheet || undefined,
      mappings,
      dataType,
      false // 전체 데이터
    );

    // Base64 → ArrayBuffer 변환
    const base64Data = file.fileBase64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = bytes.buffer;

    let importResult;

    // 데이터 유형별 기존 임포트 서비스 호출
    switch (dataType) {
      case "products":
        importResult = await importProductData({
          organizationId: user.organizationId,
          buffer,
          sheetName: file.selectedSheet || undefined,
          duplicateHandling,
        });
        break;
      case "sales":
        importResult = await importSalesData({
          organizationId: user.organizationId,
          buffer,
          sheetName: file.selectedSheet || undefined,
          duplicateHandling,
          deductInventory: false,
        });
        break;
      case "suppliers":
        importResult = await importSupplierRows(
          user.organizationId,
          transformResult,
          duplicateHandling
        );
        break;
      case "inventory":
        importResult = await importInventoryRows(
          user.organizationId,
          transformResult,
          duplicateHandling
        );
        break;
      case "inbound":
        importResult = await importInboundRows(
          user.organizationId,
          transformResult
        );
        break;
      default:
        importResult = {
          success: transformResult.successCount > 0,
          data: transformResult.rows,
          errors: transformResult.errors,
          totalRows: transformResult.totalRows,
          successCount: transformResult.successCount,
          errorCount: transformResult.errorCount,
        };
        break;
    }

    // 결과 저장
    const fileImportResult = {
      totalRows: importResult.totalRows,
      successCount: importResult.successCount,
      errorCount: importResult.errorCount,
      errors: importResult.errors.slice(0, 50), // 최대 50개 에러만 저장
    };

    await db
      .update(onboardingFiles)
      .set({
        status: importResult.success ? "imported" : "error",
        importResult: fileImportResult,
      })
      .where(eq(onboardingFiles.id, fileId));

    // 활동 로그
    if (importResult.successCount > 0) {
      await logActivity({
        user,
        action: "IMPORT",
        entityType: "onboarding",
        entityId: sessionId,
        description: `온보딩 데이터 임포트: ${dataType} (${importResult.successCount}/${importResult.totalRows}건)`,
      });
    }

    return { success: true, data: fileImportResult };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "임포트 실행 실패",
    };
  }
}

/** 세션 완료 처리 */
export async function completeOnboardingSession(sessionId: string) {
  try {
    const user = await requireAuth();

    // 모든 파일의 임포트 결과 집계
    const files = await db
      .select()
      .from(onboardingFiles)
      .where(eq(onboardingFiles.sessionId, sessionId));

    const summary: Record<string, unknown> = {};
    for (const file of files) {
      const dataType = file.dataType as string;
      summary[dataType] = file.importResult || { totalRows: 0, successCount: 0, errorCount: 0 };
    }

    await db
      .update(onboardingSessions)
      .set({
        status: "completed",
        currentStep: 5,
        importSummary: summary,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(onboardingSessions.id, sessionId),
          eq(onboardingSessions.organizationId, user.organizationId)
        )
      );

    await logActivity({
      user,
      action: "CREATE",
      entityType: "onboarding",
      entityId: sessionId,
      description: `온보딩 세션 완료`,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "세션 완료 처리 실패",
    };
  }
}

// ── 매핑 프로필 ──

/** 매핑 프로필 목록 조회 */
export async function getMappingProfiles(dataType?: OnboardingDataType) {
  try {
    const user = await requireAuth();

    const conditions = [
      eq(columnMappingProfiles.organizationId, user.organizationId),
    ];
    if (dataType) {
      conditions.push(eq(columnMappingProfiles.dataType, dataType));
    }

    const profiles = await db
      .select()
      .from(columnMappingProfiles)
      .where(and(...conditions))
      .orderBy(desc(columnMappingProfiles.updatedAt));

    return { success: true, data: profiles };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "프로필 조회 실패",
      data: [],
    };
  }
}

/** 매핑 프로필 저장 */
export async function saveMappingProfile(input: {
  name: string;
  description?: string;
  dataType: OnboardingDataType;
  mappings: MappingEntry[];
  sourceHeaders: string[];
}) {
  try {
    const user = await requireAuth();

    const [profile] = await db
      .insert(columnMappingProfiles)
      .values({
        organizationId: user.organizationId,
        name: input.name,
        description: input.description,
        dataType: input.dataType,
        mappings: input.mappings,
        sourceHeaders: input.sourceHeaders,
      })
      .returning();

    return { success: true, data: profile };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "프로필 저장 실패",
    };
  }
}

/** 매핑 프로필 삭제 */
export async function deleteMappingProfile(profileId: string) {
  try {
    const user = await requireAuth();

    await db
      .delete(columnMappingProfiles)
      .where(
        and(
          eq(columnMappingProfiles.id, profileId),
          eq(columnMappingProfiles.organizationId, user.organizationId)
        )
      );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "프로필 삭제 실패",
    };
  }
}

// ── 온보딩 임포트 헬퍼 (suppliers / inventory / inbound) ──

interface TransformResult {
  rows: Record<string, unknown>[];
  errors: { row: number; column?: string; value?: unknown; message: string }[];
  totalRows: number;
  successCount: number;
  errorCount: number;
}

/** 공급자 데이터 임포트 */
async function importSupplierRows(
  organizationId: string,
  result: TransformResult,
  duplicateHandling: "skip" | "update" | "error"
) {
  const errors: { row: number; column?: string; value?: unknown; message: string }[] = [...result.errors];
  let successCount = 0;
  const imported: Record<string, unknown>[] = [];

  // 기존 공급자를 미리 배치 조회하여 Map 생성 (N+1 제거)
  const existingSuppliers = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.organizationId, organizationId));
  const supplierByName = new Map(existingSuppliers.map((s) => [s.name, s]));

  const newSupplierValues: Array<typeof suppliers.$inferInsert> = [];
  const updateBatch: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    const name = String(row.name || "").trim();
    if (!name) {
      errors.push({ row: i + 2, column: "name", message: "공급자명이 비어있습니다" });
      continue;
    }

    try {
      const existing = supplierByName.get(name);

      if (existing) {
        if (duplicateHandling === "skip") continue;
        if (duplicateHandling === "error") {
          errors.push({ row: i + 2, column: "name", value: name, message: `중복 공급자: ${name}` });
          continue;
        }
        updateBatch.push({
          id: existing.id,
          data: {
            code: row.code ? String(row.code) : existing.code,
            businessNumber: row.businessNumber ? String(row.businessNumber) : existing.businessNumber,
            contactName: row.contactName ? String(row.contactName) : existing.contactName,
            contactEmail: row.contactEmail ? String(row.contactEmail) : existing.contactEmail,
            contactPhone: row.contactPhone ? String(row.contactPhone) : existing.contactPhone,
            address: row.address ? String(row.address) : existing.address,
            paymentTerms: row.paymentTerms ? String(row.paymentTerms) : existing.paymentTerms,
            avgLeadTime: row.avgLeadTime ? Number(row.avgLeadTime) : existing.avgLeadTime,
            updatedAt: new Date(),
          },
        });
      } else {
        newSupplierValues.push({
          organizationId,
          name,
          code: row.code ? String(row.code) : null,
          businessNumber: row.businessNumber ? String(row.businessNumber) : null,
          contactName: row.contactName ? String(row.contactName) : null,
          contactEmail: row.contactEmail ? String(row.contactEmail) : null,
          contactPhone: row.contactPhone ? String(row.contactPhone) : null,
          address: row.address ? String(row.address) : null,
          paymentTerms: row.paymentTerms ? String(row.paymentTerms) : null,
          avgLeadTime: row.avgLeadTime ? Number(row.avgLeadTime) : 7,
        });
      }
      successCount++;
      imported.push(row);
    } catch (err) {
      errors.push({ row: i + 2, message: `DB 저장 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}` });
    }
  }

  // 배치 INSERT (신규 공급자)
  if (newSupplierValues.length > 0) {
    await db.insert(suppliers).values(newSupplierValues);
  }

  // 배치 UPDATE (기존 공급자) — 각 행의 업데이트 데이터가 다르므로 개별 실행하되 Promise.all로 병렬화
  if (updateBatch.length > 0) {
    await Promise.all(
      updateBatch.map((item) =>
        db.update(suppliers).set(item.data).where(eq(suppliers.id, item.id))
      )
    );
  }

  return {
    success: successCount > 0,
    data: imported,
    errors,
    totalRows: result.totalRows,
    successCount,
    errorCount: errors.length,
  };
}

/** 재고 데이터 임포트 (SKU 기반으로 기존 inventory 레코드 업데이트) */
async function importInventoryRows(
  organizationId: string,
  result: TransformResult,
  duplicateHandling: "skip" | "update" | "error"
) {
  const errors: { row: number; column?: string; value?: unknown; message: string }[] = [...result.errors];
  let successCount = 0;
  const imported: Record<string, unknown>[] = [];

  // SKU→제품 Map 미리 배치 조회 (N+1 제거)
  const allProducts = await db
    .select({ id: products.id, sku: products.sku })
    .from(products)
    .where(eq(products.organizationId, organizationId));
  const skuToProduct = new Map(allProducts.map((p) => [p.sku, p]));

  // 기존 재고 Map 미리 배치 조회 (N+1 제거)
  const allInventory = await db
    .select()
    .from(inventory)
    .where(eq(inventory.organizationId, organizationId));
  const inventoryByProductId = new Map(allInventory.map((inv) => [inv.productId, inv]));

  const newInventoryValues: Array<typeof inventory.$inferInsert> = [];
  const updateInventoryBatch: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    const sku = String(row.sku || "").trim();
    if (!sku) {
      errors.push({ row: i + 2, column: "sku", message: "SKU가 비어있습니다" });
      continue;
    }

    try {
      const product = skuToProduct.get(sku);
      if (!product) {
        errors.push({ row: i + 2, column: "sku", value: sku, message: `제품을 찾을 수 없음: ${sku}` });
        continue;
      }

      const currentStock = Number(row.currentStock) || 0;
      const availableStock = row.availableStock != null ? Number(row.availableStock) : currentStock;
      const reservedStock = row.reservedStock != null ? Number(row.reservedStock) : 0;
      const location = row.location ? String(row.location) : null;

      const existing = inventoryByProductId.get(product.id);

      if (existing) {
        if (duplicateHandling === "skip") continue;
        if (duplicateHandling === "error") {
          errors.push({ row: i + 2, column: "sku", value: sku, message: `재고 레코드 이미 존재: ${sku}` });
          continue;
        }
        updateInventoryBatch.push({
          id: existing.id,
          data: {
            currentStock,
            availableStock,
            reservedStock,
            location: location || existing.location,
            updatedAt: new Date(),
            lastUpdatedAt: new Date(),
          },
        });
      } else {
        newInventoryValues.push({
          organizationId,
          productId: product.id,
          currentStock,
          availableStock,
          reservedStock,
          location,
        });
      }
      successCount++;
      imported.push(row);
    } catch (err) {
      errors.push({ row: i + 2, message: `DB 저장 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}` });
    }
  }

  // 배치 INSERT (신규 재고)
  if (newInventoryValues.length > 0) {
    await db.insert(inventory).values(newInventoryValues);
  }

  // 배치 UPDATE (기존 재고) — 각 행이 다르므로 Promise.all로 병렬화
  if (updateInventoryBatch.length > 0) {
    await Promise.all(
      updateInventoryBatch.map((item) =>
        db.update(inventory).set(item.data).where(eq(inventory.id, item.id))
      )
    );
  }

  return {
    success: successCount > 0,
    data: imported,
    errors,
    totalRows: result.totalRows,
    successCount,
    errorCount: errors.length,
  };
}

/** 입고 데이터 임포트 */
async function importInboundRows(
  organizationId: string,
  result: TransformResult
) {
  const errors: { row: number; column?: string; value?: unknown; message: string }[] = [...result.errors];
  let successCount = 0;
  const imported: Record<string, unknown>[] = [];

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    const sku = String(row.sku || "").trim();
    if (!sku) {
      errors.push({ row: i + 2, column: "sku", message: "SKU가 비어있습니다" });
      continue;
    }

    try {
      // SKU로 제품 찾기
      const product = await db.query.products.findFirst({
        where: and(
          eq(products.organizationId, organizationId),
          eq(products.sku, sku)
        ),
      });

      if (!product) {
        errors.push({ row: i + 2, column: "sku", value: sku, message: `제품을 찾을 수 없음: ${sku}` });
        continue;
      }

      const dateStr = String(row.date || "");
      const receivedQty = Number(row.receivedQuantity) || 0;
      if (receivedQty <= 0) {
        errors.push({ row: i + 2, column: "receivedQuantity", message: "입고수량이 0 이하입니다" });
        continue;
      }

      await db.insert(inboundRecords).values({
        organizationId,
        productId: product.id,
        date: dateStr || new Date().toISOString().split("T")[0],
        receivedQuantity: receivedQty,
        expectedQuantity: row.expectedQuantity ? Number(row.expectedQuantity) : null,
        lotNumber: row.lotNumber ? String(row.lotNumber) : null,
        location: row.location ? String(row.location) : null,
        notes: row.notes ? String(row.notes) : null,
      });

      successCount++;
      imported.push(row);
    } catch (err) {
      errors.push({ row: i + 2, message: `DB 저장 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}` });
    }
  }

  return {
    success: successCount > 0,
    data: imported,
    errors,
    totalRows: result.totalRows,
    successCount,
    errorCount: errors.length,
  };
}
