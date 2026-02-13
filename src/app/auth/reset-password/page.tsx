'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordConfirmPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase가 URL fragment에서 자동으로 세션을 복원하는지 확인
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsValidSession(!!session);
    });

    // auth 상태 변경 리스너 (recovery 이벤트 감지)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !passwordConfirm) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        if (updateError.message.includes('same_password')) {
          setError('이전과 같은 비밀번호는 사용할 수 없습니다.');
        } else {
          setError('비밀번호 변경에 실패했습니다. 링크가 만료되었을 수 있습니다.');
        }
        return;
      }

      setIsSuccess(true);

      // 3초 후 대시보드로 이동
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 3000);
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="w-full max-w-md">
          <Card className="border-2">
            <CardHeader className="space-y-3 text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl">비밀번호 변경 완료</CardTitle>
              <CardDescription>
                비밀번호가 성공적으로 변경되었습니다.
                <br />
                잠시 후 대시보드로 이동합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => {
                  router.push('/dashboard');
                  router.refresh();
                }}
              >
                대시보드로 이동
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isValidSession === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="w-full max-w-md">
          <Card className="border-2">
            <CardHeader className="space-y-3 text-center">
              <CardTitle className="text-2xl">링크가 만료되었습니다</CardTitle>
              <CardDescription>
                비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.
                <br />
                다시 비밀번호 찾기를 진행해주세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" asChild>
                <Link href="/reset-password">
                  비밀번호 찾기 다시 하기
                </Link>
              </Button>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Link
                href="/login"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                로그인으로 돌아가기
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="w-full max-w-md flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <Card className="border-2">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">새 비밀번호 설정</CardTitle>
            <CardDescription>
              새로 사용할 비밀번호를 입력해주세요.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">새 비밀번호</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="최소 8자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-9"
                    autoComplete="new-password"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">비밀번호 확인</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="passwordConfirm"
                    type="password"
                    placeholder="비밀번호를 다시 입력"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    disabled={isLoading}
                    className="pl-9"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    변경 중...
                  </>
                ) : (
                  '비밀번호 변경'
                )}
              </Button>
            </CardContent>

            <CardFooter className="flex justify-center">
              <Link
                href="/login"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                로그인으로 돌아가기
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
