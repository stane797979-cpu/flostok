'use client';

import { useState } from 'react';
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
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSent, setIsSent] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('이메일을 입력해주세요.');
      return;
    }

    if (!validateEmail(email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        setError('비밀번호 재설정 이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      setIsSent(true);
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <Card className="border-2">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl">이메일 전송 완료</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{email}</span>
            <br />
            위 주소로 비밀번호 재설정 링크를 보냈습니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600 space-y-2">
            <p>이메일이 도착하지 않는 경우:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>스팸/정크 메일함을 확인해주세요</li>
              <li>가입 시 사용한 이메일이 맞는지 확인해주세요</li>
              <li>카카오/구글로 가입한 경우 비밀번호가 없습니다</li>
            </ul>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setIsSent(false);
              setEmail('');
            }}
          >
            다른 이메일로 다시 보내기
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
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
          <Mail className="w-6 h-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">비밀번호 찾기</CardTitle>
        <CardDescription>
          가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다.
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
            <Label htmlFor="email">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="example@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="pl-9"
                autoComplete="email"
                autoFocus
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
                전송 중...
              </>
            ) : (
              '재설정 링크 보내기'
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
  );
}
