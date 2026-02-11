"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireManagerOrAbove } from "./auth-helpers";
import {
  refreshGradesForOrganization,
  type GradeRefreshResult,
} from "@/server/services/scm/grade-refresh";

/**
 * ABC-XYZ 등급 수동 갱신
 *
 * - 매니저 이상 권한 필요
 * - 조직의 전체 제품에 대해 등급 재계산
 * - 판매 이력 3개월 미만 → NEW 태그
 * - 판매 이력 3개월 이상 → ABC-XYZ 등급 자동 부여
 */
export async function refreshGrades(): Promise<{
  success: boolean;
  result?: GradeRefreshResult;
  error?: string;
}> {
  try {
    const user = await requireManagerOrAbove();
    const result = await refreshGradesForOrganization(user.organizationId);

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/analytics");
    revalidateTag(`analytics-${user.organizationId}`);

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error("등급 갱신 오류:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "등급 갱신에 실패했습니다",
    };
  }
}
