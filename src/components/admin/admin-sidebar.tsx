"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavItem } from "@/components/layout/nav-item";
import { ADMIN_NAV, ADMIN_BOTTOM_NAV } from "@/lib/constants/admin-navigation";
import { Button } from "@/components/ui/button";

interface AdminSidebarProps {
  className?: string;
  userInfo?: {
    name: string;
    email: string;
  };
}

export function AdminSidebar({ className, userInfo }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const roleLabel: Record<string, string> = { CEO: "관리자", ADMIN: "관리자", MANAGER: "매니저", STAFF: "스태프", VIEWER: "뷰어" };
  const rawName = userInfo?.name || "슈퍼관리자";
  const userName = roleLabel[rawName] ?? rawName;
  const userEmail = userInfo?.email || "";
  const firstChar = userName.charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 dark:border-slate-800 dark:bg-slate-950",
        collapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* 로고 */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-200 px-4 dark:border-slate-800",
          collapsed && "justify-center px-2"
        )}
      >
        <Link href="/admin" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-red-600">Admin</span>
          )}
        </Link>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {ADMIN_NAV.map((item) => (
          <NavItem
            key={item.href}
            title={item.title}
            href={item.href}
            icon={item.icon}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* 하단 */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="space-y-1">
          {ADMIN_BOTTOM_NAV.map((item) => (
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
        <div
          className={cn(
            "mt-3 flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-950",
            collapsed && "justify-center p-1"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-medium text-white">
            {firstChar}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden text-left">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {userName}
              </p>
              <p className="truncate text-xs text-red-600">{userEmail || "슈퍼관리자"}</p>
            </div>
          )}
        </div>

        {/* 접기/펼치기 */}
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
