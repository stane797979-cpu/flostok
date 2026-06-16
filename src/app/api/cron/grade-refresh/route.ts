import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { refreshGradesForOrganization } from "@/server/services/scm/grade-refresh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ABC-XYZ 등급 갱신 크론잡
 *
 * 스케줄: 매월 1일 09:30 KST (00:30 UTC)
 * 기능:
 * - 모든 조직의 제품 ABC-XYZ 등급 재계산
 * - 판매 이력 3개월 미만 → 신제품(NEW) 태그
 * - 판매 이력 3개월 이상 → ABC-XYZ 등급 자동 부여
 *
 * Railway 크론잡 설정:
 * - 환경변수: CRON_SECRET
 * - 요청: GET /api/cron/grade-refresh?secret={CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. CRON_SECRET 검증
    const secret = request.nextUrl.searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error(
        "[Grade-Refresh Cron] CRON_SECRET 환경변수가 설정되지 않았습니다"
      );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (secret !== expectedSecret) {
      console.error("[Grade-Refresh Cron] 인증 실패: 잘못된 secret");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Grade-Refresh Cron] 시작:", new Date().toISOString());

    // 2. 모든 조직 가져오기
    const allOrganizations = await db.select().from(organizations);

    console.log(
      `[Grade-Refresh Cron] 처리할 조직 수: ${allOrganizations.length}`
    );

    const results: Array<{
      organizationId: string;
      organizationName: string;
      totalProducts: number;
      updatedCount: number;
      newProductCount: number;
      error?: string;
    }> = [];

    // 3. 각 조직별로 등급 갱신
    for (const org of allOrganizations) {
      try {
        console.log(
          `[Grade-Refresh Cron] 조직 처리 시작: ${org.name} (${org.id})`
        );

        const refreshResult = await refreshGradesForOrganization(org.id);

        console.log(
          `[Grade-Refresh Cron] 조직 ${org.name}: 전체 ${refreshResult.totalProducts}개, 갱신 ${refreshResult.updatedCount}개, 신제품 ${refreshResult.newProductCount}개`
        );

        if (refreshResult.errors.length > 0) {
          console.warn(
            `[Grade-Refresh Cron] 조직 ${org.name} 부분 오류:`,
            refreshResult.errors
          );
        }

        results.push({
          organizationId: org.id,
          organizationName: org.name,
          totalProducts: refreshResult.totalProducts,
          updatedCount: refreshResult.updatedCount,
          newProductCount: refreshResult.newProductCount,
          error:
            refreshResult.errors.length > 0
              ? `${refreshResult.errors.length}건 오류`
              : undefined,
        });
      } catch (error) {
        console.error(
          `[Grade-Refresh Cron] 조직 ${org.name} 처리 실패:`,
          error
        );
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          totalProducts: 0,
          updatedCount: 0,
          newProductCount: 0,
          error: error instanceof Error ? error.message : "알 수 없는 오류",
        });
      }
    }

    const duration = Date.now() - startTime;
    const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newProductCount, 0);

    console.log("[Grade-Refresh Cron] 완료:", {
      duration: `${duration}ms`,
      totalOrganizations: allOrganizations.length,
      totalUpdated,
      totalNewProducts: totalNew,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      summary: {
        totalOrganizations: allOrganizations.length,
        totalUpdated,
        totalNewProducts: totalNew,
      },
      results,
    });
  } catch (error) {
    console.error("[Grade-Refresh Cron] 치명적 오류:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
