'use client'

/**
 * 알림 테스트 컴포넌트
 * - 이메일/SMS 알림 테스트 전송
 * - Mock 모드 표시
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Mail, MessageSquare, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

// ============================================
// 타입 정의
// ============================================

type NotificationTemplate =
  | 'inventory-alert'
  | 'order-created'
  | 'inbound-completed'
  | 'custom'

// ============================================
// 컴포넌트
// ============================================

export function NotificationTest() {
  // 이메일 상태
  const [emailTo, setEmailTo] = useState('')
  const [emailTemplate, setEmailTemplate] = useState<NotificationTemplate>('inventory-alert')
  const [emailCustomSubject, setEmailCustomSubject] = useState('')
  const [emailCustomBody, setEmailCustomBody] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailResult, setEmailResult] = useState<{
    success: boolean
    message: string
    mock?: boolean
  } | null>(null)

  // SMS 상태
  const [smsTo, setSmsTo] = useState('')
  const [smsTemplate, setSmsTemplate] = useState<NotificationTemplate>('inventory-alert')
  const [smsCustomMessage, setSmsCustomMessage] = useState('')
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsResult, setSmsResult] = useState<{
    success: boolean
    message: string
    mock?: boolean
  } | null>(null)

  // ============================================
  // 템플릿 데이터
  // ============================================

  const getEmailTemplateData = (template: NotificationTemplate) => {
    switch (template) {
      case 'inventory-alert':
        return {
          subject: '[긴급] 재고 부족 알림 - 테스트 제품',
          html: `
            <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">🚨 재고 부족 알림</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
                <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
                  <strong>긴급 조치 필요!</strong><br>
                  다음 제품의 재고가 부족합니다. 즉시 발주를 진행해주세요.
                </div>
                <h2 style="color: #111827; font-size: 18px;">재고 현황</h2>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>제품명:</strong> 테스트 제품
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>현재 재고:</strong> <span style="color: #ef4444;">5개</span>
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>안전재고:</strong> 20개
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>재고 상태:</strong> 위험
                </div>
                <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
                  이 메일은 FloStok 시스템에서 자동 발송되었습니다.
                </p>
              </div>
            </div>
          `,
        }
      case 'order-created':
        return {
          subject: '발주서 생성 완료 - PO-20260206-001',
          html: `
            <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">✅ 발주서 생성 완료</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
                <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                  <strong>발주가 정상적으로 등록되었습니다.</strong><br>
                  공급자에게 발주서를 전달해주세요.
                </div>
                <h2 style="color: #111827; font-size: 18px;">발주 정보</h2>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>발주번호:</strong> PO-20260206-001
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>공급자:</strong> 테스트 공급자
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>발주 품목:</strong> 3개
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>총 금액:</strong> <span style="color: #2563eb;">1,500,000원</span>
                </div>
                <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
                  이 메일은 FloStok 시스템에서 자동 발송되었습니다.
                </p>
              </div>
            </div>
          `,
        }
      case 'inbound-completed':
        return {
          subject: '입고 완료 알림 - PO-20260206-001',
          html: `
            <div style="font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">📦 입고 완료</h1>
              </div>
              <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
                <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                  <strong>입고가 정상적으로 처리되었습니다.</strong><br>
                  재고가 자동으로 업데이트되었습니다.
                </div>
                <h2 style="color: #111827; font-size: 18px;">입고 정보</h2>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>발주번호:</strong> PO-20260206-001
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>제품명:</strong> 테스트 제품
                </div>
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>입고 수량:</strong> <span style="color: #10b981;">100개</span>
                </div>
                <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px;">
                  이 메일은 FloStok 시스템에서 자동 발송되었습니다.
                </p>
              </div>
            </div>
          `,
        }
      default:
        return { subject: '', html: '' }
    }
  }

  const getSMSTemplateData = (template: NotificationTemplate) => {
    switch (template) {
      case 'inventory-alert':
        return '[FloStok] 테스트 제품 재고 부족 알림\n현재 재고: 5개 (위험)\n즉시 발주 필요'
      case 'order-created':
        return '[FloStok] 발주서 생성 완료\n발주번호: PO-20260206-001\n공급자: 테스트 공급자\n총액: 1,500,000원'
      case 'inbound-completed':
        return '[FloStok] 입고 완료\n제품: 테스트 제품\n수량: 100개\n재고가 업데이트되었습니다.'
      default:
        return ''
    }
  }

  // ============================================
  // 이메일 전송
  // ============================================

  const handleSendEmail = async () => {
    if (!emailTo) {
      toast.error('수신자 이메일을 입력해주세요')
      return
    }

    setEmailLoading(true)
    setEmailResult(null)

    try {
      const templateData = getEmailTemplateData(emailTemplate)
      const payload =
        emailTemplate === 'custom'
          ? {
              to: emailTo,
              subject: emailCustomSubject,
              html: `<div style="font-family: 'Malgun Gothic', sans-serif; padding: 20px;">${emailCustomBody.replace(/\n/g, '<br>')}</div>`,
              text: emailCustomBody,
            }
          : {
              to: emailTo,
              subject: templateData.subject,
              html: templateData.html,
            }

      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        setEmailResult({
          success: true,
          message: data.mock ? 'Mock 모드로 전송되었습니다 (로그 확인)' : '이메일이 전송되었습니다',
          mock: data.mock,
        })
        toast.success(data.mock ? 'Mock 이메일 전송 완료 (로그 확인)' : '이메일이 전송되었습니다')
      } else {
        setEmailResult({
          success: false,
          message: data.error || '전송에 실패했습니다',
        })
        toast.error(data.error || '전송에 실패했습니다')
      }
    } catch {
      setEmailResult({
        success: false,
        message: '네트워크 오류가 발생했습니다',
      })
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setEmailLoading(false)
    }
  }

  // ============================================
  // SMS 전송
  // ============================================

  const handleSendSMS = async () => {
    if (!smsTo) {
      toast.error('수신자 전화번호를 입력해주세요')
      return
    }

    setSmsLoading(true)
    setSmsResult(null)

    try {
      const templateData = getSMSTemplateData(smsTemplate)
      const payload = {
        to: smsTo,
        message: smsTemplate === 'custom' ? smsCustomMessage : templateData,
      }

      const response = await fetch('/api/notifications/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        setSmsResult({
          success: true,
          message: data.mock ? 'Mock 모드로 전송되었습니다 (로그 확인)' : 'SMS가 전송되었습니다',
          mock: data.mock,
        })
        toast.success(data.mock ? 'Mock SMS 전송 완료 (로그 확인)' : 'SMS가 전송되었습니다')
      } else {
        setSmsResult({
          success: false,
          message: data.error || '전송에 실패했습니다',
        })
        toast.error(data.error || '전송에 실패했습니다')
      }
    } catch {
      setSmsResult({
        success: false,
        message: '네트워크 오류가 발생했습니다',
      })
      toast.error('네트워크 오류가 발생했습니다')
    } finally {
      setSmsLoading(false)
    }
  }

  // ============================================
  // 렌더링
  // ============================================

  return (
    <Card>
      <CardHeader>
        <CardTitle>알림 테스트</CardTitle>
        <CardDescription>
          이메일 및 SMS 알림을 테스트합니다.
          <br />
          <span className="text-amber-600">
            ⚠️ Mock 모드 (NOTIFICATIONS_MOCK_MODE=true)일 경우 실제 전송되지 않고 로그만 출력됩니다.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email">
              <Mail className="mr-2 h-4 w-4" />
              이메일
            </TabsTrigger>
            <TabsTrigger value="sms">
              <MessageSquare className="mr-2 h-4 w-4" />
              SMS
            </TabsTrigger>
          </TabsList>

          {/* 이메일 탭 */}
          <TabsContent value="email" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-to">수신자 이메일</Label>
                <Input
                  id="email-to"
                  type="email"
                  placeholder="example@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-template">템플릿</Label>
                <Select
                  value={emailTemplate}
                  onValueChange={(value) => setEmailTemplate(value as NotificationTemplate)}
                >
                  <SelectTrigger id="email-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inventory-alert">재고 부족 알림</SelectItem>
                    <SelectItem value="order-created">발주서 생성 알림</SelectItem>
                    <SelectItem value="inbound-completed">입고 완료 알림</SelectItem>
                    <SelectItem value="custom">사용자 지정</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {emailTemplate === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">제목</Label>
                    <Input
                      id="email-subject"
                      placeholder="이메일 제목"
                      value={emailCustomSubject}
                      onChange={(e) => setEmailCustomSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-body">본문</Label>
                    <Textarea
                      id="email-body"
                      placeholder="이메일 본문"
                      rows={6}
                      value={emailCustomBody}
                      onChange={(e) => setEmailCustomBody(e.target.value)}
                    />
                  </div>
                </>
              )}

              <Button onClick={handleSendEmail} disabled={emailLoading} className="w-full">
                {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                테스트 이메일 전송
              </Button>

              {emailResult && (
                <div
                  className={`flex items-start gap-2 rounded-lg border p-4 ${
                    emailResult.success
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {emailResult.success ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {emailResult.success ? '전송 성공' : '전송 실패'}
                    </p>
                    <p className="text-sm">{emailResult.message}</p>
                    {emailResult.mock && (
                      <p className="mt-1 text-xs text-amber-600">
                        개발 환경에서는 실제 이메일이 전송되지 않습니다. 서버 로그를 확인하세요.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* SMS 탭 */}
          <TabsContent value="sms" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms-to">수신자 전화번호</Label>
                <Input
                  id="sms-to"
                  type="tel"
                  placeholder="010-1234-5678 또는 01012345678"
                  value={smsTo}
                  onChange={(e) => setSmsTo(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms-template">템플릿</Label>
                <Select
                  value={smsTemplate}
                  onValueChange={(value) => setSmsTemplate(value as NotificationTemplate)}
                >
                  <SelectTrigger id="sms-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inventory-alert">재고 부족 알림</SelectItem>
                    <SelectItem value="order-created">발주서 생성 알림</SelectItem>
                    <SelectItem value="inbound-completed">입고 완료 알림</SelectItem>
                    <SelectItem value="custom">사용자 지정</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {smsTemplate === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="sms-message">메시지</Label>
                  <Textarea
                    id="sms-message"
                    placeholder="SMS 메시지 (최대 90바이트, 한글 45자)"
                    rows={4}
                    value={smsCustomMessage}
                    onChange={(e) => setSmsCustomMessage(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    현재: {new Blob([smsCustomMessage]).size}바이트 (한글 {smsCustomMessage.length}자)
                  </p>
                </div>
              )}

              <Button onClick={handleSendSMS} disabled={smsLoading} className="w-full">
                {smsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                테스트 SMS 전송
              </Button>

              {smsResult && (
                <div
                  className={`flex items-start gap-2 rounded-lg border p-4 ${
                    smsResult.success
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {smsResult.success ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">
                      {smsResult.success ? '전송 성공' : '전송 실패'}
                    </p>
                    <p className="text-sm">{smsResult.message}</p>
                    {smsResult.mock && (
                      <p className="mt-1 text-xs text-amber-600">
                        개발 환경에서는 실제 SMS가 전송되지 않습니다. 서버 로그를 확인하세요.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
