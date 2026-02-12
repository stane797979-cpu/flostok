import { getGradeChangeAnalysis } from "@/server/actions/grade-change";
import { GradeChangeTable } from "./grade-change-table";

export async function AnalyticsGradeChange() {
  const data = await getGradeChangeAnalysis().catch(() => null);
  return <GradeChangeTable data={data} />;
}
