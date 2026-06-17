import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { purchaseOrders, purchaseOrderItems, products, suppliers } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/server/actions/auth-helpers";

function krw(n: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  const date = new Date(d);
  return isNaN(date.getTime())
    ? d
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    draft: "초안", pending: "승인대기", approved: "승인됨",
    ordered: "발주완료", confirmed: "공급자확인", shipped: "출하됨",
    partially_received: "부분입고", received: "입고완료",
    completed: "완료", cancelled: "취소",
  };
  return map[s] ?? s;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;

  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, user.organizationId)))
    .limit(1);

  if (!order) return new NextResponse("Not Found", { status: 404 });

  const [supplier] = order.supplierId
    ? await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId)).limit(1)
    : [null];

  const itemRows = await db
    .select({
      id: purchaseOrderItems.id,
      quantity: purchaseOrderItems.quantity,
      unitPrice: purchaseOrderItems.unitPrice,
      totalPrice: purchaseOrderItems.totalPrice,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
    })
    .from(purchaseOrderItems)
    .innerJoin(products, eq(purchaseOrderItems.productId, products.id))
    .where(eq(purchaseOrderItems.purchaseOrderId, id));

  const totalQty = itemRows.reduce((s, i) => s + i.quantity, 0);

  const itemRows_html = itemRows
    .map(
      (item, idx) => `
      <tr class="${idx % 2 === 1 ? "even" : ""}">
        <td class="center">${idx + 1}</td>
        <td>${item.sku}</td>
        <td>${item.name}</td>
        <td class="center">${item.unit ?? "개"}</td>
        <td class="right">${krw(item.quantity)}</td>
        <td class="right">${krw(item.unitPrice)}</td>
        <td class="right">${krw(item.totalPrice)}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>발주서 ${order.orderNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; font-size: 13px; color: #1a1a2e; background: #f5f5f5; }
    .page { max-width: 800px; margin: 24px auto; background: #fff; padding: 36px 40px; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
    .title { font-size: 22px; font-weight: 700; color: #1e3a5f; text-align: center; padding-bottom: 8px; border-bottom: 3px solid #1e3a5f; margin-bottom: 20px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; }
    .meta-block { display: flex; flex-direction: column; gap: 4px; }
    .meta-row { display: flex; gap: 8px; align-items: baseline; }
    .meta-label { font-size: 11px; color: #546e7a; white-space: nowrap; min-width: 72px; }
    .meta-value { font-size: 13px; font-weight: 600; color: #1a237e; }
    .meta-value.large { font-size: 15px; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    th { background: #1e3a5f; color: #fff; font-size: 12px; padding: 8px 6px; text-align: center; }
    td { padding: 7px 6px; font-size: 12px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
    tr.even td { background: #f0f4fa; }
    td.center, th.center { text-align: center; }
    td.right { text-align: right; }
    .total-row td { background: #ecf0f6; font-weight: 700; color: #1e3a5f; border-top: 2px solid #78909c; font-size: 13px; }
    .notes-section { margin-top: 20px; }
    .notes-label { font-size: 11px; font-weight: 700; color: #546e7a; background: #f0f4fa; padding: 5px 8px; border: 1px solid #e0e0e0; }
    .notes-body { border: 1px solid #e0e0e0; border-top: none; padding: 10px 8px; min-height: 48px; font-size: 12px; color: #333; }
    .sign-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-top: 24px; border: 1px solid #b0bec5; }
    .sign-col { border-right: 1px solid #b0bec5; }
    .sign-col:last-child { border-right: none; }
    .sign-label { background: #f0f4fa; text-align: center; padding: 5px; font-size: 11px; color: #546e7a; font-weight: 700; border-bottom: 1px solid #b0bec5; }
    .sign-space { height: 56px; }
    .print-btn { display: block; margin: 16px auto 0; padding: 8px 28px; background: #1e3a5f; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; }
    @media print {
      body { background: #fff; }
      .page { margin: 0; padding: 20px 24px; box-shadow: none; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="title">PURCHASE ORDER &nbsp;/&nbsp; 발 주 서</div>

    <div class="meta">
      <div class="meta-block">
        <div class="meta-row">
          <span class="meta-label">수신 (공급자)</span>
          <span class="meta-value large">${supplier?.name ?? "-"}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">담당 / 연락처</span>
          <span class="meta-value">${supplier?.contactPhone ?? "-"}</span>
        </div>
      </div>
      <div class="meta-block" style="text-align:right">
        <div class="meta-row" style="justify-content:flex-end">
          <span class="meta-label">발주번호</span>
          <span class="meta-value">${order.orderNumber}</span>
        </div>
        <div class="meta-row" style="justify-content:flex-end">
          <span class="meta-label">발주일</span>
          <span class="meta-value">${fmtDate(order.orderDate)}</span>
        </div>
        <div class="meta-row" style="justify-content:flex-end">
          <span class="meta-label">예상 입고일</span>
          <span class="meta-value">${fmtDate(order.expectedDate)}</span>
        </div>
        <div class="meta-row" style="justify-content:flex-end; margin-top:4px">
          <span class="status-badge">${statusLabel(order.status)}</span>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:44px">No.</th>
          <th style="width:110px">SKU 코드</th>
          <th>제품명</th>
          <th style="width:48px" class="center">단위</th>
          <th style="width:72px" class="center">수량</th>
          <th style="width:100px" class="center">단가 (원)</th>
          <th style="width:110px" class="center">금액 (원)</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows_html || '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">발주 항목이 없습니다</td></tr>'}
        <tr class="total-row">
          <td colspan="4" style="text-align:center">품목 수: ${itemRows.length}개 &nbsp;/&nbsp; 총 수량: ${krw(totalQty)}</td>
          <td colspan="2" style="text-align:center">합 계</td>
          <td class="right">&#8361; ${krw(order.totalAmount ?? 0)}</td>
        </tr>
      </tbody>
    </table>

    <div class="notes-section">
      <div class="notes-label">[ 특이사항 / 비고 ]</div>
      <div class="notes-body">${order.notes ?? ""}</div>
    </div>

    <div class="sign-section">
      <div class="sign-col"><div class="sign-label">담당자 확인</div><div class="sign-space"></div></div>
      <div class="sign-col"><div class="sign-label">팀장 확인</div><div class="sign-space"></div></div>
      <div class="sign-col"><div class="sign-label">승인 (인감)</div><div class="sign-space"></div></div>
    </div>

    <button class="print-btn" onclick="window.print()">인쇄</button>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
