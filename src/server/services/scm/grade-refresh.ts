/**
 * ABC-XYZ 등급 갱신 서비스
 *
 * - 판매 이력 3개월 미만: 신제품(NEW) 태그, 등급 미부여
 * - 판매 이력 3개월 이상: ABC-XYZ 분석 수행, 등급 자동 부여
 * - products.metadata.gradeInfo에 메타데이터 저장 (스키마 변경 없음)
 */

import { db } from "@/server/db";
import { products, salesRecords, gradeHistory } from "@/server/db/schema";
import { eq, and, sql, min } from "drizzle-orm";
import {
  performABCAnalysis,
  performXYZAnalysis,
  type ABCAnalysisItem,
  type XYZAnalysisItem,
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

    // 2. 각 제품별 최초 판매일 조회 (단일 쿼리로 처리)
    const firstSaleDates = await db
      .select({
        productId: salesRecords.productId,
        firstSaleDate: min(salesRecords.date),
      })
      .from(salesRecords)
      .where(eq(salesRecords.organizationId, organizationId))
      .groupBy(salesRecords.productId);

    const firstSaleMap = new Map(
      firstSaleDates.map((r) => [r.productId, r.firstSaleDate])
    );

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

    // 4. 신제품: 배치 metadata 업데이트 (등급은 null로 설정)
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
          return sql`(${productId}::uuid, ${JSON.stringify(gradeInfo)}::jsonb)`;
        });

        // 단일 UPDATE ... FROM (VALUES ...) 쿼리로 배치 처리
        await db.execute(sql`
          UPDATE products
          SET
            abc_grade = NULL,
            xyz_grade = NULL,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('gradeInfo', v.grade_info),
            updated_at = ${now}
          FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(product_id, grade_info)
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

      const salesData = await db
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
        );

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

      // 5-5a. products 배치 UPDATE (UPDATE ... FROM VALUES)
      try {
        const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        const updateRows = eligibleProducts.map((productId) => {
          const abcGrade = abcMap.get(productId) || null;
          const xyzResult = xyzMap.get(productId);
          const xyzGrade = xyzResult?.grade || null;

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

          return sql`(${productId}::uuid, ${abcGrade}, ${xyzGrade}, ${JSON.stringify(gradeInfo)}::jsonb)`;
        });

        await db.execute(sql`
          UPDATE products
          SET
            abc_grade = v.abc_grade,
            xyz_grade = v.xyz_grade,
            metadata = COALESCE(products.metadata, '{}'::jsonb) || jsonb_build_object('gradeInfo', v.grade_info),
            updated_at = ${now}
          FROM (VALUES ${sql.join(updateRows, sql`, `)}) AS v(product_id, abc_grade, xyz_grade, grade_info)
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
