/**
 * 데이터 익스포트 서비스
 * - 제품 목록 Excel 다운로드
 * - 판매 데이터 Excel 다운로드
 */

/**
 * XLSX 라이브러리 lazy 로딩
 */
let _xlsx: typeof import("xlsx") | null = null;
async function getXLSX() {
  if (!_xlsx) _xlsx = await import("xlsx");
  return _xlsx;
}

interface ProductExportRow {
  SKU: string;
  제품명: string;
  카테고리: string;
  단위: string;
  판매단가: number;
  원가: number;
  안전재고: number;
  발주점: number;
  리드타임: number;
  MOQ: number;
  ABC등급: string;
  XYZ등급: string;
  상태: string;
}

interface SalesExportRow {
  날짜: string;
  SKU: string;
  제품명: string;
  판매수량: number;
  판매단가: number;
  판매금액: number;
  채널: string;
  비고: string;
}

/**
 * 제품 목록 Excel 생성
 */
export async function generateProductsExcel(
  products: Array<{
    sku: string;
    name: string;
    category: string | null;
    unit: string | null;
    unitPrice: number | null;
    costPrice: number | null;
    safetyStock: number | null;
    reorderPoint: number | null;
    leadTime: number | null;
    moq: number | null;
    abcGrade: string | null;
    xyzGrade: string | null;
    isActive: Date | null;
  }>
): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();
  const rows: ProductExportRow[] = products.map((p) => ({
    SKU: p.sku,
    제품명: p.name,
    카테고리: p.category || "",
    단위: p.unit || "EA",
    판매단가: p.unitPrice || 0,
    원가: p.costPrice || 0,
    안전재고: p.safetyStock || 0,
    발주점: p.reorderPoint || 0,
    리드타임: p.leadTime || 7,
    MOQ: p.moq || 1,
    ABC등급: p.abcGrade || "-",
    XYZ등급: p.xyzGrade || "-",
    상태: p.isActive ? "활성" : "비활성",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 14 }, // SKU
    { wch: 30 }, // 제품명
    { wch: 12 }, // 카테고리
    { wch: 6 },  // 단위
    { wch: 12 }, // 판매단가
    { wch: 12 }, // 원가
    { wch: 10 }, // 안전재고
    { wch: 10 }, // 발주점
    { wch: 10 }, // 리드타임
    { wch: 6 },  // MOQ
    { wch: 8 },  // ABC등급
    { wch: 8 },  // XYZ등급
    { wch: 8 },  // 상태
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "제품목록");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

/**
 * 판매 데이터 Excel 생성
 */
export async function generateSalesExcel(
  sales: Array<{
    date: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPrice: number | null;
    totalAmount: number | null;
    channel: string | null;
    notes: string | null;
  }>
): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();
  const rows: SalesExportRow[] = sales.map((s) => ({
    날짜: s.date,
    SKU: s.sku,
    제품명: s.productName,
    판매수량: s.quantity,
    판매단가: s.unitPrice || 0,
    판매금액: s.totalAmount || 0,
    채널: s.channel || "",
    비고: s.notes || "",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 12 }, // 날짜
    { wch: 14 }, // SKU
    { wch: 30 }, // 제품명
    { wch: 10 }, // 판매수량
    { wch: 12 }, // 판매단가
    { wch: 12 }, // 판매금액
    { wch: 10 }, // 채널
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "판매데이터");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

interface InventoryExportRow {
  SKU: string;
  제품명: string;
  현재고: number;
  가용재고: number;
  안전재고: number;
  발주점: number;
  재고상태: string;
  재고일수: number;
  적치위치: string;
}

const INVENTORY_STATUS_LABELS: Record<string, string> = {
  out_of_stock: "품절",
  critical: "위험",
  shortage: "부족",
  caution: "주의",
  optimal: "적정",
  excess: "과다",
  overstock: "과잉",
};

/**
 * 재고 현황 Excel 생성
 */
export async function generateInventoryExcel(
  inventoryItems: Array<{
    sku: string;
    name: string;
    currentStock: number;
    availableStock: number;
    safetyStock: number;
    reorderPoint: number;
    status: string;
    daysOfInventory: number;
    location: string | null;
  }>
): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();
  const rows: InventoryExportRow[] = inventoryItems.map((item) => ({
    SKU: item.sku,
    제품명: item.name,
    현재고: item.currentStock,
    가용재고: item.availableStock,
    안전재고: item.safetyStock,
    발주점: item.reorderPoint,
    재고상태: INVENTORY_STATUS_LABELS[item.status] || item.status,
    재고일수: item.daysOfInventory,
    적치위치: item.location || "-",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 14 }, // SKU
    { wch: 30 }, // 제품명
    { wch: 10 }, // 현재고
    { wch: 10 }, // 가용재고
    { wch: 10 }, // 안전재고
    { wch: 10 }, // 발주점
    { wch: 10 }, // 재고상태
    { wch: 10 }, // 재고일수
    { wch: 14 }, // 적치위치
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "재고현황");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

interface InboundExportRow {
  입고일: string;
  발주번호: string;
  SKU: string;
  제품명: string;
  예상수량: number;
  입고수량: number;
  합격수량: number;
  불합격수량: number;
  품질결과: string;
  적치위치: string;
  LOT번호: string;
  비고: string;
}

/**
 * 입고 현황 Excel 생성
 */
export async function generateInboundExcel(
  records: Array<{
    date: string;
    orderNumber: string | null;
    productSku: string;
    productName: string;
    expectedQuantity: number | null;
    receivedQuantity: number;
    acceptedQuantity: number | null;
    rejectedQuantity: number | null;
    qualityResult: string | null;
    location: string | null;
    lotNumber: string | null;
    notes: string | null;
  }>
): Promise<ArrayBuffer> {
  const XLSX = await getXLSX();
  const qualityLabels: Record<string, string> = {
    pass: "합격",
    fail: "불합격",
    partial: "부분합격",
    pending: "검수대기",
  };

  const rows: InboundExportRow[] = records.map((r) => ({
    입고일: r.date,
    발주번호: r.orderNumber || "-",
    SKU: r.productSku,
    제품명: r.productName,
    예상수량: r.expectedQuantity || 0,
    입고수량: r.receivedQuantity,
    합격수량: r.acceptedQuantity || 0,
    불합격수량: r.rejectedQuantity || 0,
    품질결과: r.qualityResult ? (qualityLabels[r.qualityResult] || r.qualityResult) : "-",
    적치위치: r.location || "-",
    LOT번호: r.lotNumber || "-",
    비고: r.notes || "",
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 12 }, // 입고일
    { wch: 18 }, // 발주번호
    { wch: 14 }, // SKU
    { wch: 30 }, // 제품명
    { wch: 10 }, // 예상수량
    { wch: 10 }, // 입고수량
    { wch: 10 }, // 합격수량
    { wch: 10 }, // 불합격수량
    { wch: 10 }, // 품질결과
    { wch: 12 }, // 적치위치
    { wch: 14 }, // LOT번호
    { wch: 20 }, // 비고
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "입고현황");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
