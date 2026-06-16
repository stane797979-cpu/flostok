# Flostok 시스템 플로우차트

## Figma에서 열기

### 방법 1: SVG 직접 임포트 (권장)
1. Figma 열기 → File > Place Image
2. `flostok-flowchart.svg` 선택
3. 캔버스에 배치 → 더블클릭하면 벡터 편집 가능

### 방법 2: FigJam에서 Mermaid 사용
1. FigJam 열기
2. 좌측 툴바 → Shape → Mermaid 선택 (또는 `/mermaid` 입력)
3. 아래 코드 붙여넣기

### 방법 3: Figma 플러그인
- **"Diagram"** 플러그인: Mermaid 코드 임포트 가능
- **"Autoflow"** 플러그인: 플로우 연결 자동화

---

## Mermaid 코드

```mermaid
flowchart TD
    %% ============ 인증 ============
    USER([👤 방문자]) --> CLERK[🔐 Clerk Auth\n소셜/이메일 인증]
    CLERK --> ORG[🏢 조직 선택\n멀티테넌트]
    ORG --> DASH[📊 대시보드\nKPI 요약]

    %% ============ 메뉴 ============
    DASH --> PROD_MENU[제품관리]
    DASH --> INV_MENU[재고관리]
    DASH --> ANA_MENU[분석·예측]
    DASH --> PSI_MENU[PSI 계획]
    DASH --> SUP_MENU[공급자관리]
    DASH --> ORD_MENU[발주관리]

    %% ============ 제품관리 ============
    subgraph PRODUCT [📦 제품 마스터 관리]
        PROD_MENU --> PROD_LIST[제품 목록\nSKU / 카테고리 / 공급자]
        PROD_LIST --> PROD_DETAIL[제품 상세\n원가/판가/리드타임]
        PROD_LIST --> ABC_SET[ABC 등급 설정]
        PROD_DETAIL --> SS_PARAM[안전재고 파라미터\n서비스율 Z · 리드타임]
        SS_PARAM --> SS_CALC[📐 안전재고 산출\nSS = Z × σd × √LT\nσ = 1.25 × MAD]
    end

    %% ============ 재고관리 ============
    subgraph INVENTORY [🏭 재고 관리]
        INV_MENU --> INV_DASH[재고 현황 대시보드\n현재고 / 가용재고 / 예약]
        INV_DASH --> STATUS{재고 상태}
        STATUS --> |"⚫품절"| OUT[out_of_stock]
        STATUS --> |"🔴위험"| CRIT[critical]
        STATUS --> |"🟡주의"| CAUT[caution]
        STATUS --> |"🟢적정"| OPT[optimal]
        STATUS --> |"🔵과다"| EXC[excess]
        INV_DASH --> IN_PROC[입고 처리]
        INV_DASH --> OUT_PROC[출고 처리]
        IN_PROC & OUT_PROC --> INV_HIST[재고 이력 추적]
    end

    %% ============ 분석·예측 ============
    subgraph ANALYTICS [📈 분석 · 수요예측]
        ANA_MENU --> ABC_ANA[ABC 분류\n파레토 매출 기반]
        ANA_MENU --> XYZ_ANA[XYZ 분류\nCV 변동계수 기반]
        ANA_MENU --> FMR_ANA[FMR 분류\n월 출고빈도 F≥10 M4~9 R≤3]
        ABC_ANA & XYZ_ANA & FMR_ANA --> COMB[🎯 3중 분류 조합\nABC × XYZ × FMR\n27가지 전략]
        COMB --> FORECAST[🔮 수요예측 엔진]
        FORECAST --> SMA[SMA\n3개월 이동평균]
        FORECAST --> SES[SES\nCV 기반 α 자동선택]
        FORECAST --> HOLTS[Holt's\n이중지수평활]
        SMA & SES & HOLTS --> MAPE[📊 MAPE 평가\n최적 모델 선택]
        MAPE --> POLICY[재고 전략 가이드\n등급별 발주전략]
    end

    %% ============ PSI 계획 ============
    subgraph PSI [📋 PSI 계획]
        PSI_MENU --> PSI_INPUT[수요 입력\n예측값 / 수동]
        PSI_INPUT --> PSI_PROD[생산 계획\nLOT / 리드타임]
        PSI_PROD --> PSI_INV[재고 계획\n기말=기초+생산-판매]
        PSI_INV --> PSI_TABLE[월별 PSI 테이블\n12개월 / Excel 내보내기]
    end

    %% ============ 공급자 ============
    subgraph SUPPLIER [🤝 공급자 관리]
        SUP_MENU --> SUP_LIST[공급자 목록\n업체명/연락처/리드타임]
        SUP_LIST --> SUP_PERF[성과 평가\n납기율 · 불량률]
        SUP_LIST --> SUP_PROD[연결 제품\n공급 SKU]
    end

    %% ============ 발주관리 ============
    subgraph ORDER [🛒 발주 관리]
        ORD_MENU --> ROP_TRIG[발주 추천 트리거\n재고 ≤ ROP]
        ROP_TRIG --> EOQ_CALC[발주량 계산\nEOQ / 안전재고 보충]
        EOQ_CALC --> APPROVE{승인 결정}
        APPROVE --> |확정| CONFIRM[발주 확정]
        APPROVE --> |보류| HOLD[발주 보류]
        CONFIRM --> RECEIPT[입고 확정\n→ 재고 자동 증가]
    end

    %% ============ AI 어시스턴트 ============
    subgraph AI [🤖 AI 어시스턴트 Claude claude-sonnet-4-6]
        AI_DIAG[재고 진단\n위험 제품 · 조치 우선순위]
        AI_FORE[수요예측 해석\n근거 설명 · 신뢰도]
        AI_OPT[발주 최적화\nEOQ · 타이밍]
        AI_SIM[PSI 시뮬레이션\n시나리오 비교]
        AI_NL[자연어 질의\nTool Use 기반]
    end

    %% ============ 크로스 플로우 ============
    MAPE -->|예측값 활용| PSI_INPUT
    INV_DASH -->|ROP 도달| ROP_TRIG
    RECEIPT -->|재고 증가| INV_DASH
    SS_CALC -->|SS 반영| EOQ_CALC
    SUP_LIST -->|리드타임 반영| SS_PARAM

    DASH <--> AI_DIAG
    ANALYTICS <--> AI_FORE
    ORDER <--> AI_OPT
    PSI <--> AI_SIM
    DASH <--> AI_NL

    %% ============ 스타일 ============
    classDef auth fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    classDef core fill:#1e293b,stroke:#334155,color:white
    classDef product fill:#dcfce7,stroke:#22c55e,color:#14532d
    classDef inventory fill:#f3e8ff,stroke:#a855f7,color:#581c87
    classDef analytics fill:#ffedd5,stroke:#fb923c,color:#7c2d12
    classDef psi fill:#d1fae5,stroke:#34d399,color:#064e3b
    classDef supplier fill:#e0f2fe,stroke:#38bdf8,color:#0c4a6e
    classDef order fill:#fee2e2,stroke:#f87171,color:#7f1d1d
    classDef ai fill:#fdf4ff,stroke:#d946ef,color:#701a75
    classDef algo fill:#fef9c3,stroke:#fde047,color:#713f12
    classDef status fill:#f1f5f9,stroke:#94a3b8,color:#374151

    class USER,CLERK,ORG auth
    class DASH core
    class PROD_LIST,PROD_DETAIL,ABC_SET,SS_PARAM product
    class SS_CALC algo
    class INV_DASH,IN_PROC,OUT_PROC,INV_HIST inventory
    class OUT,CRIT,CAUT,OPT,EXC status
    class ABC_ANA,XYZ_ANA,FMR_ANA,COMB,FORECAST,SMA,SES,HOLTS,MAPE,POLICY analytics
    class PSI_INPUT,PSI_PROD,PSI_INV,PSI_TABLE psi
    class SUP_LIST,SUP_PERF,SUP_PROD supplier
    class ROP_TRIG,EOQ_CALC,CONFIRM,HOLD,RECEIPT order
    class AI_DIAG,AI_FORE,AI_OPT,AI_SIM,AI_NL ai
```

---

## 핵심 알고리즘 요약

| 구분 | 공식/기준 | 비고 |
|------|-----------|------|
| **SMA** | F(t) = (D(t-1)+D(t-2)+D(t-3)) / 3 | 3개월 슬라이딩 이동평균 |
| **SES** | F(t+1) = α×D(t) + (1-α)×F(t) | CV 기반 α 자동선택 |
| **Holt's** | Level + Trend 이중 지수평활 | 추세 데이터에 적합 |
| **표준편차** | σ = 1.25 × MAD | 이상치 강건 추정 |
| **안전재고** | SS = Z × σd × √LT | 방식 1/2/3 자동 선택 |
| **CV→α** | X(CV<0.2)→0.6, Y→0.4, Z(CV>0.5)→0.2 | 변동성 클수록 α 작게 |
| **FMR** | F≥10회/월, M=4~9회, R≤3회 | 월 출고빈도 기준 |
| **3중분류** | ABC × XYZ × FMR = 27가지 | 전략 매트릭스 |
