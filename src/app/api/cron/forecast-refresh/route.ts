import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { organizations, products, salesRecords, demandForecasts } from "@/server/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { selectBestMethod } from "@/server/services/scm/demand-forecast/selector";
import type { ForecastInput } from "@/server/services/scm/demand-forecast/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 5분 (SKU 많을 경우 대비)

/**
 * 수요예측 자동 재산출 크론잡
 *
 * 스케줄: 매월 말일 23:30 KST (14:30 UTC)
 * → vercel.json: "30 14 28-31 * *" + 익월 1일 체크로 말일만 실행
 *
 * 기능:
 * - 모든 조직의 전 SKU 수요예측 재산출
 * - 최근 데이터 기반 최적 방법 자동 선택 (WMA/SES/Holt's + 계절조정)
 * - demand_forecasts 테이블 UPSERT (향후 3개월)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. CRON_SECRET 검증
    const secret = request.nextUrl.searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 말일 여부 체크 (28~31일 스케줄이므로 실제 말일에만 실행)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDate() !== 1) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "말일 아님 — 스킵",
        timestamp: now.toISOString(),
      });
    }

    console.log("[Forecast-Refresh Cron] 시작:", now.toISOString());

    const allOrganizations = await db.select().from(organizations);
    const methodDbMap: Record<string, string> = { SMA: "sma_3", WMA: "sma_3", SES: "ses", Holts: "holt" };

    const results: Array<{
      organizationId: string;
      organizationName: string;
      totalProducts: number;
      updatedCount: number;
      errorCount: number;
    }> = [];

    for (const org of allOrganizations) {
      let updatedCount = 0;
      let errorCount = 0;

      try {
        // 3. 조직 내 전 제품 조회
        const orgProducts = await db
          .select({
            id: products.id,
            sku: products.sku,
            name: products.name,
            abcGrade: products.abcGrade,
            xyzGrade: products.xyzGrade,
            safetyStock: products.safetyStock,
          })
          .from(products)
          .where(eq(products.organizationId, org.id));

        // 4. 최근 24개월 월별 출고량 전체 조회 (N+1 방지)
        const twoYearsAgo = new Date();
        twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);
        const startDate = twoYearsAgo.toISOString().split("T")[0];

        const salesRows = await db
          .select({
            productId: salesRecords.productId,
            month: sql<string>`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`,
            qty: sql<number>`COALESCE(SUM(${salesRecords.quantity}), 0)`,
          })
          .from(salesRecords)
          .where(
            and(
              eq(salesRecords.organizationId, org.id),
              gte(salesRecords.date, startDate)
            )
          )
          .groupBy(salesRecords.productId, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`)
          .orderBy(salesRecords.productId, sql`TO_CHAR(${salesRecords.date}::date, 'YYYY-MM')`);

        // productId별 월별 출고 맵 구성
        const salesMap = new Map<string, Array<{ month: string; value: number }>>();
        for (const row of salesRows) {
          if (!salesMap.has(row.productId)) salesMap.set(row.productId, []);
          salesMap.get(row.productId)!.push({ month: row.month, value: Number(row.qty) });
        }

        // 5. SKU별 예측 재산출 + DB UPSERT
        for (const product of orgProducts) {
          try {
            const monthlyData = salesMap.get(product.id) || [];
            if (monthlyData.length < 3) continue; // 최소 3개월 데이터 필요

            const history = monthlyData.map((d) => ({
              date: new Date(`${d.month}-01`),
              value: d.value,
            }));

            const input: ForecastInput = {
              history,
              periods: 3,
              abcGrade: product.abcGrade ?? undefined,
              xyzGrade: product.xyzGrade ?? undefined,
            };

            const forecastResult = selectBestMethod(input);
            const dbMethod = methodDbMap[forecastResult.method] || "sma_3";
            const mapeValue = Math.round((forecastResult.mape ?? 999) * 10) / 10;
            const noteText = `자동 재산출: ${forecastResult.method}`;

            // 향후 3개월 기간 생성
            const lastDate = history[history.length - 1].date;
            const predictedPeriods = forecastResult.forecast.map((value, i) => {
              const d = new Date(lastDate);
              d.setMonth(d.getMonth() + i + 1);
              const periodStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
              return { period: periodStr, value: Math.round(value) };
            });

            // 기존 예측 조회 후 UPSERT
            const periodStrs = predictedPeriods.map((p) => p.period);
            const existingRows = await db
              .select({ id: demandForecasts.id, period: demandForecasts.period })
              .from(demandForecasts)
              .where(
                and(
                  eq(demandForecasts.organizationId, org.id),
                  eq(demandForecasts.productId, product.id),
                  sql`${demandForecasts.period} IN (${sql.join(periodStrs.map((p) => sql`${p}`), sql`, `)})`
                )
              );
            const existingMap = new Map(existingRows.map((r) => [r.period, r.id]));

            const ops: Promise<unknown>[] = [];
            for (const pp of predictedPeriods) {
              const existId = existingMap.get(pp.period);
              if (existId) {
                ops.push(
                  db.update(demandForecasts).set({
                    method: dbMethod as typeof demandForecasts.method.enumValues[number],
                    forecastQuantity: pp.value,
                    mape: String(mapeValue),
                    notes: noteText,
                    updatedAt: new Date(),
                  }).where(eq(demandForecasts.id, existId))
                );
              } else {
                ops.push(
                  db.insert(demandForecasts).values({
                    organizationId: org.id,
                    productId: product.id,
                    period: pp.period,
                    method: dbMethod as typeof demandForecasts.method.enumValues[number],
                    forecastQuantity: pp.value,
                    mape: String(mapeValue),
                    notes: noteText,
                  })
                );
              }
            }
            await Promise.all(ops);
            updatedCount++;
          } catch (err) {
            console.error(`[Forecast-Refresh] SKU ${product.sku} 오류:`, err);
            errorCount++;
          }
        }

        console.log(`[Forecast-Refresh] 조직 ${org.name}: 갱신 ${updatedCount}개, 오류 ${errorCount}개`);
        results.push({ organizationId: org.id, organizationName: org.name, totalProducts: orgProducts.length, updatedCount, errorCount });
      } catch (orgErr) {
        console.error(`[Forecast-Refresh] 조직 ${org.name} 실패:`, orgErr);
        results.push({ organizationId: org.id, organizationName: org.name, totalProducts: 0, updatedCount: 0, errorCount: 1 });
      }
    }

    const duration = Date.now() - startTime;
    const totalUpdated = results.reduce((s, r) => s + r.updatedCount, 0);

    console.log("[Forecast-Refresh Cron] 완료:", { duration: `${duration}ms`, totalUpdated });

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      duration,
      summary: { totalOrganizations: allOrganizations.length, totalUpdated },
      results,
    });
  } catch (error) {
    console.error("[Forecast-Refresh Cron] 치명적 오류:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "알 수 없는 오류", timestamp: new Date().toISOString(), duration: Date.now() - startTime },
      { status: 500 }
    );
  }
}
