import {
  Building2,
  GraduationCap,
  BarChart3,
  TrendingDown,
  Clock,
  Target,
  ShieldCheck,
  Brain,
  LineChart,
  Gauge,
  FlaskConical,
  Boxes,
  Grid3X3,
  FileSpreadsheet,
  MessageSquare,
  CalendarRange,
  BellRing,
  Users,
  Lightbulb,
  Database,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

// ─── 회사 기본 정보 ───────────────────────────────
export const COMPANY = {
  name: "Stock & Logis",
  slogan: "Less Stock, More Profit",
  sloganKo: "재고는 줄이고, 이익은 높이는 SCM의 정석",
  description:
    "22년 현장 경력의 SCM 전문가가 직접 설계한 컨설팅, 교육, 그리고 AI 솔루션",
  ceoName: "이동욱",
  solutionName: "FloStok",
  email: "contact@stockandlogis.com",
  phone: "02-XXX-XXXX", // TODO: 실제 번호로 교체
} as const;

// ─── 네비게이션 ───────────────────────────────────
export interface MarketingNavItem {
  name: string;
  href: string;
}

export const MARKETING_NAV: MarketingNavItem[] = [
  { name: "홈", href: "/" },
  { name: "회사 소개", href: "/about" },
  { name: "대표 소개", href: "/ceo" },
  { name: "커리큘럼", href: "/curriculum" },
  { name: "솔루션", href: "/solution" },
];

// ─── Hero ─────────────────────────────────────────
export const HERO = {
  headline: "재고는 줄이고 이익은 높이는 SCM의 정석",
  subCopy:
    "22년 현장 경력의 SCM 전문가가 직접 설계한 컨설팅, 교육, 그리고 AI 솔루션.\n감이 아닌 데이터로, 경험이 아닌 시스템으로 공급망을 바꿉니다.",
  ctaPrimary: "무료 재고 진단 신청",
  ctaSecondary: "솔루션 더 알아보기",
} as const;

// ─── 서비스 3종 ───────────────────────────────────
export interface ServiceItem {
  title: string;
  icon: LucideIcon;
  description: string;
  href: string;
}

export const SERVICES: ServiceItem[] = [
  {
    title: "SCM 컨설팅",
    icon: Building2,
    description:
      "수요예측부터 발주 체계, 공급자 관리까지 공급망 전 영역을 진단하고 귀사의 업종과 규모에 맞는 실행 가능한 개선안을 설계합니다.",
    href: "/contact",
  },
  {
    title: "교육 / 강의",
    icon: GraduationCap,
    description:
      "SCM은 이론만으로 완성되지 않습니다. 22년간 제조·유통 현장에서 검증된 실전 노하우를 실무자가 바로 적용할 수 있는 커리큘럼으로 전달합니다.",
    href: "/curriculum",
  },
  {
    title: "FloStok AI 솔루션",
    icon: BarChart3,
    description:
      "엑셀과 감에 의존하던 재고 관리를 AI가 대신합니다. 수요예측, 자동발주, 재고 최적화까지 하나의 플랫폼에서. 도입 첫 달부터 체감할 수 있는 변화를 만듭니다.",
    href: "/solution",
  },
];

// ─── 대표 소개 (하이라이트) ───────────────────────
export const CEO_HIGHLIGHT = {
  name: "이동욱",
  title: "Stock & Logis 대표",
  quote:
    "현장에서 통하지 않는 이론은 이론이 아닙니다.",
  summary:
    "제조·유통 현장에서 22년, 다양한 산업의 재고를 직접 관리하며 체득한 SCM 실전 전문가.",
  stats: [
    { label: "현장 경력", value: "22년+" },
    { label: "근무 기업", value: "5개사" },
    { label: "산업 경험", value: "8개 산업" },
    { label: "글로벌", value: "50개국" },
  ],
} as const;

// ─── 대표 경력 (주요 기업) ──────────────────────────────
export interface CareerCompany {
  name: string;
  industry: string;
}

export const CEO_CAREER_COMPANIES: CareerCompany[] = [
  { name: "Lufthansa Cargo Airlines", industry: "항공물류" },
  { name: "SolidHomme", industry: "의류/잡화" },
  { name: "FujiXerox", industry: "사무기기" },
  { name: "Simplot", industry: "식품" },
  { name: "Wishcompany", industry: "화장품" },
];

export const CEO_SKILLS = [
  "S&OP",
  "수요예측",
  "재고최적화",
  "발주자동화",
  "물류기획",
  "3PL관리",
  "SAP",
  "Oracle",
  "ERP",
  "WMS",
  "FTA",
  "글로벌 SCM",
  "수출입",
  "ITT 통번역사",
  "국제무역사",
] as const;

export const CEO_INDUSTRIES = [
  "항공물류",
  "LED 제조",
  "의류/잡화",
  "사무기기",
  "미니프린터",
  "식품",
  "화장품",
  "e-Commerce",
] as const;

// ─── 커리큘럼 4단계 ──────────────────────────────
export interface CurriculumStep {
  step: number;
  title: string;
  subtitle: string;
  description: string;
  topics: string[];
}

export const CURRICULUM: CurriculumStep[] = [
  {
    step: 1,
    title: "수요예측",
    subtitle: "Demand Forecasting",
    description:
      "과거 판매 데이터에서 패턴을 읽고, 계절성과 트렌드를 분리합니다. 상황별 최적 예측 기법을 학습하고 예측 정확도를 측정하여 지속적으로 개선하는 체계를 구축합니다.",
    topics: [
      "이동평균법 (SMA)",
      "지수평활법 (SES)",
      "이중지수평활 (Holt's)",
      "계절인덱스 조정",
      "예측 정확도 (MAPE/MAE/RMSE)",
      "백테스팅",
    ],
  },
  {
    step: 2,
    title: "공급계획",
    subtitle: "Supply Planning",
    description:
      "수요예측 결과를 기반으로 언제, 얼마나, 어디서 조달할지 결정합니다. 안전재고, 발주점, EOQ 산출 공식을 실무 데이터로 실습하고 품목별 차등 발주 전략을 수립합니다.",
    topics: [
      "발주점 (ROP) 계산",
      "안전재고 산출",
      "경제적 발주량 (EOQ)",
      "발주 우선순위 스코어링",
      "ABC-XYZ 매트릭스 전략",
      "S&OP 프로세스",
    ],
  },
  {
    step: 3,
    title: "입출고 관리",
    subtitle: "Inbound & Outbound",
    description:
      "입고 검수부터 출하까지 물류 프로세스의 정확도를 높입니다. 출고 원칙을 정립하고 로케이션 관리와 순환재고실사로 재고 정확도 98% 이상을 달성합니다.",
    topics: [
      "입고 확인/이력 관리",
      "선입선출 (FIFO)",
      "납기준수율 관리",
      "수불관리",
      "3PL 관리",
      "물류비 분석/절감",
    ],
  },
  {
    step: 4,
    title: "재고관리",
    subtitle: "Inventory Management",
    description:
      "핵심 KPI로 재고 건강을 진단합니다. 과잉재고와 품절을 동시에 줄이는 7단계 재고상태 관리 체계를 도입하고 PSI 계획과 실적을 비교하며 지속적으로 최적화합니다.",
    topics: [
      "7단계 재고상태 분류",
      "재고일수/재고회전율",
      "KPI 대시보드",
      "결품관리",
      "재고 최적화",
      "시나리오 시뮬레이션",
    ],
  },
];

// ─── FloStok 솔루션 기능 ─────────────────────────
export interface SolutionFeature {
  title: string;
  description: string;
  icon: LucideIcon;
  size: "large" | "small";
}

export const SOLUTION_FEATURES: SolutionFeature[] = [
  // 대형 카드 (핵심 변별력)
  {
    title: "AI 수요예측",
    description:
      "품목 특성에 따라 최적 예측 모델을 자동 선택합니다. 한국 고유의 계절성(설날, 추석, 여름 시즌)까지 반영한 정밀 예측을 제공합니다.",
    icon: Brain,
    size: "large",
  },
  {
    title: "AI 자동 발주",
    description:
      "발주점 도달 품목을 실시간 감지하고, 우선순위 스코어링으로 발주 순서를 자동 결정합니다. MOQ, 리드타임까지 반영한 최적 발주량을 추천합니다.",
    icon: LineChart,
    size: "large",
  },
  {
    title: "KPI 분석 + 개선 제안",
    description:
      "재고회전율, 품절률, 서비스수준 등 핵심 KPI를 실시간 모니터링합니다. 수치만 보여주는 것이 아니라, 구체적인 개선 액션까지 AI가 제안합니다.",
    icon: Gauge,
    size: "large",
  },
  {
    title: "시나리오 시뮬레이션",
    description:
      '"리드타임이 2주 늘어나면?", "수요가 30% 증가하면?" — 가정을 숫자로 검증합니다. 재고 추이와 비용 영향을 미리 확인합니다.',
    icon: FlaskConical,
    size: "large",
  },
  // 소형 카드 (부가 기능)
  {
    title: "7단계 재고상태",
    description: "품절부터 과잉까지 7단계로 재고 건강을 한눈에 파악",
    icon: Boxes,
    size: "small",
  },
  {
    title: "ABC-XYZ 매트릭스",
    description: "9가지 조합별 맞춤 발주 전략 자동 적용",
    icon: Grid3X3,
    size: "small",
  },
  {
    title: "Excel 자동 온보딩",
    description: "5단계 위자드로 기존 데이터 즉시 활용",
    icon: FileSpreadsheet,
    size: "small",
  },
  {
    title: "AI 채팅 어시스턴트",
    description: "자연어로 재고 현황 조회, 발주 추천 요청",
    icon: MessageSquare,
    size: "small",
  },
  {
    title: "PSI 통합 관리",
    description: "구매·판매·재고 계획을 하나의 표에서 관리",
    icon: CalendarRange,
    size: "small",
  },
  {
    title: "실시간 알림",
    description: "재고 부족, 발주 지연 이메일+SMS 즉시 알림",
    icon: BellRing,
    size: "small",
  },
];

// ─── 타 업체 대비 변별력 ─────────────────────────
export interface Differentiator {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    title: "현장 실무 + 기술의 결합",
    description:
      "대부분의 SCM 컨설팅은 이론 중심, 대부분의 SaaS는 기능 중심입니다. Stock & Logis는 22년 현장 경력의 전문가가 직접 로직을 설계하고 솔루션에 녹여냈습니다.",
    icon: Users,
  },
  {
    title: "컨설팅 · 교육 · 솔루션 원스톱",
    description:
      '"문제 발견(컨설팅) → 역량 내재화(교육) → 시스템 정착(FloStok)"으로 이어지는 전 주기 지원. 일회성이 아닌 지속 가능한 개선을 실현합니다.',
    icon: RefreshCw,
  },
  {
    title: "한국 제조·유통 현장에 최적화",
    description:
      "한국 영업일 기준 리드타임, 한국형 계절인덱스, 원화 기반 비용 분석 등 국내 현장의 실무 요구사항을 처음부터 설계에 반영했습니다.",
    icon: Lightbulb,
  },
  {
    title: "중소·중견 기업 맞춤 설계",
    description:
      "대기업용 ERP/SCM의 복잡성 없이, 핵심 기능에 집중한 합리적 가격과 빠른 온보딩. 엑셀에서 벗어나려는 기업이 바로 도입할 수 있습니다.",
    icon: Database,
  },
];

// ─── Benefits ─────────────────────────────────────
export interface BenefitItem {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}

export const BENEFITS: BenefitItem[] = [
  {
    label: "재고 비용 절감",
    value: "15~30%",
    description: "안전재고 최적화와 과잉재고 감축을 통한 재고유지비용 절감",
    icon: TrendingDown,
  },
  {
    label: "발주 업무 시간",
    value: "70%↓",
    description: "수동 엑셀 작업에서 AI 자동 추천 기반 의사결정으로 전환",
    icon: Clock,
  },
  {
    label: "재고회전율 개선",
    value: "1.5~2배",
    description: "데이터 기반 적정재고 운영으로 자본 효율성 극대화",
    icon: Target,
  },
  {
    label: "품절률 감소",
    value: "50%↓",
    description: "AI 수요예측과 자동 발주점 관리로 결품 사전 방지",
    icon: ShieldCheck,
  },
];

// ─── 회사 소개 ────────────────────────────────────
export const ABOUT = {
  vision: "모든 기업이 데이터로 공급망을 관리하는 세상",
  visionDetail:
    "규모와 관계없이, 모든 기업이 감이 아닌 시스템으로 재고를 최적화하는 SCM 생태계를 만듭니다.",
  mission: "현장의 언어로 SCM을 설계하고, 기술로 실행을 완성한다",
  missionDetail:
    "22년 현장 경험을 컨설팅, 교육, AI 솔루션에 담아 기업의 재고 비용을 줄이고 수익성을 높입니다.",
  values: [
    {
      title: "현장 중심",
      titleEn: "Field-First",
      description:
        "회의실이 아닌 창고에서 답을 찾습니다. 이론보다 실행, 보고서보다 현장 적용을 우선합니다.",
    },
    {
      title: "데이터 기반",
      titleEn: "Data-Driven",
      description:
        "경험과 직감을 존중하되, 의사결정의 근거는 반드시 데이터에 둡니다.",
    },
    {
      title: "지속 가능한 변화",
      titleEn: "Sustainable Change",
      description:
        "일회성 프로젝트가 아닌, 조직 내 역량으로 내재화되는 변화를 추구합니다.",
    },
  ],
} as const;

// ─── 연혁 ─────────────────────────────────────────
export interface HistoryItem {
  year: string;
  events: string[];
}

export const HISTORY: HistoryItem[] = [
  {
    year: "2026",
    events: [
      "AI 수요예측 엔진 고도화",
      "엔터프라이즈 솔루션 확장",
    ],
  },
  {
    year: "2025",
    events: [
      "FloStok v1.0 정식 출시",
      "SCM 실무 교육 프로그램 런칭",
      "첫 컨설팅 고객사 수주",
    ],
  },
  {
    year: "2024",
    events: [
      "Stock & Logis 설립",
      "FloStok 솔루션 개발 착수",
      "22년 SCM 노하우 솔루션화 시작",
    ],
  },
];

// ─── CTA ──────────────────────────────────────────
export const CTA = {
  headline: "재고 문제, 더 이상 혼자 고민하지 마세요.",
  subCopy:
    "무료 재고 진단으로 귀사의 개선 가능성을 확인해 보세요.\n22년 경력의 SCM 전문가가 직접 답변드립니다.",
  ctaPrimary: "무료 재고 진단 신청",
  ctaSecondary: "솔루션 더 알아보기",
} as const;

// ─── Footer ───────────────────────────────────────
export const FOOTER_NAV = {
  services: [
    { name: "SCM 컨설팅", href: "/contact" },
    { name: "교육/강의", href: "/curriculum" },
    { name: "FloStok 솔루션", href: "/solution" },
    { name: "가격", href: "/solution#pricing" },
  ],
  company: [
    { name: "회사 소개", href: "/about" },
    { name: "대표 소개", href: "/ceo" },
    { name: "무료 재고 진단", href: "/contact" },
  ],
  legal: [
    { name: "개인정보 처리방침", href: "/privacy" },
    { name: "이용약관", href: "/terms" },
    { name: "계약서 양식", href: "/contracts" },
  ],
} as const;

// ─── Testimonials ─────────────────────────────────
export interface TestimonialItem {
  body: string;
  author: {
    name: string;
    position: string;
    company: string;
  };
}

export const TESTIMONIALS: TestimonialItem[] = [
  {
    body: "SCM 프로세스 전체를 진단받고 개선안까지 받았는데, 엑셀로 하던 발주 업무가 70% 이상 줄었습니다. 현장을 아는 분이라 소통이 빨랐어요.",
    author: {
      name: "김민수",
      position: "물류팀장",
      company: "A 유통회사",
    },
  },
  {
    body: "FloStok의 ABC-XYZ 분석과 수요예측 기능 덕분에 재고회전율이 2배 가까이 개선되었습니다. 과잉재고가 눈에 띄게 줄었어요.",
    author: {
      name: "이지은",
      position: "구매담당",
      company: "B 제조회사",
    },
  },
  {
    body: "교육 커리큘럼이 실무 중심이라 팀원들이 바로 업무에 적용할 수 있었습니다. 이론이 아닌 현장의 언어로 가르쳐주셔서 체감이 달랐습니다.",
    author: {
      name: "박준혁",
      position: "SCM 매니저",
      company: "C 이커머스",
    },
  },
];

// ─── 경쟁사 비교표 ──────────────────────────────────
export interface ComparisonFeature {
  category: string;
  feature: string;
  floStok: number; // 0~5 별점
  compA: number;
  compB: number;
  compC: number;
}

export const COMPETITORS = {
  floStok: "FloStok",
  compA: "A사 (국내 ERP형)",
  compB: "B사 (해외 SaaS형)",
  compC: "C사 (엔터프라이즈형)",
} as const;

export const COMPARISON_FEATURES: ComparisonFeature[] = [
  // 수요예측
  { category: "수요예측", feature: "AI 자동 예측 알고리즘", floStok: 5, compA: 1, compB: 3, compC: 4 },
  { category: "수요예측", feature: "예측 정확도 측정 (MAPE/MAE)", floStok: 5, compA: 0, compB: 2, compC: 4 },
  { category: "수요예측", feature: "XYZ 등급별 자동 방법 선택", floStok: 5, compA: 0, compB: 1, compC: 3 },
  // 재고관리
  { category: "재고관리", feature: "7단계 재고상태 분류", floStok: 5, compA: 2, compB: 2, compC: 3 },
  { category: "재고관리", feature: "ABC-XYZ 매트릭스 분석", floStok: 5, compA: 1, compB: 3, compC: 4 },
  { category: "재고관리", feature: "안전재고 자동 산출", floStok: 5, compA: 2, compB: 3, compC: 4 },
  // 발주
  { category: "발주", feature: "AI 자동 발주 추천", floStok: 5, compA: 1, compB: 3, compC: 4 },
  { category: "발주", feature: "발주 우선순위 스코어링", floStok: 5, compA: 0, compB: 1, compC: 2 },
  { category: "발주", feature: "EOQ 최적 발주량 계산", floStok: 5, compA: 0, compB: 2, compC: 4 },
  // 분석/KPI
  { category: "분석/KPI", feature: "KPI 대시보드", floStok: 5, compA: 2, compB: 3, compC: 5 },
  { category: "분석/KPI", feature: "AI 개선 제안", floStok: 5, compA: 0, compB: 1, compC: 2 },
  { category: "분석/KPI", feature: "시나리오 시뮬레이션", floStok: 5, compA: 0, compB: 1, compC: 3 },
  // 사용성
  { category: "사용성", feature: "온보딩 소요 시간", floStok: 5, compA: 3, compB: 4, compC: 1 },
  { category: "사용성", feature: "한국어 UI/UX", floStok: 5, compA: 5, compB: 2, compC: 3 },
  { category: "사용성", feature: "Excel 자동 업로드", floStok: 5, compA: 3, compB: 3, compC: 2 },
  // 가격
  { category: "가격", feature: "월 이용료 합리성", floStok: 5, compA: 4, compB: 2, compC: 1 },
  { category: "가격", feature: "무료 플랜 제공", floStok: 5, compA: 3, compB: 2, compC: 0 },
];
