'use client'

import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Trash2, Plus, Users, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'
import {
  getOrganizationUsersAction,
  updateUserRoleAction,
  removeUserAction,
  inviteUserAction,
  toggleSuperadminAction,
  type OrganizationUser,
} from '@/server/actions/users'

interface UserManagementProps {
  organizationId?: string
}

const roleLabels: Record<string, string> = {
  admin: '관리자',
  manager: '매니저',
  viewer: '뷰어',
  warehouse: '창고',
}

const roleBadgeVariants: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  admin: 'destructive',
  manager: 'default',
  viewer: 'secondary',
  warehouse: 'outline',
}

export function UserManagement({ organizationId }: UserManagementProps) {
  const [users, setUsers] = useState<OrganizationUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // 초대 다이얼로그 상태
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'viewer' | 'warehouse'>('viewer')

  // 사용자 목록 로드
  const loadUsers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await getOrganizationUsersAction(organizationId)

      if (result.success) {
        setUsers(result.data)
      } else {
        setError(result.error)
      }
    } catch {
      setError('사용자 목록을 불러오는 중 오류가 발생했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  // 역할 변경
  const handleRoleChange = async (
    userId: string,
    newRole: 'admin' | 'manager' | 'viewer' | 'warehouse'
  ) => {
    setMessage(null)

    startTransition(async () => {
      const result = await updateUserRoleAction(userId, organizationId || '', newRole)

      if (result.success) {
        setMessage({ type: 'success', text: '역할이 성공적으로 변경되었습니다' })
        await loadUsers()
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  // 슈퍼관리자 토글
  const handleToggleSuperadmin = async (userId: string, isSuperadmin: boolean) => {
    setMessage(null)

    startTransition(async () => {
      const result = await toggleSuperadminAction(userId, isSuperadmin)

      if (result.success) {
        setMessage({
          type: 'success',
          text: isSuperadmin ? '슈퍼관리자로 설정되었습니다' : '슈퍼관리자 권한이 해제되었습니다',
        })
        await loadUsers()
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  // 사용자 제거
  const handleRemoveUser = async (userId: string) => {
    setMessage(null)

    startTransition(async () => {
      const result = await removeUserAction(userId, organizationId || '')

      if (result.success) {
        setMessage({ type: 'success', text: '사용자가 성공적으로 제거되었습니다' })
        await loadUsers()
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  // 사용자 초대
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (!inviteEmail) {
      setMessage({ type: 'error', text: '이메일을 입력해주세요' })
      return
    }

    startTransition(async () => {
      const result = await inviteUserAction(organizationId || '', inviteEmail, inviteRole)

      if (result.success) {
        setMessage({ type: 'success', text: '사용자가 성공적으로 초대되었습니다' })
        setIsInviteDialogOpen(false)
        setInviteEmail('')
        setInviteRole('viewer')
        await loadUsers()
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            사용자 관리
          </CardTitle>
          <CardDescription>조직 내 사용자와 권한을 관리합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            사용자 관리
          </CardTitle>
          <CardDescription>조직 내 사용자와 권한을 관리합니다</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-slate-400 dark:text-slate-500">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              사용자 관리
            </CardTitle>
            <CardDescription>
              조직 내 사용자와 권한을 관리합니다 (총 {users.length}명)
            </CardDescription>
          </div>

          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                사용자 초대
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 사용자 초대</DialogTitle>
                <DialogDescription>
                  이메일 주소와 권한을 선택하여 사용자를 초대합니다
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteUser}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일 주소 *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">권한 *</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) =>
                        setInviteRole(value as 'admin' | 'manager' | 'viewer' | 'warehouse')
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">관리자 - 모든 권한</SelectItem>
                        <SelectItem value="manager">매니저 - 데이터 관리 가능</SelectItem>
                        <SelectItem value="warehouse">창고 - 입고/출고 처리</SelectItem>
                        <SelectItem value="viewer">뷰어 - 조회만 가능</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(false)}
                    disabled={isPending}
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    초대 보내기
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 메시지 */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* 사용자 테이블 */}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800">
                <TableHead className="min-w-[200px]">이름</TableHead>
                <TableHead className="min-w-[240px]">이메일</TableHead>
                <TableHead className="min-w-[120px]">권한</TableHead>
                <TableHead className="min-w-[100px]">슈퍼관리자</TableHead>
                <TableHead className="min-w-[150px]">가입일</TableHead>
                <TableHead className="w-12 text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500 dark:text-slate-400">
                    사용자가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <Image
                            src={user.avatarUrl}
                            alt={user.name || user.email}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            {(user.name || user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span>{user.name || '이름 없음'}</span>
                          {user.isSuperadmin && (
                            <ShieldCheck className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(newRole) =>
                          handleRoleChange(user.id, newRole as 'admin' | 'manager' | 'viewer' | 'warehouse')
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            <Badge variant={roleBadgeVariants[user.role]}>
                              {roleLabels[user.role]}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">관리자</SelectItem>
                          <SelectItem value="manager">매니저</SelectItem>
                          <SelectItem value="warehouse">창고</SelectItem>
                          <SelectItem value="viewer">뷰어</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <Switch
                                checked={user.isSuperadmin}
                                onCheckedChange={(checked) => handleToggleSuperadmin(user.id, checked)}
                                disabled={isPending}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{user.isSuperadmin ? '슈퍼관리자 해제' : '슈퍼관리자 설정'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>사용자 제거 확인</AlertDialogTitle>
                            <AlertDialogDescription>
                              <span className="font-semibold">{user.name || user.email}</span> 사용자를
                              조직에서 제거하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveUser(user.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              제거
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 권한 설명 */}
        <div className="rounded-lg border bg-slate-50 dark:bg-slate-800 p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">권한 설명</h4>
          <div className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-start gap-2">
              <Badge className="mt-0.5 shrink-0 bg-amber-500 hover:bg-amber-600">
                <ShieldCheck className="mr-1 h-3 w-3" />
                슈퍼관리자
              </Badge>
              <p>플랫폼 최고 권한. 데이터 영구 삭제, 삭제 요청 본인 승인 가능</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="destructive" className="mt-0.5 shrink-0">
                관리자
              </Badge>
              <p>모든 데이터 조회, 수정, 삭제 및 사용자 관리, 삭제 요청 승인 권한</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="default" className="mt-0.5 shrink-0">
                매니저
              </Badge>
              <p>데이터 조회 및 수정 가능, 삭제 요청 제출 가능 (승인은 관리자)</p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="mt-0.5 shrink-0">
                창고
              </Badge>
              <p>입고/출고 처리 및 재고 조회 가능</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="mt-0.5 shrink-0">
                뷰어
              </Badge>
              <p>데이터 조회만 가능</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
