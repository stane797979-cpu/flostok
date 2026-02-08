'use client'

import { Plus, Trash2, Calendar, Building2, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { OnboardingSession } from '@/server/db/schema/onboarding'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteOnboardingSession } from '@/server/actions/onboarding'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface OnboardingListClientProps {
  initialSessions: OnboardingSession[]
}

const STATUS_CONFIG = {
  draft: { label: '진행중', variant: 'secondary' as const, color: 'bg-slate-100 text-slate-700' },
  completed: { label: '완료', variant: 'default' as const, color: 'bg-green-100 text-green-700' },
  failed: { label: '실패', variant: 'destructive' as const, color: 'bg-red-100 text-red-700' },
  uploaded: { label: '업로드됨', variant: 'outline' as const, color: 'bg-blue-100 text-blue-700' },
  analyzing: { label: '분석중', variant: 'outline' as const, color: 'bg-blue-100 text-blue-700' },
  mapping: { label: '매핑중', variant: 'outline' as const, color: 'bg-blue-100 text-blue-700' },
  previewing: { label: '미리보기', variant: 'outline' as const, color: 'bg-blue-100 text-blue-700' },
  importing: { label: '임포트중', variant: 'outline' as const, color: 'bg-blue-100 text-blue-700' },
}

const STEP_LABELS = [
  '회사 정보',
  '파일 업로드',
  '구조 분석',
  '컬럼 매핑',
  '미리보기'
]

export function OnboardingListClient({ initialSessions }: OnboardingListClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [sessions, setSessions] = useState(initialSessions)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    const result = await deleteOnboardingSession(deleteId)
    setIsDeleting(false)

    if (result.success) {
      setSessions(sessions.filter(s => s.id !== deleteId))
      toast({
        title: '삭제 완료',
        description: '온보딩 세션이 삭제되었습니다.',
      })
    } else {
      toast({
        title: '삭제 실패',
        description: result.error || '세션 삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }

    setDeleteId(null)
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">데이터 온보딩</h1>
          <p className="text-slate-500 mt-2">
            고객사 데이터를 FlowStok으로 가져오기
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/onboarding/new')}>
          <Plus className="h-4 w-4 mr-2" />
          새 온보딩 시작
        </Button>
      </div>

      {/* 세션 목록 */}
      {sessions.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-700 mb-2">
            온보딩 세션이 없습니다
          </h3>
          <p className="text-slate-500 mb-6">
            새 온보딩을 시작하여 고객사 데이터를 가져오세요
          </p>
          <Button onClick={() => router.push('/dashboard/onboarding/new')}>
            <Plus className="h-4 w-4 mr-2" />
            새 온보딩 시작
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.draft
            const currentStepLabel = STEP_LABELS[session.currentStep - 1] || '알 수 없음'

            return (
              <Card
                key={session.id}
                className="p-6 cursor-pointer hover:border-primary transition-colors"
                onClick={() => router.push(`/dashboard/onboarding/${session.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">
                      {session.companyName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(session.createdAt)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteId(session.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={cn(statusConfig.color, 'font-medium')}>
                      {statusConfig.label}
                    </Badge>
                    {session.status === 'completed' && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                  </div>

                  <div className="text-sm">
                    <span className="text-slate-500">현재 단계:</span>
                    <span className="ml-2 font-medium text-slate-700">
                      {session.currentStep}단계 - {currentStepLabel}
                    </span>
                  </div>

                  {/* 프로그레스 바 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>진행률</span>
                      <span>{Math.round((session.currentStep / 5) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${(session.currentStep / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>온보딩 세션 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 온보딩 세션을 삭제하시겠습니까? 업로드된 파일과 설정이 모두 삭제됩니다.
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
