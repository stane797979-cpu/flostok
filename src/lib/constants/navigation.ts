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
  AlertOctagon,
  CalendarRange,
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
  color?: string; // 섹션 도트 색상 (Tailwind class)
  items: NavItem[];
}

/**
 * 메인 네비게이션 — SCM 프로세스 흐름 순서
 * 계획 → 조달 → 실행 → 재고 → 관리 → 도구
 */
export const MAIN_SECTIONS: NavSection[] = [
  {
    // 대시보드 — 섹션 헤더 없음
    items: [
      {
        title: "대시보드",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "전체 현황 요약",
      },
    ],
  },
  {
    title: "계획",
    color: "text-blue-500",
    items: [
      {
        title: "PSI 계획",
        href: "/dashboard/psi",
        icon: CalendarRange,
        description: "수요·공급·재고 통합 계획표",
      },
      {
        title: "수요·공급 분석",
        href: "/dashboard/analytics",
        icon: BarChart3,
        description: "ABC-XYZ·수요예측·회전율 분석",
      },
    ],
  },
  {
    title: "조달",
    color: "text-emerald-500",
    items: [
      {
        title: "발주(입고)관리",
        href: "/dashboard/orders",
        icon: ClipboardList,
        description: "발주 생성 및 입고 추적",
      },
    ],
  },
  {
    title: "실행",
    color: "text-orange-500",
    items: [
      {
        title: "출고 관리",
        href: "/dashboard/outbound",
        icon: Truck,
        description: "출고 등록 및 처리",
      },
      {
        title: "수불관리",
        href: "/dashboard/movement",
        icon: FileSpreadsheet,
        description: "재고 수불부 조회 및 다운로드",
      },
    ],
  },
  {
    title: "재고",
    color: "text-violet-500",
    items: [
      {
        title: "재고 현황",
        href: "/dashboard/inventory",
        icon: Package,
        description: "재고 상태 및 수량 관리",
      },
      {
        title: "결품관리",
        href: "/dashboard/stockout",
        icon: AlertOctagon,
        description: "결품 감지, 원인 분석 및 조치",
      },
    ],
  },
  {
    title: "관리",
    color: "text-slate-400",
    items: [
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
        title: "KPI",
        href: "/dashboard/kpi",
        icon: Gauge,
        description: "핵심 성과 지표 현황",
      },
    ],
  },
  {
    title: "도구",
    color: "text-slate-300",
    items: [
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
      {
        title: "알림",
        href: "/dashboard/alerts",
        icon: Bell,
        description: "재고 알림 및 알림 설정",
      },
    ],
  },
];

/** @deprecated MAIN_SECTIONS 사용 권장 */
export const MAIN_NAV: NavItem[] = MAIN_SECTIONS.flatMap((s) => s.items);

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
  ...MAIN_SECTIONS,
  {
    items: BOTTOM_NAV,
  },
];
