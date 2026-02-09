# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Stock & Logis - AI 기반 재고 관리 및 자동 발주 추천 시스템.
Next.js 15 + Supabase + Drizzle 기반의 풀스택 SaaS 애플리케이션.

- 언어: 모든 UI, 에러 메시지, 도메인 용어가 한국어. 코드 수정 시 반드시 한국어 유지.
- 레거시: 기존 Streamlit 앱은 `Old/` 폴더에 참고용으로 보관

## 실행

```bash
npm install
npm run dev          # localhost:3000
npm run lint         # ESLint
npm run format       # Prettier
npm run db:generate  # Drizzle 마이그레이션 생성
npm run db:migrate   # 마이그레이션 적용
npm run db:studio    # Drizzle Studio
```

## 기술 스택

- **프레임워크**: Next.js 15 (App Router) + React 19 + TypeScript strict
- **UI**: shadcn/ui (new-york) + Tailwind CSS v3 + Lucide Icons
  - Tailwind v4 사용 금지 (불안정). v3 + tailwind.config.js 방식 사용
- **상태관리**: TanStack Query (서버) + Zustand (클라이언트) — 추후 추가
- **DB**: Supabase PostgreSQL + Row Level Security (멀티테넌시)
- **ORM**: Drizzle ORM
- **AI**: Vercel AI SDK 6 + Anthropic Claude — 추후 추가
- **인증**: Supabase Auth (카카오, 구글)
- **결제**: PortOne + 토스페이먼츠 (Stripe 한국 미지원, 사용 금지)
- **캐싱**: Upstash Redis — 추후 추가
- **배포**: Railway (프론트 + 백그라운드 잡)

## 디렉토리 구조

```
src/
├── app/                    # Next.js 15 App Router
│   ├── (auth)/             # 인증 라우트 그룹
│   ├── (dashboard)/        # 대시보드 라우트 그룹
│   ├── api/                # API Routes
│   └── globals.css
│
├── components/
│   ├── ui/                 # shadcn/ui 컴포넌트
│   ├── layout/             # 사이드바, 헤더
│   └── features/           # 기능별 비즈니스 컴포넌트
│
├── server/
│   ├── db/
│   │   ├── index.ts        # Drizzle DB 연결
│   │   ├── schema/         # 10개 테이블 스키마
│   │   ├── migrations/     # drizzle-kit 자동 생성
│   │   └── seed/           # 시드 데이터
│   ├── actions/            # Server Actions
│   └── services/           # 비즈니스 로직
│
├── lib/
│   ├── supabase/           # Supabase 클라이언트
│   └── utils.ts            # cn(), 헬퍼
│
├── hooks/                  # 커스텀 훅
├── stores/                 # Zustand 스토어
└── types/                  # 타입 정의
```

## DB 스키마 (10개 테이블)

| 테이블 | 설명 |
|--------|------|
| organizations | 조직 (멀티테넌시 기본 단위) |
| users | 사용자 (admin/manager/viewer) |
| suppliers | 공급자 |
| products | 제품/SKU |
| supplier_products | 공급자-제품 매핑 |
| inventory | 현재 재고 |
| inventory_history | 재고 변동 이력 |
| purchase_orders | 발주서 |
| purchase_order_items | 발주 항목 |
| sales_records | 판매 기록 |
| demand_forecasts | 수요 예측 |
| inbound_records | 입고 기록 |
| alerts | 알림 |

## SCM 도메인 규칙

모든 SCM 계산은 `.claude/agents/scm-expert.md`에 정의된 공식을 따릅니다.

### 발주점 (단일 공식, 전체 시스템 통일)
```
발주점 = 일평균판매량 × 리드타임(일) + 안전재고
```

### 재고상태 (7단계 통일)
| 상태 | 조건 | 색상 |
|------|------|------|
| 품절 | 현재고 = 0 | ⚫ 검정 |
| 위험 | 0 < 현재고 < 안전재고 × 0.5 | 🔴 빨강 |
| 부족 | 안전재고 × 0.5 ≤ 현재고 < 안전재고 | 🟠 주황 |
| 주의 | 안전재고 ≤ 현재고 < 발주점 | 🟡 노랑 |
| 적정 | 발주점 ≤ 현재고 < 안전재고 × 3.0 | 🟢 초록 |
| 과다 | 안전재고 × 3.0 ≤ 현재고 < 안전재고 × 5 | 🔵 파랑 |
| 과잉 | 현재고 ≥ 안전재고 × 5.0 | 🟣 보라 |

## Claude Code 개발 환경

### 오케스트레이션 (`.claude/agents.md`)

SCM 관련 변경은 반드시 `scm-expert`가 먼저 설계/검증한 후 구현 에이전트를 투입한다.
단순 작업(10줄 이하 수정, 설정, 문서)은 에이전트 없이 메인에서 직접 처리한다.
상세 워크플로우 및 의사결정 트리: `.claude/agents.md` 참고.

### 전문가 에이전트 (`.claude/agents/`)
| 에이전트 | 모델 | 역할 |
|---------|------|------|
| `scm-expert` | opus | **핵심** SCM 도메인 (재고, 발주, 수요예측, 공급자, S&OP, MRP, KPI) |
| `frontend-expert` | sonnet | Next.js 15, React 19, shadcn/ui, Tailwind v3 |
| `backend-expert` | sonnet | Supabase, Drizzle, API, 인증 |
| `ai-expert` | opus | Vercel AI SDK, 프롬프트, 에이전트 |
| `code-reviewer` | opus | 코드 품질, 보안, 성능 리뷰 (읽기 전용) |
| `database-expert` | sonnet | 스키마 설계, 마이그레이션, RLS |
| `test-expert` | sonnet | Vitest, Playwright, RTL |
| `devops-expert` | haiku | 배포, CI/CD, 모니터링 |

### MCP 서버 (`.mcp.json`)
Supabase, GitHub, Sentry, PostHog, Upstash, Playwright, Memory, Sequential Thinking

### Hooks (`.claude/settings.json`)
- TypeScript/TSX 파일 작성/수정 시 자동 ESLint 포맷팅

### UI 변경 시 검증 (필수)
- UI/레이아웃/스타일 변경 후 반드시 **Playwright로 직접 페이지를 열어 시각적 검증**한다
- `npx playwright test` 또는 Playwright MCP를 활용하여 스크린샷 촬영 후 확인
- "변경했습니다"만으로 끝내지 말고, 실제 렌더링 결과를 눈으로 확인한 뒤 보고

## 작업 관리

### TODO.md (필수 준수)

**`TODO.md` 파일을 작업 진행의 단일 진실 공급원(Single Source of Truth)으로 사용한다.**

1. **작업 시작 전**: `TODO.md`를 읽고 현재 진행할 태스크 확인
2. **작업 완료 후**: 해당 태스크를 `[x]`로 체크하고 진행률 업데이트
3. **새 작업 추가 시**: 적절한 Phase에 태스크 추가
4. **매 세션 시작 시**: `TODO.md` 상태 확인 후 이어서 진행

```markdown
# 체크 예시
- [ ] 미완료 태스크
- [x] 완료된 태스크
```

### 상세 계획

- 전체 로드맵: `.claude/plans/twinkling-soaring-coral.md`
- 작업 체크리스트: `TODO.md` (루트)
