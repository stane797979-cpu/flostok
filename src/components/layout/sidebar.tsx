"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Package, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavItem } from "./nav-item";
import { MAIN_SECTIONS, BOTTOM_NAV, type NavSection } from "@/lib/constants/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  className?: string;
  userInfo?: {
    name: string;
    role: string;
    orgName: string;
    isSuperadmin?: boolean;
    allowedMenus?: string[];
  };
}

export function Sidebar({ className, userInfo }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  const userName = userInfo?.name || "관리자";
  const userRole = userInfo?.role || "관리자";
  const orgName = userInfo?.orgName || "";

  const firstChar = userName ? userName.charAt(0).toUpperCase() : "?";

  // TODO: 실제 배지 데이터는 서버에서 가져오기
  const badges: Record<string, number> = {
    "/inventory": 3,
    "/orders": 5,
    "/alerts": 2,
  };

  // 권한 기반 메뉴 필터링
  const filteredSections = useMemo(() => {
    const allowedMenus = userInfo?.allowedMenus;
    const isAllAllowed = !allowedMenus || allowedMenus.includes("*");

    if (isAllAllowed) return MAIN_SECTIONS;

    return MAIN_SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!item.menuKey) return true; // menuKey 없으면 항상 표시
          return allowedMenus.includes(item.menuKey);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [userInfo?.allowedMenus]);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* 로고 영역 */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-200 px-4 dark:border-slate-800",
          collapsed && "justify-center px-2"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <Package className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-slate-900 dark:text-white">FloStok</span>
          )}
        </Link>
      </div>

      {/* 메인 네비게이션 — SCM 프로세스 순서 섹션 (권한 필터링 적용) */}
      <nav className="flex-1 overflow-y-auto p-3">
        {filteredSections.map((section, idx) => (
          <div key={idx}>
            {section.title && (
              collapsed ? (
                <Separator className="my-2" />
              ) : (
                <div className="flex items-center gap-1.5 px-3 pt-4 pb-1">
                  <span className={cn("text-[8px]", section.color || "text-slate-400")}>●</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {section.title}
                  </span>
                </div>
              )
            )}
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  title={item.title}
                  href={item.href}
                  icon={item.icon}
                  badge={badges[item.href]}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* 하단 영역 */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        {/* 슈퍼관리자 전용 링크 */}
        {userInfo?.isSuperadmin && (
          <Link
            href="/admin"
            className={cn(
              "mb-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100",
              collapsed && "justify-center px-2"
            )}
          >
            <Shield className="h-4 w-4 shrink-0" />
            {!collapsed && <span>관리자 패널</span>}
          </Link>
        )}

        {/* 하단 메뉴 */}
        <div className="space-y-1">
          {BOTTOM_NAV.map((item) => (
            <NavItem
              key={item.href}
              title={item.title}
              href={item.href}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* 사용자 정보 */}
        <button
          onClick={() => router.push("/dashboard/settings?tab=account")}
          className={cn(
            "mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-200 p-2 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800",
            collapsed && "justify-center p-1"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700">
            {firstChar}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden text-left">
              {orgName && (
                <p className="truncate text-xs font-medium text-primary-600">{orgName}</p>
              )}
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userRole}</p>
            </div>
          )}
        </button>

        {/* 접기/펼치기 버튼 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("mt-3 w-full justify-center", collapsed && "px-2")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2">접기</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
