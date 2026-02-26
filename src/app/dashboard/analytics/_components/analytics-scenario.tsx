import { getScenarioSimulationData } from "@/server/actions/scenario-simulation";
import { ScenarioSimulation } from "./scenario-simulation";

/**
 * 시나리오 시뮬레이션 RSC 래퍼
 * - 서버에서 실데이터 조회 후 ScenarioSimulation 클라이언트 컴포넌트에 전달
 * - 에러 시 null → ScenarioSimulation 내 빈 상태 UI 표시
 */
export async function AnalyticsScenario() {
  const data = await getScenarioSimulationData().catch(() => null);
  return <ScenarioSimulation data={data} />;
}
