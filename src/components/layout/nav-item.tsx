"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItemProps {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  collapsed?: boolean;
  onClick?: () => void;
}

export function NavItem({ title, href, icon: Icon, badge, collapsed = false, onClick }: NavItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === href ||
    (href !== "/" && href !== "/dashboard" && pathname.startsWith(href + "/"));

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
