# Code Reviewer Memory

## Stock & Logis 프로젝트 리뷰 패턴

### 자주 발견되는 문제 패턴
1. **fire-and-forget async 호출 시 `.catch()` 누락** - `checkAndCreateInventoryAlert` 등 Promise 반환 함수를 await 없이 호출할 때 `.catch()` 체인 필요
2. **SVG 차트에서 0 나누기** - `chartData.length - 1`이 0이거나 `maxVal - minVal`이 0일 때 NaN 발생. `Math.max(divisor, 1)` 방어 필요
3. **동일 type 공유 상태 간 알림 중복 방지 로직 한계** - `out_of_stock`과 `critical`이 같은 `stock_critical` type을 공유하여 상태 악화 시 알림 미생성
4. **UI 컴포넌트에서 데이터 캐싱 vs 갱신 트레이드오프** - `productOptions.length === 0` 패턴으로 최초 1회만 로드 시 새 제품/삭제된 제품 반영 안 됨

### DB 스키마 참고
- alerts 테이블: `id, organizationId, type(enum), severity(enum), productId, title, message, actionUrl, isRead, readAt, expiresAt, createdAt`
- alert_type enum: `stock_critical, stock_shortage, stock_excess, order_delay, demand_surge, demand_drop, price_change, supplier_issue, order_pending, inbound_expected, system`
- inventory_status enum (7단계): `out_of_stock, critical, shortage, caution, optimal, excess, overstock`

### 수요예측 서비스 시그니처
- `forecastDemand(input: ForecastInput): ForecastResult` - ForecastInput = `{ history: TimeSeriesDataPoint[], periods: number, xyzGrade?: XYZGrade }`
- `backtestForecast(history: number[], forecastPeriods: number, method?: ForecastMethodType)` - 이력 < periods+3 이면 confidence: "low" 반환
- `TimeSeriesDataPoint = { date: Date, value: number }`

### 재고 변동 타입
- `InventoryChangeTypeKey`: INBOUND_PURCHASE, INBOUND_RETURN, INBOUND_ADJUSTMENT, INBOUND_TRANSFER, OUTBOUND_SALE, OUTBOUND_DISPOSAL, OUTBOUND_ADJUSTMENT, OUTBOUND_TRANSFER, OUTBOUND_SAMPLE, OUTBOUND_LOSS, OUTBOUND_RETURN
- 출고 다이얼로그에서 OUTBOUND_ADJUSTMENT 누락 발견 (2026-02-08)

### xlsx 동적 import 변환 패턴 (2026-02-11)
- lazy 초기화: `let _xlsx | null = null; async function getXLSX()` 패턴 사용 중
- `require("xlsx")` 잔존: `product-import.ts:createProductTemplate`, `sales-import.ts:createSalesTemplate` - 빌드 실패 원인
- barrel `index.ts`가 `export *`로 re-export하면 tree-shaking 실패 가능성 있음
- 동적 import된 async 함수 호출부에서 await 누락 주의
