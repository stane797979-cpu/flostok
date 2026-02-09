/**
 * 납기준수 분석 서비스
 * 기준 리드타임 vs 실제 리드타임, 납기준수율, 공급자별 분석
 */

export interface DeliveryComplianceItem {
  orderId: string;
  orderNumber: string;
  supplierId: string | null;
  supplierName: string;
  productNames: string[];
  /** 발주일 */
  orderDate: string;
  /** 예상입고일 */
  expectedDate: string | null;
  /** 실제입고일 */
  actualDate: string | null;
  /** 요청일 (입고 희망일) */
  requestedDate: string | null;
  /** 기준 리드타임 (공급자 설정) */
  standardLeadTime: number;
  /** 실제 리드타임 (일) */
  actualLeadTime: number | null;
  /** 지연일수 (양수=지연, 음수=조기) */
  delayDays: number | null;
  /** 납기 준수 여부 */
  isOnTime: boolean | null;
  /** 상태 */
  status: string;
}

export interface SupplierComplianceSummary {
  supplierId: string;
  supplierName: string;
  totalOrders: number;
  completedOrders: number;
  onTimeOrders: number;
  lateOrders: number;
  onTimeRate: number;
  avgActualLeadTime: number;
  avgStandardLeadTime: number;
  avgDelayDays: number;
  maxDelayDays: number;
}

export interface DeliveryComplianceResult {
  items: DeliveryComplianceItem[];
  supplierSummaries: SupplierComplianceSummary[];
  overall: {
    totalOrders: number;
    completedOrders: number;
    onTimeRate: number;
    avgLeadTime: number;
    avgDelayDays: number;
  };
}

/**
 * 두 날짜 사이의 일수 차이 계산
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 발주 데이터에서 납기준수 분석 결과를 계산
 */
export function analyzeDeliveryCompliance(
  orders: Array<{
    id: string;
    orderNumber: string;
    supplierId: string | null;
    supplierName: string;
    productNames: string[];
    orderDate: string | null;
    expectedDate: string | null;
    actualDate: string | null;
    requestedDate: string | null;
    standardLeadTime: number;
    status: string;
  }>
): DeliveryComplianceResult {
  const items: DeliveryComplianceItem[] = [];
  const supplierMap = new Map<string, {
    supplierId: string;
    supplierName: string;
    orders: DeliveryComplianceItem[];
  }>();

  for (const order of orders) {
    if (!order.orderDate) continue;

    const actualLeadTime = order.actualDate
      ? daysBetween(order.orderDate, order.actualDate)
      : null;

    // 지연일수: 예상입고일 기준 (없으면 발주일+기준LT 기준)
    let delayDays: number | null = null;
    let isOnTime: boolean | null = null;

    if (order.actualDate) {
      if (order.expectedDate) {
        delayDays = daysBetween(order.expectedDate, order.actualDate);
      } else {
        // 예상입고일이 없으면 기준LT와 비교
        delayDays = (actualLeadTime ?? 0) - order.standardLeadTime;
      }
      // 1일 이내 지연은 정시로 간주
      isOnTime = delayDays <= 1;
    }

    const item: DeliveryComplianceItem = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      productNames: order.productNames,
      orderDate: order.orderDate,
      expectedDate: order.expectedDate,
      actualDate: order.actualDate,
      requestedDate: order.requestedDate,
      standardLeadTime: order.standardLeadTime,
      actualLeadTime,
      delayDays,
      isOnTime,
      status: order.status,
    };

    items.push(item);

    // 공급자별 집계
    const key = order.supplierId || "unknown";
    if (!supplierMap.has(key)) {
      supplierMap.set(key, {
        supplierId: order.supplierId || "unknown",
        supplierName: order.supplierName,
        orders: [],
      });
    }
    supplierMap.get(key)!.orders.push(item);
  }

  // 공급자별 요약 계산
  const supplierSummaries: SupplierComplianceSummary[] = [];
  for (const [, group] of supplierMap) {
    const completed = group.orders.filter((o) => o.actualDate !== null);
    const onTime = completed.filter((o) => o.isOnTime === true);
    const late = completed.filter((o) => o.isOnTime === false);

    const actualLeadTimes = completed
      .map((o) => o.actualLeadTime)
      .filter((v): v is number => v !== null);
    const delayValues = completed
      .map((o) => o.delayDays)
      .filter((v): v is number => v !== null);

    supplierSummaries.push({
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      totalOrders: group.orders.length,
      completedOrders: completed.length,
      onTimeOrders: onTime.length,
      lateOrders: late.length,
      onTimeRate: completed.length > 0 ? (onTime.length / completed.length) * 100 : 0,
      avgActualLeadTime:
        actualLeadTimes.length > 0
          ? actualLeadTimes.reduce((a, b) => a + b, 0) / actualLeadTimes.length
          : 0,
      avgStandardLeadTime:
        group.orders.length > 0
          ? group.orders.reduce((a, b) => a + b.standardLeadTime, 0) / group.orders.length
          : 0,
      avgDelayDays:
        delayValues.length > 0
          ? delayValues.reduce((a, b) => a + b, 0) / delayValues.length
          : 0,
      maxDelayDays:
        delayValues.length > 0 ? Math.max(...delayValues) : 0,
    });
  }

  // 전체 요약
  const allCompleted = items.filter((i) => i.actualDate !== null);
  const allOnTime = allCompleted.filter((i) => i.isOnTime === true);
  const allActualLT = allCompleted
    .map((i) => i.actualLeadTime)
    .filter((v): v is number => v !== null);
  const allDelays = allCompleted
    .map((i) => i.delayDays)
    .filter((v): v is number => v !== null);

  return {
    items: items.sort((a, b) => {
      // 지연일수 내림차순 (지연 큰 것 먼저)
      const delayA = a.delayDays ?? -999;
      const delayB = b.delayDays ?? -999;
      return delayB - delayA;
    }),
    supplierSummaries: supplierSummaries.sort((a, b) => a.onTimeRate - b.onTimeRate),
    overall: {
      totalOrders: items.length,
      completedOrders: allCompleted.length,
      onTimeRate:
        allCompleted.length > 0
          ? (allOnTime.length / allCompleted.length) * 100
          : 0,
      avgLeadTime:
        allActualLT.length > 0
          ? allActualLT.reduce((a, b) => a + b, 0) / allActualLT.length
          : 0,
      avgDelayDays:
        allDelays.length > 0
          ? allDelays.reduce((a, b) => a + b, 0) / allDelays.length
          : 0,
    },
  };
}
