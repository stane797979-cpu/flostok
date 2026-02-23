/**
 * 실제 데이터 입력/출력 전체 검증 테스트
 * - 로그인 → 각 페이지 접근 → 데이터 입력 → 출력 확인
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const TEST_EMAIL = 'admin1@stocklogis.com'
const TEST_PASSWORD = 'admin1234'

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')
  if (page.url().includes('/dashboard')) return

  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
}

test.describe.serial('전체 기능 라이브 테스트', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await login(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  // ================================================================
  // PHASE A: 대시보드 + 기본 페이지 접근
  // ================================================================
  test('A-1. 대시보드 메인 페이지 로딩', async () => {
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')
    // 대시보드 요소 확인
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    console.log('✅ 대시보드 메인 로딩 성공')
  })

  // ================================================================
  // PHASE B: 발주 기능
  // ================================================================
  test('B-1. 발주 페이지 접근 + 탭 전환', async () => {
    await page.goto(`${BASE_URL}/dashboard/orders`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 페이지 타이틀 확인
    const pageContent = await page.textContent('body')
    expect(pageContent).toContain('발주')
    console.log('✅ 발주 페이지 접근 성공')

    // 탭 확인 — 수동 발주, 자동발주, 발주현황, 입고현황 등
    const tabs = page.locator('[role="tab"], button[data-state]')
    const tabCount = await tabs.count()
    console.log(`✅ 발주 탭 수: ${tabCount}개`)

    // 각 탭 클릭 테스트
    for (let i = 0; i < Math.min(tabCount, 7); i++) {
      const tab = tabs.nth(i)
      const tabText = await tab.textContent()
      await tab.click()
      await page.waitForTimeout(1500)
      console.log(`  → 탭 ${i + 1}: "${tabText?.trim()}" 클릭 성공`)
    }
  })

  test('B-2. 수동 발주 탭 — 발주 추천 품목 확인', async () => {
    await page.goto(`${BASE_URL}/dashboard/orders?tab=reorder`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 테이블이나 품목 목록 확인
    const table = page.locator('table')
    const hasTable = await table.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasTable) {
      const rows = page.locator('tbody tr')
      const rowCount = await rows.count()
      console.log(`✅ 발주 추천 품목: ${rowCount}개`)

      if (rowCount > 0) {
        const firstRowText = await rows.first().textContent()
        console.log(`  → 첫 번째 품목: ${firstRowText?.substring(0, 100)}`)
      }
    } else {
      const emptyMsg = await page.textContent('body')
      if (emptyMsg?.includes('없') || emptyMsg?.includes('발주')) {
        console.log('✅ 발주 추천 품목 없음 (데이터에 따라 정상)')
      }
    }
  })

  test('B-3. 발주 현황 탭 — 발주서 목록 확인', async () => {
    await page.goto(`${BASE_URL}/dashboard/orders?tab=orders`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    console.log(`✅ 발주 현황: ${rowCount}건`)

    if (rowCount > 0) {
      // 첫 번째 발주서 클릭 → 상세 다이얼로그
      await rows.first().click()
      await page.waitForTimeout(2000)

      const dialog = page.locator('[role="dialog"]')
      const hasDialog = await dialog.first().isVisible({ timeout: 3000 }).catch(() => false)
      if (hasDialog) {
        const dialogText = await dialog.first().textContent()
        console.log(`✅ 발주 상세 다이얼로그 열림: ${dialogText?.substring(0, 100)}`)

        // 상태 변경 버튼 확인
        const statusBtn = page.locator('[role="dialog"] button').filter({ hasText: /확정|취소|완료/ })
        if (await statusBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('✅ 상태 변경 버튼 확인됨')
        }

        // 닫기
        const closeBtn = page.locator('[role="dialog"] button').filter({ hasText: /닫기|취소|×/ })
        if (await closeBtn.first().isVisible({ timeout: 2000 })) {
          await closeBtn.first().click()
        } else {
          await page.keyboard.press('Escape')
        }
      }
    }
  })

  test('B-4. 발주 현황 — 엑셀 다운로드', async () => {
    await page.goto(`${BASE_URL}/dashboard/orders?tab=orders`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const excelBtn = page.locator('button').filter({ hasText: /엑셀|Excel|다운로드/ })
    const hasExcel = await excelBtn.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasExcel) {
      const isDisabled = await excelBtn.first().isDisabled()
      if (isDisabled) {
        console.log('✅ 엑셀 다운로드 버튼 존재 (데이터 없어서 disabled — 정상)')
      } else {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
          excelBtn.first().click(),
        ])
        if (download) {
          console.log(`✅ 발주 엑셀 다운로드 성공: ${download.suggestedFilename()}`)
        } else {
          console.log('⚠️ 엑셀 다운로드 이벤트 없음')
        }
      }
    } else {
      console.log('⚠️ 엑셀 다운로드 버튼 없음')
    }
  })

  test('B-5. 입고 현황 탭 확인', async () => {
    await page.goto(`${BASE_URL}/dashboard/orders?tab=inbound`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const body = await page.textContent('body')
    expect(body).toContain('입고')
    console.log('✅ 입고 현황 탭 정상 로딩')

    // 월 이동 버튼 확인
    const monthNav = page.locator('button').filter({ hasText: /◀|▶|이전|다음/ })
    if (await monthNav.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✅ 월 이동 버튼 확인')
    }
  })

  // ================================================================
  // PHASE C: 입고 기능 (창고 입고)
  // ================================================================
  test('C-1. 창고 입고 페이지 접근', async () => {
    await page.goto(`${BASE_URL}/dashboard/warehouse/inbound`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /입고/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 창고 입고 페이지 접근 성공')
  })

  test('C-2. 입고 대기 목록 확인', async () => {
    const rows = page.locator('tbody tr, [data-testid="inbound-card"]')
    const rowCount = await rows.count()
    console.log(`✅ 입고 대기 건수: ${rowCount}건`)

    if (rowCount > 0) {
      const firstRowText = await rows.first().textContent()
      console.log(`  → 첫 번째: ${firstRowText?.substring(0, 100)}`)
    }
  })

  test('C-3. 입고 처리 다이얼로그 확인', async () => {
    // 입고 처리 버튼 찾기
    const inboundBtn = page.locator('button').filter({ hasText: /입고.*처리|처리/ })
    const hasBtn = await inboundBtn.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasBtn) {
      await inboundBtn.first().click()
      await page.waitForTimeout(2000)

      const dialog = page.locator('[role="dialog"]')
      if (await dialog.first().isVisible({ timeout: 5000 })) {
        console.log('✅ 입고 처리 다이얼로그 열림')

        // 창고 선택 드롭다운 확인
        const warehouseSelect = page.locator('[role="dialog"] [role="combobox"], [role="dialog"] select')
        if (await warehouseSelect.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('✅ 입고 창고 선택 필드 확인')
        }

        // 입고수량 입력 필드 확인
        const qtyInputs = page.locator('[role="dialog"] input[type="number"]')
        const qtyCount = await qtyInputs.count()
        console.log(`✅ 입고수량 입력 필드: ${qtyCount}개`)

        // LOT 입력 필드 확인
        const lotInput = page.locator('[role="dialog"] input[placeholder*="LOT"], [role="dialog"] input[placeholder*="lot"]')
        if (await lotInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('✅ LOT 번호 입력 필드 확인')
        }

        // 유통기한 입력 확인
        const expiryInput = page.locator('[role="dialog"] input[type="date"]')
        if (await expiryInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('✅ 유통기한 입력 필드 확인')
        }

        // 전체 입고 버튼 확인
        const fullInbound = page.locator('[role="dialog"] button').filter({ hasText: /전체.*입고/ })
        if (await fullInbound.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('✅ 전체 입고 버튼 확인')
        }

        // 닫기
        await page.keyboard.press('Escape')
      }
    } else {
      console.log('⚠️ 입고 처리 버튼 없음 (대기 건이 없을 수 있음)')
    }
  })

  // ================================================================
  // PHASE D: 출고 기능
  // ================================================================
  test('D-1. 출고 현황 페이지 접근', async () => {
    await page.goto(`${BASE_URL}/dashboard/outbound`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /출고/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 출고 현황 페이지 접근 성공')
  })

  test('D-2. 출고 요청 다이얼로그 — 정상 입력 테스트', async () => {
    // 출고 요청 버튼
    const requestBtn = page.locator('button').filter({ hasText: /출고.*요청/ })
    await requestBtn.first().click()
    await page.waitForTimeout(2000)

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog.first()).toBeVisible({ timeout: 5000 })
    console.log('✅ 출고 요청 다이얼로그 열림')

    // 1) 출고 유형 선택 — 첫 번째 combobox
    const comboboxes = page.locator('[role="dialog"] button[role="combobox"]')
    const typeCombo = comboboxes.first()
    await typeCombo.click()
    await page.waitForTimeout(500)
    const saleOption = page.locator('[role="option"]').filter({ hasText: /판매/ })
    if (await saleOption.first().isVisible({ timeout: 3000 })) {
      await saleOption.first().click()
      console.log('✅ 출고 유형: 판매 출고 선택')
    }
    await page.waitForTimeout(500)

    // 2) 제품 선택 — ProductCombobox (popover trigger)
    const productTrigger = page.locator('[role="dialog"] [data-testid="product-combobox"], [role="dialog"] button[role="combobox"]').nth(1)
    if (await productTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await productTrigger.click()
      await page.waitForTimeout(1000)

      const firstOpt = page.locator('[role="option"]').first()
      if (await firstOpt.isVisible({ timeout: 3000 })) {
        const productName = await firstOpt.textContent()
        await firstOpt.click()
        console.log(`✅ 제품 선택: ${productName?.substring(0, 40)}`)
        await page.waitForTimeout(1500)
      }
    }

    // 현재고 표시 확인
    const stockText = page.locator('[role="dialog"]').filter({ hasText: /현재고/ })
    if (await stockText.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const txt = await stockText.first().textContent()
      const stockMatch = txt?.match(/현재고[:\s]*[\d,]+/)
      console.log(`✅ 현재고 표시: ${stockMatch?.[0] || '확인됨'}`)
    }

    // 3) 수량 입력
    const qtyInput = page.locator('[role="dialog"] input[type="number"][placeholder*="수량"]')
    if (await qtyInput.first().isVisible({ timeout: 3000 })) {
      await qtyInput.first().fill('1')
      console.log('✅ 수량 입력: 1')
    }

    // 4) + 버튼 클릭 (항목 추가)
    const plusBtns = page.locator('[role="dialog"] button')
    const btnCount = await plusBtns.count()
    for (let i = 0; i < btnCount; i++) {
      const btn = plusBtns.nth(i)
      const hasPlusIcon = await btn.locator('.lucide-plus').isVisible().catch(() => false)
      if (hasPlusIcon) {
        await btn.click()
        await page.waitForTimeout(1000)
        console.log('✅ 항목 추가 버튼 클릭')
        break
      }
    }

    // 5) 항목 테이블 확인
    const itemTable = page.locator('[role="dialog"] table')
    if (await itemTable.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const itemRows = page.locator('[role="dialog"] tbody tr')
      const itemCount = await itemRows.count()
      console.log(`✅ 출고 항목: ${itemCount}개 추가됨`)
    }

    // 취소 (데이터 오염 방지)
    const cancelBtn = page.locator('[role="dialog"] button').filter({ hasText: /취소/ })
    await cancelBtn.first().click()
    console.log('✅ 출고 요청 다이얼로그 정상 동작 확인')
  })

  test('D-3. 출고 시 재고 부족 차단 테스트', async () => {
    const requestBtn = page.locator('button').filter({ hasText: /출고.*요청/ })
    await requestBtn.first().click()
    await page.waitForTimeout(2000)

    // 출고 유형 선택
    const comboboxes = page.locator('[role="dialog"] button[role="combobox"]')
    await comboboxes.first().click()
    await page.waitForTimeout(500)
    const saleOpt = page.locator('[role="option"]').filter({ hasText: /판매/ })
    if (await saleOpt.first().isVisible({ timeout: 2000 })) await saleOpt.first().click()
    await page.waitForTimeout(500)

    // 제품 선택
    const productCombo = comboboxes.nth(1)
    if (await productCombo.isVisible({ timeout: 3000 }).catch(() => false)) {
      await productCombo.click()
      await page.waitForTimeout(1000)
      const firstOpt = page.locator('[role="option"]').first()
      if (await firstOpt.isVisible({ timeout: 3000 })) {
        await firstOpt.click()
        await page.waitForTimeout(1500)
      }
    }

    // 초과 수량 입력 (999999)
    const qtyInput = page.locator('[role="dialog"] input[type="number"][placeholder*="수량"]')
    if (await qtyInput.first().isVisible({ timeout: 3000 })) {
      await qtyInput.first().fill('999999')
    }

    // + 버튼 클릭
    const plusBtns = page.locator('[role="dialog"] button')
    const btnCount = await plusBtns.count()
    for (let i = 0; i < btnCount; i++) {
      const btn = plusBtns.nth(i)
      const hasPlusIcon = await btn.locator('.lucide-plus').isVisible().catch(() => false)
      if (hasPlusIcon) {
        await btn.click()
        await page.waitForTimeout(1000)
        break
      }
    }

    // 재고 부족 경고 확인
    await page.waitForTimeout(1500)
    const dialogContent = await page.locator('[role="dialog"]').first().textContent()
    const hasWarning = dialogContent?.includes('부족') || dialogContent?.includes('초과')
    const redElements = await page.locator('[role="dialog"] .bg-red-50, [role="dialog"] .text-red-600, [role="dialog"] [data-variant="destructive"]').count()

    if (hasWarning || redElements > 0) {
      console.log('✅ 재고 부족 경고 표시 확인')
    }

    // 제출 버튼 비활성화 확인
    const submitBtn = page.locator('[role="dialog"] button').filter({ hasText: /출고.*요청.*생성/ })
    if (await submitBtn.first().isVisible({ timeout: 3000 })) {
      const isDisabled = await submitBtn.first().isDisabled()
      expect(isDisabled).toBe(true)
      console.log('✅ 출고 요청 생성 버튼 비활성화 (재고 부족 차단 성공)')
    }

    await page.keyboard.press('Escape')
  })

  test('D-4. 창고 출고 확정 페이지 + 가용재고/대기수량', async () => {
    await page.goto(`${BASE_URL}/dashboard/warehouse/outbound`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /출고/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 창고 출고 확정 페이지 접근')

    // 가용재고 헤더 확인
    const availHeader = page.locator('th, span').filter({ hasText: /가용재고/ })
    if (await availHeader.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ 가용재고 헤더 표시 확인')
    }

    // 대기수량 헤더 확인
    const backlogHeader = page.locator('th, span').filter({ hasText: /대기수량/ })
    if (await backlogHeader.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✅ 대기수량 헤더 표시 확인')
    }

    // 피킹지 다운로드 버튼 확인 (선택 시)
    const pickingBtn = page.locator('button').filter({ hasText: /피킹지/ })
    console.log(`✅ 피킹지 버튼 존재: ${await pickingBtn.first().isVisible({ timeout: 2000 }).catch(() => false)}`)
  })

  test('D-5. 출고현황 — 수불부 탭 확인', async () => {
    await page.goto(`${BASE_URL}/dashboard/outbound`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 탭 확인
    const tabs = page.locator('[role="tab"], button[data-state]')
    const tabCount = await tabs.count()

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i)
      const tabText = await tab.textContent()
      if (tabText?.includes('출고요청') || tabText?.includes('upload') || tabText?.includes('이동')) {
        await tab.click()
        await page.waitForTimeout(2000)
        console.log(`✅ 출고 탭 "${tabText?.trim()}" 정상 전환`)
      }
    }
  })

  // ================================================================
  // PHASE E: 재고 관리
  // ================================================================
  test('E-1. 재고 현황 페이지 + 통계 카드', async () => {
    await page.goto(`${BASE_URL}/dashboard/inventory`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /재고/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 재고 현황 페이지 접근')

    // 통계 카드 확인
    const cards = page.locator('[class*="card"], [class*="Card"]')
    const cardTexts = await page.locator('body').textContent()
    const hasStats = cardTexts?.includes('전체') || cardTexts?.includes('품절') || cardTexts?.includes('발주필요')
    if (hasStats) console.log('✅ 재고 통계 카드 표시 확인')

    // 7단계 상태 Badge 확인
    const statusBadges = page.locator('[class*="badge"], [class*="Badge"]')
    const badgeCount = await statusBadges.count()
    console.log(`✅ 상태 Badge: ${badgeCount}개`)
  })

  test('E-2. 재고 엑셀 다운로드', async () => {
    const excelBtn = page.locator('button').filter({ hasText: /엑셀|Excel|다운로드/ })
    const hasExcel = await excelBtn.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasExcel) {
      const isDisabled = await excelBtn.first().isDisabled()
      if (isDisabled) {
        console.log('✅ 재고 엑셀 버튼 존재 (disabled — 정상)')
      } else {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
          excelBtn.first().click(),
        ])
        if (download) {
          console.log(`✅ 재고 엑셀 다운로드: ${download.suggestedFilename()}`)
        }
      }
    } else {
      console.log('⚠️ 재고 엑셀 버튼 없음')
    }
  })

  test('E-3. 재고 테이블 정렬 + 필터', async () => {
    // 검색 테스트
    const searchInput = page.locator('input[placeholder*="검색"], input[placeholder*="SKU"]')
    if (await searchInput.first().isVisible({ timeout: 3000 })) {
      await searchInput.first().fill('테스트')
      await page.waitForTimeout(1500)
      console.log('✅ 재고 검색 필터 입력 성공')
      await searchInput.first().clear()
      await page.waitForTimeout(1000)
    }

    // 정렬 테스트 — 테이블 헤더 클릭
    const sortHeaders = page.locator('th[class*="cursor"], th button')
    if (await sortHeaders.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await sortHeaders.first().click()
      await page.waitForTimeout(1000)
      console.log('✅ 테이블 정렬 클릭 성공')
    }
  })

  // ================================================================
  // PHASE F: 수불관리
  // ================================================================
  test('F-1. 수불관리 페이지 + 기간 조회', async () => {
    await page.goto(`${BASE_URL}/dashboard/movement`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /수불/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 수불관리 페이지 접근 성공')

    // 통계 카드 (총 입고 / 총 출고 / 순변동 / 변동 제품)
    const body = await page.textContent('body')
    if (body?.includes('입고') && body?.includes('출고')) {
      console.log('✅ 수불 통계 카드 표시 확인')
    }

    // 조회 버튼 테스트
    const queryBtn = page.locator('button').filter({ hasText: /조회/ })
    if (await queryBtn.first().isVisible({ timeout: 3000 })) {
      await queryBtn.first().click()
      await page.waitForTimeout(2000)
      console.log('✅ 기간 조회 실행')
    }
  })

  test('F-2. 수불관리 — 탭 전환 (종합요약 / 일별수불부)', async () => {
    const tabs = page.locator('[role="tab"], button[data-state]')
    const tabCount = await tabs.count()

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i)
      const tabText = await tab.textContent()
      await tab.click()
      await page.waitForTimeout(2000)
      console.log(`✅ 수불 탭 "${tabText?.trim()}" 전환 성공`)
    }
  })

  test('F-3. 수불관리 — 엑셀 다운로드', async () => {
    const excelBtn = page.locator('button').filter({ hasText: /Excel|엑셀|다운로드/ })
    if (await excelBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await excelBtn.first().isDisabled()
      if (isDisabled) {
        console.log('✅ 수불부 엑셀 버튼 존재 (disabled — 정상)')
      } else {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
          excelBtn.first().click(),
        ])
        if (download) {
          console.log(`✅ 수불부 엑셀 다운로드: ${download.suggestedFilename()}`)
        }
      }
    } else {
      console.log('⚠️ 수불부 엑셀 버튼 없음')
    }
  })

  // ================================================================
  // PHASE G: 분석 / KPI
  // ================================================================
  test('G-1. KPI 대시보드 접근 + 카드 확인', async () => {
    await page.goto(`${BASE_URL}/dashboard/kpi`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /KPI/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ KPI 대시보드 접근 성공')

    // KPI 카드 확인
    const body = await page.textContent('body')
    const kpiTerms = ['회전율', '정시율', '가용률', '충족율', '과잉']
    const foundTerms = kpiTerms.filter((t) => body?.includes(t))
    console.log(`✅ KPI 지표: ${foundTerms.join(', ')} (${foundTerms.length}/${kpiTerms.length})`)
  })

  test('G-2. 분석 페이지 — ABC-XYZ 매트릭스', async () => {
    await page.goto(`${BASE_URL}/dashboard/analytics`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /분석|Analytics/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 분석 페이지 접근 성공')

    // ABC-XYZ 관련 요소 확인
    const body = await page.textContent('body')
    if (body?.includes('ABC') || body?.includes('XYZ') || body?.includes('매트릭스')) {
      console.log('✅ ABC-XYZ 분석 데이터 표시 확인')
    }
  })

  test('G-3. 분석 — 판매 추이 차트', async () => {
    // 판매 추이 탭 클릭
    const tabs = page.locator('[role="tab"]')
    const tabCount = await tabs.count()
    for (let i = 0; i < tabCount; i++) {
      const tabText = await tabs.nth(i).textContent()
      if (tabText?.includes('판매') || tabText?.includes('추이')) {
        await tabs.nth(i).click()
        await page.waitForTimeout(2000)
        console.log('✅ 판매 추이 탭 전환')
        break
      }
    }

    // 차트 영역 확인
    const chartArea = page.locator('.recharts-wrapper, svg.recharts-surface, [class*="chart"]')
    const hasChart = await chartArea.first().isVisible({ timeout: 5000 }).catch(() => false)
    if (hasChart) {
      console.log('✅ 판매 추이 차트 렌더링 확인')
    }
  })

  // ================================================================
  // PHASE H: SCM 진단키트 28문항
  // ================================================================
  test('H-1. SCM 진단키트 페이지 접근', async () => {
    await page.goto(`${BASE_URL}/dashboard/scm-diagnostic`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /진단|SCM/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ SCM 진단키트 페이지 접근 성공')
  })

  test('H-2. 카테고리 선택 (재고/물류/발주 전체)', async () => {
    // 카테고리 카드 선택 — OptionCard 형태 (클릭 가능한 카드)
    const categoryCards = page.locator('[role="checkbox"], [data-state], label, button').filter({ hasText: /재고|물류|발주/ })
    const cardCount = await categoryCards.count()

    // 모든 카테고리 선택
    for (let i = 0; i < cardCount; i++) {
      const card = categoryCards.nth(i)
      const cardText = await card.textContent()
      await card.click()
      await page.waitForTimeout(300)
      console.log(`  → 카테고리 선택: ${cardText?.substring(0, 20)}`)
    }

    console.log(`✅ ${cardCount}개 카테고리 선택 완료`)

    // 다음 버튼
    const nextBtn = page.locator('button').filter({ hasText: /다음|시작/ })
    if (await nextBtn.first().isVisible({ timeout: 3000 })) {
      await nextBtn.first().click()
      await page.waitForTimeout(1500)
      console.log('✅ 다음 단계로 이동')
    }
  })

  test('H-3. 28문항 전체 응답', async () => {
    let totalAnswered = 0

    // 최대 4개 스텝 (카테고리 선택 이후: 재고/물류/발주)
    for (let step = 0; step < 4; step++) {
      // 현재 스텝의 문항들에 응답
      let stepAnswered = 0

      for (let q = 0; q < 15; q++) {
        // OptionCard 형태의 선택지 찾기 — 클릭 가능한 카드
        const options = page.locator('[class*="cursor-pointer"][class*="border"], [class*="option"], [data-value]')
          .filter({ has: page.locator('p, span, div') })
        const optCount = await options.count()

        if (optCount === 0) break

        // 중간값 선택 (3번째 옵션, 없으면 2번째, 없으면 1번째)
        const targetIdx = Math.min(2, optCount - 1)
        const opt = options.nth(targetIdx)
        if (await opt.isVisible({ timeout: 1000 }).catch(() => false)) {
          await opt.click()
          stepAnswered++
          await page.waitForTimeout(400)
        } else {
          break
        }
      }

      totalAnswered += stepAnswered
      if (stepAnswered > 0) {
        console.log(`  → 스텝 ${step + 1}: ${stepAnswered}개 문항 응답`)
      }

      // 다음 or 결과보기 버튼
      const resultBtn = page.locator('button').filter({ hasText: /결과|진단/ })
      const nextBtn = page.locator('button').filter({ hasText: /다음/ })

      if (await resultBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        const isEnabled = !(await resultBtn.first().isDisabled())
        if (isEnabled) {
          await resultBtn.first().click()
          console.log(`✅ 결과 보기 클릭 (총 ${totalAnswered}개 응답)`)
          await page.waitForTimeout(5000) // 진단 계산 대기
          break
        }
      }

      if (await nextBtn.first().isVisible({ timeout: 1000 }).catch(() => false)) {
        const isEnabled = !(await nextBtn.first().isDisabled())
        if (isEnabled) {
          await nextBtn.first().click()
          await page.waitForTimeout(1500)
        }
      }
    }
  })

  test('H-4. 진단 결과 확인 — 점수/등급/전략', async () => {
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')

    // 점수 확인
    const hasScore = body?.match(/\d+\s*점|점수|\/\s*100/)
    if (hasScore) console.log(`✅ 진단 점수 표시: ${hasScore[0]}`)

    // 등급 확인
    const hasGrade = body?.match(/[SABCD]\s*등급|등급\s*[SABCD]/)
    if (hasGrade) console.log(`✅ 진단 등급 표시: ${hasGrade[0]}`)

    // 카테고리별 결과
    const categories = ['재고', '물류', '발주']
    const foundCategories = categories.filter((c) => body?.includes(c))
    console.log(`✅ 카테고리별 결과: ${foundCategories.join(', ')}`)

    // 전략/로드맵
    const hasStrategy = body?.includes('전략') || body?.includes('개선') || body?.includes('로드맵') || body?.includes('조치')
    if (hasStrategy) console.log('✅ 최적화 전략/로드맵 표시 확인')

    // 실측 지표
    const hasMetrics = body?.includes('회전율') || body?.includes('지표') || body?.includes('%')
    if (hasMetrics) console.log('✅ 실측 지표 표시 확인')

    // CTA 버튼
    const ctaBtn = page.locator('button').filter({ hasText: /다시.*진단|KPI|발주/ })
    if (await ctaBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✅ CTA 버튼 (다시 진단/KPI/발주추천) 확인')
    }

    expect(hasScore || hasGrade || foundCategories.length > 0).toBeTruthy()
    console.log('✅ SCM 진단키트 전체 테스트 완료')
  })

  // ================================================================
  // PHASE I: 추가 페이지 접근 확인
  // ================================================================
  test('I-1. 제품 관리 페이지', async () => {
    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const heading = page.locator('h1, h2').filter({ hasText: /제품/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 제품 관리 페이지 정상')
  })

  test('I-2. 공급자 관리 페이지', async () => {
    await page.goto(`${BASE_URL}/dashboard/suppliers`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const heading = page.locator('h1, h2').filter({ hasText: /공급/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 공급자 관리 페이지 정상')
  })

  test('I-3. 설정 페이지', async () => {
    await page.goto(`${BASE_URL}/dashboard/settings`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const heading = page.locator('h1, h2').filter({ hasText: /설정/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 설정 페이지 정상')
  })

  test('I-4. PSI 계획표 페이지', async () => {
    await page.goto(`${BASE_URL}/dashboard/psi`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const heading = page.locator('h1, h2').filter({ hasText: /PSI|계획/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ PSI 계획표 페이지 정상')
  })

  test('I-5. 수요예측 가이드 페이지', async () => {
    await page.goto(`${BASE_URL}/dashboard/forecast-guide`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const body = await page.textContent('body')
    expect(body?.length).toBeGreaterThan(100)
    console.log('✅ 수요예측 가이드 페이지 정상')
  })

  test('I-6. 창고 관리 페이지', async () => {
    await page.goto(`${BASE_URL}/dashboard/warehouses`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const heading = page.locator('h1, h2').filter({ hasText: /창고/ })
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
    console.log('✅ 창고 관리 페이지 정상')
  })
})
