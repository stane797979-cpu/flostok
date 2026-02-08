import {
  LayoutDashboard,
  Package,
  Tags,
  Factory,
  ClipboardList,
  Truck,
  FileSpreadsheet,
  BarChart3,
  Gauge,
  Bell,
  MessageSquare,
  CreditCard,
  Settings,
  HelpCircle,
  FileSearch,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  description?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * 메인 네비게이션 메뉴
 */
export const MAIN_NAV: NavItem[] = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "전체 현황 요약",
  },
  {
    title: "재고 현황",
    href: "/dashboard/inventory",
    icon: Package,
    description: "재고 상태 및 수량 관리",
  },
  {
    title: "발주(입고)관리",
    href: "/dashboard/orders",
    icon: ClipboardList,
    description: "발주 생성 및 입고 추적",
  },
  {
    title: "출고 관리",
    href: "/dashboard/outbound",
    icon: Truck,
    description: "출고 업로드 및 수불부",
  },
  {
    title: "수불관리",
    href: "/dashboard/movement",
    icon: FileSpreadsheet,
    description: "재고 수불부 조회 및 다운로드",
  },
  {
    title: "제품 관리",
    href: "/dashboard/products",
    icon: Tags,
    description: "제품/SKU 정보 관리",
  },
  {
    title: "공급업체",
    href: "/dashboard/suppliers",
    icon: Factory,
    description: "공급업체 정보 및 연락처",
  },
  {
    title: "분석",
    href: "/dashboard/analytics",
    icon: BarChart3,
    description: "ABC/XYZ 분석",
  },
  {
    title: "KPI 대시보드",
    href: "/dashboard/kpi",
    icon: Gauge,
    description: "핵심 성과 지표 현황",
  },
  {
    title: "알림",
    href: "/dashboard/alerts",
    icon: Bell,
    description: "재고 알림 및 알림 설정",
  },
  {
    title: "AI 채팅",
    href: "/dashboard/chat",
    icon: MessageSquare,
    description: "AI 어시스턴트와 상담",
  },
  {
    title: "데이터 온보딩",
    href: "/dashboard/onboarding",
    icon: FileSearch,
    description: "회사 데이터 분석 및 매핑",
  },
];

/**
 * 하단 고정 메뉴
 */
export const BOTTOM_NAV: NavItem[] = [
  {
    title: "결제 및 구독",
    href: "/dashboard/billing",
    icon: CreditCard,
    description: "플랜 관리 및 결제 내역",
  },
  {
    title: "설정",
    href: "/dashboard/settings",
    icon: Settings,
    description: "조직 및 시스템 설정",
  },
  {
    title: "도움말",
    href: "/dashboard/help",
    icon: HelpCircle,
    description: "사용 가이드 및 지원",
  },
];

/**
 * 전체 네비게이션 구조
 */
export const NAVIGATION: NavSection[] = [
  {
    items: MAIN_NAV,
  },
  {
    items: BOTTOM_NAV,
  },
];
