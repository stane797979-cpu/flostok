'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Copy,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Key,
} from 'lucide-react'
import { createApiKey, deleteApiKey, listApiKeys, type APIKey } from '@/server/actions/api-keys'

interface APIKeySettingsProps {
  organizationId: string
}

export function APIKeySettings({ organizationId }: APIKeySettingsProps): React.ReactNode {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null) // 생성 직후 한 번만 표시

  // API 키 목록 로드
  useEffect(() => {
    loadApiKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const loadApiKeys = async () => {
    setIsLoading(true)
    const result = await listApiKeys(organizationId)
    if (result.success && result.data) {
      setApiKeys(result.data as APIKey[])
    } else {
      setMessage({ type: 'error', text: result.error || 'API 키 목록을 불러오지 못했습니다' })
    }
    setIsLoading(false)
  }

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      setMessage({ type: 'error', text: 'API 키 이름을 입력해주세요.' })
      return
    }

    setIsCreating(true)
    setMessage(null)
    setNewlyCreatedKey(null)

    const result = await createApiKey({
      organizationId,
      name: newKeyName,
    })

    setIsCreating(false)

    if (result.success && result.data) {
      // 생성된 키를 목록에 추가
      setApiKeys((prev) => [
        {
          id: result.data.id,
          name: result.data.name,
          key: result.data.key,
          maskedKey: result.data.maskedKey,
          createdAt: result.data.createdAt,
          status: 'active',
        },
        ...prev,
      ])
      setNewKeyName('')
      setNewlyCreatedKey(result.data.key) // 전체 키 저장 (한 번만 표시)
      setMessage({ type: 'success', text: 'API 키가 성공적으로 생성되었습니다. 키를 안전한 곳에 보관하세요.' })
    } else {
      setMessage({ type: 'error', text: result.error || 'API 키 생성에 실패했습니다' })
    }
  }

  const handleDeleteKey = async (id: string) => {
    setIsDeleting(true)
    setMessage(null)

    const result = await deleteApiKey({
      organizationId,
      keyId: id,
    })

    setIsDeleting(false)

    if (result.success) {
      setApiKeys((prev) => prev.filter((key) => key.id !== id))
      setDeleteConfirm(null)
      setMessage({ type: 'success', text: 'API 키가 삭제되었습니다.' })
    } else {
      setMessage({ type: 'error', text: result.error || 'API 키 삭제에 실패했습니다' })
    }
  }

  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <Tabs defaultValue="keys" className="space-y-4">
      <TabsList>
        <TabsTrigger value="keys">API 키</TabsTrigger>
        <TabsTrigger value="usage">사용 기록</TabsTrigger>
      </TabsList>

      {/* API 키 탭 */}
      <TabsContent value="keys" className="space-y-4">
        {/* 새 API 키 생성 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              새 API 키 생성
            </CardTitle>
            <CardDescription>새로운 API 키를 생성하여 외부 애플리케이션에서 사용할 수 있습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName" className="text-sm font-medium">
                  API 키 이름 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="keyName"
                  placeholder="예: 모바일 앱 API 키"
                  value={newKeyName}
                  onChange={(e) => {
                    setNewKeyName(e.target.value)
                    setMessage(null)
                  }}
                  disabled={isCreating}
                />
              </div>

              {newlyCreatedKey && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>중요:</strong> 생성된 API 키는 아래에 한 번만 표시됩니다. 안전한 곳에 복사해서
                    보관하세요.
                    <code className="mt-2 block rounded bg-slate-100 p-2 font-mono text-sm">{newlyCreatedKey}</code>
                  </AlertDescription>
                </Alert>
              )}

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

              <div className="flex justify-end">
                <Button onClick={handleGenerateKey} disabled={isCreating} className="gap-2">
                  {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                  API 키 생성
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API 키 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              생성된 API 키
            </CardTitle>
            <CardDescription>총 {apiKeys.length}개의 API 키</CardDescription>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-slate-200">
                <p className="text-center text-slate-500">생성된 API 키가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                    {/* 좌측: 키 정보 */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{apiKey.name}</span>
                        <span className="text-xs text-slate-500">생성일: {apiKey.createdAt}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded bg-slate-100 px-3 py-2 font-mono text-sm text-slate-700">
                          {apiKey.maskedKey}
                        </code>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyKey(apiKey.maskedKey, apiKey.id)}
                          className="gap-1"
                        >
                          {copiedId === apiKey.id ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="hidden sm:inline">복사됨</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              <span className="hidden sm:inline">복사</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {apiKey.lastUsedAt && (
                        <p className="text-xs text-slate-500">마지막 사용: {apiKey.lastUsedAt}</p>
                      )}
                    </div>

                    {/* 우측: 삭제 버튼 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(apiKey.id)}
                      disabled={isDeleting}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 보안 안내 */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>보안 주의:</strong> API 키를 안전하게 보관하세요. 절대 공개 저장소에 커밋하지 마세요. 의심스러운
            활동을 감지하면 즉시 해당 키를 삭제하세요.
          </AlertDescription>
        </Alert>
      </TabsContent>

      {/* 사용 기록 탭 */}
      <TabsContent value="usage" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>API 키 사용 기록</CardTitle>
            <CardDescription>API 키별 최근 사용 이력을 확인할 수 있습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{apiKey.name}</p>
                      <p className="text-sm text-slate-500">{apiKey.maskedKey}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-900">
                        {apiKey.lastUsedAt ? `마지막 사용: ${apiKey.lastUsedAt}` : '아직 사용되지 않음'}
                      </p>
                      <p className="text-xs text-slate-500">생성일: {apiKey.createdAt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>API 키를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 API 키를 삭제하면 이 키를 사용하는 모든 애플리케이션이 작동하지 않습니다. 이 작업은 되돌릴 수
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3">
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteKey(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  )
}
