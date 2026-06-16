/**
 * 발주서 Excel 익스포트 서비스 (ExcelJS 기반 — 스타일 완전 지원)
 */

import ExcelJS from "exceljs";
import { type PurchaseOrder, type PurchaseOrderItem } from "@/server/db/schema";

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

// ── 색상 팔레트 ───────────────────────────────────────────
const COLOR = {
  headerBg: "FF1E3A5F",   // 네이비
  headerFont: "FFFFFFFF",
  accentBg: "FFF0F4FA",   // 연파랑 (짝수 행)
  totalBg: "FFECF0F6",    // 합계 행 배경
  totalFont: "FF1E3A5F",
  borderThin: "FFB0BEC5",
  borderMedium: "FF78909C",
  titleFont: "FF1E3A5F",
  metaLabel: "FF546E7A",
  metaValue: "FF1A237E",
  statusOk: "FF2E7D32",
  divider: "FFCFD8DC",
} as const;

// ── 유틸 ─────────────────────────────────────────────────
function krw(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(amount));
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
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
  return map[status] ?? status;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  const date = new Date(d);
  return isNaN(date.getTime())
    ? d
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ── 공통 스타일 헬퍼 ──────────────────────────────────────
function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: COLOR.borderThin } },
    left: { style: "thin", color: { argb: COLOR.borderThin } },
    bottom: { style: "thin", color: { argb: COLOR.borderThin } },
    right: { style: "thin", color: { argb: COLOR.borderThin } },
  };
}

function applyMediumBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "medium", color: { argb: COLOR.borderMedium } },
    left: { style: "medium", color: { argb: COLOR.borderMedium } },
    bottom: { style: "medium", color: { argb: COLOR.borderMedium } },
    right: { style: "medium", color: { argb: COLOR.borderMedium } },
  };
}

// ── 워크시트 빌드 ─────────────────────────────────────────
function buildSheet(wb: ExcelJS.Workbook, order: PurchaseOrderWithDetails, sheetName: string) {
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3 },
    },
  });

  // 컬럼 정의: A~G (No / SKU / 제품명 / 단위 / 수량 / 단가 / 금액)
  ws.columns = [
    { key: "no",     width: 6  },
    { key: "sku",    width: 16 },
    { key: "name",   width: 32 },
    { key: "unit",   width: 8  },
    { key: "qty",    width: 10 },
    { key: "price",  width: 16 },
    { key: "amount", width: 18 },
  ];

  let r = 1; // 현재 행 포인터

  // ── R1: 문서 제목 ─────────────────────────────────────
  ws.mergeCells(`A${r}:G${r}`);
  const titleCell = ws.getCell(`A${r}`);
  titleCell.value = "PURCHASE ORDER  /  발 주 서";
  titleCell.font = { name: "Malgun Gothic", size: 18, bold: true, color: { argb: COLOR.titleFont } };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFD" } };
  ws.getRow(r).height = 40;
  r++;

  // ── 구분선 ────────────────────────────────────────────
  ws.mergeCells(`A${r}:G${r}`);
  ws.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerBg } };
  ws.getRow(r).height = 4;
  r++;

  // ── R3~R5: 메타 정보 2열 레이아웃 ────────────────────
  // 왼쪽: 공급자 정보 / 오른쪽: 발주 정보
  const metaLeft = [
    ["수 신 (공급자)", order.supplier?.name ?? "-"],
    ["담당 / 연락처",  order.supplier?.contactPhone ?? "-"],
    ["",               ""],
  ];
  const metaRight = [
    ["발 주 번 호", order.orderNumber ?? "-"],
    ["발  주  일", fmtDate(order.orderDate)],
    ["예상 입고일", fmtDate(order.expectedDate)],
  ];

  for (let i = 0; i < 3; i++) {
    ws.getRow(r).height = 20;

    // 왼쪽 블록 (A:D)
    ws.mergeCells(`A${r}:A${r}`);
    const lLabel = ws.getCell(`A${r}`);
    lLabel.value = metaLeft[i][0];
    lLabel.font = { name: "Malgun Gothic", size: 9, color: { argb: COLOR.metaLabel } };
    lLabel.alignment = { vertical: "middle", horizontal: "left" };

    ws.mergeCells(`B${r}:D${r}`);
    const lVal = ws.getCell(`B${r}`);
    lVal.value = metaLeft[i][1];
    lVal.font = { name: "Malgun Gothic", size: 10, bold: i === 0, color: { argb: COLOR.metaValue } };
    lVal.alignment = { vertical: "middle", horizontal: "left" };

    // 오른쪽 블록 (E~F label, G value)
    const rLabel = ws.getCell(`E${r}`);
    rLabel.value = metaRight[i][0];
    rLabel.font = { name: "Malgun Gothic", size: 9, color: { argb: COLOR.metaLabel } };
    rLabel.alignment = { vertical: "middle", horizontal: "right" };

    ws.mergeCells(`F${r}:G${r}`);
    const rVal = ws.getCell(`F${r}`);
    rVal.value = metaRight[i][1];
    rVal.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: COLOR.metaValue } };
    rVal.alignment = { vertical: "middle", horizontal: "right" };

    r++;
  }

  // ── 상태 배지 행 ──────────────────────────────────────
  ws.getRow(r).height = 20;
  ws.mergeCells(`A${r}:D${r}`);

  ws.mergeCells(`E${r}:G${r}`);
  const statusCell = ws.getCell(`E${r}`);
  statusCell.value = `상태: ${statusLabel(order.status)}`;
  statusCell.font = { name: "Malgun Gothic", size: 9, bold: true, color: { argb: COLOR.statusOk } };
  statusCell.alignment = { vertical: "middle", horizontal: "right" };
  r++;

  // ── 구분선 ────────────────────────────────────────────
  ws.mergeCells(`A${r}:G${r}`);
  ws.getCell(`A${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.divider } };
  ws.getRow(r).height = 3;
  r++;

  // ── 테이블 헤더 ───────────────────────────────────────
  const HEADERS = ["No.", "SKU 코드", "제  품  명", "단위", "수  량", "단가 (원)", "금액 (원)"];
  const headerRow = ws.getRow(r);
  headerRow.height = 24;
  HEADERS.forEach((h, col) => {
    const cell = headerRow.getCell(col + 1);
    cell.value = h;
    cell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: COLOR.headerFont } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.headerBg } };
    cell.alignment = { vertical: "middle", horizontal: col >= 4 ? "right" : "center" };
    applyThinBorder(cell);
  });
  r++;

  // ── 품목 행 ───────────────────────────────────────────
  const itemStartRow = r;
  order.items.forEach((item, idx) => {
    const dataRow = ws.getRow(r);
    dataRow.height = 20;
    const isEven = idx % 2 === 1;
    const bgArgb = isEven ? COLOR.accentBg : "FFFFFFFF";

    const values = [
      idx + 1,
      item.product.sku,
      item.product.name,
      item.product.unit ?? "개",
      item.quantity,
      krw(item.unitPrice),
      krw(item.totalPrice),
    ];

    values.forEach((v, col) => {
      const cell = dataRow.getCell(col + 1);
      cell.value = v;
      cell.font = { name: "Malgun Gothic", size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 0 ? "center" : col >= 4 ? "right" : "left",
      };
      applyThinBorder(cell);
    });
    r++;
  });

  // 품목이 없는 경우 빈 안내 행
  if (order.items.length === 0) {
    ws.mergeCells(`A${r}:G${r}`);
    const empty = ws.getCell(`A${r}`);
    empty.value = "발주 항목이 없습니다";
    empty.alignment = { vertical: "middle", horizontal: "center" };
    applyThinBorder(empty);
    ws.getRow(r).height = 20;
    r++;
  }

  // ── 합계 행 ───────────────────────────────────────────
  ws.getRow(r).height = 26;
  ws.mergeCells(`A${r}:D${r}`);
  const totalLabelCell = ws.getCell(`A${r}`);
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  totalLabelCell.value = `품목 수: ${order.items.length}개  /  총 수량: ${krw(totalQty)}`;
  totalLabelCell.font = { name: "Malgun Gothic", size: 10, bold: true, color: { argb: COLOR.totalFont } };
  totalLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.totalBg } };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "center" };
  applyMediumBorder(totalLabelCell);

  ws.getCell(`E${r}`).value = "";
  ws.getCell(`E${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.totalBg } };
  applyMediumBorder(ws.getCell(`E${r}`));

  ws.getCell(`F${r}`).value = "합  계";
  ws.getCell(`F${r}`).font = { name: "Malgun Gothic", size: 11, bold: true, color: { argb: COLOR.totalFont } };
  ws.getCell(`F${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.totalBg } };
  ws.getCell(`F${r}`).alignment = { vertical: "middle", horizontal: "center" };
  applyMediumBorder(ws.getCell(`F${r}`));

  ws.getCell(`G${r}`).value = `₩ ${krw(order.totalAmount ?? 0)}`;
  ws.getCell(`G${r}`).font = { name: "Malgun Gothic", size: 12, bold: true, color: { argb: COLOR.totalFont } };
  ws.getCell(`G${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.totalBg } };
  ws.getCell(`G${r}`).alignment = { vertical: "middle", horizontal: "right" };
  applyMediumBorder(ws.getCell(`G${r}`));
  r++;

  // ── 특이사항 / 비고 ───────────────────────────────────
  r++;
  ws.getRow(r).height = 18;
  ws.mergeCells(`A${r}:G${r}`);
  const noteLabel = ws.getCell(`A${r}`);
  noteLabel.value = "[ 특이사항 / 비고 ]";
  noteLabel.font = { name: "Malgun Gothic", size: 9, bold: true, color: { argb: COLOR.metaLabel } };
  noteLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.accentBg } };
  noteLabel.alignment = { vertical: "middle", horizontal: "left" };
  applyThinBorder(noteLabel);
  r++;

  ws.getRow(r).height = 40;
  ws.mergeCells(`A${r}:G${r}`);
  const noteVal = ws.getCell(`A${r}`);
  noteVal.value = order.notes ?? "";
  noteVal.font = { name: "Malgun Gothic", size: 10 };
  noteVal.alignment = { vertical: "top", horizontal: "left", wrapText: true };
  applyThinBorder(noteVal);
  r++;

  // ── 서명란 ────────────────────────────────────────────
  r++;
  ws.getRow(r).height = 18;
  ws.mergeCells(`A${r}:B${r}`);
  const s1Label = ws.getCell(`A${r}`);
  s1Label.value = "담당자 확인";
  s1Label.font = { name: "Malgun Gothic", size: 9, color: { argb: COLOR.metaLabel } };
  s1Label.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.accentBg } };
  s1Label.alignment = { vertical: "middle", horizontal: "center" };
  applyThinBorder(s1Label);

  ws.mergeCells(`C${r}:D${r}`);
  const s2Label = ws.getCell(`C${r}`);
  s2Label.value = "팀장 확인";
  s2Label.font = { name: "Malgun Gothic", size: 9, color: { argb: COLOR.metaLabel } };
  s2Label.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.accentBg } };
  s2Label.alignment = { vertical: "middle", horizontal: "center" };
  applyThinBorder(s2Label);

  ws.mergeCells(`E${r}:G${r}`);
  const s3Label = ws.getCell(`E${r}`);
  s3Label.value = "승인 (인감)";
  s3Label.font = { name: "Malgun Gothic", size: 9, color: { argb: COLOR.metaLabel } };
  s3Label.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.accentBg } };
  s3Label.alignment = { vertical: "middle", horizontal: "center" };
  applyThinBorder(s3Label);
  r++;

  // 서명 공간
  ws.getRow(r).height = 50;
  ws.mergeCells(`A${r}:B${r}`);
  applyThinBorder(ws.getCell(`A${r}`));
  ws.mergeCells(`C${r}:D${r}`);
  applyThinBorder(ws.getCell(`C${r}`));
  ws.mergeCells(`E${r}:G${r}`);
  applyThinBorder(ws.getCell(`E${r}`));

  // 인쇄 영역 설정
  ws.pageSetup.printArea = `A1:G${r}`;

  // 반복 인쇄 행 (헤더 행)
  ws.pageSetup.firstPageNumber = 1;

  // 품목 행 영역에 출력선 확인을 위한 freeze 없음 (인쇄 전용)
  void itemStartRow; // suppress unused warning
}

// ── 공개 API ─────────────────────────────────────────────

/** 단일 발주서 Excel 버퍼 생성 */
export async function generatePurchaseOrderExcel(
  order: PurchaseOrderWithDetails
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FloStok";
  wb.created = new Date();

  buildSheet(wb, order, "발주서");

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** 복수 발주서 Excel — 각 발주서를 별도 시트로 */
export async function generateMultiplePurchaseOrdersExcel(
  orders: PurchaseOrderWithDetails[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "FloStok";
  wb.created = new Date();

  orders.forEach((order, idx) => {
    const sheetName = `${order.orderNumber ?? `PO-${idx + 1}`}`.substring(0, 31);
    buildSheet(wb, order, sheetName);
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
