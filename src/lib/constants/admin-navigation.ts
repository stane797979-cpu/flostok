import {
  LayoutDashboard,
  Building2,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: AdminNavItem[] = [
  {
    title: "시스템 대시보드",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "조직 관리",
    href: "/admin/organizations",
    icon: Building2,
  },
];

export const ADMIN_BOTTOM_NAV: AdminNavItem[] = [
  {
    title: "대시보드로 돌아가기",
    href: "/dashboard",
    icon: ArrowLeft,
  },
];
