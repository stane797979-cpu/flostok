/**
 * 규칙 기반 폴백 응답
 * Anthropic API 실패 시 기본 응답 제공
 */

/**
 * 메시지 키워드 분석
 */
function analyzeMessage(message: string) {
  const lower = message.toLowerCase();
  const keywords = {
    inventory: ['재고', 'inventory', '현재고', '품절'],
    reorder: ['발주', '주문', 'order', '구매', 'purchase'],
    forecast: ['예측', 'forecast', '수요'],
    analysis: ['분석', 'analytics', 'abc', 'xyz'],
    supplier: ['공급자', 'supplier', '협력사', '납품'],
    alert: ['알림', 'alert', 'notification', '경고'],
    status: ['상태', 'status', '현황'],
    help: ['도움', 'help', '안녕', '?', '기능'],
  };

  const matches: string[] = [];
  for (const [key, words] of Object.entries(keywords)) {
    if (words.some((w) => lower.includes(w))) {
      matches.push(key);
    }
  }

  return matches.length > 0 ? matches[0] : 'general';
}

/**
 * 카테고리별 폴백 응답
 */
const fallbackResponses: Record<string, string> = {
  inventory: `재고 관련 정보를 확인하시려면 다음 기능을 이용해주세요:

**대시보드** → 전체 재고 현황 요약
- KPI 카드 (총 재고금액, 품절 품목 수, 발주 필요 품목 등)
- 재고상태 분포 차트
- 긴급/발주필요 품목 테이블

**제품 관리** → 제품별 상세 재고 정보
- 현재고, 안전재고, 발주점
- ABC/XYZ 등급
- 재고일수, 회전율

**분석** → 재고 분석 리포트
- ABC-XYZ 매트릭스
- 재고회전율 분석
- KPI 대시보드

구체적인 제품 코드나 상태를 알려주시면 더 정확한 정보를 제공해드릴 수 있습니다.`,

  reorder: `발주 관련 기능은 다음과 같습니다:

**발주** → 발주 관리 페이지
1. **발주추천** 탭: 발주 필요 품목 자동 분석
   - 우선순위별 정렬
   - 추천 발주량 제공
   - 개별/일괄 발주 실행

2. **AI발주** 탭: AI 기반 자동 발주 추천
   - 발주 스코어링 (100점 만점)
   - 일괄 승인/거부 가능

3. **발주현황** 탭: 발주 이력 조회
   - 상태별 필터 (초안, 승인, 발주, 입고완료)
   - 입고 확인 처리

**발주점 계산 공식**:
\`발주점 = 일평균판매량 × 리드타임(일) + 안전재고\`

특정 제품의 발주가 필요하신가요? 제품 코드를 알려주세요.`,

  forecast: `수요 예측 기능 안내:

**분석** → **시뮬레이션** 탭
- 판매 추이 시각화 (7/30/90일)
- 시나리오 시뮬레이션
  - 수요 변동 (±20%)
  - 리드타임 변동 (±5일)
  - 최악/최선 시나리오

**수요 예측 방법**:
1. **SMA (단순이동평균)**: 단기 예측
2. **SES (단순지수평활)**: 중기 예측
3. **Holt's Method**: 트렌드 반영

예측 정확도(MAPE):
- < 10%: 매우 우수
- 10-20%: 양호
- 20-50%: 보통
- > 50%: 부적합

특정 제품의 수요 예측이 필요하신가요?`,

  analysis: `분석 기능 안내:

**ABC-XYZ 분석**:
- **ABC 등급**: 매출 기여도
  - A등급: 상위 80% 매출 (집중 관리)
  - B등급: 80-95% 매출 (표준 관리)
  - C등급: 95-100% 매출 (최소 관리)

- **XYZ 등급**: 수요 변동성
  - X등급: CV < 0.5 (안정적, 예측 쉬움)
  - Y등급: 0.5 ≤ CV < 1.0 (변동적)
  - Z등급: CV ≥ 1.0 (불규칙, 예측 어려움)

**재고회전율 분석**:
- 재고회전율 = 매출원가 / 평균재고금액
- 재고회전일수 = 365 / 재고회전율

**KPI 대시보드**:
- 서비스 수준, 품절률, 재고일수
- 발주 정확도, 납기 준수율

원하시는 분석 유형을 선택해주세요.`,

  supplier: `공급자 관리 기능:

**공급자 관리** 페이지:
- 공급자 등록/수정/삭제
- 공급자별 제품 매핑
- 리드타임, MOQ, 가격 관리

**공급자 평가 지표**:
| 지표 | 배점 | 설명 |
|------|------|------|
| 납기 준수율 | 30점 | 정시 납품 비율 |
| 품질 합격률 | 25점 | 불량률 |
| 가격 경쟁력 | 20점 | 시장 대비 가격 |
| 대응 속도 | 15점 | 요청~응답 시간 |
| 유연성 | 10점 | 긴급 대응 능력 |

공급자 정보 조회 또는 평가가 필요하신가요?`,

  alert: `알림 기능 안내:

**재고 알림 기준**:
- 🔴 **품절/위험**: 긴급 발주 필요
- 🟠 **부족**: 우선 발주 권장
- 🟡 **주의**: 발주 검토 필요
- 🔵 **과다/과잉**: 판촉 또는 재고 조정

**자동 알림 조건**:
- 재고 부족: 현재고 < 안전재고 × 0.5
- 발주 지연: LT × 1.5일 경과
- 수요 급증: 최근 7일 판매 > 평균 × 2
- 수요 급감: 최근 7일 판매 < 평균 × 0.3

대시보드 상단 벨 아이콘에서 최근 알림을 확인하실 수 있습니다.`,

  status: `현재 시스템 상태 확인:

**대시보드**에서 다음 정보를 제공합니다:
- 📊 총 재고금액
- 📦 총 제품 수
- ⚠️ 품절/발주 필요 품목 수
- 🔄 평균 재고회전율

**재고상태 7단계**:
| 상태 | 조건 | 색상 |
|------|------|------|
| 품절 | 재고 = 0 | ⚫ 검정 |
| 위험 | 0 < 재고 < 안전재고 × 0.5 | 🔴 빨강 |
| 부족 | 안전재고 × 0.5 ≤ 재고 < 안전재고 | 🟠 주황 |
| 주의 | 안전재고 ≤ 재고 < 발주점 | 🟡 노랑 |
| 적정 | 발주점 ≤ 재고 < 안전재고 × 3 | 🟢 초록 |
| 과다 | 안전재고 × 3 ≤ 재고 < 안전재고 × 5 | 🔵 파랑 |
| 과잉 | 재고 ≥ 안전재고 × 5 | 🟣 보라 |

더 구체적인 정보가 필요하신가요?`,

  help: `안녕하세요! FloStok AI 어시스턴트입니다. 😊

**주요 기능**:
1. 📦 **재고 관리**: 실시간 재고 현황, 재고일수, 회전율
2. 🛒 **발주 추천**: AI 기반 자동 발주 추천 및 실행
3. 📈 **수요 예측**: 판매 추이 분석 및 미래 수요 예측
4. 📊 **ABC-XYZ 분석**: 제품 분류 및 맞춤 관리 전략
5. 🏢 **공급자 관리**: 공급자 평가 및 리드타임 관리
6. 🔔 **알림**: 재고 부족/과잉 자동 알림

**질문 예시**:
- "현재 재고 상태는 어때?"
- "발주가 필요한 제품은?"
- "제품 ABC-123의 발주 추천해줘"
- "지난 달 판매 추이를 보여줘"
- "ABC 등급별 재고 현황은?"

무엇을 도와드릴까요?`,

  general: `말씀하신 내용에 대해 다음 정보가 도움이 될 수 있습니다:

**시스템 주요 기능**:
- 📦 재고 관리 (실시간 재고 현황, 상태 모니터링)
- 🛒 발주 시스템 (자동 추천, 일괄 발주)
- 📈 수요 예측 (AI 기반 예측, 시나리오 분석)
- 📊 분석 도구 (ABC-XYZ, 재고회전율, KPI)
- 🏢 공급자 관리 (평가, 리드타임 관리)

더 구체적인 질문을 해주시면 정확한 답변을 드릴 수 있습니다.

예: "제품 A-001의 재고 상태는?", "발주 필요한 품목 보여줘", "ABC 분석 결과는?"`,
};

/**
 * 규칙 기반 폴백 응답 생성
 */
export function generateFallbackResponse(userMessage: string): string {
  const category = analyzeMessage(userMessage);
  return (
    fallbackResponses[category] ||
    fallbackResponses.general ||
    '죄송합니다. 현재 AI 서비스에 일시적인 문제가 있습니다. 메뉴에서 직접 원하시는 기능을 이용해주세요.'
  );
}

/**
 * 에러 유형별 폴백 메시지
 */
export function getErrorFallback(error: unknown): {
  message: string;
  suggestion: string;
} {
  // API 키 누락
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('API key')) {
    return {
      message: 'AI 서비스 설정이 필요합니다.',
      suggestion:
        '환경변수에 ANTHROPIC_API_KEY를 설정해주세요. 설정 방법은 관리자에게 문의하세요.',
    };
  }

  // Rate limit
  const errObj = error as Record<string, unknown>;
  const errMsg = typeof errObj?.message === 'string' ? errObj.message : '';
  if (errObj?.status === 429 || errMsg.includes('rate limit')) {
    return {
      message: 'AI 서비스 사용량 한도에 도달했습니다.',
      suggestion: '잠시 후 다시 시도하거나, 메뉴에서 직접 기능을 이용해주세요.',
    };
  }

  // Network error
  if (errMsg.includes('network') || errMsg.includes('fetch')) {
    return {
      message: '네트워크 연결에 문제가 있습니다.',
      suggestion: '인터넷 연결을 확인하고 다시 시도해주세요.',
    };
  }

  // Timeout
  if (errMsg.includes('timeout')) {
    return {
      message: 'AI 응답 시간이 초과되었습니다.',
      suggestion: '간단한 질문으로 다시 시도하거나, 메뉴에서 직접 기능을 이용해주세요.',
    };
  }

  // Generic error
  return {
    message: 'AI 서비스에 일시적인 문제가 발생했습니다.',
    suggestion: '잠시 후 다시 시도하거나, 메뉴에서 직접 원하시는 기능을 이용해주세요.',
  };
}
