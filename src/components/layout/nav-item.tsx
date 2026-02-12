"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubNavItem } from "@/lib/constants/navigation";

/**
 * child href와 현재 URL 비교
 */
function isHrefActive(
  childHref: string,
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  const qIdx = childHref.indexOf("?");
  const childPath = qIdx >= 0 ? childHref.slice(0, qIdx) : childHref;
  const childQuery = qIdx >= 0 ? childHref.slice(qIdx + 1) : "";

  if (pathname !== childPath) return false;

  // query 없는 href → pathname 일치 + URL에 tab 파라미터 없으면 active
  if (!childQuery) return !searchParams.has("tab");

  // query 파라미터 전부 일치해야 active
  const params = new URLSearchParams(childQuery);
  for (const [key, value] of params.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

interface NavItemProps {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  collapsed?: boolean;
  onClick?: () => void;
  subItems?: SubNavItem[];
}

export function NavItem({
  title,
  href,
  icon: Icon,
  badge,
  collapsed = false,
  onClick,
  subItems,
}: NavItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // children 기반 활성 감지
  const isChildActive =
    subItems?.some((child) => isHrefActive(child.href, pathname, searchParams)) ?? false;

  // children의 base path가 현재 pathname과 일치하면 auto-expand
  const hasMatchingPath =
    subItems?.some((child) => {
      const qIdx = child.href.indexOf("?");
      const childPath = qIdx >= 0 ? child.href.slice(0, qIdx) : child.href;
      return pathname === childPath || pathname.startsWith(childPath + "/");
    }) ?? false;

  // 일반 항목의 활성 상태
  const isDirectActive =
    pathname === href ||
    (href !== "/" && href !== "/dashboard" && pathname.startsWith(href + "/"));

  const isActive = subItems ? isChildActive : isDirectActive;
  const shouldExpand = isChildActive || hasMatchingPath;

  const [expanded, setExpanded] = useState(shouldExpand);

  // --- collapsible 그룹 (children + 펼쳐진 사이드바) ---
  if (subItems && subItems.length > 0 && !collapsed) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors",
            "hover:bg-slate-100 dark:hover:bg-slate-800",
            isActive
              ? "text-primary-700 dark:text-primary-400"
              : "text-slate-600 dark:text-slate-400"
          )}
        >
          <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary-600")} />
          <span className="flex-1 text-left">{title}</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {expanded && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700">
            {subItems.map((child) => {
              const childActive = isHrefActive(child.href, pathname, searchParams);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onClick}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm transition-colors",
                    "hover:bg-slate-100 dark:hover:bg-slate-800",
                    childActive
                      ? "font-medium text-primary-700 bg-primary-50 dark:text-primary-400 dark:bg-primary-900/20"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {child.title}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // --- 일반 항목 또는 collapsed 모드 ---
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium transition-colors",
        "hover:bg-slate-100 dark:hover:bg-slate-800",
        isActive
          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
          : "text-slate-600 dark:text-slate-400",
        collapsed && "justify-center px-2"
      )}
      title={collapsed ? title : undefined}
    >
      <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary-600")} />
      {!collapsed && (
        <>
          <span className="flex-1">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium",
                isActive
                  ? "bg-primary-600 text-white"
                  : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
