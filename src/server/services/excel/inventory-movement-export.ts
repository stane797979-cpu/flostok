/**
 * 재고 수불부 Excel 생성 서비스 (한국 표준 양식)
 *
 * 시트 1: 종합요약 - 헤더 + 제품별 수량/금액 합산 + 합계행 + 유형별 소계
 * 시트 2: 품목별 수불부 - T자 원장 형태 (입고/출고/잔고 각 수량·단가·금액)
 * 시트 3: 상세 이력 - 개별 트랜잭션 로우 데이터
 */

import {
  calculateDailyMovements,
  type MovementRecord,
} from "@/server/services/inventory/movement-calculation";
import { getChangeTypeByKey } from "@/server/services/inventory/types";

/**
 * XLSX 라이브러리 lazy 로딩
 */
let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

// 타입 re-export (기존 코드 호환)
export type { MovementRecord };

interface MovementExcelOptions {
  records: MovementRecord[];
  startDate: string;
  endDate: string;
  organizationName?: string;
}

/**
 * 재고 수불부 Excel 버퍼 생성 (한국 표준 양식)
 */
export async function generateInventoryMovementExcel(
  options: MovementExcelOptions
): Promise<Buffer> {
  const XLSX = await getXLSX();
  const { records, startDate, endDate, organizationName } = options;

  // 제품별 원가 매핑
  const productCostMap = new Map<string, number>();
  const productUnitMap = new Map<string, string>();
  for (const r of records) {
    if (!productCostMap.has(r.productId)) {
      productCostMap.set(r.productId, r.costPrice ?? 0);
      productUnitMap.set(r.productId, r.productUnit ?? "EA");
    }
  }

  // 공유 계산 로직
  const summaries = calculateDailyMovements(records, startDate, endDate);

  const wb = XLSX.utils.book_new();
  const today = new Date().toISOString().split("T")[0];

  // ========================================
  // 시트 1: 종합요약
  // ========================================
  buildSummarySheet(XLSX, wb, summaries, {
    organizationName,
    startDate,
    endDate,
    today,
    productCostMap,
    productUnitMap,
    records,
  });

  // ========================================
  // 시트 2: 품목별 수불부 (T자 원장)
  // ========================================
  buildItemLedgerSheet(XLSX, wb, summaries, {
    organizationName,
    startDate,
    endDate,
    today,
    productCostMap,
    productUnitMap,
    records,
  });

  // ========================================
  // 시트 3: 상세 이력
  // ========================================
  buildDetailSheet(XLSX, wb, records, {
    organizationName,
    startDate,
    endDate,
    today,
    productCostMap,
    productUnitMap,
  });

  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
}

// ============================================================
// 시트 1: 종합요약
// ============================================================
function buildSummarySheet(
  XLSX: typeof import("xlsx"),
  wb: ReturnType<typeof import("xlsx").utils.book_new>,
  summaries: ReturnType<typeof calculateDailyMovements>,
  ctx: {
    organizationName?: string;
    startDate: string;
    endDate: string;
    today: string;
    productCostMap: Map<string, number>;
    productUnitMap: Map<string, string>;
    records: MovementRecord[];
  }
) {
  const rows: unknown[][] = [];

  // 헤더 영역
  rows.push(["재 고 수 불 부 (종합요약)"]);
  rows.push([]);
  rows.push(["회사명", ctx.organizationName || "-", "", "조회기간", `${ctx.startDate} ~ ${ctx.endDate}`]);
  rows.push(["작성일", ctx.today, "", "재고평가", "최종매입원가법"]);
  rows.push([]);

  // 테이블 헤더
  rows.push([
    "No",
    "SKU",
    "제품명",
    "단위",
    "전기이월 수량",
    "전기이월 금액",
    "입고 수량",
    "입고 금액",
    "출고 수량",
    "출고 금액",
    "기말재고 수량",
    "기말재고 금액",
  ]);

  // 합계 누적 변수
  let totalOpenQty = 0;
  let totalOpenAmt = 0;
  let totalInQty = 0;
  let totalInAmt = 0;
  let totalOutQty = 0;
  let totalOutAmt = 0;
  let totalCloseQty = 0;
  let totalCloseAmt = 0;

  // 데이터 행
  summaries.forEach((s, idx) => {
    const cost = ctx.productCostMap.get(s.productId) ?? 0;
    const unit = ctx.productUnitMap.get(s.productId) ?? "EA";

    const openAmt = s.openingStock * cost;
    const inAmt = s.totalInbound * cost;
    const outAmt = s.totalOutbound * cost;
    const closeAmt = s.closingStock * cost;

    totalOpenQty += s.openingStock;
    totalOpenAmt += openAmt;
    totalInQty += s.totalInbound;
    totalInAmt += inAmt;
    totalOutQty += s.totalOutbound;
    totalOutAmt += outAmt;
    totalCloseQty += s.closingStock;
    totalCloseAmt += closeAmt;

    rows.push([
      idx + 1,
      s.productSku,
      s.productName,
      unit,
      s.openingStock,
      openAmt,
      s.totalInbound,
      inAmt,
      s.totalOutbound,
      outAmt,
      s.closingStock,
      closeAmt,
    ]);
  });

  // 합계 행
  rows.push([
    "",
    "",
    "합  계",
    "",
    totalOpenQty,
    totalOpenAmt,
    totalInQty,
    totalInAmt,
    totalOutQty,
    totalOutAmt,
    totalCloseQty,
    totalCloseAmt,
  ]);

  // 유형별 소계
  rows.push([]);
  rows.push(["입출고 유형별 소계"]);

  const typeSummary = new Map<string, { count: number; qty: number }>();
  for (const r of ctx.records) {
    const typeInfo = r.changeType ? getChangeTypeByKey(r.changeType) : null;
    const label = typeInfo?.label || r.changeType || "기타";
    if (!typeSummary.has(label)) {
      typeSummary.set(label, { count: 0, qty: 0 });
    }
    const entry = typeSummary.get(label)!;
    entry.count += 1;
    entry.qty += Math.abs(r.changeAmount);
  }

  rows.push(["유형", "건수", "수량"]);
  for (const [label, info] of typeSummary) {
    rows.push([label, info.count, info.qty]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 열 너비
  ws["!cols"] = [
    { wch: 6 },  // No
    { wch: 15 }, // SKU
    { wch: 25 }, // 제품명
    { wch: 8 },  // 단위
    { wch: 14 }, // 전기이월 수량
    { wch: 16 }, // 전기이월 금액
    { wch: 12 }, // 입고 수량
    { wch: 16 }, // 입고 금액
    { wch: 12 }, // 출고 수량
    { wch: 16 }, // 출고 금액
    { wch: 14 }, // 기말재고 수량
    { wch: 16 }, // 기말재고 금액
  ];

  // 제목 셀 병합
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } }, // 제목
  ];

  XLSX.utils.book_append_sheet(wb, ws, "종합요약");
}

// ============================================================
// 시트 2: 품목별 수불부 (T자 원장)
// ============================================================
function buildItemLedgerSheet(
  XLSX: typeof import("xlsx"),
  wb: ReturnType<typeof import("xlsx").utils.book_new>,
  summaries: ReturnType<typeof calculateDailyMovements>,
  ctx: {
    organizationName?: string;
    startDate: string;
    endDate: string;
    today: string;
    productCostMap: Map<string, number>;
    productUnitMap: Map<string, string>;
    records: MovementRecord[];
  }
) {
  const rows: unknown[][] = [];

  // 헤더 영역
  rows.push(["재 고 수 불 부 (품목별)"]);
  rows.push([]);
  rows.push(["회사명", ctx.organizationName || "-", "", "조회기간", `${ctx.startDate} ~ ${ctx.endDate}`]);
  rows.push(["작성일", ctx.today, "", "재고평가", "최종매입원가법"]);
  rows.push([]);

  // 제품별 레코드 매핑 (일자별 적요를 위해)
  const recordsByProduct = new Map<string, MovementRecord[]>();
  for (const r of ctx.records) {
    if (!recordsByProduct.has(r.productId)) {
      recordsByProduct.set(r.productId, []);
    }
    recordsByProduct.get(r.productId)!.push(r);
  }

  for (const s of summaries) {
    const cost = ctx.productCostMap.get(s.productId) ?? 0;
    const unit = ctx.productUnitMap.get(s.productId) ?? "EA";
    const productRecords = recordsByProduct.get(s.productId) || [];

    // 품목 구분 헤더
    rows.push([`${s.productSku}  |  ${s.productName}  |  단위: ${unit}`]);

    // T자 원장 컬럼 헤더
    rows.push([
      "날짜",
      "입고 수량",
      "입고 단가",
      "입고 금액",
      "출고 수량",
      "출고 단가",
      "출고 금액",
      "잔고 수량",
      "잔고 단가",
      "잔고 금액",
      "적요",
    ]);

    // 전기이월 행
    rows.push([
      "전기이월",
      "", "", "",
      "", "", "",
      s.openingStock,
      cost,
      s.openingStock * cost,
      "전기이월",
    ]);

    // 품목별 소계
    let itemInQty = 0;
    let itemInAmt = 0;
    let itemOutQty = 0;
    let itemOutAmt = 0;

    // 일별 변동 (변동이 있는 날만)
    for (const m of s.dailyMovements) {
      if (m.inbound === 0 && m.outbound === 0) continue;

      // 해당 날짜의 적요 생성
      const dayRecords = productRecords.filter((r) => r.date === m.date);
      const remarks = dayRecords
        .map((r) => {
          const typeInfo = r.changeType ? getChangeTypeByKey(r.changeType) : null;
          return typeInfo?.label || r.changeType || "";
        })
        .filter(Boolean);
      const remark = [...new Set(remarks)].join(", ");

      const inQty = m.inbound || "";
      const inPrice = m.inbound > 0 ? cost : "";
      const inAmt = m.inbound > 0 ? m.inbound * cost : "";
      const outQty = m.outbound || "";
      const outPrice = m.outbound > 0 ? cost : "";
      const outAmt = m.outbound > 0 ? m.outbound * cost : "";

      if (m.inbound > 0) {
        itemInQty += m.inbound;
        itemInAmt += m.inbound * cost;
      }
      if (m.outbound > 0) {
        itemOutQty += m.outbound;
        itemOutAmt += m.outbound * cost;
      }

      rows.push([
        m.date,
        inQty,
        inPrice,
        inAmt,
        outQty,
        outPrice,
        outAmt,
        m.closingStock,
        cost,
        m.closingStock * cost,
        remark,
      ]);
    }

    // 품목별 소계 행
    rows.push([
      "소  계",
      itemInQty,
      "",
      itemInAmt,
      itemOutQty,
      "",
      itemOutAmt,
      s.closingStock,
      cost,
      s.closingStock * cost,
      "",
    ]);

    // 품목 사이 빈 행
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!cols"] = [
    { wch: 12 }, // 날짜
    { wch: 12 }, // 입고 수량
    { wch: 12 }, // 입고 단가
    { wch: 14 }, // 입고 금액
    { wch: 12 }, // 출고 수량
    { wch: 12 }, // 출고 단가
    { wch: 14 }, // 출고 금액
    { wch: 12 }, // 잔고 수량
    { wch: 12 }, // 잔고 단가
    { wch: 14 }, // 잔고 금액
    { wch: 25 }, // 적요
  ];

  // 제목 병합
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "품목별 수불부");
}

// ============================================================
// 시트 3: 상세 이력
// ============================================================
function buildDetailSheet(
  XLSX: typeof import("xlsx"),
  wb: ReturnType<typeof import("xlsx").utils.book_new>,
  records: MovementRecord[],
  ctx: {
    organizationName?: string;
    startDate: string;
    endDate: string;
    today: string;
    productCostMap: Map<string, number>;
    productUnitMap: Map<string, string>;
  }
) {
  const rows: unknown[][] = [];

  // 헤더 영역
  rows.push(["재 고 수 불 부 (상세 이력)"]);
  rows.push([]);
  rows.push(["회사명", ctx.organizationName || "-", "", "조회기간", `${ctx.startDate} ~ ${ctx.endDate}`]);
  rows.push(["작성일", ctx.today]);
  rows.push([]);

  // 테이블 헤더
  rows.push([
    "날짜",
    "SKU",
    "제품명",
    "단위",
    "변동유형",
    "입출구분",
    "수량",
    "단가",
    "금액",
    "변동전 재고",
    "변동후 재고",
    "비고",
  ]);

  for (const r of records) {
    const typeInfo = r.changeType ? getChangeTypeByKey(r.changeType) : null;
    const category = typeInfo?.category === "inbound" ? "입고" : "출고";
    const cost = ctx.productCostMap.get(r.productId) ?? 0;
    const unit = ctx.productUnitMap.get(r.productId) ?? "EA";
    const absQty = Math.abs(r.changeAmount);

    rows.push([
      r.date,
      r.productSku,
      r.productName,
      unit,
      typeInfo?.label || r.changeType || "-",
      category,
      absQty,
      cost,
      absQty * cost,
      r.stockBefore,
      r.stockAfter,
      r.notes || "",
    ]);
  }

  // 합계 행
  if (records.length > 0) {
    const totalInQty = records
      .filter((r) => r.changeAmount > 0)
      .reduce((sum, r) => sum + r.changeAmount, 0);
    const totalOutQty = records
      .filter((r) => r.changeAmount < 0)
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);

    rows.push([]);
    rows.push([
      "",
      "",
      "합  계",
      "",
      "",
      "입고",
      totalInQty,
      "",
      "",
      "",
      "",
      "",
    ]);
    rows.push([
      "",
      "",
      "",
      "",
      "",
      "출고",
      totalOutQty,
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!cols"] = [
    { wch: 12 }, // 날짜
    { wch: 15 }, // SKU
    { wch: 25 }, // 제품명
    { wch: 8 },  // 단위
    { wch: 12 }, // 변동유형
    { wch: 10 }, // 입출구분
    { wch: 10 }, // 수량
    { wch: 12 }, // 단가
    { wch: 14 }, // 금액
    { wch: 12 }, // 변동전
    { wch: 12 }, // 변동후
    { wch: 25 }, // 비고
  ];

  // 제목 병합
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "상세 이력");
}
