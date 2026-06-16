/**
 * KPI 개선 제안 서비스
 * KPI 분석 후 자동으로 개선 제안을 생성하는 서비스
 */

export interface KPIMetrics {
  inventoryTurnoverRate: number; // 재고회전율 (회/년)
  averageInventoryDays: number; // 평균 재고일수 (일)
  inventoryAccuracy: number; // 재고 정확도 (%)
  stockoutRate: number; // 품절률 (%)
  onTimeOrderRate: number; // 적시 발주율 (%)
  averageLeadTime: number; // 평균 리드타임 (일)
  orderFulfillmentRate: number; // 발주 충족률 (%)
}

export interface KPITarget {
  inventoryTurnoverRate: number;
  averageInventoryDays: number;
  inventoryAccuracy: number;
  stockoutRate: number;
  onTimeOrderRate: number;
  averageLeadTime: number;
  orderFulfillmentRate: number;
}

export interface ImprovementProposal {
  id: string;
  title: string;
  description: string;
  kpiCategory: "inventory" | "order" | "cost";
  affectedKPIs: string[]; // 영향을 받는 KPI 이름
  priority: "high" | "medium" | "low";
  estimatedImpact: string; // 예상 효과 (예: "재고회전율 +15%")
  actionSteps: string[]; // 실행 단계
  timeToImplement: string; // 구현 기간 (예: "2-4주")
}

/**
 * KPI 기반 개선 제안 생성
 * @param metrics 현재 KPI 지표
 * @param targets 목표 KPI 지표
 * @returns 개선 제안 목록
 */
export function generateKPIImprovementProposals(
  metrics: KPIMetrics,
  targets: KPITarget
): ImprovementProposal[] {
  const proposals: ImprovementProposal[] = [];

  // 재고회전율 개선 제안
  if (metrics.inventoryTurnoverRate < targets.inventoryTurnoverRate) {
    const gap = targets.inventoryTurnoverRate - metrics.inventoryTurnoverRate;
    const percentGap = (gap / targets.inventoryTurnoverRate) * 100;

    if (percentGap > 10) {
      proposals.push({
        id: "turnover-1",
        title: "과다 재고 정리 및 재고 최적화",
        description:
          "현재 재고회전율이 목표보다 " +
          percentGap.toFixed(1) +
          "% 낮습니다. ABC 분석 결과 C등급 제품의 과다 재고를 정리하고, 재고 최적화를 진행하세요.",
        kpiCategory: "inventory",
        affectedKPIs: ["재고회전율", "평균 재고일수", "총 재고금액"],
        priority: "high",
        estimatedImpact: `재고회전율 +${gap.toFixed(1)}회/년, 재고일수 -${(365 / (metrics.inventoryTurnoverRate + gap)).toFixed(0)}일`,
        actionSteps: [
          "1. ABC 분석: C등급 제품 중 3개월 미판매 제품 식별",
          "2. 재고 정리: 폐기/할인 판매를 통한 과다 재고 처분",
          "3. 발주 정책 조정: EOQ 계산 기반 최적 발주량 설정",
          "4. 정기 모니터링: 월 1회 회전율 추이 확인",
        ],
        timeToImplement: "4-6주",
      });
    }
  }

  // 평균 재고일수 개선 제안
  if (metrics.averageInventoryDays > targets.averageInventoryDays) {
    const gap = metrics.averageInventoryDays - targets.averageInventoryDays;

    if (gap > 5) {
      proposals.push({
        id: "inventory-days-1",
        title: "발주 주기 단축 및 재고 회전 가속화",
        description:
          "평균 재고일수가 목표보다 " +
          gap.toFixed(0) +
          "일 많습니다. 발주 주기를 단축하고 공급자와의 협력을 강화하세요.",
        kpiCategory: "inventory",
        affectedKPIs: ["평균 재고일수", "재고회전율"],
        priority: "medium",
        estimatedImpact: `평균 재고일수 -${gap.toFixed(0)}일`,
        actionSteps: [
          "1. 공급자 협력: 더 빈번한 배송(예: 주 2회 → 주 3회) 협의",
          "2. 발주 정책: 발주량 감소, 발주 빈도 증가",
          "3. 수요예측: 정확도 개선으로 안전재고 감소",
          "4. JIT 도입: A급 제품부터 시범 운영",
        ],
        timeToImplement: "2-4주",
      });
    }
  }

  // 품절률 개선 제안
  if (metrics.stockoutRate > targets.stockoutRate) {
    const gap = metrics.stockoutRate - targets.stockoutRate;

    if (gap > 0.5) {
      proposals.push({
        id: "stockout-1",
        title: "안전재고 및 발주점 최적화",
        description:
          "품절률이 목표보다 " +
          gap.toFixed(2) +
          "% 높습니다. A/B급 제품의 안전재고와 발주점을 재계산하세요.",
        kpiCategory: "inventory",
        affectedKPIs: ["품절률", "적시 발주율"],
        priority: "high",
        estimatedImpact: `품절률 -${gap.toFixed(2)}%, 고객 만족도 향상`,
        actionSteps: [
          "1. 수요 분석: 최근 6개월 판매 데이터 재분석",
          "2. 안전재고 재계산: 서비스 수준(예: 95% → 98%) 상향 검토",
          "3. 리드타임 확인: 공급자 리드타임 단축 협의",
          "4. 자동 발주: 발주점 기반 자동 발주 활성화",
        ],
        timeToImplement: "1-2주",
      });
    }
  }

  // 적시 발주율 개선 제안
  if (metrics.onTimeOrderRate < targets.onTimeOrderRate) {
    const gap = targets.onTimeOrderRate - metrics.onTimeOrderRate;

    if (gap > 3) {
      proposals.push({
        id: "ontime-order-1",
        title: "발주 프로세스 자동화 및 리드타임 단축",
        description:
          "적시 발주율이 목표보다 " +
          gap.toFixed(1) +
          "% 낮습니다. 발주 프로세스를 자동화하고 리드타임을 단축하세요.",
        kpiCategory: "order",
        affectedKPIs: ["적시 발주율", "발주 충족률"],
        priority: "high",
        estimatedImpact: `적시 발주율 +${gap.toFixed(1)}%`,
        actionSteps: [
          "1. 자동 발주: 발주점 도달 시 자동 발주 활성화",
          "2. 공급자 리드타임: 주요 공급자와 리드타임 단축 협의",
          "3. 발주 승인: 승인 프로세스 간소화 (자동 승인 규칙 설정)",
          "4. 모니터링: 주 1회 발주 현황 검토",
        ],
        timeToImplement: "2-3주",
      });
    }
  }

  // 평균 리드타임 개선 제안
  if (metrics.averageLeadTime > targets.averageLeadTime) {
    const gap = metrics.averageLeadTime - targets.averageLeadTime;

    if (gap > 1) {
      proposals.push({
        id: "leadtime-1",
        title: "공급자 성과 관리 및 대체 공급자 개발",
        description:
          "평균 리드타임이 목표보다 " +
          gap.toFixed(1) +
          "일 깁니다. 주요 공급자의 납기 성과를 개선하고 대체 공급자를 발굴하세요.",
        kpiCategory: "order",
        affectedKPIs: ["평균 리드타임", "발주 충족률", "적시 발주율"],
        priority: "medium",
        estimatedImpact: `평균 리드타임 -${gap.toFixed(1)}일`,
        actionSteps: [
          "1. 공급자 분석: 리드타임별 공급자 성과 현황 파악",
          "2. KPI 계약: 주요 공급자와 납기 KPI 계약서 작성",
          "3. 대체 공급자: 리드타임이 짧은 대체 공급자 발굴",
          "4. 벌크 주문: A급 제품 공급자와 벌크 계약 협의",
        ],
        timeToImplement: "3-4주",
      });
    }
  }

  // 재고 정확도 개선 제안
  if (metrics.inventoryAccuracy < targets.inventoryAccuracy) {
    const gap = targets.inventoryAccuracy - metrics.inventoryAccuracy;

    if (gap > 2) {
      proposals.push({
        id: "accuracy-1",
        title: "재고 실사 및 시스템 점검 강화",
        description:
          "재고 정확도가 목표보다 " +
          gap.toFixed(1) +
          "% 낮습니다. 정기 실사를 강화하고 시스템 오류를 파악하세요.",
        kpiCategory: "inventory",
        affectedKPIs: ["재고 정확도", "재고회전율"],
        priority: "medium",
        estimatedImpact: `재고 정확도 +${gap.toFixed(1)}%`,
        actionSteps: [
          "1. 정기 실사: 주기를 월 1회 → 월 2회로 증가",
          "2. ABC 실사: A급(매월), B급(분기), C급(반기) 구분 실시",
          "3. 시스템 점검: 오류 발생 빈도 및 원인 분석",
          "4. 교육: 재고 관리 담당자 교육 강화",
        ],
        timeToImplement: "2주",
      });
    }
  }

  // 발주 충족률 개선 제안
  if (metrics.orderFulfillmentRate < targets.orderFulfillmentRate) {
    const gap = targets.orderFulfillmentRate - metrics.orderFulfillmentRate;

    if (gap > 2) {
      proposals.push({
        id: "fulfillment-1",
        title: "공급자 신뢰도 개선 및 계약 조건 조정",
        description:
          "발주 충족률이 목표보다 " +
          gap.toFixed(1) +
          "% 낮습니다. 공급자 신뢰도를 높이고 계약 조건을 재검토하세요.",
        kpiCategory: "order",
        affectedKPIs: ["발주 충족률", "적시 발주율"],
        priority: "medium",
        estimatedImpact: `발주 충족률 +${gap.toFixed(1)}%`,
        actionSteps: [
          "1. 공급자 성과: 납기, 품질, 정량 정확도 평가",
          "2. 미충족 분석: 부분 납품 원인 파악",
          "3. 계약 조정: 패널티/인센티브 구조 개선",
          "4. 협력 강화: 정기 협력사 미팅 개최 (월 1회)",
        ],
        timeToImplement: "3-4주",
      });
    }
  }

  // 종합 제안: 모든 KPI가 목표를 달성한 경우
  if (
    metrics.inventoryTurnoverRate >= targets.inventoryTurnoverRate &&
    metrics.averageInventoryDays <= targets.averageInventoryDays &&
    metrics.inventoryAccuracy >= targets.inventoryAccuracy &&
    metrics.stockoutRate <= targets.stockoutRate &&
    metrics.onTimeOrderRate >= targets.onTimeOrderRate &&
    metrics.orderFulfillmentRate >= targets.orderFulfillmentRate
  ) {
    proposals.push({
      id: "excellence-1",
      title: "지속적 개선 및 고도화 전략",
      description:
        "축하합니다! 모든 KPI가 목표를 달성했습니다. 이제 경쟁 우위를 확보하고 고도화된 전략을 추진하세요.",
      kpiCategory: "cost",
      affectedKPIs: ["모든 KPI"],
      priority: "medium",
      estimatedImpact: "경쟁력 강화, 고객 만족도 향상",
      actionSteps: [
        "1. 벤치마킹: 산업 평균 대비 성과 분석",
        "2. AI 적용: 수요예측 정확도 고도화 (딥러닝 모델)",
        "3. 공급망 최적화: 다단계 네트워크 분석",
        "4. 지속적 개선: PDCA 사이클 운영 강화",
      ],
      timeToImplement: "4주 이상",
    });
  }

  return proposals;
}

/**
 * 개선 제안의 우선순위 정렬
 * @param proposals 개선 제안 목록
 * @returns 우선순위별 정렬된 제안 목록
 */
export function sortProposalsByPriority(proposals: ImprovementProposal[]): ImprovementProposal[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return [...proposals].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * 카테고리별 제안 필터링
 * @param proposals 개선 제안 목록
 * @param category 필터할 카테고리
 * @returns 필터링된 제안 목록
 */
export function filterProposalsByCategory(
  proposals: ImprovementProposal[],
  category: "inventory" | "order" | "cost"
): ImprovementProposal[] {
  return proposals.filter((p) => p.kpiCategory === category);
}
