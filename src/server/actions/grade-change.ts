"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { gradeHistory, products } from "@/server/db/schema";
import { eq, and, desc, sql, isNotNull } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";

export interface GradeChangeItem {
  productId: string;
  sku: string;
  name: string;
  prevGrade: string | null;
  currentGrade: string | null;
  prevAbcGrade: string | null;
  currentAbcGrade: string | null;
  prevXyzGrade: string | null;
  currentXyzGrade: string | null;
  changeType: "upgrade" | "downgrade" | "lateral" | "new";
  riskLevel: "high" | "medium" | "low";
  signal: string;
  action: string;
}

export interface GradeTrendMonth {
  period: string;
  xCount: number;
  yCount: number;
  zCount: number;
}

export interface GradeChangeResult {
  changes: GradeChangeItem[];
  trend: GradeTrendMonth[];
  totalProducts: number;
  changedCount: number;
}

// 등급 순서 (높은 등급 = 높은 숫자)
const GRADE_ORDER: Record<string, number> = {
  AX: 9, AY: 8, AZ: 7,
  BX: 6, BY: 5, BZ: 4,
  CX: 3, CY: 2, CZ: 1,
};

function getChangeType(prev: string | null, current: string | null): GradeChangeItem["changeType"] {
  if (!prev) return "new";
  if (!current) return "downgrade";
  const prevOrder = GRADE_ORDER[prev] || 0;
  const currentOrder = GRADE_ORDER[current] || 0;
  if (currentOrder > prevOrder) return "upgrade";
  if (currentOrder < prevOrder) return "downgrade";
  return "lateral";
}

function getRiskLevel(current: string | null, changeType: string): GradeChangeItem["riskLevel"] {
  if (!current) return "medium";
  // AX, AY에서 하락 → high risk
  if (changeType === "downgrade" && (current.startsWith("A") || GRADE_ORDER[current] <= 4)) return "high";
  // CZ, BZ → medium risk
  if (current.endsWith("Z")) return "medium";
  return "low";
}

function getSignalAndAction(
  prev: string | null,
  current: string | null,
  changeType: string
): { signal: string; action: string } {
  if (changeType === "new") {
    return { signal: "신규 등급 부여", action: "초기 모니터링 필요" };
  }
  if (changeType === "lateral") {
    return { signal: "등급 유지", action: "현행 정책 유지" };
  }

  const prevAbc = prev?.charAt(0) || "";
  const currentAbc = current?.charAt(0) || "";
  const prevXyz = prev?.charAt(1) || "";
  const currentXyz = current?.charAt(1) || "";

  // ABC 변동
  if (prevAbc !== currentAbc) {
    if (currentAbc === "C" && prevAbc === "A") {
      return { signal: "매출 급감", action: "원인 분석 + 재고 축소 검토" };
    }
    if (currentAbc === "A" && prevAbc === "C") {
      return { signal: "매출 급증", action: "안전재고 상향 + 공급 확대" };
    }
  }

  // XYZ 변동
  if (prevXyz !== currentXyz) {
    if (currentXyz === "Z" && prevXyz === "X") {
      return { signal: "수요 불안정화", action: "안전재고 상향 + 발주 주기 단축" };
    }
    if (currentXyz === "X" && prevXyz === "Z") {
      return { signal: "수요 안정화", action: "안전재고 하향 조정 가능" };
    }
  }

  if (changeType === "downgrade") {
    return { signal: "등급 하락", action: "모니터링 강화" };
  }
  return { signal: "등급 상승", action: "긍정적 변화, 현행 유지" };
}

async function _getGradeChangeInternal(orgId: string): Promise<GradeChangeResult> {
  // 3개 쿼리 병렬 실행
  const [history, productList, trendData] = await Promise.all([
    db
      .select({
        productId: gradeHistory.productId,
        period: gradeHistory.period,
        abcGrade: gradeHistory.abcGrade,
        xyzGrade: gradeHistory.xyzGrade,
        combinedGrade: gradeHistory.combinedGrade,
      })
      .from(gradeHistory)
      .where(eq(gradeHistory.organizationId, orgId))
      .orderBy(desc(gradeHistory.period)),
    db
      .select({ id: products.id, sku: products.sku, name: products.name })
      .from(products)
      .where(and(eq(products.organizationId, orgId), isNotNull(products.isActive))),
    db
      .select({
        period: gradeHistory.period,
        xyzGrade: gradeHistory.xyzGrade,
        count: sql<number>`count(*)`,
      })
      .from(gradeHistory)
      .where(eq(gradeHistory.organizationId, orgId))
      .groupBy(gradeHistory.period, gradeHistory.xyzGrade)
      .orderBy(gradeHistory.period),
  ]);

  const productMap = new Map(productList.map((p) => [p.id, p]));

  // 제품별 최근 2개 기간 데이터 매핑
  const productPeriods = new Map<string, { current?: typeof history[0]; prev?: typeof history[0] }>();
  for (const h of history) {
    const entry = productPeriods.get(h.productId) || {};
    if (!entry.current) {
      entry.current = h;
    } else if (!entry.prev) {
      entry.prev = h;
    }
    productPeriods.set(h.productId, entry);
  }

  // 변동 분석
  const changes: GradeChangeItem[] = [];
  for (const [productId, periods] of productPeriods) {
    const product = productMap.get(productId);
    if (!product) continue;

    const prevGrade = periods.prev?.combinedGrade || null;
    const currentGrade = periods.current?.combinedGrade || null;

    if (prevGrade === currentGrade && prevGrade !== null) continue; // 변동 없으면 스킵

    const changeType = getChangeType(prevGrade, currentGrade);
    const riskLevel = getRiskLevel(currentGrade, changeType);
    const { signal, action } = getSignalAndAction(prevGrade, currentGrade, changeType);

    changes.push({
      productId,
      sku: product.sku,
      name: product.name,
      prevGrade,
      currentGrade,
      prevAbcGrade: periods.prev?.abcGrade || null,
      currentAbcGrade: periods.current?.abcGrade || null,
      prevXyzGrade: periods.prev?.xyzGrade || null,
      currentXyzGrade: periods.current?.xyzGrade || null,
      changeType,
      riskLevel,
      signal,
      action,
    });
  }

  // 월별 X/Y/Z 품목수 추이 (최근 6개월) — 이미 병렬로 조회됨
  const trendMap = new Map<string, GradeTrendMonth>();
  for (const row of trendData) {
    if (!row.period) continue;
    const existing = trendMap.get(row.period) || { period: row.period, xCount: 0, yCount: 0, zCount: 0 };
    if (row.xyzGrade === "X") existing.xCount = Number(row.count);
    else if (row.xyzGrade === "Y") existing.yCount = Number(row.count);
    else if (row.xyzGrade === "Z") existing.zCount = Number(row.count);
    trendMap.set(row.period, existing);
  }

  const trend = Array.from(trendMap.values()).slice(-6);

  return {
    changes: changes.sort((a, b) => {
      // high risk 먼저, downgrade 먼저
      const riskOrder = { high: 0, medium: 1, low: 2 };
      return (riskOrder[a.riskLevel] || 2) - (riskOrder[b.riskLevel] || 2);
    }),
    trend,
    totalProducts: productList.length,
    changedCount: changes.filter((c) => c.changeType !== "lateral" && c.changeType !== "new").length,
  };
}

/**
 * 등급 변동 분석 조회 (60초 캐시)
 */
export async function getGradeChangeAnalysis(): Promise<GradeChangeResult> {
  const user = await getCurrentUser();
  const orgId = user?.organizationId || "00000000-0000-0000-0000-000000000001";

  return unstable_cache(
    () => _getGradeChangeInternal(orgId),
    [`grade-change-${orgId}`],
    { revalidate: 60, tags: [`analytics-${orgId}`] }
  )();
}
