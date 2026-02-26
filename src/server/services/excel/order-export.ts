/**
 * 발주서 Excel 익스포트 서비스
 */

import { type PurchaseOrder, type PurchaseOrderItem } from "@/server/db/schema";
import { formatKRW } from "@/lib/utils";

/**
 * XLSX 라이브러리 lazy 로딩
 */
let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 발주서 정보 (공급자 포함)
 */
export interface PurchaseOrderWithDetails extends PurchaseOrder {
  supplier?: {
    id: string;
    name: string;
    contactPhone: string | null;
  } | null;
  items: (PurchaseOrderItem & {
    product: {
      sku: string;
      name: string;
      unit: string | null;
    };
  })[];
}

/**
 * 발주서 Excel 행 타입
 */
interface OrderExcelRow {
  SKU코드: string;
  제품명: string;
  단위: string;
  수량: number;
  단가: string;
  금액: string;
  비고: string;
}

/**
 * 단일 발주서를 Excel로 변환
 *
 * @param order - 발주서 정보
 * @returns Excel 워크북 버퍼
 */
export async function generatePurchaseOrderExcel(order: PurchaseOrderWithDetails): Promise<Buffer> {
  const XLSX = await getXLSX();

  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 발주서 헤더 정보
  const headerData = [
    ["발주서"],
    [""],
    ["발주번호", order.orderNumber],
    ["발주일", order.orderDate || "-"],
    ["예상입고일", order.expectedDate || "-"],
    ["공급자명", order.supplier?.name || "-"],
    ["연락처", order.supplier?.contactPhone || "-"],
    ["상태", getStatusText(order.status)],
    [""],
  ];

  // 발주 항목 데이터
  const itemsData: OrderExcelRow[] = order.items.map((item) => ({
    SKU코드: item.product.sku,
    제품명: item.product.name,
    단위: item.product.unit || "개",
    수량: item.quantity,
    단가: formatCurrency(item.unitPrice),
    금액: formatCurrency(item.totalPrice),
    비고: item.notes || "",
  }));

  // 합계 행
  const totalRow = {
    SKU코드: "",
    제품명: "",
    단위: "",
    수량: order.items.reduce((sum, item) => sum + item.quantity, 0),
    단가: "합계",
    금액: formatCurrency(order.totalAmount || 0),
    비고: "",
  };

  // 워크시트 생성 (헤더 + 빈 행 + 테이블 헤더 + 항목 + 합계)
  const ws = XLSX.utils.aoa_to_sheet(headerData);

  // 항목 데이터 추가
  XLSX.utils.sheet_add_json(ws, itemsData, {
    origin: `A${headerData.length + 1}`,
  });

  // 합계 행 추가
  XLSX.utils.sheet_add_json(ws, [totalRow], {
    origin: `A${headerData.length + 1 + itemsData.length + 1}`,
    skipHeader: true,
  });

  // 비고 추가
  if (order.notes) {
    const notesRowIndex = headerData.length + itemsData.length + 3;
    XLSX.utils.sheet_add_aoa(ws, [[""], ["비고", order.notes]], {
      origin: `A${notesRowIndex}`,
    });
  }

  // 컬럼 너비 설정
  ws["!cols"] = [
    { wch: 15 }, // SKU코드
    { wch: 30 }, // 제품명
    { wch: 8 }, // 단위
    { wch: 10 }, // 수량
    { wch: 15 }, // 단가
    { wch: 15 }, // 금액
    { wch: 20 }, // 비고
  ];

  // 워크시트 추가
  XLSX.utils.book_append_sheet(wb, ws, "발주서");

  // Excel 파일 생성
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buffer;
}

/**
 * 복수 발주서를 Excel로 변환 (각 발주서가 별도 시트)
 *
 * @param orders - 발주서 배열
 * @returns Excel 워크북 버퍼
 */
export async function generateMultiplePurchaseOrdersExcel(
  orders: PurchaseOrderWithDetails[]
): Promise<Buffer> {
  const XLSX = await getXLSX();

  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 각 발주서를 별도 시트로 생성
  orders.forEach((order) => {
    // 발주서 헤더 정보
    const headerData = [
      ["발주서"],
      [""],
      ["발주번호", order.orderNumber],
      ["발주일", order.orderDate || "-"],
      ["예상입고일", order.expectedDate || "-"],
      ["공급자명", order.supplier?.name || "-"],
      ["연락처", order.supplier?.contactPhone || "-"],
      ["상태", getStatusText(order.status)],
      [""],
    ];

    // 발주 항목 데이터
    const itemsData: OrderExcelRow[] = order.items.map((item) => ({
      SKU코드: item.product.sku,
      제품명: item.product.name,
      단위: item.product.unit || "개",
      수량: item.quantity,
      단가: formatCurrency(item.unitPrice),
      금액: formatCurrency(item.totalPrice),
      비고: item.notes || "",
    }));

    // 합계 행
    const totalRow = {
      SKU코드: "",
      제품명: "",
      단위: "",
      수량: order.items.reduce((sum, item) => sum + item.quantity, 0),
      단가: "합계",
      금액: formatCurrency(order.totalAmount || 0),
      비고: "",
    };

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(headerData);

    // 항목 데이터 추가
    XLSX.utils.sheet_add_json(ws, itemsData, {
      origin: `A${headerData.length + 1}`,
    });

    // 합계 행 추가
    XLSX.utils.sheet_add_json(ws, [totalRow], {
      origin: `A${headerData.length + 1 + itemsData.length + 1}`,
      skipHeader: true,
    });

    // 비고 추가
    if (order.notes) {
      const notesRowIndex = headerData.length + itemsData.length + 3;
      XLSX.utils.sheet_add_aoa(ws, [[""], ["비고", order.notes]], {
        origin: `A${notesRowIndex}`,
      });
    }

    // 컬럼 너비 설정
    ws["!cols"] = [
      { wch: 15 }, // SKU코드
      { wch: 30 }, // 제품명
      { wch: 8 }, // 단위
      { wch: 10 }, // 수량
      { wch: 15 }, // 단가
      { wch: 15 }, // 금액
      { wch: 20 }, // 비고
    ];

    // 시트명 생성 (최대 31자)
    const sheetName = `${order.orderNumber}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // Excel 파일 생성
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return buffer;
}

/**
 * 발주 상태 텍스트 변환
 */
function getStatusText(
  status: (typeof import("@/server/db/schema").orderStatusEnum.enumValues)[number]
): string {
  const statusMap = {
    draft: "초안",
    pending: "검토대기",
    approved: "승인됨",
    ordered: "발주완료",
    confirmed: "공급자확인",
    shipped: "출하됨",
    partially_received: "부분입고",
    received: "입고완료",
    completed: "완료",
    cancelled: "취소",
  };
  return statusMap[status] || status;
}

/**
 * 금액 포맷팅
 * @deprecated 직접 사용 대신 `@/lib/utils`의 `formatKRW()` 사용
 */
const formatCurrency = formatKRW;
