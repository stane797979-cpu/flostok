"use server";

import { db } from "@/server/db";
import {
  suppliers,
  purchaseOrders,
  inboundRecords,
} from "@/server/db/schema";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { getCurrentUser } from "./auth-helpers";
import {
  buildScorecard,
  rankSuppliers,
  type SupplierScorecard,
} from "@/server/services/scm/supplier-scorecard";

/**
 * 조직의 모든 공급자에 대해 성과 점수를 계산합니다.
 *
 * 데이터 소스:
 * - 납기 준수율: purchase_orders (완료된 발주 기준 정시 입고 비율)
 * - 불량률: inbound_records (rejectedQuantity / receivedQuantity)
 * - 평균 리드타임: suppliers.avgLeadTime (설정값 사용)
 * - 가격 경쟁력: 1.0 고정 (시장가 데이터 없으므로 기본값)
 *
 * @returns 순위 정렬된 공급자 성과 평가표 목록
 */
export async function getSupplierScorecards(): Promise<
  (SupplierScorecard & { rank: number })[]
> {
  try {
    const user = await getCurrentUser();
    if (!user?.organizationId) {
      return [];
    }
    const orgId = user.organizationId;

    // 1. 활성 공급자 목록 조회
    const supplierList = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        avgLeadTime: suppliers.avgLeadTime,
      })
      .from(suppliers)
      .where(and(eq(suppliers.organizationId, orgId), isNull(suppliers.deletedAt)));

    if (supplierList.length === 0) {
      return [];
    }

    // 2. 공급자별 납기 준수율 집계
    //    완료/입고된 발주 중 정시 입고 비율 계산
    //    정시 기준: actualDate <= expectedDate + 1일 (1일 이내 지연 허용)
    const deliveryRows = await db
      .select({
        supplierId: purchaseOrders.supplierId,
        totalCompleted: sql<number>`count(*)`,
        onTimeCount: sql<number>`
          count(*) filter (
            where ${purchaseOrders.actualDate} is not null
            and ${purchaseOrders.expectedDate} is not null
            and ${purchaseOrders.actualDate}::date <= ${purchaseOrders.expectedDate}::date + interval '1 day'
          )
        `,
        actualLeadTimeSum: sql<number>`
          sum(
            case
              when ${purchaseOrders.actualDate} is not null and ${purchaseOrders.orderDate} is not null
              then (${purchaseOrders.actualDate}::date - ${purchaseOrders.orderDate}::date)
              else null
            end
          )
        `,
        actualLeadTimeCount: sql<number>`
          count(*) filter (
            where ${purchaseOrders.actualDate} is not null and ${purchaseOrders.orderDate} is not null
          )
        `,
      })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, orgId),
          isNull(purchaseOrders.deletedAt),
          isNotNull(purchaseOrders.supplierId),
          isNotNull(purchaseOrders.actualDate),
          sql`${purchaseOrders.status} in ('received', 'completed')`
        )
      )
      .groupBy(purchaseOrders.supplierId);

    // 공급자 ID → 납기 데이터 맵
    const deliveryMap = new Map<
      string,
      { onTimeRate: number; avgActualLeadTime: number }
    >();
    for (const row of deliveryRows) {
      if (!row.supplierId) continue;
      const total = Number(row.totalCompleted) || 0;
      const onTime = Number(row.onTimeCount) || 0;
      const ltSum = Number(row.actualLeadTimeSum) || 0;
      const ltCount = Number(row.actualLeadTimeCount) || 0;

      deliveryMap.set(row.supplierId, {
        onTimeRate: total > 0 ? (onTime / total) * 100 : 100,
        avgActualLeadTime: ltCount > 0 ? ltSum / ltCount : 0,
      });
    }

    // 3. 공급자별 불량률 집계
    //    inbound_records: rejectedQuantity / receivedQuantity
    const defectRows = await db
      .select({
        supplierId: purchaseOrders.supplierId,
        totalReceived: sql<number>`sum(${inboundRecords.receivedQuantity})`,
        totalRejected: sql<number>`sum(${inboundRecords.rejectedQuantity})`,
      })
      .from(inboundRecords)
      .innerJoin(
        purchaseOrders,
        and(
          eq(inboundRecords.purchaseOrderId, purchaseOrders.id),
          isNotNull(purchaseOrders.supplierId)
        )
      )
      .where(
        and(
          eq(inboundRecords.organizationId, orgId),
          isNotNull(purchaseOrders.supplierId)
        )
      )
      .groupBy(purchaseOrders.supplierId);

    // 공급자 ID → 불량률 맵
    const defectMap = new Map<string, number>();
    for (const row of defectRows) {
      if (!row.supplierId) continue;
      const received = Number(row.totalReceived) || 0;
      const rejected = Number(row.totalRejected) || 0;
      defectMap.set(
        row.supplierId,
        received > 0 ? (rejected / received) * 100 : 0
      );
    }

    // 4. 각 공급자별 스코어카드 생성
    const scorecards = supplierList.map((supplier) => {
      const delivery = deliveryMap.get(supplier.id);
      const defectRate = defectMap.get(supplier.id) ?? 0;
      const avgLeadTime = Number(supplier.avgLeadTime) || 7;

      // 납기 데이터가 없으면 중립값(80%) 사용
      const onTimeRate = delivery?.onTimeRate ?? 80;
      // 실제 리드타임이 있으면 사용, 없으면 설정값 사용
      const effectiveLeadTime =
        delivery && delivery.avgActualLeadTime > 0
          ? delivery.avgActualLeadTime
          : avgLeadTime;

      return buildScorecard(supplier.id, supplier.name, {
        onTimeRate,
        defectRate,
        avgLeadTime: effectiveLeadTime,
        priceIndex: 1.0, // 시장가 데이터 없으므로 중립값 고정
      });
    });

    // 5. 순위 정렬 후 반환
    return rankSuppliers(scorecards);
  } catch (error) {
    console.error("공급자 스코어카드 계산 오류:", error);
    return [];
  }
}
