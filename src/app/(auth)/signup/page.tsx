'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Mail, Lock, User, Building2, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createUserWithOrganization } from '@/server/actions/users';
import { translateAuthError } from '@/lib/utils';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    organizationName: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    // 최소 8자, 영문+숫자+특수문자 조합
    const hasMinLength = password.length >= 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return hasMinLength && hasLetter && hasNumber && hasSpecial;
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 유효성 검증
    if (!formData.organizationName || !formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (!validateEmail(formData.email)) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (!validatePassword(formData.password)) {
      setError('비밀번호는 최소 8자 이상, 영문/숫자/특수문자를 포함해야 합니다.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!agreedToTerms) {
      setError('이용약관에 동의해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      // 1. Supabase Auth 회원가입
      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            organization_name: formData.organizationName,
          },
        },
      });

      if (authError) {
        setError(translateAuthError(authError.message));
        return;
      }

      if (!data.user) {
        setError('회원가입 처리 중 오류가 발생했습니다.');
        return;
      }

      // 2. DB에 조직 + 사용자 레코드 생성
      const result = await createUserWithOrganization({
        authId: data.user.id,
        email: formData.email,
        name: formData.name,
        organizationName: formData.organizationName,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // 3. 대시보드로 이동
      router.push('/dashboard');
    } catch {
      setError('회원가입에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
          <Package className="w-6 h-6 text-primary-foreground" />
        </div>
        <CardTitle className="text-2xl">회원가입</CardTitle>
        <CardDescription>
          FloStok 시작하기
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
            <Label htmlFor="organizationName">조직명</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="organizationName"
                type="text"
                placeholder="회사명 또는 조직명"
                value={formData.organizationName}
                onChange={(e) => handleChange('organizationName', e.target.value)}
                disabled={isLoading}
                className="pl-9"
                autoComplete="organization"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="name"
                type="text"
                placeholder="홍길동"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isLoading}
                className="pl-9"
                autoComplete="name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="example@company.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                disabled={isLoading}
                className="pl-9"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                disabled={isLoading}
                className="pl-9"
                autoComplete="new-password"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              8자 이상, 영문/숫자/특수문자 포함
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">비밀번호 확인</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                disabled={isLoading}
                className="pl-9"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              disabled={isLoading}
            />
            <label
              htmlFor="terms"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <Link href="/terms" className="text-primary hover:underline">
                이용약관
              </Link>
              {' '}및{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                개인정보처리방침
              </Link>
              에 동의합니다
            </label>
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
                가입 중...
              </>
            ) : (
              '회원가입'
            )}
          </Button>

        </CardContent>

        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            이미 계정이 있으신가요?{' '}
            <Link
              href="/login"
              className="text-primary font-medium hover:underline"
            >
              로그인
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
