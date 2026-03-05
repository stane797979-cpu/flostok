/**
 * 이메일 클라이언트 (Resend)
 * - 이메일 전송 전용 모듈
 * - Mock 모드 지원
 */

import { Resend } from 'resend'

// ============================================
// 환경변수
// ============================================
const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@example.com'
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || 'FloStok'
// API 키가 없으면 자동 Mock 모드 (개발 환경 지원)
const IS_MOCK_MODE = process.env.NOTIFICATIONS_MOCK_MODE === 'true' || !RESEND_API_KEY

// ============================================
// 클라이언트 초기화
// ============================================
let resend: Resend | null = null

if (!IS_MOCK_MODE && RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY)
}

// ============================================
// 타입 정의
// ============================================

/** 이메일 전송 요청 */
export interface SendEmailRequest {
  /** 수신자 이메일 */
  to: string | string[]
  /** 제목 */
  subject: string
  /** HTML 본문 */
  html: string
  /** 텍스트 본문 (선택) */
  text?: string
  /** 참조 (선택) */
  cc?: string | string[]
  /** 숨은 참조 (선택) */
  bcc?: string | string[]
}

/** 이메일 전송 결과 */
export interface EmailResult {
  /** 성공 여부 */
  success: boolean
  /** 에러 메시지 (실패 시) */
  error?: string
  /** 전송 ID (성공 시) */
  id?: string
  /** Mock 모드 여부 */
  mock?: boolean
}

// ============================================
// 이메일 전송
// ============================================

/**
 * 이메일 전송
 * @param request 이메일 전송 요청
 * @returns 전송 결과
 */
export async function sendEmail(request: SendEmailRequest): Promise<EmailResult> {
  try {
    // Mock 모드
    if (IS_MOCK_MODE) {
      console.log('📧 [Mock] 이메일 전송:', {
        from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: request.to,
        subject: request.subject,
        html: request.html.substring(0, 100) + '...',
      })
      return { success: true, mock: true, id: `mock-email-${Date.now()}` }
    }

    // Resend 클라이언트 체크
    if (!resend) {
      throw new Error('Resend 클라이언트가 초기화되지 않았습니다.')
    }

    // 이메일 전송
    const response = await resend.emails.send({
      from: `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: request.to,
      subject: request.subject,
      html: request.html,
      text: request.text,
      cc: request.cc,
      bcc: request.bcc,
    })

    if (response.error) {
      throw new Error(response.error.message)
    }

    return { success: true, id: response.data?.id }
  } catch (error) {
    console.error('이메일 전송 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '이메일 전송 실패',
    }
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 이메일 주소 유효성 검증
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Mock 모드 여부 확인
 */
export function isMockMode(): boolean {
  return IS_MOCK_MODE
}

/**
 * 환경변수 설정 확인
 */
export function isConfigured(): boolean {
  return IS_MOCK_MODE || !!RESEND_API_KEY
}
