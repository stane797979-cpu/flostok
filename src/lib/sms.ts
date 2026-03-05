/**
 * SMS 클라이언트 (CoolSMS)
 * - SMS/LMS 전송 전용 모듈
 * - Mock 모드 지원
 */

// ============================================
// 환경변수
// ============================================
const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET
const COOLSMS_SENDER_PHONE = process.env.COOLSMS_SENDER_PHONE
// API 키가 없으면 자동 Mock 모드 (개발 환경 지원)
const IS_MOCK_MODE = process.env.NOTIFICATIONS_MOCK_MODE === 'true' ||
  !COOLSMS_API_KEY || !COOLSMS_API_SECRET

// ============================================
// CoolSMS 클라이언트 초기화
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let coolsms: any = null

if (!IS_MOCK_MODE && COOLSMS_API_KEY && COOLSMS_API_SECRET) {
  try {
    // CoolSMS SDK 동적 임포트 (타입 정의 없음)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: MessageService } = require('coolsms-sdk')

    coolsms = new MessageService(COOLSMS_API_KEY, COOLSMS_API_SECRET)
  } catch (error) {
    console.error('CoolSMS 클라이언트 초기화 실패:', error)
  }
}

// ============================================
// 타입 정의
// ============================================

/** SMS 전송 요청 */
export interface SendSMSRequest {
  /** 수신자 전화번호 (010-1234-5678 또는 01012345678) */
  to: string | string[]
  /** 메시지 내용 (SMS: 90바이트/한글 45자, LMS: 2000바이트/한글 1000자) */
  message: string
  /** 메시지 타입 (SMS, LMS, MMS) */
  type?: 'SMS' | 'LMS' | 'MMS'
}

/** SMS 전송 결과 */
export interface SMSResult {
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
// SMS 전송
// ============================================

/**
 * SMS 전송
 * @param request SMS 전송 요청
 * @returns 전송 결과
 */
export async function sendSMS(request: SendSMSRequest): Promise<SMSResult> {
  try {
    // Mock 모드
    if (IS_MOCK_MODE) {
      console.log('📱 [Mock] SMS 전송:', {
        from: COOLSMS_SENDER_PHONE,
        to: request.to,
        message: request.message,
        type: request.type || 'SMS',
      })
      return { success: true, mock: true, id: `mock-sms-${Date.now()}` }
    }

    // CoolSMS 클라이언트 체크
    if (!coolsms) {
      throw new Error('CoolSMS 클라이언트가 초기화되지 않았습니다.')
    }

    if (!COOLSMS_SENDER_PHONE) {
      throw new Error('발신번호가 설정되지 않았습니다.')
    }

    // 전화번호 배열 처리
    const recipients = Array.isArray(request.to) ? request.to : [request.to]

    // 메시지 타입 자동 결정 (90바이트 기준: 한글 45자, 영숫자 90자)
    const messageType = request.type || getMessageType(request.message)

    // SMS 전송 (CoolSMS SDK v1.0.0-beta)
    const response = await coolsms.sendOne({
      to: recipients[0], // sendOne은 단일 수신자만 지원
      from: COOLSMS_SENDER_PHONE,
      text: request.message,
      type: messageType,
    })

    // 다수 수신자 처리 (sendMany 사용)
    if (recipients.length > 1) {
      const messages = recipients.map((to) => ({
        to,
        from: COOLSMS_SENDER_PHONE,
        text: request.message,
        type: messageType,
      }))

      const batchResponse = await coolsms.sendMany(messages)
      return { success: true, id: batchResponse.groupId }
    }

    return { success: true, id: response.groupId }
  } catch (error) {
    console.error('SMS 전송 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SMS 전송 실패',
    }
  }
}

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 전화번호 정규화
 * @param phone 전화번호 (010-1234-5678 또는 01012345678)
 * @returns 정규화된 전화번호 (01012345678)
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

/**
 * 전화번호 유효성 검증
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone)
  return /^01[0-9]{8,9}$/.test(normalized)
}

/**
 * 메시지 타입 자동 결정
 * - SMS: 90바이트 이하 (한글 45자, 영숫자 90자)
 * - LMS: 90바이트 초과 ~ 2000바이트 이하
 * - MMS: 이미지 첨부 시
 */
export function getMessageType(message: string): 'SMS' | 'LMS' {
  const byteLength = getByteLength(message)
  return byteLength <= 90 ? 'SMS' : 'LMS'
}

/**
 * 문자열 바이트 길이 계산 (한글 3바이트, 영숫자 1바이트)
 */
export function getByteLength(str: string): number {
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    if (char <= 0x007f) {
      bytes += 1 // ASCII
    } else if (char <= 0x07ff) {
      bytes += 2 // 2바이트 문자
    } else {
      bytes += 3 // 한글 등 3바이트 문자
    }
  }
  return bytes
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
  return IS_MOCK_MODE || !!(COOLSMS_API_KEY && COOLSMS_API_SECRET && COOLSMS_SENDER_PHONE)
}
