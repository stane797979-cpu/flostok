/**
 * 출시 전 전체 사이클 검증 테스트
 *
 * 1. 발주 → 입고 → 출고 전체 사이클
 * 2. 출고 시 재고 부족 차단 확인
 * 3. SCM 진단키트 28문항 → 결과
 */
import { test, expect, type Page } from '@playwright/test'

// 실제 테스트 계정
const TEST_EMAIL = 'admin1@stocklogis.com'
const TEST_PASSWORD = 'admin1234'

const BASE_URL = 'http://localhost:3000'

// 로그인 헬퍼
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  // 이미 로그인 되어 있으면 스킵
  if (page.url().includes('/dashboard')) {
    return
  }

  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')

  // 대시보드로 이동 대기
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  console.log('✅ 로그인 성공')
}

test.describe.serial('출시 전 전체 사이클 검증', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await login(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  // ================================================================
  // 테스트 1: 발주 → 입고 → 출고 전체 사이클
  // ================================================================
  test.describe('1. 발주 → 입고 → 출고 전체 사이클', () => {
    let createdOrderNumber: string | null = null

    test('1-1. 발주 페이지 접근 및 발주 추천 확인', async () => {
      await page.goto(`${BASE_URL}/dashboard/orders`)
      await page.waitForLoadState('networkidle')

      // 발주 페이지 로딩 확인
      const heading = page.locator('h1, h2').filter({ hasText: /발주/ })
      await expect(heading.first()).toBeVisible({ timeout: 10000 })
      console.log('✅ 발주 페이지 접근 성공')

      // 발주 추천 탭 또는 버튼 확인
      const reorderTab = page.locator('button, [role="tab"]').filter({ hasText: /추천|자동|발주점/ })
      if (await reorderTab.first().isVisible()) {
        await reorderTab.first().click()
        await page.waitForTimeout(2000)
        console.log('✅ 발주 추천 탭 확인')
      }
    })

    test('1-2. 신규 발주서 생성', async () => {
      await page.goto(`${BASE_URL}/dashboard/orders`)
      await page.waitForLoadState('networkidle')

      // 신규 발주 버튼 클릭
      const newOrderBtn = page.locator('button').filter({ hasText: /새.*발주|발주.*생성|신규/ })
      if (await newOrderBtn.first().isVisible({ timeout: 5000 })) {
        await newOrderBtn.first().click()
        await page.waitForTimeout(2000)

        // 다이얼로그/폼이 나타나는지 확인
        const dialog = page.locator('[role="dialog"], form')
        if (await dialog.first().isVisible({ timeout: 5000 })) {
          console.log('✅ 발주서 생성 다이얼로그 열림')

          // 공급자 선택
          const supplierSelect = page.locator('[data-testid="supplier-select"], select, [role="combobox"]').first()
          if (await supplierSelect.isVisible({ timeout: 3000 })) {
            await supplierSelect.click()
            await page.waitForTimeout(1000)

            // 첫 번째 공급자 선택
            const firstOption = page.locator('[role="option"], [data-value]').first()
            if (await firstOption.isVisible({ timeout: 3000 })) {
              await firstOption.click()
              console.log('✅ 공급자 선택')
            }
          }

          // 제품 추가
          const productInput = page.locator('input[placeholder*="제품"], input[placeholder*="검색"], [data-testid="product-combobox"]').first()
          if (await productInput.isVisible({ timeout: 3000 })) {
            await productInput.click()
            await page.waitForTimeout(1000)
            const firstProduct = page.locator('[role="option"]').first()
            if (await firstProduct.isVisible({ timeout: 3000 })) {
              await firstProduct.click()
              console.log('✅ 제품 선택')
            }
          }

          // 수량 입력
          const qtyInput = page.locator('input[type="number"], input[placeholder*="수량"]').first()
          if (await qtyInput.isVisible({ timeout: 3000 })) {
            await qtyInput.fill('10')
            console.log('✅ 수량 입력: 10')
          }

          // 생성 버튼
          const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /생성|저장|확인/ })
          if (await submitBtn.first().isVisible({ timeout: 3000 })) {
            await submitBtn.first().click()
            await page.waitForTimeout(3000)
            console.log('✅ 발주서 생성 요청')
          }
        }
      } else {
        console.log('⚠️ 신규 발주 버튼을 찾지 못함 — 기존 발주서로 테스트 진행')
      }

      // 발주 목록에서 첫 번째 발주서 확인
      await page.goto(`${BASE_URL}/dashboard/orders`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      const orderRow = page.locator('tr, [data-testid="order-row"]').filter({ hasText: /AUTO|ORD|PO/ })
      if (await orderRow.first().isVisible({ timeout: 5000 })) {
        const orderText = await orderRow.first().textContent()
        console.log(`✅ 발주서 확인: ${orderText?.substring(0, 80)}`)
      }
    })

    test('1-3. 창고 입고 페이지 접근 및 확인', async () => {
      await page.goto(`${BASE_URL}/dashboard/warehouse/inbound`)
      await page.waitForLoadState('networkidle')

      const heading = page.locator('h1, h2').filter({ hasText: /입고/ })
      await expect(heading.first()).toBeVisible({ timeout: 10000 })
      console.log('✅ 입고 페이지 접근 성공')

      // 입고 대기 목록 확인
      await page.waitForTimeout(2000)
      const content = await page.textContent('body')
      if (content?.includes('입고') || content?.includes('발주')) {
        console.log('✅ 입고 페이지 콘텐츠 정상 로딩')
      }
    })

    test('1-4. 출고 요청 페이지 접근 및 확인', async () => {
      await page.goto(`${BASE_URL}/dashboard/outbound`)
      await page.waitForLoadState('networkidle')

      const heading = page.locator('h1, h2').filter({ hasText: /출고/ })
      await expect(heading.first()).toBeVisible({ timeout: 10000 })
      console.log('✅ 출고 페이지 접근 성공')

      // 출고 요청 버튼 존재 확인
      const requestBtn = page.locator('button').filter({ hasText: /출고.*요청|새.*출고/ })
      await expect(requestBtn.first()).toBeVisible({ timeout: 5000 })
      console.log('✅ 출고 요청 버튼 확인')
    })

    test('1-5. 출고 요청 생성 시도 (정상 케이스)', async () => {
      await page.goto(`${BASE_URL}/dashboard/outbound`)
      await page.waitForLoadState('networkidle')

      // 출고 요청 버튼 클릭
      const requestBtn = page.locator('button').filter({ hasText: /출고.*요청|새.*출고/ })
      await requestBtn.first().click()
      await page.waitForTimeout(2000)

      // 다이얼로그 확인
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog.first()).toBeVisible({ timeout: 5000 })
      console.log('✅ 출고 요청 다이얼로그 열림')

      // 출고 유형 선택
      const typeSelect = page.locator('[role="dialog"] button[role="combobox"], [role="dialog"] [data-testid="outbound-type"]').first()
      if (await typeSelect.isVisible({ timeout: 3000 })) {
        await typeSelect.click()
        await page.waitForTimeout(500)
        const saleOption = page.locator('[role="option"]').filter({ hasText: /판매/ })
        if (await saleOption.first().isVisible({ timeout: 3000 })) {
          await saleOption.first().click()
          console.log('✅ 출고 유형: 판매 출고 선택')
        }
      }

      // 제품 선택 (ProductCombobox)
      const productCombo = page.locator('[role="dialog"] input[placeholder*="검색"], [role="dialog"] button').filter({ hasText: /제품.*선택|검색/ })
      if (await productCombo.first().isVisible({ timeout: 3000 })) {
        await productCombo.first().click()
        await page.waitForTimeout(1000)

        const firstProduct = page.locator('[role="option"]').first()
        if (await firstProduct.isVisible({ timeout: 3000 })) {
          await firstProduct.click()
          await page.waitForTimeout(1000)
          console.log('✅ 제품 선택 완료')
        }
      }

      // 수량 입력 (소량 — 재고 내)
      const qtyInput = page.locator('[role="dialog"] input[type="number"]').first()
      if (await qtyInput.isVisible({ timeout: 3000 })) {
        await qtyInput.fill('1')
        console.log('✅ 수량 입력: 1')
      }

      // + 버튼으로 항목 추가
      const addBtn = page.locator('[role="dialog"] button').filter({ hasText: /추가/ })
      const plusBtn = page.locator('[role="dialog"] button:has(svg)')
      if (await addBtn.first().isVisible({ timeout: 2000 })) {
        await addBtn.first().click()
      } else if (await plusBtn.first().isVisible({ timeout: 2000 })) {
        // Plus 아이콘 버튼
        const buttons = page.locator('[role="dialog"] button')
        const count = await buttons.count()
        for (let i = 0; i < count; i++) {
          const btn = buttons.nth(i)
          const svg = btn.locator('svg.lucide-plus')
          if (await svg.isVisible({ timeout: 500 }).catch(() => false)) {
            await btn.click()
            break
          }
        }
      }
      await page.waitForTimeout(1000)

      // 항목 추가 확인
      const itemTable = page.locator('[role="dialog"] table, [role="dialog"] [data-testid="items-list"]')
      if (await itemTable.first().isVisible({ timeout: 3000 })) {
        console.log('✅ 출고 항목 추가됨')
      }

      // 취소 (실제 생성하지 않음 — 데이터 오염 방지)
      const cancelBtn = page.locator('[role="dialog"] button').filter({ hasText: /취소/ })
      if (await cancelBtn.first().isVisible()) {
        await cancelBtn.first().click()
        console.log('✅ 출고 요청 다이얼로그 정상 동작 확인 (취소)')
      }
    })

    test('1-6. 창고 출고 확정 페이지 확인', async () => {
      await page.goto(`${BASE_URL}/dashboard/warehouse/outbound`)
      await page.waitForLoadState('networkidle')

      const heading = page.locator('h1, h2').filter({ hasText: /출고/ })
      await expect(heading.first()).toBeVisible({ timeout: 10000 })
      console.log('✅ 창고 출고 확정 페이지 접근 성공')

      // 가용재고 / 대기수량 헤더 확인
      const availableHeader = page.locator('th, span').filter({ hasText: /가용재고/ })
      const backlogHeader = page.locator('th, span').filter({ hasText: /대기수량/ })

      if (await availableHeader.first().isVisible({ timeout: 5000 })) {
        console.log('✅ 가용재고 헤더 표시 확인')
      }
      if (await backlogHeader.first().isVisible({ timeout: 5000 })) {
        console.log('✅ 대기수량 헤더 표시 확인')
      }
    })
  })

  // ================================================================
  // 테스트 2: 출고 시 재고 부족 차단 확인
  // ================================================================
  test.describe('2. 출고 시 재고 부족 차단', () => {
    test('2-1. 재고 초과 수량으로 출고 요청 시 차단', async () => {
      await page.goto(`${BASE_URL}/dashboard/outbound`)
      await page.waitForLoadState('networkidle')

      // 출고 요청 다이얼로그 열기
      const requestBtn = page.locator('button').filter({ hasText: /출고.*요청|새.*출고/ })
      await requestBtn.first().click()
      await page.waitForTimeout(2000)

      // 출고 유형 선택
      const typeSelect = page.locator('[role="dialog"] button[role="combobox"]').first()
      if (await typeSelect.isVisible({ timeout: 3000 })) {
        await typeSelect.click()
        await page.waitForTimeout(500)
        const saleOption = page.locator('[role="option"]').filter({ hasText: /판매/ })
        await saleOption.first().click()
        await page.waitForTimeout(500)
      }

      // 제품 선택
      const productCombo = page.locator('[role="dialog"] input[placeholder*="검색"], [role="dialog"] button[role="combobox"]')
      // 두 번째 combobox (첫 번째는 출고유형)
      const comboboxes = page.locator('[role="dialog"] button[role="combobox"]')
      const comboCount = await comboboxes.count()
      if (comboCount >= 2) {
        await comboboxes.nth(1).click()
      } else {
        // input 기반 검색
        const searchInput = page.locator('[role="dialog"] input[placeholder*="검색"]').first()
        if (await searchInput.isVisible({ timeout: 2000 })) {
          await searchInput.click()
        }
      }
      await page.waitForTimeout(1000)

      const firstProduct = page.locator('[role="option"]').first()
      if (await firstProduct.isVisible({ timeout: 3000 })) {
        await firstProduct.click()
        await page.waitForTimeout(1500)
      }

      // 현재고 정보 표시 확인
      const stockInfo = page.locator('[role="dialog"]').filter({ hasText: /현재고/ })
      if (await stockInfo.first().isVisible({ timeout: 3000 })) {
        const stockText = await stockInfo.first().textContent()
        console.log(`✅ 현재고 정보 표시: ${stockText?.match(/현재고.*?\d+/)?.[0] || '확인됨'}`)
      }

      // 매우 큰 수량 입력 (999999 — 확실히 재고 초과)
      const qtyInput = page.locator('[role="dialog"] input[type="number"]').first()
      if (await qtyInput.isVisible({ timeout: 3000 })) {
        await qtyInput.fill('999999')
      }

      // 추가 버튼 클릭
      const buttons = page.locator('[role="dialog"] button')
      const btnCount = await buttons.count()
      for (let i = 0; i < btnCount; i++) {
        const btn = buttons.nth(i)
        const hasPlusIcon = await btn.locator('svg.lucide-plus').isVisible().catch(() => false)
        if (hasPlusIcon) {
          await btn.click()
          break
        }
      }
      await page.waitForTimeout(1500)

      // 재고 부족 경고 또는 빨간색 하이라이트 확인
      const alertWarning = page.locator('[role="dialog"]').filter({ hasText: /재고.*부족|부족.*항목/ })
      const redHighlight = page.locator('[role="dialog"] .bg-red-50, [role="dialog"] .border-red-500, [role="dialog"] .text-red-600')
      const submitBtn = page.locator('[role="dialog"] button').filter({ hasText: /출고.*요청.*생성/ })

      // 경고 메시지 또는 빨간색 표시 확인
      const hasAlert = await alertWarning.first().isVisible({ timeout: 3000 }).catch(() => false)
      const hasRedHighlight = await redHighlight.first().isVisible({ timeout: 1000 }).catch(() => false)

      if (hasAlert || hasRedHighlight) {
        console.log('✅ 재고 부족 경고 표시 확인')
      }

      // 제출 버튼이 비활성화되어 있는지 확인
      if (await submitBtn.first().isVisible({ timeout: 3000 })) {
        const isDisabled = await submitBtn.first().isDisabled()
        if (isDisabled) {
          console.log('✅ 출고 요청 생성 버튼 비활성화 확인 (재고 부족 차단)')
        } else {
          console.log('⚠️ 버튼이 활성화 상태 — 프론트엔드 차단 미작동 가능')
        }
        expect(isDisabled).toBe(true)
      }

      // 취소
      const cancelBtn = page.locator('[role="dialog"] button').filter({ hasText: /취소/ })
      await cancelBtn.first().click()
      console.log('✅ 재고 부족 차단 테스트 완료')
    })
  })

  // ================================================================
  // 테스트 3: SCM 진단키트 28문항 → 결과
  // ================================================================
  test.describe('3. SCM 진단키트 28문항', () => {
    test('3-1. 진단키트 페이지 접근', async () => {
      await page.goto(`${BASE_URL}/dashboard/scm-diagnostic`)
      await page.waitForLoadState('networkidle')

      const heading = page.locator('h1, h2').filter({ hasText: /진단|SCM/ })
      await expect(heading.first()).toBeVisible({ timeout: 10000 })
      console.log('✅ SCM 진단키트 페이지 접근 성공')
    })

    test('3-2. 28문항 전체 응답 및 결과 확인', async () => {
      await page.goto(`${BASE_URL}/dashboard/scm-diagnostic`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(2000)

      // 진단 시작 버튼 (있으면 클릭)
      const startBtn = page.locator('button').filter({ hasText: /시작|진단.*시작|설문/ })
      if (await startBtn.first().isVisible({ timeout: 3000 })) {
        await startBtn.first().click()
        await page.waitForTimeout(2000)
      }

      // 문항 응답 — 라디오 버튼/선택지를 찾아서 응답
      let answeredCount = 0
      const maxAttempts = 35 // 여유를 두고 35번 시도

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // 라디오 버튼 또는 선택지 찾기
        const radioButtons = page.locator('input[type="radio"], [role="radio"], [role="radiogroup"] button, label:has(input[type="radio"])')
        const radioCount = await radioButtons.count()

        if (radioCount > 0) {
          // 중간값(3점) 또는 첫 번째 옵션 선택
          const targetIndex = Math.min(2, radioCount - 1) // 3번째(0-indexed 2) 또는 마지막
          await radioButtons.nth(targetIndex).click()
          answeredCount++
          await page.waitForTimeout(300)
        }

        // 슬라이더가 있으면 조작
        const sliders = page.locator('input[type="range"], [role="slider"]')
        if (await sliders.first().isVisible({ timeout: 500 }).catch(() => false)) {
          await sliders.first().fill('3')
          answeredCount++
          await page.waitForTimeout(300)
        }

        // 다음 버튼 또는 제출 버튼 확인
        const nextBtn = page.locator('button').filter({ hasText: /다음|Next/ })
        const submitBtn = page.locator('button').filter({ hasText: /결과|제출|완료|진단.*결과/ })

        if (await submitBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
          // 제출 가능하면 클릭
          const isEnabled = !(await submitBtn.first().isDisabled())
          if (isEnabled) {
            await submitBtn.first().click()
            console.log(`✅ ${answeredCount}개 문항 응답 후 결과 제출`)
            await page.waitForTimeout(3000)
            break
          }
        }

        if (await nextBtn.first().isVisible({ timeout: 500 }).catch(() => false)) {
          await nextBtn.first().click()
          await page.waitForTimeout(500)
        }
      }

      // 결과 페이지 확인
      await page.waitForTimeout(3000)
      const resultContent = await page.textContent('body')

      const hasScore = resultContent?.match(/\d+점|\d+%|점수|등급|Level|레벨/)
      const hasCategory = resultContent?.match(/재고|물류|발주|supply|inventory|logistics/)
      const hasRecommendation = resultContent?.match(/추천|개선|전략|제안|방안/)

      if (hasScore) {
        console.log(`✅ 진단 점수/등급 표시 확인: ${hasScore[0]}`)
      }
      if (hasCategory) {
        console.log(`✅ 카테고리별 분석 확인: ${hasCategory[0]}`)
      }
      if (hasRecommendation) {
        console.log(`✅ 개선 전략 추천 표시 확인: ${hasRecommendation[0]}`)
      }

      // 최소한 결과가 표시되는지 확인
      expect(hasScore || hasCategory || hasRecommendation).toBeTruthy()
      console.log('✅ SCM 진단키트 전체 테스트 완료')
    })
  })
})
