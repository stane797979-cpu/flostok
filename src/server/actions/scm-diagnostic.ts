"use server";

/**
 * SCM 진단키트 Server Actions
 *
 * 1. getScmDiagnosticInitData  — 초기 데이터 로드 (KPI + 재고 상태 분포)
 * 2. runScmDiagnosis           — 설문 응답 수신 → 진단 엔진 호출 → 결과 반환
 */

import { requireAuth } from "./auth-helpers";
import { measureKPIMetrics } from "@/server/services/scm/kpi-measurement";
import { db } from "@/server/db";
import { inventory } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import type { KPIMetrics } from "@/server/services/scm/kpi-improvement";
import {
  scoreInventoryDiagnosis,
  scoreLogisticsDiagnosis,
  scoreOrderDiagnosis,
  generateDiagnosticResult,
} from "@/server/services/scm/diagnostic-engine";
import type {
  DiagnosticAnswers,
  DiagnosticResult,
  CategoryDiagnosticResult,
  InventoryDbMetrics,
  OrderDbMetrics,
} from "@/server/services/scm/diagnostic-engine";

// ─────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────

/** 재고 상태별 카운트 (7단계) */
export interface InventoryStatusCounts {
  out_of_stock: number;
  critical: number;
  shortage: number;
  caution: number;
  optimal: number;
  excess: number;
  overstock: number;
  total: number;
}

/** getScmDiagnosticInitData 반환 타입 */
export interface ScmDiagnosticInitData {
  kpiMetrics: KPIMetrics | null;
  inventoryStatusCounts: InventoryStatusCounts | null;
}

// ─────────────────────────────────────────────
// 내부 헬퍼: 재고 상태 분포 조회
// ─────────────────────────────────────────────

/**
 * 조직의 재고 상태별 카운트를 단일 쿼리로 조회합니다.
 * excess + overstock 비율 계산에 활용됩니다.
 */
async function fetchInventoryStatusCounts(
  organizationId: string
): Promise<InventoryStatusCounts> {
  const rows = await db
    .select({
      status: inventory.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(inventory)
    .where(eq(inventory.organizationId, organizationId))
    .groupBy(inventory.status);

  // 상태별 카운트를 맵으로 변환
  const countMap = new Map<string, number>(
    rows.map((r) => [r.status ?? "optimal", Number(r.count) || 0])
  );

  const out_of_stock = countMap.get("out_of_stock") ?? 0;
  const critical = countMap.get("critical") ?? 0;
  const shortage = countMap.get("shortage") ?? 0;
  const caution = countMap.get("caution") ?? 0;
  const optimal = countMap.get("optimal") ?? 0;
  const excess = countMap.get("excess") ?? 0;
  const overstock = countMap.get("overstock") ?? 0;

  return {
    out_of_stock,
    critical,
    shortage,
    caution,
    optimal,
    excess,
    overstock,
    total:
      out_of_stock + critical + shortage + caution + optimal + excess + overstock,
  };
}

/**
 * InventoryStatusCounts → InventoryDbMetrics 변환
 * KPIMetrics + 재고 상태 분포를 엔진 입력 형식으로 조합합니다.
 */
function buildInventoryDbMetrics(
  kpi: KPIMetrics,
  statusCounts: InventoryStatusCounts
): InventoryDbMetrics {
  // 과잉재고 비율: (excess + overstock) / 전체 × 100
  const excessStockRatio =
    statusCounts.total > 0
      ? Math.round(
          ((statusCounts.excess + statusCounts.overstock) /
            statusCounts.total) *
            10000
        ) / 100
      : 0;

  return {
    inventoryTurnoverRate: kpi.inventoryTurnoverRate,
    stockoutRate: kpi.stockoutRate,
    excessStockRatio,
  };
}

/**
 * KPIMetrics → OrderDbMetrics 변환
 */
function buildOrderDbMetrics(kpi: KPIMetrics): OrderDbMetrics {
  return {
    onTimeOrderRate: kpi.onTimeOrderRate,
    orderFulfillmentRate: kpi.orderFulfillmentRate,
    averageLeadTime: kpi.averageLeadTime,
  };
}

// ─────────────────────────────────────────────
// Action 1: 초기 데이터 로드
// ─────────────────────────────────────────────

/**
 * SCM 진단키트 초기 데이터를 로드합니다.
 *
 * - KPI 지표 (measureKPIMetrics 재사용)
 * - 재고 상태 분포 (status별 COUNT)
 *
 * 각 조회는 독립적으로 실패해도 null로 폴백합니다.
 * 미인증 시 에러를 throw합니다.
 */
export async function getScmDiagnosticInitData(): Promise<ScmDiagnosticInitData> {
  const user = await requireAuth();
  const organizationId = user.organizationId;

  // KPI와 재고 상태 분포를 병렬로 조회 (개별 catch로 부분 실패 허용)
  const [kpiMetrics, inventoryStatusCounts] = await Promise.all([
    measureKPIMetrics(organizationId).catch((err) => {
      console.error("[getScmDiagnosticInitData] KPI 조회 실패:", err);
      return null;
    }),
    fetchInventoryStatusCounts(organizationId).catch((err) => {
      console.error("[getScmDiagnosticInitData] 재고 상태 조회 실패:", err);
      return null;
    }),
  ]);

  return { kpiMetrics, inventoryStatusCounts };
}

// ─────────────────────────────────────────────
// Action 2: 진단 실행
// ─────────────────────────────────────────────

/**
 * 설문 응답을 받아 SCM 진단을 실행하고 결과를 반환합니다.
 *
 * - inventory/order 선택 시: measureKPIMetrics + 재고 상태 분포 조회
 * - logistics만 선택 시: DB 조회 불필요
 * - 각 카테고리 score 함수를 호출한 후 generateDiagnosticResult로 종합
 *
 * @param answers 사용자 설문 응답 (selectedCategories 포함)
 * @returns DiagnosticResult
 */
export async function runScmDiagnosis(
  answers: DiagnosticAnswers
): Promise<DiagnosticResult> {
  const user = await requireAuth();
  const organizationId = user.organizationId;

  const { selectedCategories } = answers;

  // ── DB 데이터 조회 여부 결정 ──────────────────
  // inventory 또는 order가 포함된 경우에만 DB 조회
  const needsDbData =
    selectedCategories.includes("inventory") ||
    selectedCategories.includes("order");

  let kpiMetrics: KPIMetrics | null = null;
  let statusCounts: InventoryStatusCounts | null = null;

  if (needsDbData) {
    // KPI + 재고 상태 분포 병렬 조회 (개별 catch로 부분 실패 허용)
    const [kpiResult, statusResult] = await Promise.all([
      measureKPIMetrics(organizationId).catch((err) => {
        console.error("[runScmDiagnosis] KPI 조회 실패:", err);
        return null;
      }),
      fetchInventoryStatusCounts(organizationId).catch((err) => {
        console.error("[runScmDiagnosis] 재고 상태 조회 실패:", err);
        return null;
      }),
    ]);

    kpiMetrics = kpiResult;
    statusCounts = statusResult;
  }

  // ── 카테고리별 진단 실행 ─────────────────────
  const categoryResults: CategoryDiagnosticResult[] = [];

  // 재고 진단
  if (selectedCategories.includes("inventory") && answers.inventory) {
    const inventoryDbMetrics: InventoryDbMetrics =
      kpiMetrics && statusCounts
        ? buildInventoryDbMetrics(kpiMetrics, statusCounts)
        : { inventoryTurnoverRate: 0, stockoutRate: 0, excessStockRatio: 0 };

    const result = scoreInventoryDiagnosis(inventoryDbMetrics, answers.inventory);
    categoryResults.push(result);
  }

  // 물류 진단 (순수 설문 — DB 조회 없음)
  if (selectedCategories.includes("logistics") && answers.logistics) {
    const result = scoreLogisticsDiagnosis(answers.logistics);
    categoryResults.push(result);
  }

  // 발주 진단
  if (selectedCategories.includes("order") && answers.order) {
    const orderDbMetrics: OrderDbMetrics =
      kpiMetrics
        ? buildOrderDbMetrics(kpiMetrics)
        : { onTimeOrderRate: 0, orderFulfillmentRate: 0, averageLeadTime: 0 };

    const result = scoreOrderDiagnosis(orderDbMetrics, answers.order);
    categoryResults.push(result);
  }

  // ── 종합 결과 생성 ────────────────────────────
  return generateDiagnosticResult(categoryResults, selectedCategories);
}
