# TODO.md — 작업 진행 체크리스트

> 마지막 업데이트: 2026-02-07
> 크기: S(1-2h) M(2-4h) L(4-8h) XL(8h+)

---

## Phase 1: 프로젝트 초기화 & 인프라

- [x] **1.1** 루트 정리 — `.gitignore` Node.js용 업데이트 (`S`)
- [x] **1.2** Next.js 15 프로젝트 생성 (`M`)
- [x] **1.3** Tailwind CSS v3 + tailwind.config.js (`S`)
- [x] **1.4** shadcn/ui 초기화 + 14개 컴포넌트 (`M`)
- [x] **1.5** ESLint 9 + Prettier 설정 (`S`)
- [x] **1.6** Drizzle ORM 설정 (`M`)
- [x] **1.7** Supabase 클라이언트 연결 (`S`)
- [x] **1.8** DB 스키마 설계 (13개 테이블) (`XL`)
- [x] **1.9** Supabase Auth 설정 — 이메일/카카오/구글 (`L`)
- [x] **1.10** 인증 페이지 UI — 로그인/회원가입 (`M`) — `/login`, `/signup` 페이지 + 유효성검증
- [x] **1.11** 인증 미들웨어 (`M`)
- [x] **1.12** 대시보드 레이아웃 — 사이드바 + 헤더 + 8개 페이지 껍데기 (`L`)
- [x] **1.13** Vitest 설정 (`S`) — vitest.config.ts, vitest.setup.ts, safety-stock.test.ts (21 테스트)
- [x] **1.14** CLAUDE.md 업데이트 (`S`)

---

## Phase 2: 데이터 레이어 & SCM 비즈니스 로직

- [x] **2.1** 제품(Product/SKU) CRUD (`L`) — Server Actions + 등록/수정/삭제 다이얼로그
- [x] **2.2** 공급자(Supplier) CRUD (`M`) — Server Actions + 등록/수정 다이얼로그
- [x] **2.3** 재고(Inventory) 관리 (`L`) — 서비스 모듈 + Server Actions
- [x] **2.4** 판매 데이터(SalesRecord) 관리 (`M`) — Server Actions + 통계 함수
- [x] **2.5** 안전재고 계산 서비스 (`M`) — `src/server/services/scm/safety-stock.ts`
- [x] **2.6** 발주점 계산 서비스 (`M`) — `src/server/services/scm/reorder-point.ts`
- [x] **2.7** 재고상태 분류 서비스 — 7단계 통일 (`M`) — `src/server/services/scm/inventory-status.ts`
- [x] **2.8** ABC/XYZ 등급 자동 계산 (`L`) — `src/server/services/scm/abc-xyz-analysis.ts`
- [x] **2.9** Excel 데이터 임포트 (`XL`) — 판매/제품 임포트 + 템플릿 + UI (Settings → 데이터 관리)
- [x] **2.10** 시드 데이터 생성 (`M`) — 조직/공급자/제품/재고/판매 시드
- [x] **2.11** EOQ 계산 서비스 (`M`) — `src/server/services/scm/eoq.ts` (4.10에서 이동)

---

## Phase 3: 대시보드 & 분석

- [x] **3.1** 대시보드 요약 카드 (`M`) — KPI 카드 4개 구현
- [x] **3.2** 재고상태 분포 차트 (`M`) — SVG 도넛 차트 (Recharts 미사용)
- [x] **3.3** 긴급/발주필요 테이블 (`M`) — 발주 필요 품목 목록
- [x] **3.4** ABC/XYZ 분석 페이지 (`L`) — 요약 카드, 3x3 매트릭스, 제품 테이블, 정책 가이드
- [x] **3.5** 재고회전율 분석 (`M`) — 탭 통합, 회전율 테이블, 분포 차트
- [x] **3.6** KPI 대시보드 (`L`) — KPI 카드, 스파크라인, Settings 탭 통합
- [x] **3.7** KPI 개선 제안 (`M`) — 제안 생성 서비스 + 카드 컴포넌트 + Settings 탭 통합
- [x] **3.8** 최근 활동 피드 (`S`) — 대시보드 하단
- [x] **3.9** 빠른 액션 버튼 (`S`) — 대시보드 상단

---

## Phase 4: 발주 시스템

- [x] **4.1** 발주 필요 품목 목록 (`L`) — Server Actions + 발주 추천 서비스
- [x] **4.2** 개별 발주 실행 (`L`) — 발주 다이얼로그 + 폼
- [x] **4.3** 일괄 발주 (`M`) — 공급자별 그룹화 + 일괄 발주 다이얼로그 (createBulkPurchaseOrders)
- [x] **4.4** 발주서 Excel 다운로드 (`M`) — order-export.ts + excel-export.ts + 다운로드 버튼
- [x] **4.5** 발주 현황 조회 (`L`) — Orders 페이지 탭 + 테이블
- [x] **4.6** 입고 확인 처리 (`M`) — confirmInbound Server Action + InboundDialog + OrderDetailDialog
- [x] **4.7** 수요 예측 서비스 (`L`) — SMA/SES/Holt's, 자동 선택, MAPE/MAE/RMSE (8개 파일)
- [x] **4.8** 발주 스코어링 (`L`) — order-scoring.ts + 재고긴급도(40) + ABC등급(30) + 판매추세(20) + 리드타임(10)
- [x] **4.9** 자동 발주 목록 + 승인 UI (`L`) — AutoReorderRecommendationsTable + "자동발주" 탭 + 일괄 승인/거부 Server Actions
- [ ] ~~**4.10** EOQ 계산~~ → 2.11로 이동

---

## Phase 5: 시뮬레이션 & AI

- [x] **5.1** 판매 추이 시각화 (`M`)
- [x] **5.2** 시나리오 시뮬레이션 (`XL`)
- [x] **5.3** 재고 최적화 추천 (`M`)
- [x] **5.4** AI 채팅 기본 설정 (`L`)
- [x] **5.5** AI 채팅 UI (`M`)
- [x] **5.6** AI 도구 호출 (`L`)
- [x] **5.7** AI 규칙 기반 폴백 (`M`)

---

## Phase 6: 설정 & 알림 & 운영 준비

- [x] **6.1** 조직 정보 관리 (`M`)
- [x] **6.2** 사용자/권한 관리 (`L`)
- [x] **6.3** 발주 정책 설정 (`M`)
- [x] **6.4** API 키 관리 (`S`)
- [x] **6.5** 이메일 알림 — Resend (`M`)
- [x] **6.6** SMS 알림 — CoolSMS (`M`)
- [x] **6.7** RLS 정책 검증 + 보안 테스트 (`L`)
- [x] **6.8** Upstash Redis 캐싱 (`M`)
- [x] **6.9** 성능 최적화 (`L`)
- [x] **6.10** E2E 테스트 — Playwright (`L`)
- [x] **6.11** Vercel 배포 (`M`) — vercel.json, docs/DEPLOY.md, 환경변수 검증, 헬스체크 API, 빌드 최적화
- [x] **6.12** Railway 백그라운드 잡 (`M`)

---

## Phase 7: 결제 & 런칭

- [x] **7.1** PortOne + 토스페이먼츠 연동 (`XL`)
- [x] **7.2** 구독 플랜 관리 (`L`)
- [x] **7.3** 플랜별 제한 적용 (`M`)
- [x] **7.4** PostHog 분석 세팅 (`M`)
- [x] **7.5** Sentry 에러 추적 (`S`)
- [x] **7.6** 랜딩 페이지 (`XL`)
- [x] **7.7** 런칭 체크리스트 (`M`)

---

## Phase 8: 데이터 온보딩 & 컬럼 매핑 위자드

- [x] **8.1** DB 스키마 — onboarding_sessions, onboarding_files, column_mapping_profiles 3개 테이블 (`M`)
- [x] **8.2** 타입 정의 — `src/types/onboarding.ts` (`S`)
- [x] **8.3** 필드 정의 레지스트리 — 5가지 데이터 유형별 FlowStok 필드 + 별칭 (`M`)
- [x] **8.4** 자동 매핑 알고리즘 — confidence 기반 (정확일치100/대소문자95/포함80/타입추론55) (`L`)
- [x] **8.5** 파일 분석 서비스 — 기존 parser.ts 래핑, 헤더 타입 추론 (`M`)
- [x] **8.6** 매핑 실행 서비스 — 매핑 적용 + 데이터 변환 + 검증 (`M`)
- [x] **8.7** Server Actions — 세션/파일/분석/매핑/임포트/프로필 CRUD (`L`)
- [x] **8.8** 위자드 UI — 5단계 (회사정보→업로드→분석→매핑→임포트) (`XL`)
- [x] **8.9** 매핑 프로필 저장/불러오기 다이얼로그 (`M`)
- [x] **8.10** 단위 테스트 — auto-mapper 11개 테스트 (`S`)
- [x] **8.11** DB 마이그레이션 적용 + 빌드 확인 (`S`)

---

## 진행률 요약

| Phase | 완료 | 전체 | 진행률 |
|-------|------|------|--------|
| Phase 1 | 14 | 14 | 100% |
| Phase 2 | 11 | 11 | 100% |
| Phase 3 | 9 | 9 | 100% |
| Phase 4 | 9 | 9 | 100% |
| Phase 5 | 7 | 7 | 100% |
| Phase 6 | 12 | 12 | 100% |
| Phase 7 | 7 | 7 | 100% |
| Phase 8 | 11 | 11 | 100% |
| **전체** | **80** | **80** | **100%** |


> 마지막 업데이트: 2026-02-08
> - **6.4+6.12 API 키 관리 + Railway 백그라운드 잡 완료**
>   - `src/server/actions/api-keys.ts`: API 키 관리 Server Actions
>     - `createApiKey`: API 키 생성 (SHA-256 해싱, organizations.settings에 저장)
>     - `listApiKeys`: API 키 목록 조회 (마스킹 처리)
>     - `deleteApiKey`: API 키 삭제 (revoke 상태로 변경)
>     - `verifyApiKey`: API 키 검증 (API Routes에서 사용)
>   - `src/app\dashboard\settings\_components\api-key-settings.tsx`: API 키 UI 업데이트
>     - Server Actions 연동 (Mock 데이터 제거)
>     - 생성된 키 한 번만 표시 (보안)
>     - 복사 기능
>   - `src/app/api/cron/auto-reorder/route.ts`: 자동 발주 크론잡
>     - 스케줄: 매일 09:00 KST
>     - 발주점 이하 제품 자동 발주서 생성
>     - 공급자별 그룹화 후 발주서 생성
>   - `src/app/api/cron/inventory-check/route.ts`: 재고 점검 크론잡
>     - 스케줄: 매 6시간
>     - 품절/위험/부족/과다/과잉 재고 알림 생성
>     - 중복 알림 방지 (6시간 내 같은 알림 스킵)
>   - `railway.json`: Railway 배포 설정
>   - `cron.yaml`: Railway Cron 설정 가이드
>   - `docs/RAILWAY_CRON.md`: Railway 백그라운드 잡 설정 가이드 (상세 문서)
>   - `.env.local.example`: CRON_SECRET 환경변수 추가
>
> - **6.1+6.2 조직 정보 관리 + 사용자/권한 관리 완료**
>   - `src/server/actions/users.ts`: 사용자 관리 Server Actions
>     - `getOrganizationUsersAction`: 조직 사용자 목록 조회
>     - `updateUserRoleAction`: 사용자 역할 변경 (admin/manager/viewer)
>     - `removeUserAction`: 사용자 제거 (최소 1명 admin 보장)
>     - `inviteUserAction`: 이메일 기반 사용자 초대
>   - `src/app/dashboard/settings/_components/user-management.tsx`: 사용자 관리 UI
>     - 사용자 목록 테이블 (아바타, 이름, 이메일, 역할, 가입일)
>     - 역할 변경 Select (실시간 업데이트)
>     - 사용자 초대 다이얼로그 (이메일 + 역할 선택)
>     - 사용자 제거 AlertDialog (확인 필요)
>     - 권한 설명 카드 (admin/manager/viewer 차이)
>   - `src/app/dashboard/settings/page.tsx`: "사용자 관리" 탭 연동
>   - 조직 정보 관리는 이미 구현 완료 (organization-tab.tsx, organization-settings.tsx)
>   - 빌드 테스트 성공
>
> - **7.6+7.7 랜딩 페이지 및 런칭 체크리스트 완료**
>   - 랜딩 페이지 컴포넌트 7개 생성 (Hero, Features, Benefits, PricingCards, Testimonials, CTA, Footer)
>   - `src/app/(marketing)/page.tsx`: 메인 랜딩 페이지
>   - `src/app/(marketing)/pricing/page.tsx`: 가격 상세 페이지 (기능 비교 테이블 + FAQ)
>   - `docs/LAUNCH_CHECKLIST.md`: 런칭 전 필수 확인 사항 126개 항목
>   - 대시보드 경로 변경: `/` → `/dashboard` (route group 충돌 해결)
>   - 네비게이션 링크 업데이트: 모든 링크에 `/dashboard` prefix 추가
>   - 빌드 테스트: 타입 에러 수정 완료 (node_modules 재설치 필요)
>     - `get_inventory_status`: 재고 상태 조회 (전체/특정 제품)
>     - `calculate_safety_stock`: 안전재고 계산
>     - `get_reorder_recommendations`: 발주 추천 목록
>     - `get_purchase_order_status`: 발주 현황 조회
>     - `get_abcxyz_analysis`: ABC-XYZ 분석 결과
>     - `get_demand_forecast`: 수요 예측
>   - `src/server/services/ai/fallback.ts`: 규칙 기반 폴백 서비스
>     - 키워드 기반 의도 분류 (8가지 의도 타입)
>     - 실제 DB 조회 기반 폴백 응답 생성
>   - `src/app/api/ai/chat/route.ts`: Claude API + 도구 호출 통합
>     - Anthropic SDK 연동, 시스템 프롬프트 정의
>     - 3단계 폴백 전략 (Claude API -> DB 폴백 -> 정적 응답)
>
> - **7.1+7.2+7.3 PortOne + 토스페이먼츠 결제 시스템 완료**
>   - `@portone/browser-sdk` 패키지 설치
>   - `src/types/subscription.ts`: 구독 플랜 타입 정의 (4개 플랜: free/starter/pro/enterprise) + 플랜별 제한 (maxProducts/maxUsers/maxOrders/aiChatLimit 등)
>   - `src/lib/payment.ts`: PortOne 결제 클라이언트 (결제 요청/검증/취소/플랜 변경/Mock 모드)
>   - `src/lib/plan-limits.ts`: 플랜별 제한 체크 유틸 (checkLimit/checkFeature/getUsageSummary)
>   - `src/server/db/schema/subscriptions.ts`: 구독 테이블 스키마
>   - `src/server/db/schema/payment-history.ts`: 결제 내역 테이블 스키마
>   - API Routes (6개): `/api/payment/checkout`, `/api/payment/verify`, `/api/payment/cancel`, `/api/payment/change-plan`, `/api/payment/webhook`, `/api/payment/request`
>   - 환경변수: `NEXT_PUBLIC_PORTONE_STORE_ID`, `PORTONE_API_SECRET`, `NEXT_PUBLIC_PAYMENT_MOCK`
>   - Mock 모드: 개발/테스트 환경에서 실제 결제 없이 시뮬레이션 가능
>   - Drizzle 마이그레이션 생성 완료 (15개 테이블)
>   - 빌드 테스트: 결제 기능 구현 완료, 일부 기존 파일 타입 오류 수정 (AI 도구, 캐시 서비스)
>   - `REDIS_CACHE_SETUP.md`: 상세 설정 및 사용 가이드 (350줄)
>   - `.env.local.example`: Upstash 환경변수 템플릿 추가
>   - 빌드 테스트 성공 (Next.js 15.5.12) ✓
>   - 캐시 키 컨벤션 정의: `{domain}:{orgId}:{resource}:{identifier}`
>   - TTL 권장사항: 재고(5분), KPI(1시간), ABC분석(24시간), Rate Limit(1시간)
>
> - **6.8 Upstash Redis 캐싱 완료**
>   - `src/lib/redis.ts`: Redis 클라이언트 초기화 및 기본 함수 (getCached, setCached, delCached, checkRateLimit 등)
>   - `src/server/services/cache/keys.ts`: 캐시 키 상수 정의 (CacheKeys, CacheTTL, CachePatterns)
>   - `src/server/services/cache/index.ts`: 캐시 서비스 레이어 (6개 도메인: Inventory, Dashboard, Analysis, Reorder, KPI, Forecast)
>   - `src/server/services/cache.ts`: 레거시 호환성 레이어 (기존 import 경로 유지)
>   - 캐시 TTL 설정: SHORT(5분), MEDIUM(10분), LONG(15분), HOUR(1시간)
>   - 캐시 무효화 패턴: 재고 변경, 판매 기록 추가, 제품 변경, 발주서 변경 시 자동 무효화
>   - Rate Limiting: 사용자(100 req/hour), IP(1000 req/hour)
>   - `.env.local.example`: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN 추가
>   - 패키지: @upstash/redis (이미 설치됨)
>   - 빌드 테스트 성공 (Next.js 15.5.12) ✓
>
> - **6.5+6.6 이메일/SMS 알림 시스템 완료**
>   - `src/lib/notifications.ts`: Resend + CoolSMS 통합 알림 서비스 (500줄)
>   - `src/app/api/notifications/email/route.ts`: 이메일 전송 API
>   - `src/app/api/notifications/sms/route.ts`: SMS 전송 API
>   - `src/app/(dashboard)/settings/_components/notification-test.tsx`: 알림 테스트 UI (500줄)
>   - `.env.local.example`: Resend + CoolSMS 환경변수 템플릿
>   - `NOTIFICATIONS_SETUP.md`: 상세 설정 가이드 (튜토리얼 포함)
>   - 패키지: resend, coolsms-sdk 설치
>   - 3개 이메일 템플릿: 재고 부족, 발주서 생성, 입고 완료
>   - 3개 SMS 템플릿: 재고 부족, 발주서 생성, 입고 완료
>   - Mock 모드 지원 (NOTIFICATIONS_MOCK_MODE=true)
>   - 헬퍼 함수: 이메일/전화번호 유효성 검증, 정규화
>
> - **7.4+7.5 PostHog 분석 + Sentry 에러 추적 완료**
>   - `src/lib/analytics.ts`: PostHog 초기화 + 7개 API 함수
>   - `src/lib/sentry.ts`: Sentry 초기화 + 8개 API 함수
>   - `src/lib/sentry-config.ts`: Sentry 설정 및 필터링 규칙
>   - `src/lib/monitoring.ts`: 통합 모니터링 유틸리티 (10개 함수)
>   - `src/components/analytics-provider.tsx`: 초기화 + 자동 사용자 추적
>   - `.env.local.example`: PostHog + Sentry 환경변수 템플릿
>   - `ANALYTICS_SETUP.md`: 상세 설정 가이드 (튜토리얼 포함)
>   - 패키지: posthog-js, @sentry/nextjs, @sentry/react 설치
>   - 빌드 테스트 성공 (Next.js 15.5.12) ✓
>
> - **5.4+5.5 AI 채팅 기능 완료**
>   - Vercel AI SDK 6 설치 및 설정
>   - Mock 응답 기반 채팅 API (`/api/ai/chat`) — 스트리밍 응답 지원
>   - 채팅 UI 컴포넌트 3개: `ChatInterface`, `ChatMessage`, `ChatInput`
>   - `/chat` 페이지 추가 (대시보드 메뉴에 "AI 채팅" 항목 추가)
>   - 빌드 테스트 성공 (Next.js 15.5.12)

> - **5.1+5.2 판매 추이 시각화 및 시나리오 시뮬레이션 완료**
>   - 판매 추이: 7/30/90일 기간 선택, 일별 판매액/수량 라인 차트
>   - 시나리오 시뮬레이션: 수요 변동(±50%), 리드타임 변동(±10일)
>   - 8가지 시나리오 (기준/사용자설정/수요±20%/리드타임±5일/최악/최선)
>   - 시나리오별 안전재고/발주점 재계산, 재고상태 분석, 비교 차트, 권장사항
>   - `scenario-simulation.ts` 서비스 + `scenario-simulation.tsx` UI
