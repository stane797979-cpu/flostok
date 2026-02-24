/**
 * ABC-XYZ-FMR 등급 갱신 서비스
 *
 * - 판매 이력 3개월 미만: 신제품(NEW) 태그, ABC-XYZ 등급 미부여
 * - 판매 이력 3개월 이상: ABC-XYZ 분석 수행, 등급 자동 부여
 * - FMR: 출고 이력(inventory_history) 기반, 신제품 여부 무관하게 전 제품 산출
 * - products.metadata.gradeInfo에 메타데이터 저장 (스키마 변경 없음)
 */

import { db } from "@/server/db";
import { products, salesRecords, gradeHistory, inventoryHistory } from "@/server/db/schema";
import { eq, and, sql, min } from "drizzle-orm";
import {
  performABCAnalysis,
  performXYZAnalysis,
  performFMRAnalysis,
  type ABCAnalysisItem,
  type XYZAnalysisItem,
  type FMRAnalysisItem,
} from "./abc-xyz-analysis";

export interface GradeInfo {
  isNewProduct: boolean;
  salesMonths: number;
  lastGradeRefresh: string; // ISO date
}

export interface GradeRefreshResult {
  totalProducts: number;
  updatedCount: number;
  newProductCount: number;
  errors: string[];
}

/** 신제품 판단 기준: 판매 이력 개월 수 */
const NEW_PRODUCT_THRESHOLD_MONTHS = 3;

/**
 * 조직의 전체 제품 등급을 갱신합니다.
 */
export async function refreshGradesForOrganization(
  organizationId: string
): Promise<GradeRefreshResult> {
  const result: GradeRefreshResult = {
    totalProducts: 0,
    updatedCount: 0,
    newProductCount: 0,
    errors: [],
  };

  try {
    // 1. 조직의 활성 제품 목록 조회
    const productList = await db
      .select({
        id: products.id,
        name: products.name,
        metadata: products.metadata,
      })
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          sql`${products.isActive} IS NOT NULL`
        )
      );

    result.totalProducts = productList.length;

    if (productList.length === 0) {
      return result;
    }

    // 2. 각 제품별 최초 판매일 조회 (salesRecords + inventoryHistory 출고 병합)
    const [salesFirstDates, outboundFirstDates] = await Promise.all([
      db
        .select({
          productId: salesRecords.productId,
          firstSaleDate: min(salesRecords.date),
        })
        .from(salesRecords)
        .where(eq(salesRecords.organizationId, organizationId))
        .groupBy(salesRecords.productId),
      db
        .select({
          productId: inventoryHistory.productId,
          firstSaleDate: min(inventoryHistory.date),
        })
        .from(inventoryHistory)
        .where(
          and(
            eq(inventoryHistory.organizationId, organizationId),
            sql`${inventoryHistory.changeAmount} < 0`
          )
        )
        .groupBy(inventoryHistory.productId),
    ]);

    // salesRecords 우선, 없으면 inventoryHistory 출고 데이터로 보충
    const firstSaleMap = new Map<string, string | null>();
    for (const r of salesFirstDates) {
      firstSaleMap.set(r.productId, r.firstSaleDate);
    }
    for (const r of outboundFirstDates) {
      if (!firstSaleMap.has(r.productId)) {
        firstSaleMap.set(r.productId, r.firstSaleDate);
      }
    }

    // 3. 제품별 판매 이력 기간 계산 → 신제품/분석 대상 분류
    const now = new Date();
    const eligibleProducts: string[] = []; // 등급 분석 대상
    const newProducts: string[] = []; // 신제품

    for (const product of productList) {
      const firstSaleDate = firstSaleMap.get(product.id);

      if (!firstSaleDate) {
        // 판매 이력 없음 → 신제품
        newProducts.push(product.id);
        continue;
      }

      const firstDate = new Date(firstSaleDate);
      const monthsDiff =
        (now.getFullYear() - firstDate.getFullYear()) * 12 +
        (now.getMonth() - firstDate.getMonth());

      if (monthsDiff < NEW_PRODUCT_THRESHOLD_MONTHS) {
        newProducts.push(product.id);
      } else {
        eligibleProducts.push(product.id);
      }
    }

    result.newProductCount = newProducts.length;

    // 3.5. FMR 분석 — 전 제품 대상 (출고 이력 기반, 신제품 여부 무관)
    const allProductIds = productList.map((p) => p.id);
    let fmrMap = new Map<string, string | null>(); // productId → FMR grade

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const fmrStartDate = sixMonthsAgo.toISOString().split("T")[0];

      // 출고 건수 조회 (OUTBOUND_* changeType, 월별 건수)
      const outboundData = await db
        .select({
          productId: inventoryHistory.productId,
          date: inventoryHistory.date,
        })
        .from(inventoryHistory)
        .where(
          and(
            eq(inventoryHistory.organizationId, organizationId),
            sql`${inventoryHistory.changeType} LIKE 'OUTBOUND_%'`,
            sql`${inventoryHistory.date} >= ${fmrStartDate}`
          )
        );

      // 제품별 월별 출고 횟수 집계
      const outboundByProduct = new Map<string, Map<string, number>>();
      for (const row of outboundData) {
        if (!outboundByProduct.has(row.productId)) {
          outboundByProduct.set(row.productId, new Map());
        }
        const monthKey = row.date.substring(0, 7);
        const monthly = outboundByProduct.get(row.productId)!;
        monthly.set(monthKey, (monthly.get(monthKey) || 0) + 1);
      }

      // 최근 6개월의 월 키 생성
      const fmrMonthKeys: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        fmrMonthKeys.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        );
      }

      const fmrItems: FMRAnalysisItem[] = allProductIds.map((id) => {
        const productInfo = productList.find((p) => p.id === id);
        const monthlyData = outboundByProduct.get(id);
        const monthlyOutboundCounts = fmrMonthKeys.map(
          (key) => monthlyData?.get(key) || 0
        );
        return {
          id,
          name: productInfo?.name || "",
          monthlyOutboundCounts,
        };
      });

      const fmrResults = performFMRAnalysis(fmrItems);
      fmrMap = new Map(fmrResults.map((r) => [r.id, r.grade]));
    } catch (error) {
      result.errors.push(
        `FMR 분석 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
      );
    }

    // 4. 신제품: 배치 metadata 업데이트 (ABC-XYZ는 null, FMR은 설정)
    if (newProducts.length > 0) {
      try {
        // 각 제품별 gradeInfo JSON 생성
        const valueRows = newProducts.map((productId) => {
          const firstSaleDate = firstSaleMap.get(productId);
          let salesMonths = 0;
          if (firstSaleDate) {
            const firstDate = new Date(firstSaleDate);
            salesMonths =
              (now.getFullYear() - firstDate.getFullYear()) * 12 +
              (now.getMonth() - firstDate.getMonth());
          }
          const gradeInfo: GradeInfo = {
            isNewProduct: true,
            salesMonths,
            lastGradeRefresh: now.toISOString(),
          };
          const fmrGrade = fmrMap.get(productId) || null;
          return sql`(${productId}::uuid, ${JSON.stringify(gradeInfo)}::jsonb, ${fmrGrade})`;
        });

        // 단일 UPDATE ... FROM (VALUES ...) 쿼리로 배치 처리
        await db.execute(sql`
          UPDATE products
          SET
            abc_grade = NULL,
            xyz_grade = NULL,
            fmr_grade = v.fmr_grade::fmr_grade,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('gradeInfo', v.grade_info),
            updated_at = ${now}
          FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(product_id, grade_info, fmr_grade)
          WHERE products.id = v.product_id
        `);
      } catch (error) {
        result.errors.push(
          `신제품 배치 업데이트 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
      }
    }

    // 5. 분석 대상 제품: ABC-XYZ 분석 수행
    if (eligibleProducts.length > 0) {
      // 5-1. 최근 6개월 판매 데이터 조회
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = sixMonthsAgo.toISOString().split("T")[0];

      // salesRecords + inventoryHistory 출고 데이터 병렬 조회
      const [salesData, outboundSalesData] = await Promise.all([
        db
          .select({
            productId: salesRecords.productId,
            date: salesRecords.date,
            quantity: salesRecords.quantity,
            totalAmount: salesRecords.totalAmount,
          })
          .from(salesRecords)
          .where(
            and(
              eq(salesRecords.organizationId, organizationId),
              sql`${salesRecords.productId} IN ${eligibleProducts}`,
              sql`${salesRecords.date} >= ${startDate}`
            )
          ),
        db
          .select({
            productId: inventoryHistory.productId,
            date: inventoryHistory.date,
            quantity: sql<number>`ABS(${inventoryHistory.changeAmount})`,
          })
          .from(inventoryHistory)
          .where(
            and(
              eq(inventoryHistory.organizationId, organizationId),
              sql`${inventoryHistory.productId} IN ${eligibleProducts}`,
              sql`${inventoryHistory.date} >= ${startDate}`,
              sql`${inventoryHistory.changeAmount} < 0`
            )
          ),
      ]);

      // salesRecords에 데이터가 있는 제품 ID 집합
      const productsWithSalesData = new Set(salesData.map((s) => s.productId));

      // 5-2. ABC 분석용 데이터 집계 (매출액 기준)
      const salesByProduct = new Map<
        string,
        { totalValue: number; monthlyQuantities: Map<string, number> }
      >();

      for (const sale of salesData) {
        if (!salesByProduct.has(sale.productId)) {
          salesByProduct.set(sale.productId, {
            totalValue: 0,
            monthlyQuantities: new Map(),
          });
        }
        const entry = salesByProduct.get(sale.productId)!;
        entry.totalValue += Number(sale.totalAmount ?? 0);

        // 월별 수량 집계 (XYZ 분석용)
        const monthKey = sale.date.substring(0, 7); // "YYYY-MM"
        entry.monthlyQuantities.set(
          monthKey,
          (entry.monthlyQuantities.get(monthKey) || 0) + sale.quantity
        );
      }

      // 5-2b. salesRecords에 없는 제품은 inventoryHistory 출고 데이터로 보충
      for (const row of outboundSalesData) {
        if (productsWithSalesData.has(row.productId)) continue;
        if (!salesByProduct.has(row.productId)) {
          salesByProduct.set(row.productId, {
            totalValue: 0,
            monthlyQuantities: new Map(),
          });
        }
        const entry = salesByProduct.get(row.productId)!;
        // 출고 이력에는 totalAmount가 없으므로 수량만 집계 (ABC는 수량 기반으로 대체)
        entry.totalValue += Number(row.quantity);
        const monthKey = row.date.substring(0, 7);
        entry.monthlyQuantities.set(
          monthKey,
          (entry.monthlyQuantities.get(monthKey) || 0) + Number(row.quantity)
        );
      }

      // 5-3. ABC 분석
      const abcItems: ABCAnalysisItem[] = eligibleProducts.map((id) => {
        const productInfo = productList.find((p) => p.id === id);
        return {
          id,
          name: productInfo?.name || "",
          value: salesByProduct.get(id)?.totalValue || 0,
        };
      });

      const abcResults = performABCAnalysis(abcItems);

      // 5-4. XYZ 분석 (월별 수요량)
      // 최근 6개월의 월 키 생성
      const monthKeys: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthKeys.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        );
      }

      const xyzItems: XYZAnalysisItem[] = eligibleProducts.map((id) => {
        const productInfo = productList.find((p) => p.id === id);
        const monthlyData = salesByProduct.get(id)?.monthlyQuantities;
        const demandHistory = monthKeys.map(
          (key) => monthlyData?.get(key) || 0
        );

        return {
          id,
          name: productInfo?.name || "",
          demandHistory,
        };
      });

      const xyzResults = performXYZAnalysis(xyzItems);

      // 5-5. 결과를 DB에 반영
      const abcMap = new Map(abcResults.map((r) => [r.id, r.grade]));
      const xyzMap = new Map(xyzResults.map((r) => [r.id, r]));

      // 5-5a. products 배치 UPDATE (UPDATE ... FROM VALUES) — ABC-XYZ-FMR 모두 반영
      try {
        const updateRows = eligibleProducts.map((productId) => {
          const abcGrade = abcMap.get(productId) || null;
          const xyzResult = xyzMap.get(productId);
          const xyzGrade = xyzResult?.grade || null;
          const fmrGrade = fmrMap.get(productId) || null;

          const firstSaleDate = firstSaleMap.get(productId);
          let salesMonths = 0;
          if (firstSaleDate) {
            const firstDate = new Date(firstSaleDate);
            salesMonths =
              (now.getFullYear() - firstDate.getFullYear()) * 12 +
              (now.getMonth() - firstDate.getMonth());
          }

          const gradeInfo: GradeInfo = {
            isNewProduct: false,
            salesMonths,
            lastGradeRefresh: now.toISOString(),
          };

          return sql`(${productId}::uuid, ${abcGrade}, ${xyzGrade}, ${fmrGrade}, ${JSON.stringify(gradeInfo)}::jsonb)`;
        });

        await db.execute(sql`
          UPDATE products
          SET
            abc_grade = v.abc_grade,
            xyz_grade = v.xyz_grade,
            fmr_grade = v.fmr_grade::fmr_grade,
            metadata = COALESCE(products.metadata, '{}'::jsonb) || jsonb_build_object('gradeInfo', v.grade_info),
            updated_at = ${now}
          FROM (VALUES ${sql.join(updateRows, sql`, `)}) AS v(product_id, abc_grade, xyz_grade, fmr_grade, grade_info)
          WHERE products.id = v.product_id
        `);

        result.updatedCount = eligibleProducts.length;
      } catch (error) {
        result.errors.push(
          `제품 등급 배치 업데이트 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
      }

      // 5-5b. grade_history 배치 INSERT
      try {
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        const historyRows = eligibleProducts.map((productId) => {
          const abcGrade = abcMap.get(productId) || null;
          const xyzResult = xyzMap.get(productId);
          const xyzGrade = xyzResult?.grade || null;
          const combinedGrade = abcGrade && xyzGrade ? `${abcGrade}${xyzGrade}` : null;
          const salesValue = salesByProduct.get(productId)?.totalValue || 0;
          const cv = xyzResult?.coefficientOfVariation ?? null;

          return {
            organizationId,
            productId,
            period,
            abcGrade,
            xyzGrade,
            combinedGrade,
            salesValue: salesValue.toString(),
            coefficientOfVariation: cv !== null ? cv.toFixed(2) : null,
          };
        });

        if (historyRows.length > 0) {
          await db.insert(gradeHistory).values(historyRows);
        }
      } catch (error) {
        result.errors.push(
          `등급 이력 배치 저장 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
      }
    }

    return result;
  } catch (error) {
    result.errors.push(
      `등급 갱신 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
    );
    return result;
  }
}
