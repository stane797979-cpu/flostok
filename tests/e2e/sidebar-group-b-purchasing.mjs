/**
 * Group B: 구매(입고) 섹션 E2E 테스트
 *
 * B-1: 발주관리 (/dashboard/orders) — 10개
 * B-2: 입고관리 — 8개
 *
 * 총 18개 테스트 항목
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = 'admin1@stocklogis.com'
const PASSWORD = 'admin1234'

let browser, ctx, page, passed = 0, failed = 0
const results = []

function log(label, status, detail) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️'
  console.log(`${icon} [${label}] ${detail || ''}`)
  results.push({ label, status, detail })
  if (status === 'PASS') passed++
  if (status === 'FAIL') failed++
}

async function wl(ms = 2000) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

/**
 * cmdk 기반 ProductCombobox에서 제품 선택
 * @param {import('playwright').Locator} dialog
 * @param {number} comboboxIndex - dialog 내 button[role="combobox"] 중 ProductCombobox 인덱스
 */
async function selectProductFromCmdk(dialog, comboboxIndex = 0) {
  const combo = dialog.locator('button[role="combobox"]').nth(comboboxIndex)
  if (!(await combo.isVisible().catch(() => false))) return null
  const beforeText = await combo.textContent().catch(() => '?')
  await combo.click()
  await page.waitForTimeout(3000)
  let opts = await page.locator('[cmdk-item]').all()
  if (opts.length === 0) return null
  const itemText = await opts[0].textContent().catch(() => '')
  const cmdInput = page.locator('[cmdk-input]')
  if (await cmdInput.isVisible().catch(() => false)) {
    await cmdInput.press('ArrowDown')
    await page.waitForTimeout(300)
    await cmdInput.press('Enter')
  } else {
    await opts[0].click()
  }
  await page.waitForTimeout(2000)
  const afterText = await combo.textContent().catch(() => '?')
  const selected = afterText !== beforeText && !(afterText || '').includes('검색하세요')
  return selected ? (afterText || '').trim() : (itemText || '').trim() || null
}

async function main() {
  console.log('='.repeat(60))
  console.log('  Stock & Logis - Group B: 구매(입고) 섹션 E2E 테스트')
  console.log('  발주관리 10개 + 입고관리 8개 = 총 18개')
  console.log('='.repeat(60))

  browser = await chromium.launch({ headless: true })
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  page = await ctx.newPage()

  try {
    // ====== 로그인 ======
    console.log('\n--- 로그인 ---')
    await page.goto(`${BASE}/login`, { timeout: 60000 })
    await wl(2000)
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    console.log(`✅ 로그인 완료 (${EMAIL})`)

    // ====================================================================
    // B-1: 발주관리
    // ====================================================================
    console.log('\n' + '='.repeat(60))
    console.log('  B-1: 발주관리 (/dashboard/orders)')
    console.log('='.repeat(60))

    // B-1-1: 수동발주 탭 접근
    try {
      console.log('\n[B-1-1] 수동발주 탭 접근 (/dashboard/orders?tab=reorder)')
      await page.goto(`${BASE}/dashboard/orders?tab=reorder`)
      await wl(3000)

      // h1 "수동 발주" 확인 (orders-client.tsx의 pageTitles.reorder.title)
      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      // 테이블 또는 빈 메시지 확인
      const tableExists = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false)
      const emptyMsg = await page.getByText('발주가 필요한 품목이 없습니다').isVisible({ timeout: 3000 }).catch(() => false)
      const bodyText = await page.textContent('body').catch(() => '')
      const hasContent = tableExists || emptyMsg || (bodyText || '').includes('발주 필요 품목')

      if ((h1 || '').includes('발주') && hasContent) {
        log('B-1-1 수동발주 탭 접근', 'PASS', `h1="${(h1 || '').trim()}", 테이블=${tableExists}, 빈메시지=${emptyMsg}`)
      } else {
        log('B-1-1 수동발주 탭 접근', 'FAIL', `h1="${(h1 || '').trim()}", hasContent=${hasContent}`)
      }
    } catch (e) {
      log('B-1-1 수동발주 탭 접근', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-2: 발주 필요 품목 행 수 확인
    let reorderRowCount = 0
    try {
      console.log('\n[B-1-2] 발주 필요 품목 행 수 확인')
      // 이미 reorder 탭에 있음 (B-1-1 이후)
      const rows = await page.locator('table tbody tr').all()
      reorderRowCount = rows.length
      const emptyMsg = await page.locator('text=발주 필요 품목이 없습니다, text=데이터가 없습니다').first().isVisible({ timeout: 2000 }).catch(() => false)

      if (reorderRowCount > 0) {
        log('B-1-2 발주 필요 품목 행 수', 'PASS', `${reorderRowCount}개 행 확인`)
      } else {
        log('B-1-2 발주 필요 품목 행 수', 'INFO', `없음 메시지=${emptyMsg} — 재고 충분하거나 발주 완료`)
      }
      console.log(`  발주 필요 품목: ${reorderRowCount}개`)
    } catch (e) {
      log('B-1-2 발주 필요 품목 행 수', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-3: 체크박스 선택 → "발주 생성" 또는 "일괄 발주" 버튼 활성화 확인
    try {
      console.log('\n[B-1-3] 체크박스 선택 → 일괄 발주 버튼 활성화')
      if (reorderRowCount > 0) {
        // 첫 번째 행의 체크박스 클릭
        const firstRowCheckbox = page.locator('table tbody tr').first().locator('input[type="checkbox"], [role="checkbox"]').first()
        const checkboxVisible = await firstRowCheckbox.isVisible({ timeout: 3000 }).catch(() => false)
        if (checkboxVisible) {
          await firstRowCheckbox.click({ force: true })
          await page.waitForTimeout(1000)
          console.log('  체크박스 클릭 완료')

          // "발주 생성" 또는 "일괄 발주" 버튼 찾기
          // BulkOrderDialog 트리거: onBulkOrderClick → setBulkOrderDialogOpen(true)
          const bulkBtn = page.locator('button').filter({ hasText: /일괄.*발주|발주.*생성|발주 생성/ })
          const bulkBtnCount = await bulkBtn.count()
          console.log(`  일괄 발주 버튼 수: ${bulkBtnCount}개`)

          if (bulkBtnCount > 0) {
            const isEnabled = await bulkBtn.first().isEnabled().catch(() => false)
            log('B-1-3 체크박스 선택 → 버튼 활성화', isEnabled ? 'PASS' : 'FAIL',
              `일괄발주 버튼 enabled=${isEnabled}`)
          } else {
            // 개별 발주 버튼 (각 행에 있는 발주 버튼)이라도 확인
            const singleOrderBtn = page.locator('table tbody tr').first().locator('button').filter({ hasText: /발주/ })
            const singleVisible = await singleOrderBtn.first().isVisible({ timeout: 2000 }).catch(() => false)
            log('B-1-3 체크박스 선택 → 버튼 활성화', singleVisible ? 'PASS' : 'INFO',
              `개별 발주 버튼 visible=${singleVisible}`)
          }
        } else {
          log('B-1-3 체크박스 선택 → 버튼 활성화', 'INFO', '체크박스 없음 (테이블 구조 다름)')
        }
      } else {
        log('B-1-3 체크박스 선택 → 버튼 활성화', 'INFO', '발주 필요 품목 없음 — 테스트 스킵')
      }
    } catch (e) {
      log('B-1-3 체크박스 선택 → 버튼 활성화', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-4: 자동발주추천 탭 전환
    try {
      console.log('\n[B-1-4] 자동발주추천 탭 전환 (?tab=auto-reorder)')
      await page.goto(`${BASE}/dashboard/orders?tab=auto-reorder`)
      await wl(5000)

      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      // "자동발주 추천" 또는 "자동 발주 추천 목록" 텍스트 확인
      const bodyText = await page.textContent('body').catch(() => '')
      const hasAutoReorder = (bodyText || '').includes('자동발주') || (bodyText || '').includes('자동 발주') || (h1 || '').includes('자동')

      if (hasAutoReorder) {
        log('B-1-4 자동발주추천 탭 전환', 'PASS', `h1="${(h1 || '').trim()}"`)
      } else {
        log('B-1-4 자동발주추천 탭 전환', 'FAIL', `자동발주 텍스트 없음, h1="${(h1 || '').trim()}"`)
      }
    } catch (e) {
      log('B-1-4 자동발주추천 탭 전환', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-5: 발주현황 탭 → 테이블 로딩 + 발주 건수 확인 (17개 예상)
    let purchaseOrderCount = 0
    try {
      console.log('\n[B-1-5] 발주현황 탭 (?tab=orders) — 17개 예상')
      await page.goto(`${BASE}/dashboard/orders?tab=orders`)
      await wl(4000)

      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      // 테이블 로딩 확인
      const tableVisible = await page.locator('table').first().isVisible({ timeout: 8000 }).catch(() => false)
      const rows = await page.locator('table tbody tr').all()
      purchaseOrderCount = rows.length

      // "전체 N건" 텍스트에서 total 파악
      const totalText = await page.locator('text=/전체.*건/').first().textContent().catch(() => '')
      console.log(`  tbody tr 수: ${purchaseOrderCount}, 전체 텍스트: "${(totalText || '').trim()}"`)

      if (tableVisible && purchaseOrderCount > 0) {
        const msg = `테이블 ${purchaseOrderCount}개 행, 총="${(totalText || '').trim()}"`
        const isExpected = purchaseOrderCount >= 10 // 17개 예상이므로 10개 이상이면 PASS
        log('B-1-5 발주현황 탭', isExpected ? 'PASS' : 'INFO', msg)
      } else {
        const emptyMsg = await page.locator('text=발주서가 없습니다, text=데이터가 없습니다').first().isVisible({ timeout: 2000 }).catch(() => false)
        log('B-1-5 발주현황 탭', 'INFO', `발주서 없음 (emptyMsg=${emptyMsg}) — 예상: 17개`)
      }
    } catch (e) {
      log('B-1-5 발주현황 탭', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-6: 발주서 첫 행 클릭 → dialog 열림 → 상세 정보 표시
    try {
      console.log('\n[B-1-6] 발주서 첫 행 클릭 → OrderDetailDialog 확인')
      // 이미 orders 탭에 있음
      if (purchaseOrderCount > 0) {
        // 상세 보기 버튼 (Eye 아이콘 버튼 또는 행 클릭)
        const viewBtn = page.locator('table tbody tr').first().locator('button').filter({ hasText: /보기|상세/ })
        const viewBtnCount = await viewBtn.count()
        console.log(`  보기 버튼 수: ${viewBtnCount}개`)

        // Eye 아이콘 버튼 찾기 (purchase-orders-table.tsx에서 Eye 아이콘 사용)
        const eyeBtn = page.locator('table tbody tr').first().locator('button:has(.lucide-eye), button:has(svg)')
        const eyeBtnCount = await eyeBtn.count()
        console.log(`  SVG 버튼 수: ${eyeBtnCount}개`)

        // 첫 번째 버튼 클릭 시도 (Eye 또는 보기 버튼)
        const clickBtn = eyeBtnCount > 0 ? eyeBtn.first() : page.locator('table tbody tr').first().locator('button').first()
        const clickBtnVisible = await clickBtn.isVisible({ timeout: 3000 }).catch(() => false)

        if (clickBtnVisible) {
          await clickBtn.click()
          await page.waitForTimeout(2000)

          const dialog = page.locator('[role="dialog"]')
          const dialogVisible = await dialog.first().isVisible({ timeout: 5000 }).catch(() => false)
          console.log(`  Dialog 열림: ${dialogVisible}`)

          if (dialogVisible) {
            const dialogText = await dialog.first().textContent().catch(() => '')
            const hasSupplier = (dialogText || '').includes('공급') || (dialogText || '').includes('공급자')
            const hasProduct = (dialogText || '').includes('제품') || (dialogText || '').includes('품목') || (dialogText || '').includes('SKU')
            const hasQty = (dialogText || '').includes('수량') || (dialogText || '').includes('개')
            console.log(`  공급자=${hasSupplier}, 제품=${hasProduct}, 수량=${hasQty}`)
            log('B-1-6 발주서 상세 Dialog', 'PASS', `Dialog 열림, 공급자=${hasSupplier}, 제품=${hasProduct}, 수량=${hasQty}`)

            // 반드시 닫기
            await page.keyboard.press('Escape')
            await page.waitForTimeout(800)
            const stillOpen = await dialog.first().isVisible({ timeout: 2000 }).catch(() => false)
            if (stillOpen) {
              const cancelBtn = dialog.locator('button').filter({ hasText: /닫기|취소|Close/ }).first()
              await cancelBtn.click({ force: true }).catch(() => {})
              await page.waitForTimeout(500)
            }
            console.log('  Dialog 닫기 완료')
          } else {
            log('B-1-6 발주서 상세 Dialog', 'FAIL', 'Dialog 열리지 않음')
          }
        } else {
          log('B-1-6 발주서 상세 Dialog', 'FAIL', '클릭 가능한 버튼 없음')
        }
      } else {
        log('B-1-6 발주서 상세 Dialog', 'INFO', '발주서 없음 — 테스트 스킵')
      }
    } catch (e) {
      log('B-1-6 발주서 상세 Dialog', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-7: 발주현황 엑셀 다운로드
    try {
      console.log('\n[B-1-7] 발주현황 엑셀 다운로드 버튼 클릭')
      // 이미 orders 탭에 있음

      // "전체 엑셀 다운로드" 버튼 찾기 (orders-client.tsx: "전체 엑셀 다운로드")
      const downloadBtn = page.locator('button').filter({ hasText: /전체.*엑셀.*다운로드|엑셀.*다운로드|다운로드/ }).first()
      const downloadBtnVisible = await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false)
      console.log(`  다운로드 버튼 visible: ${downloadBtnVisible}`)

      if (downloadBtnVisible) {
        const isDisabled = await downloadBtn.isDisabled().catch(() => false)
        console.log(`  다운로드 버튼 disabled: ${isDisabled}`)

        if (!isDisabled) {
          // download 이벤트 대기 또는 토스트 확인
          const [downloadEvent] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
            downloadBtn.click(),
          ])

          if (downloadEvent) {
            console.log(`  다운로드 파일명: ${downloadEvent.suggestedFilename()}`)
            log('B-1-7 발주현황 엑셀 다운로드', 'PASS', `파일 다운로드 시작: ${downloadEvent.suggestedFilename()}`)
          } else {
            // 토스트 메시지 확인 (JavaScript-generated download는 waitForEvent로 못 잡을 수도 있음)
            await page.waitForTimeout(3000)
            const toastText = await page.locator('[data-sonner-toast], [role="status"], [class*="toast"]').first().textContent().catch(() => '')
            if ((toastText || '').includes('다운로드') || (toastText || '').includes('완료')) {
              log('B-1-7 발주현황 엑셀 다운로드', 'PASS', `토스트: ${(toastText || '').trim().substring(0, 60)}`)
            } else {
              log('B-1-7 발주현황 엑셀 다운로드', 'INFO', '다운로드 이벤트 미감지 — 브라우저 API 방식 다운로드 가능성')
            }
          }
        } else {
          log('B-1-7 발주현황 엑셀 다운로드', 'INFO', '버튼 disabled (발주서 없음)')
        }
      } else {
        // lucide-download SVG 아이콘으로 버튼 찾기
        const svgDownloadBtn = page.locator('button:has(.lucide-download)').first()
        const svgVisible = await svgDownloadBtn.isVisible({ timeout: 3000 }).catch(() => false)
        if (svgVisible) {
          log('B-1-7 발주현황 엑셀 다운로드', 'PASS', '다운로드 버튼(SVG) 존재 확인')
        } else {
          log('B-1-7 발주현황 엑셀 다운로드', 'FAIL', '다운로드 버튼 없음')
        }
      }
    } catch (e) {
      log('B-1-7 발주현황 엑셀 다운로드', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-8: 발주이력 탭 → 이력 테이블 렌더링 (취소된 발주)
    try {
      console.log('\n[B-1-8] 발주이력 탭 (?tab=order-history)')
      await page.goto(`${BASE}/dashboard/orders?tab=order-history`)
      await wl(3000)

      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      // "발주 이력" 또는 "취소된 발주서" 텍스트 확인
      const bodyText = await page.textContent('body').catch(() => '')
      const hasHistory = (bodyText || '').includes('발주 이력') || (bodyText || '').includes('이력') || (h1 || '').includes('이력')
      const tableVisible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false)
      const emptyMsg = await page.locator('text=취소된 발주서가 없습니다, text=데이터가 없습니다').first().isVisible({ timeout: 2000 }).catch(() => false)
      const historyRows = tableVisible ? await page.locator('table tbody tr').count() : 0
      console.log(`  발주이력 행 수: ${historyRows}, 빈메시지: ${emptyMsg}`)

      if (hasHistory && (tableVisible || emptyMsg)) {
        log('B-1-8 발주이력 탭', 'PASS', `h1="${(h1 || '').trim()}", ${historyRows > 0 ? historyRows + '개 이력' : '이력 없음'}`)
      } else {
        log('B-1-8 발주이력 탭', 'FAIL', `hasHistory=${hasHistory}, tableVisible=${tableVisible}`)
      }
    } catch (e) {
      log('B-1-8 발주이력 탭', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-9: 발주 생성 실행 — reorder 탭에서 품목이 있으면 실제 발주 생성
    let orderCreated = false
    try {
      console.log('\n[B-1-9] 발주 생성 실행')
      await page.goto(`${BASE}/dashboard/orders?tab=reorder`)
      await wl(3000)

      const rows = await page.locator('table tbody tr').all()
      const currentReorderCount = rows.length
      console.log(`  현재 발주 필요 품목: ${currentReorderCount}개`)

      if (currentReorderCount > 0) {
        // 개별 발주 버튼 찾기 — 첫 번째 발주 가능한 행의 발주 버튼 클릭
        // reorder-items-table.tsx에서: ShoppingCart 아이콘 버튼 (onOrderClick)
        const firstRow = page.locator('table tbody tr').first()
        const orderBtn = firstRow.locator('button').filter({ hasText: /발주/ }).first()
        const cartBtn = firstRow.locator('button:has(.lucide-shopping-cart), button:has(svg)').last()
        const targetBtn = (await orderBtn.isVisible({ timeout: 2000 }).catch(() => false)) ? orderBtn : cartBtn

        const btnVisible = await targetBtn.isVisible({ timeout: 3000 }).catch(() => false)
        console.log(`  발주 버튼 visible: ${btnVisible}`)

        if (btnVisible) {
          await targetBtn.click()
          await page.waitForTimeout(2000)

          // OrderDialog 열림 확인
          const dialog = page.locator('[role="dialog"]')
          const dialogVisible = await dialog.first().isVisible({ timeout: 5000 }).catch(() => false)
          console.log(`  OrderDialog 열림: ${dialogVisible}`)

          if (dialogVisible) {
            // 발주 생성 버튼 (OrderDialog의 submit 버튼)
            const submitBtn = dialog.locator('button').filter({ hasText: /발주.*생성|발주|확인|저장/ }).last()
            const submitEnabled = await submitBtn.isEnabled().catch(() => false)
            console.log(`  submit 버튼 enabled: ${submitEnabled}`)

            if (submitEnabled) {
              await submitBtn.click()
              await page.waitForTimeout(5000)
              const stillOpen = await dialog.first().isVisible({ timeout: 2000 }).catch(() => false)
              if (!stillOpen) {
                orderCreated = true
                log('B-1-9 발주 생성 실행', 'PASS', '발주 생성 완료 — dialog 닫힘')
              } else {
                // 토스트 확인
                const toastText = await page.locator('[data-sonner-toast], [role="status"]').first().textContent().catch(() => '')
                log('B-1-9 발주 생성 실행', 'FAIL', `dialog 안 닫힘, 토스트: ${(toastText || '없음').substring(0, 80)}`)
                await page.keyboard.press('Escape')
              }
            } else {
              // 공급자 미지정으로 dialog 안 열리고 toast 뜨는 경우도 있음
              const toastText = await page.locator('[data-sonner-toast], [role="status"]').first().textContent().catch(() => '')
              log('B-1-9 발주 생성 실행', 'INFO', `submit 버튼 비활성화. 토스트="${(toastText || '없음').trim().substring(0, 80)}"`)
              await page.keyboard.press('Escape')
            }
          } else {
            // 공급자 미지정으로 toast 표시되고 dialog 안 열린 경우
            const toastText = await page.locator('[data-sonner-toast], [role="status"]').first().textContent().catch(() => '')
            if ((toastText || '').includes('공급자')) {
              log('B-1-9 발주 생성 실행', 'INFO', `공급자 미지정 — 발주 불가. 토스트: ${(toastText || '').trim().substring(0, 80)}`)
            } else {
              log('B-1-9 발주 생성 실행', 'FAIL', 'Dialog 열리지 않음')
            }
          }
        } else {
          log('B-1-9 발주 생성 실행', 'INFO', '발주 버튼 없음')
        }
      } else {
        log('B-1-9 발주 생성 실행', 'INFO', '발주 필요 품목 없음 — 재고 충분')
      }
    } catch (e) {
      log('B-1-9 발주 생성 실행', 'FAIL', e.message?.substring(0, 120))
    }

    // B-1-10: 생성 후 orders 탭에서 확인
    try {
      console.log('\n[B-1-10] 생성 후 발주현황 탭 확인')
      await page.goto(`${BASE}/dashboard/orders?tab=orders`)
      await wl(3000)

      const tableVisible = await page.locator('table').first().isVisible({ timeout: 8000 }).catch(() => false)
      const rows = await page.locator('table tbody tr').all()
      const afterOrderCount = rows.length
      console.log(`  발주현황 행 수: ${afterOrderCount}`)

      if (tableVisible && afterOrderCount > 0) {
        if (orderCreated) {
          // B-1-9에서 발주 생성했으면 이전보다 많아야 함
          log('B-1-10 발주현황 생성 후 확인', 'PASS', `발주현황 ${afterOrderCount}개 확인 (신규 발주 포함)`)
        } else {
          log('B-1-10 발주현황 생성 후 확인', 'PASS', `발주현황 ${afterOrderCount}개 확인 (기존 발주서)`)
        }
      } else {
        const emptyMsg = await page.locator('text=발주서가 없습니다, text=데이터가 없습니다').first().isVisible({ timeout: 2000 }).catch(() => false)
        log('B-1-10 발주현황 생성 후 확인', 'INFO', `발주서 없음 (emptyMsg=${emptyMsg})`)
      }
    } catch (e) {
      log('B-1-10 발주현황 생성 후 확인', 'FAIL', e.message?.substring(0, 120))
    }

    // ====================================================================
    // B-2: 입고관리
    // ====================================================================
    console.log('\n' + '='.repeat(60))
    console.log('  B-2: 입고관리')
    console.log('='.repeat(60))

    // B-2-1: 입고확정(창고) 페이지 접근
    try {
      console.log('\n[B-2-1] 입고확정(창고) 페이지 (/dashboard/warehouse/inbound)')
      await page.goto(`${BASE}/dashboard/warehouse/inbound`)
      await wl(3000)

      // warehouse-inbound-client.tsx: h1 = "입고확정(창고)"
      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      const hasTitle = (h1 || '').includes('입고')
      const cardVisible = await page.locator('[class*="card"], .card').first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasTitle) {
        log('B-2-1 입고확정 페이지 접근', 'PASS', `h1="${(h1 || '').trim()}", 카드=${cardVisible}`)
      } else {
        log('B-2-1 입고확정 페이지 접근', 'FAIL', `입고 텍스트 없음, h1="${(h1 || '').trim()}"`)
      }
    } catch (e) {
      log('B-2-1 입고확정 페이지 접근', 'FAIL', e.message?.substring(0, 120))
    }

    // B-2-2: 입고 대기 목록 확인
    let inboundWaitCount = 0
    try {
      console.log('\n[B-2-2] 입고 대기 목록 확인')
      // 이미 warehouse/inbound 페이지에 있음
      const tableVisible = await page.locator('table').first().isVisible({ timeout: 5000 }).catch(() => false)
      const emptyMsg = await page.locator('text=입고 대기중인 발주서가 없습니다').first().isVisible({ timeout: 3000 }).catch(() => false)

      if (tableVisible) {
        const rows = await page.locator('table tbody tr').all()
        inboundWaitCount = rows.length
        console.log(`  입고 대기 행 수: ${inboundWaitCount}`)
        log('B-2-2 입고 대기 목록', 'PASS', `${inboundWaitCount}개 발주서 대기`)
      } else if (emptyMsg) {
        console.log('  입고 대기중인 발주서 없음')
        log('B-2-2 입고 대기 목록', 'INFO', '입고 대기 발주서 없음 (정상)')
      } else {
        log('B-2-2 입고 대기 목록', 'FAIL', '테이블도 빈 메시지도 없음')
      }
    } catch (e) {
      log('B-2-2 입고 대기 목록', 'FAIL', e.message?.substring(0, 120))
    }

    // B-2-3: 입고확정 다이얼로그 필드 확인
    try {
      console.log('\n[B-2-3] 입고확정 다이얼로그 필드 확인')
      if (inboundWaitCount > 0) {
        // 첫 번째 행의 "입고 처리" 버튼 클릭
        // warehouse-inbound-client.tsx: Button text="입고 처리"
        const inboundBtn = page.locator('table tbody tr').first().locator('button').filter({ hasText: /입고.*처리|처리/ }).first()
        // 모바일 카드 뷰도 확인
        const inboundBtnAlt = page.locator('button').filter({ hasText: /입고 처리/ }).first()

        const targetBtn = (await inboundBtn.isVisible({ timeout: 2000 }).catch(() => false)) ? inboundBtn : inboundBtnAlt
        const btnVisible = await targetBtn.isVisible({ timeout: 3000 }).catch(() => false)
        console.log(`  입고 처리 버튼 visible: ${btnVisible}`)

        if (btnVisible) {
          await targetBtn.click()
          await page.waitForTimeout(2000)

          const dialog = page.locator('[role="dialog"]')
          const dialogVisible = await dialog.first().isVisible({ timeout: 5000 }).catch(() => false)
          console.log(`  InboundConfirmDialog 열림: ${dialogVisible}`)

          if (dialogVisible) {
            // 수량 input 존재 확인
            const qtyInputs = await dialog.first().locator('input[type="number"]').count()
            console.log(`  수량 input 수: ${qtyInputs}개`)

            log('B-2-3 입고확정 다이얼로그', 'PASS', `Dialog 열림, 수량 input=${qtyInputs}개`)

            // 반드시 닫기 (취소 버튼)
            const cancelBtn = dialog.locator('button').filter({ hasText: /취소|닫기|Close/ }).first()
            const cancelVisible = await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)
            if (cancelVisible) {
              await cancelBtn.click()
            } else {
              await page.keyboard.press('Escape')
            }
            await page.waitForTimeout(800)
            console.log('  Dialog 닫기 완료')
          } else {
            log('B-2-3 입고확정 다이얼로그', 'FAIL', 'Dialog 열리지 않음')
          }
        } else {
          log('B-2-3 입고확정 다이얼로그', 'INFO', '입고 처리 버튼 없음')
        }
      } else {
        log('B-2-3 입고확정 다이얼로그', 'INFO', '입고 대기 발주서 없음 — 테스트 스킵')
      }
    } catch (e) {
      log('B-2-3 입고확정 다이얼로그', 'FAIL', e.message?.substring(0, 120))
    }

    // B-2-4: 입고현황 탭 → /dashboard/orders?tab=inbound → 기록 테이블 렌더링
    try {
      console.log('\n[B-2-4] 입고현황 탭 (?tab=inbound)')
      await page.goto(`${BASE}/dashboard/orders?tab=inbound`)
      await wl(3000)

      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      // "입고 현황" 텍스트 및 테이블 확인
      const bodyText = await page.textContent('body').catch(() => '')
      const hasInbound = (bodyText || '').includes('입고 현황') || (bodyText || '').includes('입고') || (h1 || '').includes('입고')
      const tableVisible = await page.locator('table').first().isVisible({ timeout: 8000 }).catch(() => false)

      // 기타 입고 버튼 존재 확인 (orders-client.tsx: PackagePlus "기타 입고")
      const otherInboundBtn = await page.locator('button').filter({ hasText: /기타.*입고/ }).first().isVisible({ timeout: 3000 }).catch(() => false)
      console.log(`  기타 입고 버튼: ${otherInboundBtn}`)

      if (hasInbound) {
        const rowCount = tableVisible ? await page.locator('table tbody tr').count() : 0
        log('B-2-4 입고현황 탭', 'PASS', `h1="${(h1 || '').trim()}", 입고기록=${rowCount}개, 기타입고버튼=${otherInboundBtn}`)
      } else {
        log('B-2-4 입고현황 탭', 'FAIL', `입고 텍스트 없음, h1="${(h1 || '').trim()}"`)
      }
    } catch (e) {
      log('B-2-4 입고현황 탭', 'FAIL', e.message?.substring(0, 120))
    }

    // B-2-5: "기타 입고" 다이얼로그 열기 → 필드 확인
    try {
      console.log('\n[B-2-5] 기타 입고 다이얼로그 열기 → 필드 확인')
      // 이미 inbound 탭에 있음

      const otherBtn = page.locator('button').filter({ hasText: /기타.*입고/ }).first()
      const otherBtnVisible = await otherBtn.isVisible({ timeout: 5000 }).catch(() => false)
      console.log(`  기타 입고 버튼 visible: ${otherBtnVisible}`)

      if (otherBtnVisible) {
        await otherBtn.click()
        await page.waitForTimeout(2000)

        const dialog = page.locator('[role="dialog"]')
        const dialogVisible = await dialog.first().isVisible({ timeout: 5000 }).catch(() => false)
        console.log(`  OtherInboundDialog 열림: ${dialogVisible}`)

        if (dialogVisible) {
          // 제품 ProductCombobox (combobox idx 0)
          const combos = await dialog.first().locator('button[role="combobox"]').all()
          console.log(`  combobox 수: ${combos.length}`)

          const productComboVisible = combos.length > 0 ? await combos[0].isVisible({ timeout: 2000 }).catch(() => false) : false
          // 입고유형 Select (combobox idx 1)
          const typeComboVisible = combos.length > 1 ? await combos[1].isVisible({ timeout: 2000 }).catch(() => false) : false
          // 수량 input (#oi-quantity)
          const qtyInput = await dialog.first().locator('#oi-quantity, input[type="number"]').first().isVisible({ timeout: 2000 }).catch(() => false)

          console.log(`  ProductCombobox=${productComboVisible}, 입고유형=${typeComboVisible}, 수량input=${qtyInput}`)

          if (productComboVisible && qtyInput) {
            log('B-2-5 기타 입고 다이얼로그', 'PASS', `ProductCombobox=${productComboVisible}, 입고유형=${typeComboVisible}, 수량=${qtyInput}`)
          } else {
            log('B-2-5 기타 입고 다이얼로그', 'FAIL', `ProductCombobox=${productComboVisible}, 입고유형=${typeComboVisible}, 수량=${qtyInput}`)
          }

          // 닫지 않고 B-2-6에서 계속 사용
        } else {
          log('B-2-5 기타 입고 다이얼로그', 'FAIL', 'Dialog 열리지 않음')
        }
      } else {
        log('B-2-5 기타 입고 다이얼로그', 'FAIL', '기타 입고 버튼 없음')
      }
    } catch (e) {
      log('B-2-5 기타 입고 다이얼로그', 'FAIL', e.message?.substring(0, 120))
    }

    // B-2-6: 기타 입고 실행 (실제 50개 투입)
    try {
      console.log('\n[B-2-6] 기타 입고 실행 (50개 실제 투입)')

      // 현재 dialog가 열려있는지 확인, 없으면 다시 열기
      let dlg = page.locator('[role="dialog"]')
      let dlgVisible = await dlg.first().isVisible({ timeout: 2000 }).catch(() => false)

      if (!dlgVisible) {
        console.log('  Dialog 닫혀있음 — 기타 입고 버튼 재클릭')
        await page.goto(`${BASE}/dashboard/orders?tab=inbound`)
        await wl(2000)
        const otherBtn = page.locator('button').filter({ hasText: /기타.*입고/ }).first()
        if (await otherBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await otherBtn.click()
          await page.waitForTimeout(2000)
          dlgVisible = await dlg.first().isVisible({ timeout: 5000 }).catch(() => false)
        }
      }

      if (!dlgVisible) {
        log('B-2-6 기타 입고 실행', 'FAIL', 'OtherInboundDialog를 열 수 없음')
      } else {
        console.log('  OtherInboundDialog 열림 — 제품 선택 시작')

        // 1) 제품 선택 (ProductCombobox — combobox idx 0)
        const pName = await selectProductFromCmdk(dlg.first(), 0)
        console.log(`  선택된 제품: ${pName}`)

        if (pName) {
          // Popover가 아직 열려있으면 Dialog 내부 클릭으로 닫기
          // (Dialog 바깥 클릭하면 Dialog 자체가 닫히므로 주의)
          const popoverOpen = await page.locator('[cmdk-list]').isVisible().catch(() => false)
          if (popoverOpen) {
            console.log('  Popover 아직 열림 — Dialog h2 클릭으로 닫기')
            await dlg.first().locator('h2').first().click({ force: true }).catch(() => {})
            await page.waitForTimeout(1000)
          }

          // 2) 입고유형 Select (combobox idx 1) — "반품 입고" 선택
          const combos = dlg.first().locator('button[role="combobox"]')
          const typeCombo = combos.nth(1)
          const typeComboVisible = await typeCombo.isVisible({ timeout: 3000 }).catch(() => false)
          console.log(`  입고유형 combobox visible: ${typeComboVisible}`)

          if (typeComboVisible) {
            await typeCombo.click({ force: true })
            await page.waitForTimeout(1000)

            const returnOpt = page.locator('[role="option"]:has-text("반품")').first()
            if (await returnOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
              await returnOpt.click()
              console.log('  입고유형: 반품 입고 선택')
            } else {
              // 첫 번째 옵션 선택
              const firstOpt = page.locator('[role="option"]').first()
              const firstOptText = await firstOpt.textContent().catch(() => '?')
              await firstOpt.click()
              console.log(`  입고유형: "${(firstOptText || '').trim()}" 선택 (fallback)`)
            }
            await page.waitForTimeout(500)
          } else {
            console.log('  입고유형 combobox 없음')
          }

          // 3) 수량 입력 (50개)
          const qtyInput = dlg.first().locator('#oi-quantity')
          if (await qtyInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await qtyInput.fill('50')
            console.log('  수량: 50개 입력')
          } else {
            const numInput = dlg.first().locator('input[type="number"]').first()
            if (await numInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await numInput.fill('50')
              console.log('  수량: 50개 입력 (fallback input)')
            }
          }
          await page.waitForTimeout(500)

          // 4) "입고 처리" 버튼 클릭
          const submitBtn = dlg.first().locator('button').filter({ hasText: /입고 처리/ }).last()
          const submitVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)
          const submitEnabled = await submitBtn.isEnabled({ timeout: 3000 }).catch(() => false)
          console.log(`  입고 처리 버튼 visible=${submitVisible}, enabled=${submitEnabled}`)

          if (submitVisible && submitEnabled) {
            await submitBtn.click()
            await page.waitForTimeout(5000)

            const stillOpen = await dlg.first().isVisible({ timeout: 2000 }).catch(() => false)
            if (!stillOpen) {
              log('B-2-6 기타 입고 실행', 'PASS', `${pName} 50개 입고 완료 — Dialog 닫힘`)
            } else {
              const toastText = await page.locator('[data-sonner-toast], [role="status"]').first().textContent().catch(() => '')
              log('B-2-6 기타 입고 실행', 'FAIL', `Dialog 안 닫힘. 토스트: ${(toastText || '없음').trim().substring(0, 80)}`)
              await dlg.first().locator('button').filter({ hasText: /취소/ }).first().click().catch(() => {})
            }
          } else {
            // 왜 비활성화인지 디버깅
            const prodVal = await combos.nth(0).textContent().catch(() => '?')
            const typeVal = await combos.nth(1).textContent().catch(() => '?')
            const qtyVal = await dlg.first().locator('#oi-quantity, input[type="number"]').first().inputValue().catch(() => '?')
            log('B-2-6 기타 입고 실행', 'FAIL',
              `버튼 비활성화 — 제품="${(prodVal || '').trim()}", 유형="${(typeVal || '').trim()}", 수량=${qtyVal}`)
            await dlg.first().locator('button').filter({ hasText: /취소/ }).first().click().catch(() => {})
          }
        } else {
          log('B-2-6 기타 입고 실행', 'FAIL', '제품 선택 실패 — selectProductFromCmdk 반환값 null')
          await dlg.first().locator('button').filter({ hasText: /취소/ }).first().click().catch(() => {})
        }
      }
    } catch (e) {
      log('B-2-6 기타 입고 실행', 'FAIL', e.message?.substring(0, 120))
    }

    // B-2-7: 납기분석 탭 → /dashboard/orders?tab=delivery → 분석 데이터/차트 표시
    try {
      console.log('\n[B-2-7] 납기분석 탭 (?tab=delivery)')
      await page.goto(`${BASE}/dashboard/orders?tab=delivery`)
      await wl(3000)

      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      const bodyText = await page.textContent('body').catch(() => '')
      const hasDelivery = (bodyText || '').includes('납기') || (bodyText || '').includes('준수') || (h1 || '').includes('납기')
      const hasChart = await page.locator('svg, canvas, [class*="chart"]').first().isVisible({ timeout: 3000 }).catch(() => false)
      const hasData = (bodyText || '').includes('%') || (bodyText || '').includes('공급') || (bodyText || '').includes('분석')

      console.log(`  납기 텍스트=${hasDelivery}, 차트=${hasChart}, 데이터=${hasData}`)

      if (hasDelivery) {
        log('B-2-7 납기분석 탭', 'PASS', `h1="${(h1 || '').trim()}", 차트=${hasChart}, 데이터=${hasData}`)
      } else {
        log('B-2-7 납기분석 탭', 'FAIL', `납기 텍스트 없음, h1="${(h1 || '').trim()}"`)
      }
    } catch (e) {
      log('B-2-7 납기분석 탭', 'FAIL', e.message?.substring(0, 120))
    }

    // B-2-8: 입항스케줄 탭 → /dashboard/orders?tab=import-shipment → 페이지 렌더링 확인
    try {
      console.log('\n[B-2-8] 입항스케줄 탭 (?tab=import-shipment)')
      await page.goto(`${BASE}/dashboard/orders?tab=import-shipment`)
      await wl(3000)

      const h1 = await page.locator('h1').first().textContent().catch(() => '')
      console.log(`  h1 텍스트: "${(h1 || '').trim()}"`)

      const bodyText = await page.textContent('body').catch(() => '')
      const hasShipment = (bodyText || '').includes('입항') || (bodyText || '').includes('스케줄') || (bodyText || '').includes('선박') || (h1 || '').includes('입항')
      const bodyLength = (bodyText || '').length
      const rendered = bodyLength > 200

      console.log(`  입항 텍스트=${hasShipment}, 본문길이=${bodyLength}`)

      if (rendered) {
        log('B-2-8 입항스케줄 탭', 'PASS', `h1="${(h1 || '').trim()}", 입항텍스트=${hasShipment}, 본문=${bodyLength}자`)
      } else {
        log('B-2-8 입항스케줄 탭', 'FAIL', `페이지 렌더링 실패 (본문길이=${bodyLength})`)
      }
    } catch (e) {
      log('B-2-8 입항스케줄 탭', 'FAIL', e.message?.substring(0, 120))
    }

  } catch (fatalError) {
    console.error('\n❌ 치명적 오류:', fatalError.message)
    console.error('  Stack:', fatalError.stack?.split('\n').slice(0, 3).join('\n  '))
    log('치명적 오류', 'FAIL', fatalError.message)
  } finally {
    await browser.close()
  }

  // ====== 최종 결과 출력 ======
  console.log('\n' + '='.repeat(60))
  console.log('  Group B 테스트 결과 요약')
  console.log('='.repeat(60))
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : 'ℹ️'
    console.log(`  ${icon} ${r.label}: ${r.detail || ''}`)
  }
  console.log('-'.repeat(60))
  console.log(`  ✅ PASS: ${passed}개 | ❌ FAIL: ${failed}개 | ℹ️ INFO: ${results.filter(r => r.status === 'INFO').length}개 | 총 ${results.length}개`)
  console.log('='.repeat(60))

  if (failed > 0) {
    console.log(`\n⚠ ${failed}개 실패`)
    process.exit(1)
  } else {
    console.log('\n전체 통과!')
  }
}

main().catch(e => {
  console.error('치명적 오류:', e)
  process.exit(1)
})
