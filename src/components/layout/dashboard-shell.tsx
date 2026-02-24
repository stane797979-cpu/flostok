"use client";

import { ReactNode, Suspense, useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface DashboardShellProps {
  children: ReactNode;
  userInfo?: {
    name: string;
    role: string;
    orgName: string;
    isSuperadmin?: boolean;
    allowedMenus?: string[];
  };
  sidebarBadges?: Record<string, number>;
}

export function DashboardShell({ children, userInfo, sidebarBadges }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigation = () => setMobileOpen(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 데스크탑 사이드바 */}
      <div className="hidden lg:flex">
        <Suspense>
          <Sidebar userInfo={userInfo} badges={sidebarBadges} />
        </Suspense>
      </div>

      {/* 모바일 사이드바 (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetTitle className="sr-only">네비게이션 메뉴</SheetTitle>
          <Suspense>
            <Sidebar
              userInfo={userInfo}
              badges={sidebarBadges}
              onNavigate={handleNavigation}
              className="border-r-0"
            />
          </Suspense>
        </SheetContent>
      </Sheet>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
