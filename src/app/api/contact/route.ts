/**
 * Contact 폼 API
 * POST /api/contact
 *
 * 인증 불필요 — 마케팅 페이지에서 누구나 문의 가능
 * Rate limiting은 추후 Upstash Redis로 추가 예정
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { COMPANY } from "@/lib/constants/homepage-data";

// ============================================
// 입력 유효성 검증
// ============================================

const contactSchema = z.object({
  name: z
    .string()
    .min(1, "이름을 입력해주세요")
    .max(50, "이름은 50자 이내로 입력해주세요"),
  company: z.string().max(100, "회사명은 100자 이내로 입력해주세요").optional(),
  email: z.string().email("유효한 이메일 주소를 입력해주세요"),
  phone: z.string().max(20, "연락처는 20자 이내로 입력해주세요").optional(),
  type: z.string().min(1, "문의 유형을 선택해주세요"),
  message: z
    .string()
    .min(10, "문의 내용은 10자 이상 입력해주세요")
    .max(5000, "문의 내용은 5000자 이내로 입력해주세요"),
});

// ============================================
// 이메일 템플릿
// ============================================

function buildContactEmailHtml(data: z.infer<typeof contactSchema>): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #0f172a; color: white; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .header p { margin: 8px 0 0; font-size: 14px; color: #94a3b8; }
    .body { padding: 32px; }
    .field { margin-bottom: 20px; }
    .field-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #1e293b; line-height: 1.5; }
    .type-badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500; }
    .message-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; white-space: pre-wrap; line-height: 1.6; }
    .footer { background: #f8fafc; padding: 16px 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>새로운 문의가 도착했습니다</h1>
      <p>${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p>
    </div>
    <div class="body">
      <div class="field">
        <div class="field-label">문의 유형</div>
        <div class="field-value"><span class="type-badge">${escapeHtml(data.type)}</span></div>
      </div>
      <div class="field">
        <div class="field-label">이름</div>
        <div class="field-value">${escapeHtml(data.name)}</div>
      </div>
      ${data.company ? `<div class="field"><div class="field-label">회사명</div><div class="field-value">${escapeHtml(data.company)}</div></div>` : ""}
      <div class="field">
        <div class="field-label">이메일</div>
        <div class="field-value"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></div>
      </div>
      ${data.phone ? `<div class="field"><div class="field-label">연락처</div><div class="field-value">${escapeHtml(data.phone)}</div></div>` : ""}
      <div class="field">
        <div class="field-label">문의 내용</div>
        <div class="message-box">${escapeHtml(data.message)}</div>
      </div>
    </div>
    <div class="footer">
      이 메일은 Stock & Logis 홈페이지 Contact 폼에서 자동 발송되었습니다.
    </div>
  </div>
</body>
</html>`.trim();
}

function buildAutoReplyHtml(name: string, type: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #0f172a; color: white; padding: 24px 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 32px; line-height: 1.8; color: #334155; font-size: 15px; }
    .highlight { background: #eff6ff; border-left: 3px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .footer { background: #f8fafc; padding: 20px 32px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Stock & Logis</h1>
    </div>
    <div class="body">
      <p>${escapeHtml(name)}님, 안녕하세요.</p>
      <p><strong>[${escapeHtml(type)}]</strong> 문의를 정상적으로 접수하였습니다.</p>
      <div class="highlight">
        영업일 기준 <strong>1일 이내</strong>에 답변드리겠습니다.<br>
        긴급한 문의는 이메일로 직접 연락해 주세요.
      </div>
      <p>감사합니다.</p>
      <p>
        <strong>${COMPANY.ceoName}</strong><br>
        ${COMPANY.name} 대표
      </p>
    </div>
    <div class="footer">
      ${COMPANY.email}<br>
      이 메일은 자동 발송되었습니다. 직접 회신하셔도 됩니다.
    </div>
  </div>
</body>
</html>`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================
// POST /api/contact
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = contactSchema.parse(body);

    // 1. 운영자에게 문의 알림 이메일 전송
    const adminResult = await sendEmail({
      to: COMPANY.email,
      subject: `[문의] ${data.type} — ${data.name}${data.company ? ` (${data.company})` : ""}`,
      html: buildContactEmailHtml(data),
      text: `문의 유형: ${data.type}\n이름: ${data.name}\n회사: ${data.company || "-"}\n이메일: ${data.email}\n연락처: ${data.phone || "-"}\n\n${data.message}`,
    });

    if (!adminResult.success) {
      console.error("문의 알림 이메일 전송 실패:", adminResult.error);
      return NextResponse.json(
        { error: "문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 2. 문의자에게 자동 확인 이메일 전송 (실패해도 무시)
    sendEmail({
      to: data.email,
      subject: `[Stock & Logis] 문의가 접수되었습니다`,
      html: buildAutoReplyHtml(data.name, data.type),
      text: `${data.name}님, 안녕하세요.\n\n[${data.type}] 문의를 정상적으로 접수하였습니다.\n영업일 기준 1일 이내에 답변드리겠습니다.\n\n감사합니다.\n${COMPANY.ceoName}\n${COMPANY.name} 대표`,
    }).catch((err) => {
      console.error("자동 확인 이메일 전송 실패 (무시):", err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "입력 데이터가 올바르지 않습니다",
          details: error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    console.error("Contact API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
