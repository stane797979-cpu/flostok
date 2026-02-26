import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 금액을 한국 원화 형식으로 포맷합니다.
 * 예: 1234567 → "₩1,234,567"
 */
export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
  }).format(amount);
}

/**
 * 숫자를 한국어 로케일 형식으로 포맷합니다.
 * 예: 1234567 → "1,234,567"
 */
export function formatNumber(value: number): string {
  return value.toLocaleString("ko-KR");
}

/**
 * 금액을 억/만 단위 축약형으로 포맷합니다 (차트 Y축 레이블 전용).
 * 예: 150000000 → "1.5억", 50000 → "5만", 999 → "999"
 */
export function formatCompactKRW(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(0)}만`;
  }
  return value.toLocaleString("ko-KR");
}

/**
 * Supabase Auth 에러 메시지를 한국어로 변환합니다.
 */
export function translateAuthError(message: string): string {
  const errorMap: Record<string, string> = {
    "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
    "Email not confirmed": "이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.",
    "User already registered": "이미 가입된 이메일입니다.",
    "Too many requests": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    "Invalid email": "올바른 이메일 주소를 입력해주세요.",
    "Signup requires a valid password": "유효한 비밀번호를 입력해주세요.",
    "Password should be at least 6 characters": "비밀번호는 최소 8자 이상이어야 합니다.",
    "Email rate limit exceeded": "이메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
    "User not found": "등록되지 않은 이메일입니다.",
  };
  return errorMap[message] ?? "오류가 발생했습니다. 다시 시도해주세요.";
}
