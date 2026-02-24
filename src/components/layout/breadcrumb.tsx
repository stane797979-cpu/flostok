"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

// pathname 세그먼트 → 한국어 라벨 매핑
const LABELS: Record<string, string> = {
  dashboard: "대시보드",
  inventory: "재고 현황",
  orders: "발주 관리",
  warehouse: "입출고",
  inbound: "입고",
  outbound: "출고",
  products: "제품 관리",
  suppliers: "공급업체",
  analytics: "분석",
  kpi: "KPI",
  psi: "PSI 계획",
  movement: "수불부",
  stockout: "결품 관리",
  alerts: "알림",
  settings: "설정",
  "forecast-guide": "수요예측 가이드",
  "scm-diagnostic": "SCM 진단",
  onboarding: "온보딩",
  help: "도움말",
};

interface Crumb {
  label: string;
  href: string;
  isLast: boolean;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // /dashboard 하나만 있으면 breadcrumb 표시 안 함
  if (segments.length <= 1) return null;

  const crumbs: Crumb[] = segments.map((seg, i) => ({
    label: LABELS[seg] || seg,
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="breadcrumb" className="hidden md:flex items-center gap-1 text-sm text-slate-500">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          {crumb.isLast ? (
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
