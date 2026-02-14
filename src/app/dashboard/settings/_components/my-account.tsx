'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  CheckCircle,
  Lock,
  LogOut,
  UserX,
  CreditCard,
  AlertTriangle,
  Calendar,
  RefreshCcw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getWithdrawalPreCheck,
  withdrawAccountAction,
  cancelSubscriptionAction,
  getSubscriptionInfo,
} from '@/server/actions/withdrawal';
import { WITHDRAWAL_REASONS, type WithdrawalPreCheck } from '@/types/withdrawal';

const PLAN_LABELS: Record<string, string> = {
  free: '무료',
  starter: '스타터',
  pro: '프로',
  enterprise: '엔터프라이즈',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: '활성', variant: 'default' },
  canceled: { label: '취소됨', variant: 'destructive' },
  expired: { label: '만료', variant: 'secondary' },
  pending: { label: '대기중', variant: 'outline' },
  failed: { label: '실패', variant: 'destructive' },
};

export function MyAccount() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 탈퇴 관련 상태
  const [withdrawalPreCheck, setWithdrawalPreCheck] = useState<WithdrawalPreCheck | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState<string>(WITHDRAWAL_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalStep, setWithdrawalStep] = useState<'idle' | 'confirm' | 'final'>('idle');
  const [confirmText, setConfirmText] = useState('');

  // 구독 관련 상태
  const [subscriptionData, setSubscriptionData] = useState<Awaited<ReturnType<typeof getSubscriptionInfo>> | null>(null);
  const [isCancelingSub, setIsCancelingSub] = useState(false);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  async function loadSubscriptionInfo() {
    const result = await getSubscriptionInfo();
    setSubscriptionData(result);
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || !confirmPassword) {
      setError('새 비밀번호를 입력해주세요.');
      return;
    }

    if (newPassword.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess('비밀번호가 변경되었습니다.');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('비밀번호 변경에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // 탈퇴 관련 추가 상태
  const [withdrawalError, setWithdrawalError] = useState('');

  const DEFAULT_PRECHECK: WithdrawalPreCheck = {
    hasActiveSubscription: false,
    subscription: null,
    refundInfo: null,
    organizationUserCount: 1,
    isLastAdmin: false,
  };

  // confirm 단계 진입 후 서버 데이터 비동기 로드
  useEffect(() => {
    if (withdrawalStep !== 'confirm') return;
    let cancelled = false;
    getWithdrawalPreCheck()
      .then((result) => {
        if (!cancelled && result.success) {
          setWithdrawalPreCheck(result.data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [withdrawalStep]);

  // 버튼 클릭 → 즉시 다음 단계로 전환
  const handleStartWithdrawal = () => {
    setWithdrawalError('');
    setWithdrawalPreCheck(DEFAULT_PRECHECK);
    setWithdrawalStep('confirm');
  };

  // 탈퇴 실행
  const handleWithdraw = async () => {
    if (confirmText !== '탈퇴합니다') return;

    setIsWithdrawing(true);
    try {
      const result = await withdrawAccountAction({
        reason: withdrawalReason,
        customReason: withdrawalReason === '기타' ? customReason : undefined,
        requestRefund: !!withdrawalPreCheck?.refundInfo?.eligible,
      });

      if (result.success) {
        // 탈퇴 성공 → Supabase 로그아웃 후 리다이렉트
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login?withdrawn=true');
        router.refresh();
      } else {
        setWithdrawalError(result.error);
        setWithdrawalStep('idle');
      }
    } catch {
      setWithdrawalError('탈퇴 처리 중 오류가 발생했습니다.');
      setWithdrawalStep('idle');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // 구독 취소
  const handleCancelSubscription = async (immediate: boolean) => {
    setIsCancelingSub(true);
    try {
      const result = await cancelSubscriptionAction({
        immediate,
        reason: '사용자 요청에 의한 구독 취소',
      });

      if (result.success) {
        if (result.data.refundedAmount > 0) {
          setSuccess(`구독이 취소되었습니다. ${result.data.refundedAmount.toLocaleString()}원이 환불됩니다.`);
        } else {
          setSuccess(
            immediate
              ? '구독이 즉시 취소되었습니다.'
              : '구독이 현재 기간 종료 시 취소됩니다.'
          );
        }
        await loadSubscriptionInfo();
      } else {
        setError(result.error);
      }
    } catch {
      setError('구독 취소에 실패했습니다.');
    } finally {
      setIsCancelingSub(false);
    }
  };

  const sub = subscriptionData?.success ? subscriptionData.data.subscription : null;
  const refundInfo = subscriptionData?.success ? subscriptionData.data.refundInfo : null;

  return (
    <div className="space-y-6">
      {/* 비밀번호 변경 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            비밀번호 변경
          </CardTitle>
          <CardDescription>계정 비밀번호를 변경합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">새 비밀번호</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="새 비밀번호 (8자 이상)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="새 비밀번호 확인"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  변경 중...
                </>
              ) : (
                '비밀번호 변경'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 구독 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            구독 관리
          </CardTitle>
          <CardDescription>현재 구독 플랜과 결제 정보를 관리합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sub ? (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {PLAN_LABELS[sub.plan] || sub.plan} 플랜
                    </span>
                    <Badge variant={STATUS_LABELS[sub.status]?.variant || 'outline'}>
                      {STATUS_LABELS[sub.status]?.label || sub.status}
                    </Badge>
                    {sub.cancelAtPeriodEnd && (
                      <Badge variant="secondary">기간 종료 시 취소 예정</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sub.billingCycle === 'monthly' ? '월간' : '연간'} 구독
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(sub.currentPeriodEnd).toLocaleDateString('ko-KR')} 까지
                  </div>
                </div>
              </div>

              {/* 환불 예상 정보 */}
              {refundInfo && refundInfo.eligible && sub.status === 'active' && (
                <Alert>
                  <RefreshCcw className="h-4 w-4" />
                  <AlertDescription>
                    즉시 취소 시 약 <strong>{refundInfo.estimatedAmount.toLocaleString()}원</strong> 환불 예상
                    (사용 {refundInfo.usedDays}일 / 전체 {refundInfo.totalDays}일,
                    환불률 {Math.round(refundInfo.refundRate * 100)}%)
                  </AlertDescription>
                </Alert>
              )}

              {/* 구독 취소 버튼 */}
              {sub.status === 'active' && sub.plan !== 'free' && !sub.cancelAtPeriodEnd && (
                <div className="flex gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" disabled={isCancelingSub}>
                        기간 종료 시 취소
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>구독을 기간 종료 시 취소하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {new Date(sub.currentPeriodEnd).toLocaleDateString('ko-KR')}까지
                          현재 플랜을 계속 사용하실 수 있습니다. 이후 무료 플랜으로 전환됩니다.
                          환불은 발생하지 않습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleCancelSubscription(false)}>
                          확인
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isCancelingSub}>
                        {isCancelingSub ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            처리 중...
                          </>
                        ) : (
                          '즉시 취소 및 환불'
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>구독을 즉시 취소하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                          구독이 즉시 취소되며, 이용약관 제7조에 따라 미사용 기간에 대한 환불이 처리됩니다.
                          {refundInfo?.eligible && (
                            <>
                              <br /><br />
                              예상 환불액: <strong>{refundInfo.estimatedAmount.toLocaleString()}원</strong>
                              <br />
                              환불은 7영업일 이내에 원결제 수단으로 처리됩니다.
                            </>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleCancelSubscription(true)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          즉시 취소 및 환불
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}

              {sub.cancelAtPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  {new Date(sub.currentPeriodEnd).toLocaleDateString('ko-KR')}에 구독이 자동 취소됩니다.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              현재 무료 플랜을 사용 중입니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 로그아웃 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            로그아웃
          </CardTitle>
          <CardDescription>현재 세션에서 로그아웃합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            로그아웃
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* 회원 탈퇴 */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <UserX className="h-5 w-5" />
            회원 탈퇴
          </CardTitle>
          <CardDescription>
            계정을 삭제하고 서비스를 탈퇴합니다. 이 작업은 되돌릴 수 없습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {withdrawalError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{withdrawalError}</AlertDescription>
            </Alert>
          )}
          {withdrawalStep === 'idle' && (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  탈퇴 전 확인사항
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>유료 구독이 있는 경우, 이용약관 제7조에 따라 환불 처리됩니다.</li>
                  <li>탈퇴 후 <strong>30일 이내</strong>에 데이터 내보내기를 요청하실 수 있습니다.</li>
                  <li>탈퇴 후 <strong>90일이 지나면</strong> 모든 데이터가 영구 삭제됩니다.</li>
                  <li>법적 보관 의무가 있는 데이터(결제 기록 5년, 접속 기록 3개월)는 별도 보관됩니다.</li>
                </ul>
              </div>
              <Button
                type="button"
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={handleStartWithdrawal}
              >
                <UserX className="mr-2 h-4 w-4" />
                탈퇴 진행
              </Button>
            </>
          )}

          {withdrawalStep === 'confirm' && withdrawalPreCheck && (
            <div className="space-y-4">
              {/* 현재 상태 안내 */}
              {withdrawalPreCheck.hasActiveSubscription && withdrawalPreCheck.subscription && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    현재 <strong>{PLAN_LABELS[withdrawalPreCheck.subscription.plan] || withdrawalPreCheck.subscription.plan}</strong> 플랜
                    ({withdrawalPreCheck.subscription.billingCycle === 'monthly' ? '월간' : '연간'})을 구독 중입니다.
                    탈퇴 시 구독이 즉시 취소됩니다.
                    {withdrawalPreCheck.refundInfo?.eligible && (
                      <>
                        <br />
                        예상 환불액: <strong>{withdrawalPreCheck.refundInfo.estimatedAmount.toLocaleString()}원</strong>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {withdrawalPreCheck.isLastAdmin && withdrawalPreCheck.organizationUserCount > 1 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    조직의 마지막 관리자입니다. 탈퇴 전에 다른 사용자에게 관리자 권한을 위임해주세요.
                    현재 조직에 {withdrawalPreCheck.organizationUserCount}명의 사용자가 있습니다.
                  </AlertDescription>
                </Alert>
              )}

              {/* 탈퇴 사유 선택 */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">탈퇴 사유를 선택해주세요</Label>
                <RadioGroup
                  value={withdrawalReason}
                  onValueChange={(value) => setWithdrawalReason(value as typeof withdrawalReason)}
                  className="space-y-2"
                >
                  {WITHDRAWAL_REASONS.map((reason) => (
                    <div key={reason} className="flex items-center space-x-2">
                      <RadioGroupItem value={reason} id={`reason-${reason}`} />
                      <Label htmlFor={`reason-${reason}`} className="font-normal cursor-pointer">
                        {reason}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {withdrawalReason === '기타' && (
                  <Textarea
                    placeholder="탈퇴 사유를 입력해주세요..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWithdrawalStep('idle');
                    setWithdrawalPreCheck(null);
                  }}
                >
                  돌아가기
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setWithdrawalStep('final')}
                  disabled={
                    (withdrawalPreCheck.isLastAdmin && withdrawalPreCheck.organizationUserCount > 1) ||
                    (withdrawalReason === '기타' && !customReason.trim())
                  }
                >
                  다음 단계
                </Button>
              </div>
            </div>
          )}

          {withdrawalStep === 'final' && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>최종 확인:</strong> 아래에 &quot;탈퇴합니다&quot;를 정확히 입력하시면 탈퇴가 진행됩니다.
                  이 작업은 되돌릴 수 없습니다.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="confirmWithdrawal">확인 문구 입력</Label>
                <Input
                  id="confirmWithdrawal"
                  placeholder="탈퇴합니다"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isWithdrawing}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setWithdrawalStep('confirm');
                    setConfirmText('');
                  }}
                  disabled={isWithdrawing}
                >
                  돌아가기
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleWithdraw}
                  disabled={confirmText !== '탈퇴합니다' || isWithdrawing}
                >
                  {isWithdrawing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      탈퇴 처리 중...
                    </>
                  ) : (
                    <>
                      <UserX className="mr-2 h-4 w-4" />
                      회원 탈퇴
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
