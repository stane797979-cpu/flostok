import { ABCXYZMiniMatrix } from "@/components/features/dashboard/abc-xyz-mini-matrix";
import { getABCXYZAnalysis } from "@/server/actions/analytics";

export async function DashboardABCMatrix() {
  const abcResult = await getABCXYZAnalysis().catch(() => ({
    products: [],
    matrixData: [],
    summary: { aCount: 0, aPercentage: 0, bCount: 0, bPercentage: 0, cCount: 0, cPercentage: 0, period: "" },
  }));

  return <ABCXYZMiniMatrix matrixData={abcResult.matrixData} />;
}
