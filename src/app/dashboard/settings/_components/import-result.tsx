'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImportResultProps {
  success: number
  failed: number
  errors: { row: number; message: string }[]
  onReset: () => void
  className?: string
}

export function ImportResult({
  success,
  failed,
  errors,
  onReset,
  className
}: ImportResultProps) {
  const total = success + failed
  const hasErrors = failed > 0

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="text-center space-y-6">
          {/* 상태 아이콘 */}
          <div className="flex justify-center">
            {hasErrors ? (
              failed === total ? (
                <div className="rounded-full bg-red-100 p-4">
                  <XCircle className="h-16 w-16 text-red-600" />
                </div>
              ) : (
                <div className="rounded-full bg-yellow-100 p-4">
                  <AlertCircle className="h-16 w-16 text-yellow-600" />
                </div>
              )
            ) : (
              <div className="rounded-full bg-green-100 p-4">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              </div>
            )}
          </div>

          {/* 결과 메시지 */}
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {hasErrors
                ? failed === total
                  ? '임포트 실패'
                  : '일부 임포트 완료'
                : '임포트 완료'}
            </h3>
            <p className="text-slate-600">
              총 {total}건 중 {success}건 성공, {failed}건 실패
            </p>
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <p className="text-sm text-green-700 font-medium mb-1">성공</p>
              <p className="text-3xl font-bold text-green-900">{success}</p>
            </div>
            <div className={cn(
              'border rounded-lg p-4',
              failed > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-slate-50 border-slate-200'
            )}>
              <p className={cn(
                'text-sm font-medium mb-1',
                failed > 0 ? 'text-red-700' : 'text-slate-500'
              )}>
                실패
              </p>
              <p className={cn(
                'text-3xl font-bold',
                failed > 0 ? 'text-red-900' : 'text-slate-400'
              )}>
                {failed}
              </p>
            </div>
          </div>

          {/* 에러 상세 */}
          {hasErrors && errors.length > 0 && (
            <div className="border border-red-200 rounded-lg bg-red-50 p-4 text-left max-w-2xl mx-auto">
              <p className="text-sm font-medium text-red-800 mb-3">
                실패한 항목 ({errors.length}건)
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {errors.map((error, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-medium text-red-900">
                      행 {error.row}:
                    </span>{' '}
                    <span className="text-red-700">{error.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex justify-center gap-3">
            <Button onClick={onReset} variant="outline">
              새로운 파일 업로드
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
