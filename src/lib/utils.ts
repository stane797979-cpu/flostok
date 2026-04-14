import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 금액을 간결한 한국어 형식으로 포맷
 * 예: 1500000 → "150만원", 20000000 → "2,000만원", 100000000 → "1억원"
 */
export function formatCompactKRW(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억원`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 10_000).toLocaleString("ko-KR")}만원`;
  }
  return `${value.toLocaleString("ko-KR")}원`;
}
