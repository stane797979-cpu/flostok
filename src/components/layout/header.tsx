"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "./breadcrumb";
import { ThemeToggle } from "./theme-toggle";

interface HeaderProps {
  className?: string;
  onMenuClick?: () => void;
}

export function Header({ className, onMenuClick }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-12 items-center border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950",
        className
      )}
    >
      {/* 모바일 햄버거 버튼 (lg 이상에서 숨김) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden"
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">메뉴 열기</span>
      </Button>

      {/* Breadcrumb (md 이상에서만 표시) */}
      <div className="ml-2 lg:ml-0 flex-1">
        <Breadcrumb />
      </div>

      {/* 다크모드 토글 */}
      <ThemeToggle />
    </header>
  );
}
