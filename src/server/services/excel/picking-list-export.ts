/**
 * 피킹지(Picking List) Excel 익스포트 서비스
 *
 * 출고 요청에 대해 창고 담당자가 피킹 작업에 사용하는 피킹지를 생성합니다.
 * - 단일 피킹지: 1개 출고 요청 → 1개 시트
 * - 일괄 피킹지: 합산 시트(위치순 정렬) + 개별 시트들
 */

/**
 * XLSX 라이브러리 lazy 로딩
 */
let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

/**
 * 피킹지 데이터 타입
 */
export interface PickingListData {
  requestNumber: string;
  outboundTypeLabel: string;
  status: string;
  createdAt: Date;
  confirmedAt: Date | null;
  sourceWarehouseName: string;
  sourceWarehouseCode: string;
  sourceWarehouseAddress: string | null;
  targetWarehouseName: string | null;
  requestedByName: string | null;
  customerType: string | null;
  recipientCompany: string | null;
  recipientName: string | null;
  recipientAddress: string | null;
  recipientPhone: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  notes: string | null;
  items: PickingListItem[];
}

export interface PickingListItem {
  productSku: string;
  productName: string;
  category: string | null;
  unit: string;
  location: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  requestedQuantity: number;
  confirmedQuantity: number | null;
  currentStock: number;
  notes: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "대기중",
  confirmed: "출고완료",
  cancelled: "취소됨",
};

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * 단일 피킹지 시트 생성
 */
function createPickingListSheet(
  XLSX: typeof import("xlsx"),
  data: PickingListData
): import("xlsx").WorkSheet {
  const rows: (string | number | null)[][] = [];

  // 제목
  rows.push(["피 킹 지 (Picking List)"]);
  rows.push([]);

  // 헤더 정보
  rows.push(["출고요청번호", data.requestNumber, "", "출고유형", data.outboundTypeLabel]);
  rows.push(["요청일자", formatDate(data.createdAt), "", "상태", STATUS_LABELS[data.status] || data.status]);
  rows.push(["출발 창고", `${data.sourceWarehouseName} (${data.sourceWarehouseCode})`, "", "요청자", data.requestedByName || "-"]);
  if (data.targetWarehouseName) {
    rows.push(["도착 창고", data.targetWarehouseName]);
  }
  rows.push([]);

  // 배송 정보 (있는 경우)
  const hasShippingInfo = data.recipientName || data.recipientCompany || data.recipientAddress;
  if (hasShippingInfo) {
    rows.push(["[배송 정보]"]);
    const recipientParts: string[] = [];
    if (data.recipientCompany) recipientParts.push(data.recipientCompany);
    if (data.recipientName) recipientParts.push(data.recipientName);
    rows.push([
      "고객유형",
      data.customerType || "-",
      "",
      "수령인",
      recipientParts.join(" / ") || "-",
    ]);
    if (data.recipientAddress) {
      rows.push(["배송지", data.recipientAddress]);
    }
    const shippingRow: (string | null)[] = ["연락처", data.recipientPhone || "-"];
    if (data.courierName || data.trackingNumber) {
      shippingRow.push("", "택배사", data.courierName || "-");
      if (data.trackingNumber) {
        shippingRow.push("송장번호", data.trackingNumber);
      }
    }
    rows.push(shippingRow);
    rows.push([]);
  }

  // 품목 테이블 헤더
  rows.push([
    "No",
    "SKU코드",
    "제품명",
    "카테고리",
    "적치위치",
    "LOT번호",
    "유통기한",
    "단위",
    "요청수량",
    "피킹수량",
    "비고",
  ]);

  // 품목 데이터 (적치위치순 정렬)
  const sortedItems = [...data.items].sort((a, b) => {
    const locA = a.location || "zzz";
    const locB = b.location || "zzz";
    return locA.localeCompare(locB);
  });

  let totalRequested = 0;
  sortedItems.forEach((item, idx) => {
    totalRequested += item.requestedQuantity;
    rows.push([
      idx + 1,
      item.productSku,
      item.productName,
      item.category || "-",
      item.location || "-",
      item.lotNumber || "-",
      item.expiryDate || "-",
      item.unit,
      item.requestedQuantity,
      item.confirmedQuantity !== null && item.confirmedQuantity !== undefined
        ? item.confirmedQuantity
        : "",
      item.notes || "",
    ]);
  });

  // 합계
  rows.push([]);
  rows.push(["총 품목수", `${data.items.length}개`, "", "총 요청수량", `${totalRequested.toLocaleString()}개`]);

  // 서명란
  rows.push([]);
  rows.push(["피킹 담당: ________________", "", "", "검수 담당: ________________"]);
  rows.push(["일시: ____년 __월 __일"]);

  // 비고
  if (data.notes) {
    rows.push([]);
    rows.push(["비고", data.notes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 컬럼 너비 설정
  ws["!cols"] = [
    { wch: 6 },   // No
    { wch: 15 },  // SKU코드
    { wch: 28 },  // 제품명
    { wch: 10 },  // 카테고리
    { wch: 12 },  // 적치위치
    { wch: 14 },  // LOT번호
    { wch: 12 },  // 유통기한
    { wch: 8 },   // 단위
    { wch: 10 },  // 요청수량
    { wch: 10 },  // 피킹수량
    { wch: 18 },  // 비고
  ];

  // 제목 셀 병합
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];

  return ws;
}

/**
 * 합산 피킹지 시트 생성 (복수 요청의 품목을 위치순 정렬)
 */
function createSummaryPickingSheet(
  XLSX: typeof import("xlsx"),
  dataList: PickingListData[]
): import("xlsx").WorkSheet {
  const rows: (string | number | null)[][] = [];

  // 제목
  rows.push(["합 산 피 킹 지 (Summary Picking List)"]);
  rows.push([]);

  // 요약 정보
  rows.push(["출고요청 건수", `${dataList.length}건`]);
  rows.push(["출력일시", formatDate(new Date())]);
  rows.push([]);

  // 품목 합산 (SKU 기준)
  const skuMap = new Map<
    string,
    {
      sku: string;
      name: string;
      unit: string;
      category: string | null;
      location: string | null;
      lotNumber: string | null;
      expiryDate: string | null;
      totalQuantity: number;
      requestNumbers: string[];
    }
  >();

  for (const data of dataList) {
    for (const item of data.items) {
      const existing = skuMap.get(item.productSku);
      if (existing) {
        existing.totalQuantity += item.requestedQuantity;
        if (!existing.requestNumbers.includes(data.requestNumber)) {
          existing.requestNumbers.push(data.requestNumber);
        }
      } else {
        skuMap.set(item.productSku, {
          sku: item.productSku,
          name: item.productName,
          unit: item.unit,
          category: item.category,
          location: item.location,
          lotNumber: item.lotNumber,
          expiryDate: item.expiryDate,
          totalQuantity: item.requestedQuantity,
          requestNumbers: [data.requestNumber],
        });
      }
    }
  }

  // 적치위치순 정렬
  const sortedSkus = Array.from(skuMap.values()).sort((a, b) => {
    const locA = a.location || "zzz";
    const locB = b.location || "zzz";
    return locA.localeCompare(locB);
  });

  const uniqueSkuCount = sortedSkus.length;
  rows.push(["총 SKU 수", `${uniqueSkuCount}개 (중복 제거)`]);
  rows.push([]);

  // 테이블 헤더
  rows.push([
    "No",
    "적치위치",
    "SKU코드",
    "제품명",
    "카테고리",
    "LOT번호",
    "유통기한",
    "단위",
    "총수량",
    "피킹수량",
    "해당 요청번호",
  ]);

  // 데이터
  let grandTotal = 0;
  sortedSkus.forEach((item, idx) => {
    grandTotal += item.totalQuantity;
    rows.push([
      idx + 1,
      item.location || "-",
      item.sku,
      item.name,
      item.category || "-",
      item.lotNumber || "-",
      item.expiryDate || "-",
      item.unit,
      item.totalQuantity,
      "",
      item.requestNumbers.join(", "),
    ]);
  });

  // 합계
  rows.push([]);
  rows.push(["총 SKU", `${uniqueSkuCount}개`, "", "", "", "", "", "", `${grandTotal.toLocaleString()}개`]);

  // 서명란
  rows.push([]);
  rows.push(["피킹 담당: ________________", "", "", "검수 담당: ________________"]);
  rows.push(["일시: ____년 __월 __일"]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 컬럼 너비 설정
  ws["!cols"] = [
    { wch: 6 },   // No
    { wch: 12 },  // 적치위치
    { wch: 15 },  // SKU코드
    { wch: 28 },  // 제품명
    { wch: 10 },  // 카테고리
    { wch: 14 },  // LOT번호
    { wch: 12 },  // 유통기한
    { wch: 8 },   // 단위
    { wch: 10 },  // 총수량
    { wch: 10 },  // 피킹수량
    { wch: 30 },  // 해당 요청번호
  ];

  // 제목 셀 병합
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];

  return ws;
}

/**
 * 단일 피킹지 Excel 생성
 */
export async function generatePickingListExcel(
  data: PickingListData
): Promise<Buffer> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  const ws = createPickingListSheet(XLSX, data);
  XLSX.utils.book_append_sheet(wb, ws, "피킹지");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/**
 * 복수 피킹지 Excel 생성 (합산 시트 + 개별 시트)
 */
export async function generateMultiplePickingListsExcel(
  dataList: PickingListData[]
): Promise<Buffer> {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();

  // 시트 1: 합산 피킹지
  const summaryWs = createSummaryPickingSheet(XLSX, dataList);
  XLSX.utils.book_append_sheet(wb, summaryWs, "합산 피킹지");

  // 시트 2~N: 개별 피킹지
  for (const data of dataList) {
    const ws = createPickingListSheet(XLSX, data);
    const sheetName = data.requestNumber.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
