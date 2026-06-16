// 메뉴 키 목록
export const ALL_MENU_KEYS = [
  "dashboard",
  "psi",
  "analytics",
  "orders",
  "inbound",
  "outbound",
  "warehouse_inbound",
  "warehouse_outbound",
  "inventory",
  "stockout",
  "movement",
  "products",
  "suppliers",
  "kpi",
  "chat",
  "onboarding",
  "alerts",
] as const;

export type MenuKey = (typeof ALL_MENU_KEYS)[number];

// 메뉴 키 → 한글 라벨
export const MENU_KEY_LABELS: Record<string, string> = {
  dashboard: "대시보드",
  psi: "PSI 계획",
  analytics: "수요·공급 분석",
  orders: "발주관리",
  inbound: "입고관리",
  outbound: "출고관리",
  warehouse_inbound: "입고확정(창고)",
  warehouse_outbound: "출고확정(창고)",
  inventory: "재고 현황",
  stockout: "결품관리",
  movement: "수불관리",
  products: "제품 관리",
  suppliers: "공급업체",
  kpi: "KPI",
  chat: "AI 채팅",
  onboarding: "데이터 온보딩",
  alerts: "알림",
};

// 기본 권한 (DB에 레코드 없을 때 사용)
export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ["*"],
  manager: ["*"],
  viewer: [
    "dashboard",
    "inventory",
    "analytics",
    "kpi",
    "movement",
    "products",
    "suppliers",
    "stockout",
    "alerts",
  ],
  warehouse: ["dashboard", "warehouse_inbound", "warehouse_outbound", "inbound", "inventory"],
};
