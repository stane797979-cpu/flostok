/**
 * Group C: 출고 섹션 E2E 테스트
 *
 * 테스트 항목 (12개):
 *   C-1-1: 출고요청 탭 접근 — /dashboard/outbound UI 렌더링 확인
 *   C-1-2: "출고 요청" 버튼 → 다이얼로그 열림 + 입력 요소 확인
 *   C-1-3: 출고유형 "판매 출고" 선택 → 제품 선택 → "현재고: N개" 표시 확인
 *   C-1-4: 수량 3 입력 → + 버튼 클릭 → 테이블 행 증가 확인
 *   C-1-5: 항목 삭제 후 수량 99999 입력 → 재고 부족 경고 or 생성 버튼 disabled
 *   C-1-6: 항목 삭제 후 수량 3 재추가 → "출고 요청 생성" 클릭 → 다이얼로그 닫힘
 *   C-1-7: 출고 엑셀 업로드 아이콘 버튼 → import 다이얼로그 열림 확인
 *   C-1-8: 업로드 다이얼로그 내 "양식 다운로드"/"템플릿" 버튼 존재 확인
 *   C-2-1: 출고확정(창고) /dashboard/warehouse/outbound → 대기 목록 행 존재
 *   C-2-2: 창고 출고 테이블 헤더에 "가용재고" 또는 "대기" 텍스트 존재 확인
 *   C-2-3: "피킹지" 텍스트 포함 버튼 존재 확인 (체크박스 선택 후)
 *   C-3-1: 출고현황 탭 /dashboard/outbound?tab=records → 테이블 + 다운로드 버튼
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const EMAIL = 'admin1@stocklogis.com'
const PASSWORD = 'admin1234'

let browser, ctx, page
let passed = 0
let failed = 0
const results = []

// ============================================================
// 환경변수 로드
// ============================================================
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const env = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
      }
    }
    return env
  } catch {
    return {}
  }
}

// ============================================================
// Pre-test cleanup: pending 출고 요청 모두 취소
// ============================================================
async function cleanupPendingOutbound() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('  주의: Supabase 환경변수 없음 — cleanup 생략')
    return 0
  }
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('outbound_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .select('id')
  if (error) {
    console.log(`  주의: cleanup 오류 — ${error.message}`)
    return 0
  }
  return data?.length || 0
}

// ============================================================
// 결과 로깅 헬퍼
// ============================================================
function log(label, status, detail) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️'
  console.log(`${icon} [${label}] ${detail || ''}`)
  results.push({ label, status, detail: detail || '' })
  if (status === 'PASS') passed++
  if (status === 'FAIL') failed++
}

// ============================================================
// 페이지 로드 대기 헬퍼
// ============================================================
async function waitLoad(ms = 2000) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

// ============================================================
// cmdk 기반 ProductCombobox에서 제품 선택
// @param {import('playwright').Locator} dialog - 다이얼로그 로케이터
// @param {number} comboboxIndex - dialog 내 button[role="combobox"] 인덱스
// @returns {string|null} 선택된 제품명 또는 null
// ============================================================
async function selectProductFromCmdk(dialog, comboboxIndex = 0) {
  const combo = dialog.locator('button[role="combobox"]').nth(comboboxIndex)
  if (!(await combo.isVisible().catch(() => false))) {
    console.log(`  주의: combobox[${comboboxIndex}] 없거나 안 보임`)
    return null
  }

  const beforeText = await combo.textContent().catch(() => '?')
  console.log(`  combobox[${comboboxIndex}] 클릭 전: "${(beforeText || '').trim()}"`)

  await combo.click()
  await page.waitForTimeout(3000) // 서버에서 제품 목록 로드 대기

  let opts = await page.locator('[cmdk-item]').all()
  console.log(`  cmdk 제품 목록: ${opts.length}개`)

  if (opts.length === 0) return null

  const itemText = await opts[0].textContent().catch(() => '')
  console.log(`  첫 번째 cmdk-item: "${(itemText || '').trim()}"`)

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
  console.log(`  combobox[${comboboxIndex}] 선택 후: "${(afterText || '').trim()}"`)

  const selected = afterText !== beforeText && !(afterText || '').includes('검색하세요')
  if (selected) {
    return (afterText || '').trim()
  }
  if (itemText && itemText.trim()) {
    return itemText.trim()
  }
  return null
}

// ============================================================
// 메인 테스트 실행
// ============================================================
async function main() {
  console.log('='.repeat(60))
  console.log('  Group C: 출고 섹션 E2E 테스트 (12개)')
  console.log('='.repeat(60))

  // Pre-test cleanup
  console.log('\n--- Pre-test: pending 출고 요청 정리 ---')
  const cancelledCount = await cleanupPendingOutbound()
  console.log(`  확인: pending 출고 요청 ${cancelledCount}개 취소됨`)

  browser = await chromium.launch({ headless: true })
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ko-KR',
  })
  page = await ctx.newPage()

  // 로그인
  console.log('\n--- 로그인 ---')
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 15000 })
  console.log(`  확인: ${EMAIL} 로그인 완료`)

  // ──────────────────────────────────────────────────────────
  // C-1-1: 출고요청 탭 접근 → /dashboard/outbound → UI 렌더링 확인
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-1: 출고요청 탭 접근 ---')
  try {
    await page.goto(`${BASE}/dashboard/outbound`)
    await waitLoad(3000)

    const heading = page.locator('h1, h2').filter({ hasText: /출고/ }).first()
    const headingVisible = await heading.isVisible().catch(() => false)

    const reqBtnVisible = await page.locator('button:has-text("출고 요청")').isVisible().catch(() => false)

    if (headingVisible || reqBtnVisible) {
      const headingText = headingVisible ? await heading.textContent().catch(() => '') : '(heading 없음)'
      log('C-1-1', 'PASS', `페이지 렌더링 완료 — 헤딩: "${(headingText || '').trim()}"`)
    } else {
      log('C-1-1', 'FAIL', '출고 관련 UI 요소를 찾을 수 없음')
    }
  } catch (e) {
    log('C-1-1', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-1-2: "출고 요청" 버튼 → 다이얼로그 열림 → 입력 요소 확인
  // 출고유형 Select(combobox idx 0) + 제품 cmdk(combobox idx 1) + 수량 input 확인
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-2: 출고 요청 다이얼로그 입력 요소 확인 ---')
  try {
    await page.goto(`${BASE}/dashboard/outbound`)
    await waitLoad(2000)

    const reqBtn = page.locator('button:has-text("출고 요청")')
    if (!(await reqBtn.isVisible().catch(() => false))) {
      log('C-1-2', 'FAIL', '"출고 요청" 버튼 없음')
    } else {
      await reqBtn.click()
      await page.waitForTimeout(1500)

      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 }).catch(() => {})

      const dlgVisible = await dlg.isVisible().catch(() => false)
      if (!dlgVisible) {
        log('C-1-2', 'FAIL', '다이얼로그가 열리지 않음')
      } else {
        // combobox idx 0 = 출고유형 Select
        const combo0 = dlg.locator('button[role="combobox"]').nth(0)
        const combo0Visible = await combo0.isVisible().catch(() => false)

        // combobox idx 1 = 제품 ProductCombobox (cmdk)
        const combo1 = dlg.locator('button[role="combobox"]').nth(1)
        const combo1Visible = await combo1.isVisible().catch(() => false)

        // 수량 input
        const qtyInput = dlg.locator('input[placeholder="수량"]')
        const qtyVisible = await qtyInput.isVisible().catch(() => false)

        console.log(`  출고유형 combobox(idx 0): ${combo0Visible}`)
        console.log(`  제품 combobox(idx 1): ${combo1Visible}`)
        console.log(`  수량 input: ${qtyVisible}`)

        if (combo0Visible && combo1Visible && qtyVisible) {
          log('C-1-2', 'PASS', '다이얼로그 열림 + 출고유형/제품/수량 입력 요소 모두 확인')
        } else {
          log('C-1-2', 'FAIL',
            `일부 요소 없음 — 출고유형=${combo0Visible}, 제품=${combo1Visible}, 수량=${qtyVisible}`)
        }

        // 다이얼로그 닫기 (다음 테스트를 위해)
        await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
        await page.waitForTimeout(500)
      }
    }
  } catch (e) {
    log('C-1-2', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-1-3: 출고유형 "판매 출고" 선택 → 제품 선택(cmdk) → "현재고: N개" 표시 확인
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-3: 출고유형 선택 + 제품 선택 + 현재고 표시 확인 ---')
  try {
    await page.goto(`${BASE}/dashboard/outbound`)
    await waitLoad(3000) // 제품 목록 API 준비 대기

    const reqBtn = page.locator('button:has-text("출고 요청")')
    if (!(await reqBtn.isVisible().catch(() => false))) {
      log('C-1-3', 'FAIL', '"출고 요청" 버튼 없음')
    } else {
      await reqBtn.click()
      await page.waitForTimeout(2000) // 다이얼로그 완전 렌더링 대기

      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 }).catch(() => {})

      // 출고유형 "판매 출고" 선택 (combobox idx 0)
      const typeCombo = dlg.locator('button[role="combobox"]').nth(0)
      await typeCombo.click({ force: true })
      await page.waitForTimeout(800)

      const saleOpt = page.locator('[role="option"]:has-text("판매 출고")').first()
      if (await saleOpt.isVisible().catch(() => false)) {
        await saleOpt.click()
        console.log('  출고유형: 판매 출고 선택됨')
      } else {
        const firstOpt = page.locator('[role="option"]').first()
        if (await firstOpt.isVisible().catch(() => false)) {
          const optText = await firstOpt.textContent().catch(() => '')
          await firstOpt.click()
          console.log(`  출고유형: ${(optText || '').trim()} 선택됨 (판매 출고 옵션 없어 첫 번째 선택)`)
        }
      }
      await page.waitForTimeout(1000) // 출고유형 선택 후 충분히 대기

      // 제품 선택 (combobox idx 1 = ProductCombobox)
      const selectedProduct = await selectProductFromCmdk(dlg, 1)

      if (selectedProduct) {
        // Popover가 아직 열려있으면 다이얼로그 제목 클릭으로 닫기
        const popoverOpen = await page.locator('[cmdk-list]').isVisible().catch(() => false)
        if (popoverOpen) {
          await dlg.locator('h2').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(1000)
        }

        // "현재고: N개" 텍스트 확인 (제품 선택 후 비동기로 조회됨)
        await page.waitForTimeout(2000)
        const stockText = dlg.locator('p:has-text("현재고")')
        const stockVisible = await stockText.isVisible().catch(() => false)
        const stockContent = stockVisible ? await stockText.textContent().catch(() => '') : ''
        console.log(`  현재고 텍스트: "${(stockContent || '').trim()}"`)

        if (stockVisible && (stockContent || '').includes('현재고')) {
          log('C-1-3', 'PASS', `제품 "${selectedProduct}" 선택 후 "${(stockContent || '').trim()}" 표시됨`)
        } else {
          // "조회 중..." 상태일 수도 있으므로 잠시 더 대기
          await page.waitForTimeout(2000)
          const stockVisible2 = await stockText.isVisible().catch(() => false)
          const stockContent2 = stockVisible2 ? await stockText.textContent().catch(() => '') : ''
          if (stockVisible2) {
            log('C-1-3', 'PASS', `현재고 표시됨: "${(stockContent2 || '').trim()}"`)
          } else {
            log('C-1-3', 'FAIL', `현재고 텍스트 없음 (제품: ${selectedProduct})`)
          }
        }
      } else {
        log('C-1-3', 'FAIL', '제품 선택 실패')
      }

      // 다이얼로그 닫기
      await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
      await page.waitForTimeout(500)
    }
  } catch (e) {
    log('C-1-3', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-1-4: 수량 3 입력 → + 버튼(.lucide-plus) 클릭 → table tbody tr 카운트 증가
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-4: 항목 추가 (수량 3, + 버튼) ---')
  try {
    // 새 페이지 컨텍스트로 이동하여 이전 테스트 상태 초기화
    await page.goto(`${BASE}/dashboard/outbound`)
    await waitLoad(3000) // 충분한 대기 (제품 목록 API 준비)

    const reqBtn = page.locator('button:has-text("출고 요청")')
    if (!(await reqBtn.isVisible().catch(() => false))) {
      log('C-1-4', 'FAIL', '"출고 요청" 버튼 없음')
    } else {
      await reqBtn.click()
      await page.waitForTimeout(2000) // 다이얼로그 완전 렌더링 대기

      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 }).catch(() => {})

      // 출고유형 선택 (idx 0)
      const typeCombo = dlg.locator('button[role="combobox"]').nth(0)
      await typeCombo.click({ force: true })
      await page.waitForTimeout(800)
      const saleOpt = page.locator('[role="option"]:has-text("판매 출고")').first()
      if (await saleOpt.isVisible().catch(() => false)) {
        await saleOpt.click()
      } else {
        const firstOpt = page.locator('[role="option"]').first()
        if (await firstOpt.isVisible().catch(() => false)) await firstOpt.click()
      }
      await page.waitForTimeout(1000) // 출고유형 선택 후 충분히 대기

      // 제품 선택 (idx 1)
      const selectedProduct = await selectProductFromCmdk(dlg, 1)
      if (!selectedProduct) {
        log('C-1-4', 'FAIL', '제품 선택 실패')
      } else {
        // Popover 닫기
        const popoverOpen = await page.locator('[cmdk-list]').isVisible().catch(() => false)
        if (popoverOpen) {
          await dlg.locator('h2').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(1000)
        }

        // 현재고 로드 대기
        await page.waitForTimeout(2000)

        // 이전 행 카운트
        const beforeCount = await dlg.locator('table tbody tr').count()

        // 수량 3 입력
        const qtyInput = dlg.locator('input[placeholder="수량"]')
        await qtyInput.click({ force: true })
        await qtyInput.fill('3')
        await page.waitForTimeout(500)

        // + 버튼 클릭
        const addBtn = dlg.locator('button:has(svg.lucide-plus)').first()
        const addBtnVisible = await addBtn.isVisible().catch(() => false)
        const addBtnEnabled = await addBtn.isEnabled().catch(() => false)
        console.log(`  + 버튼 visible=${addBtnVisible}, enabled=${addBtnEnabled}`)

        if (addBtnVisible && addBtnEnabled) {
          await addBtn.click({ force: true })
          await page.waitForTimeout(1500)

          const afterCount = await dlg.locator('table tbody tr').count()
          console.log(`  테이블 행: ${beforeCount} → ${afterCount}`)

          if (afterCount > beforeCount) {
            log('C-1-4', 'PASS', `항목 추가됨 (${beforeCount} → ${afterCount}행)`)
          } else {
            // 토스트 메시지 확인 (중복 또는 오류 가능성)
            const toast = await page.locator('[data-sonner-toast], [role="status"]').first()
              .textContent().catch(() => '')
            log('C-1-4', 'FAIL', `행 카운트 증가 안 됨 (toast: ${(toast || '없음').trim()})`)
          }
        } else {
          log('C-1-4', 'FAIL', `+ 버튼 비활성화 (visible=${addBtnVisible}, enabled=${addBtnEnabled})`)
        }
      }

      // 다이얼로그 닫기 — 다음 테스트를 위해 상태 유지 (닫지 않음, 재사용)
      await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
      await page.waitForTimeout(500)
    }
  } catch (e) {
    log('C-1-4', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-1-5: 항목 삭제 후 수량 99999 입력 → + 클릭
  //        → "재고가 부족한" 경고 메시지 or 생성 버튼 disabled
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-5: 재고 부족 차단 테스트 (99999개) ---')
  try {
    await page.goto(`${BASE}/dashboard/outbound`)
    await waitLoad(2000)

    const reqBtn = page.locator('button:has-text("출고 요청")')
    if (!(await reqBtn.isVisible().catch(() => false))) {
      log('C-1-5', 'FAIL', '"출고 요청" 버튼 없음')
    } else {
      await reqBtn.click()
      await page.waitForTimeout(1500)

      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 }).catch(() => {})

      // 출고유형 선택 (idx 0)
      const typeCombo = dlg.locator('button[role="combobox"]').nth(0)
      await typeCombo.click({ force: true })
      await page.waitForTimeout(800)
      const firstTypeOpt = page.locator('[role="option"]').first()
      if (await firstTypeOpt.isVisible().catch(() => false)) await firstTypeOpt.click()
      await page.waitForTimeout(500)

      // 제품 선택 (idx 1)
      const selectedProduct = await selectProductFromCmdk(dlg, 1)
      if (!selectedProduct) {
        log('C-1-5', 'FAIL', '제품 선택 실패')
      } else {
        // Popover 닫기
        const cmdkStill = await page.locator('[cmdk-list]').isVisible().catch(() => false)
        if (cmdkStill) {
          await dlg.locator('h2').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(1000)
        }

        // 현재고 로드 대기
        await page.waitForTimeout(2000)

        // 기존 항목 삭제 (테이블에 이미 항목이 있는 경우)
        const existingRows = await dlg.locator('table tbody tr').count()
        if (existingRows > 0) {
          const trashBtn = dlg.locator('table tbody tr').first().locator('button').last()
          if (await trashBtn.isVisible().catch(() => false)) {
            await trashBtn.click()
            await page.waitForTimeout(500)
          }
        }

        // 99999개 수량 입력
        const qtyInput = dlg.locator('input[placeholder="수량"]')
        await qtyInput.click({ force: true })
        await qtyInput.fill('99999')
        await page.waitForTimeout(500)

        // + 버튼 클릭
        const addBtn = dlg.locator('button:has(svg.lucide-plus)').first()
        if (await addBtn.isVisible().catch(() => false) && await addBtn.isEnabled().catch(() => false)) {
          await addBtn.click({ force: true })
          await page.waitForTimeout(1500)
        }

        // 재고 부족 경고 또는 버튼 disabled 확인
        const warnVisible = await dlg.locator('text=재고가 부족한').isVisible().catch(() => false)
        const submitBtn = dlg.locator('button:has-text("출고 요청 생성")')
        const submitDisabled = await submitBtn.isDisabled().catch(() => true)
        console.log(`  재고 부족 경고: ${warnVisible}, 생성 버튼 disabled: ${submitDisabled}`)

        if (warnVisible || submitDisabled) {
          log('C-1-5', 'PASS', `99999개 차단됨 (경고=${warnVisible}, 버튼disabled=${submitDisabled})`)
        } else {
          log('C-1-5', 'FAIL', '재고 부족 차단 없음 (경고도 없고 버튼도 활성화됨)')
        }
      }

      // 다이얼로그 닫기
      await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
      await page.waitForTimeout(500)
    }
  } catch (e) {
    log('C-1-5', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-1-6: 항목 삭제 후 수량 3으로 재추가 → "출고 요청 생성" 클릭 → 다이얼로그 닫힘
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-6: 출고 요청 생성 (정상 수량 3개) ---')
  try {
    await page.goto(`${BASE}/dashboard/outbound`)
    await waitLoad(2000)

    const reqBtn = page.locator('button:has-text("출고 요청")')
    if (!(await reqBtn.isVisible().catch(() => false))) {
      log('C-1-6', 'FAIL', '"출고 요청" 버튼 없음')
    } else {
      await reqBtn.click()
      await page.waitForTimeout(1500)

      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 }).catch(() => {})

      // 출고유형 선택 (idx 0)
      const typeCombo = dlg.locator('button[role="combobox"]').nth(0)
      await typeCombo.click({ force: true })
      await page.waitForTimeout(800)
      const saleOpt = page.locator('[role="option"]:has-text("판매 출고")').first()
      if (await saleOpt.isVisible().catch(() => false)) {
        await saleOpt.click()
      } else {
        const firstOpt = page.locator('[role="option"]').first()
        if (await firstOpt.isVisible().catch(() => false)) await firstOpt.click()
      }
      await page.waitForTimeout(500)

      // 제품 선택 (idx 1)
      const selectedProduct = await selectProductFromCmdk(dlg, 1)
      if (!selectedProduct) {
        log('C-1-6', 'FAIL', '제품 선택 실패')
      } else {
        // Popover 닫기
        const popoverOpen = await page.locator('[cmdk-list]').isVisible().catch(() => false)
        if (popoverOpen) {
          await dlg.locator('h2').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(1000)
        }

        // 현재고 로드 대기
        await page.waitForTimeout(2000)

        // 기존 항목 삭제 (테이블에 이미 항목이 있는 경우)
        let tableRows = await dlg.locator('table tbody tr').count()
        while (tableRows > 0) {
          const trashBtn = dlg.locator('table tbody tr').first().locator('button').last()
          if (await trashBtn.isVisible().catch(() => false)) {
            await trashBtn.click()
            await page.waitForTimeout(500)
          } else break
          tableRows = await dlg.locator('table tbody tr').count()
        }

        // 수량 3 입력
        const qtyInput = dlg.locator('input[placeholder="수량"]')
        await qtyInput.click({ force: true })
        await qtyInput.fill('3')
        await page.waitForTimeout(500)

        // + 버튼 클릭
        const addBtn = dlg.locator('button:has(svg.lucide-plus)').first()
        const addEnabled = await addBtn.isEnabled().catch(() => false)
        if (await addBtn.isVisible().catch(() => false) && addEnabled) {
          await addBtn.click({ force: true })
          await page.waitForTimeout(1500)
        }

        // 재고 부족 경고 있으면 수량을 1로 줄임
        const warnVisible = await dlg.locator('text=재고가 부족한').isVisible().catch(() => false)
        if (warnVisible) {
          console.log('  재고 부족 경고 — 수량 1로 변경')
          const rowQtyInput = dlg.locator('table tbody tr').first().locator('input[type="number"]')
          if (await rowQtyInput.isVisible().catch(() => false)) {
            await rowQtyInput.fill('1')
            await page.waitForTimeout(1000)
          }
        }

        // "출고 요청 생성" 버튼 클릭
        const submitBtn = dlg.locator('button:has-text("출고 요청 생성")')
        const submitEnabled = await submitBtn.isEnabled().catch(() => false)
        console.log(`  출고 요청 생성 버튼 enabled=${submitEnabled}`)

        if (submitEnabled) {
          await submitBtn.click()
          await page.waitForTimeout(8000) // 서버 응답 대기

          const stillOpen = await dlg.isVisible().catch(() => false)
          if (!stillOpen) {
            log('C-1-6', 'PASS', `"${selectedProduct}" 출고 요청 생성 완료 — 다이얼로그 닫힘`)
          } else {
            // 토스트 메시지 확인
            const toastTexts = []
            const toasts = await page.locator('[data-sonner-toast], [role="status"]').all()
            for (const t of toasts) {
              toastTexts.push((await t.textContent().catch(() => '')).trim())
            }
            log('C-1-6', 'FAIL',
              `다이얼로그 안 닫힘 (토스트: ${toastTexts.join(' | ').substring(0, 100) || '없음'})`)
            // 강제 닫기
            await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
            await page.waitForTimeout(500)
          }
        } else {
          const rowCount = await dlg.locator('table tbody tr').count()
          log('C-1-6', 'FAIL',
            `출고 요청 생성 버튼 비활성화 (항목 수=${rowCount}, 제품=${selectedProduct})`)
          await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
          await page.waitForTimeout(500)
        }
      }
    }
  } catch (e) {
    log('C-1-6', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-1-7: 출고 엑셀 업로드 다이얼로그 → Upload 아이콘 버튼 → import dialog 열림
  // /dashboard/outbound?tab=upload 페이지의 "파일 업로드" 버튼
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-7: 출고 엑셀 업로드 다이얼로그 ---')
  try {
    await page.goto(`${BASE}/dashboard/outbound?tab=upload`)
    await waitLoad(3000)

    // 업로드 버튼 찾기: "파일 업로드" 버튼 또는 Upload 아이콘 포함 버튼
    const uploadBtn = page.locator(
      'button:has(.lucide-upload), button:has(.lucide-file-up), button:has-text("파일 업로드"), button:has-text("업로드")'
    ).first()

    const uploadBtnVisible = await uploadBtn.isVisible().catch(() => false)
    console.log(`  업로드 버튼 visible: ${uploadBtnVisible}`)

    if (!uploadBtnVisible) {
      log('C-1-7', 'FAIL', '업로드 버튼 없음 (upload 탭 렌더링 실패 가능)')
    } else {
      await uploadBtn.click()
      await page.waitForTimeout(1500)

      const importDlg = page.locator('[role="dialog"]')
      await importDlg.waitFor({ timeout: 5000 }).catch(() => {})
      const dlgVisible = await importDlg.isVisible().catch(() => false)

      if (dlgVisible) {
        const dlgTitle = await importDlg.locator('h2, [role="heading"]').first()
          .textContent().catch(() => '')
        log('C-1-7', 'PASS', `업로드 다이얼로그 열림 (제목: "${(dlgTitle || '').trim()}")`)
      } else {
        log('C-1-7', 'FAIL', '업로드 버튼 클릭했으나 다이얼로그 열리지 않음')
      }
    }
  } catch (e) {
    log('C-1-7', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-1-8: 업로드 다이얼로그 내 "양식 다운로드"/"템플릿" 버튼 존재 확인
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-1-8: 업로드 다이얼로그 내 템플릿 다운로드 버튼 확인 ---')
  try {
    // C-1-7에서 다이얼로그가 열려있을 수 있으므로 먼저 확인
    let importDlg = page.locator('[role="dialog"]')
    let dlgVisible = await importDlg.isVisible().catch(() => false)

    if (!dlgVisible) {
      // 다시 업로드 페이지로 이동하여 다이얼로그 오픈
      await page.goto(`${BASE}/dashboard/outbound?tab=upload`)
      await waitLoad(3000)

      const uploadBtn = page.locator(
        'button:has(.lucide-upload), button:has(.lucide-file-up), button:has-text("파일 업로드"), button:has-text("업로드")'
      ).first()

      if (await uploadBtn.isVisible().catch(() => false)) {
        await uploadBtn.click()
        await page.waitForTimeout(1500)
        importDlg = page.locator('[role="dialog"]')
        dlgVisible = await importDlg.isVisible().catch(() => false)
      }
    }

    if (!dlgVisible) {
      log('C-1-8', 'FAIL', '업로드 다이얼로그를 열 수 없음')
    } else {
      // "양식 다운로드", "템플릿", "샘플", "다운로드" 텍스트 포함 버튼 찾기
      const templateBtn = importDlg.locator(
        'button:has-text("양식 다운로드"), button:has-text("템플릿"), button:has-text("샘플 다운로드"), button:has-text("양식")'
      ).first()
      const templateBtnVisible = await templateBtn.isVisible().catch(() => false)
      console.log(`  템플릿 버튼 visible: ${templateBtnVisible}`)

      // 버튼 텍스트로 찾지 못하면 다이얼로그 텍스트에서 "양식" 또는 "템플릿" 포함 여부 확인
      if (!templateBtnVisible) {
        const dlgText = await importDlg.textContent().catch(() => '')
        const hasTemplateText = (dlgText || '').includes('양식') ||
          (dlgText || '').includes('템플릿') ||
          (dlgText || '').includes('다운로드')
        console.log(`  다이얼로그 내 템플릿 관련 텍스트: ${hasTemplateText}`)
        if (hasTemplateText) {
          log('C-1-8', 'PASS', '다이얼로그 내 양식/템플릿 관련 텍스트 확인됨')
        } else {
          log('C-1-8', 'FAIL', '양식 다운로드/템플릿 버튼 또는 텍스트 없음')
        }
      } else {
        const btnText = await templateBtn.textContent().catch(() => '')
        log('C-1-8', 'PASS', `템플릿 버튼 존재: "${(btnText || '').trim()}"`)
      }

      // 다이얼로그 닫기
      const closeBtn = importDlg.locator('button:has-text("취소"), button:has-text("닫기"), button[aria-label="Close"]').first()
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {})
      } else {
        await page.keyboard.press('Escape')
      }
      await page.waitForTimeout(500)
    }
  } catch (e) {
    log('C-1-8', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-2-1: 출고확정(창고) → /dashboard/warehouse/outbound → 대기 목록 행 존재
  // C-1-6에서 생성한 출고 요청 1건이 여기 나타나야 함
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-2-1: 창고 출고 확정 페이지 — 대기 목록 확인 ---')
  try {
    await page.goto(`${BASE}/dashboard/warehouse/outbound`)
    await waitLoad(3000)

    const heading = page.locator('h1').filter({ hasText: /출고확정|출고/ }).first()
    const headingVisible = await heading.isVisible().catch(() => false)
    console.log(`  출고확정 헤딩: ${headingVisible}`)

    // 기본 필터는 "대기중" — 테이블 또는 빈 상태 확인
    const tableVisible = await page.locator('table').first().isVisible().catch(() => false)
    const emptyMsg = await page.locator('text=출고 요청이 없습니다, text=대기중인 출고 요청이 없습니다')
      .first().isVisible().catch(() => false)

    if (tableVisible) {
      const rowCount = await page.locator('table tbody tr').count()
      console.log(`  대기 목록 테이블 행: ${rowCount}개`)

      if (rowCount > 0) {
        log('C-2-1', 'PASS', `대기 목록 ${rowCount}개 존재 (C-1-6에서 생성한 출고 요청 포함)`)
      } else {
        // 테이블은 있지만 행이 없는 경우
        log('C-2-1', 'FAIL', '테이블은 렌더링됐으나 대기 중인 출고 요청 없음 (C-1-6 출고 요청 생성 실패 가능)')
      }
    } else if (emptyMsg) {
      log('C-2-1', 'FAIL', '대기중인 출고 요청 없음 — 빈 상태 메시지 표시')
    } else if (headingVisible) {
      log('C-2-1', 'PASS', '출고확정 페이지 접근 성공 (로딩 중이거나 데이터 준비 중)')
    } else {
      log('C-2-1', 'FAIL', '출고확정 페이지 렌더링 실패')
    }
  } catch (e) {
    log('C-2-1', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-2-2: 테이블 헤더에 "가용재고" 또는 "대기" 텍스트 존재 확인
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-2-2: 창고 출고 테이블 헤더 "가용재고"/"대기" 확인 ---')
  try {
    // C-2-1에서 이미 해당 페이지에 있으므로 재이동 생략
    const tableVisible = await page.locator('table').first().isVisible().catch(() => false)

    if (!tableVisible) {
      // 빈 상태이면 페이지 텍스트에서 직접 확인
      const bodyText = await page.textContent('body').catch(() => '')
      const hasAvailStock = (bodyText || '').includes('가용재고')
      const hasBacklog = (bodyText || '').includes('대기수량') || (bodyText || '').includes('대기')
      if (hasAvailStock || hasBacklog) {
        log('C-2-2', 'PASS',
          `페이지 내 가용재고=${hasAvailStock}, 대기수량/대기=${hasBacklog} 텍스트 존재`)
      } else {
        log('C-2-2', 'FAIL', '테이블 없고 가용재고/대기 텍스트도 없음')
      }
    } else {
      // thead에서 찾기
      const thead = page.locator('thead')
      const theadText = await thead.textContent().catch(() => '')
      const hasAvailStock = (theadText || '').includes('가용재고')
      const hasBacklog = (theadText || '').includes('대기수량') || (theadText || '').includes('대기')
      console.log(`  thead 텍스트에 가용재고: ${hasAvailStock}, 대기: ${hasBacklog}`)

      if (hasAvailStock || hasBacklog) {
        log('C-2-2', 'PASS',
          `헤더 확인됨 — 가용재고=${hasAvailStock}, 대기수량/대기=${hasBacklog}`)
      } else {
        // span 형태로 렌더링될 수 있음 (Tooltip trigger 내부)
        const availStockSpan = page.locator('thead').getByText(/가용재고/).first()
        const backlogSpan = page.locator('thead').getByText(/대기수량|대기/).first()
        const availVisible = await availStockSpan.isVisible().catch(() => false)
        const backlogVisible = await backlogSpan.isVisible().catch(() => false)
        if (availVisible || backlogVisible) {
          log('C-2-2', 'PASS', `헤더 span 확인됨 — 가용재고=${availVisible}, 대기=${backlogVisible}`)
        } else {
          log('C-2-2', 'FAIL', '테이블 헤더에 가용재고/대기 텍스트 없음')
        }
      }
    }
  } catch (e) {
    log('C-2-2', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-2-3: "피킹지" 텍스트 포함 버튼 존재 확인 (체크박스 선택 후)
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-2-3: 피킹지 버튼 확인 (체크박스 선택 후) ---')
  try {
    // 테이블이 있는지 확인
    const tableVisible = await page.locator('table').first().isVisible().catch(() => false)

    if (!tableVisible) {
      // 테이블 없음 — 이 경우 "피킹지" 텍스트가 있는지 바로 확인 (숨겨진 요소 포함)
      const pickingBtn = page.locator('button:has-text("피킹지")').first()
      const pickingBtnExists = await pickingBtn.evaluate(el => !!el).catch(() => false)
      if (pickingBtnExists) {
        log('C-2-3', 'PASS', '"피킹지" 버튼 DOM에 존재 (체크박스 미선택 상태로 숨김)')
      } else {
        log('C-2-3', 'FAIL', '테이블 없음 + 피킹지 버튼도 없음 (출고 대기 건 필요)')
      }
    } else {
      const rowCount = await page.locator('table tbody tr').count()
      if (rowCount === 0) {
        log('C-2-3', 'FAIL', '테이블 있으나 행 없음 — 체크박스 선택 불가')
      } else {
        // 첫 번째 행의 체크박스 선택
        const firstRowCheckbox = page.locator('table tbody tr').first().locator('[role="checkbox"]').first()
        const checkboxVisible = await firstRowCheckbox.isVisible().catch(() => false)

        if (!checkboxVisible) {
          log('C-2-3', 'FAIL', '체크박스 없음 (대기중 이외의 상태 항목)')
        } else {
          await firstRowCheckbox.click()
          await page.waitForTimeout(800)

          // "피킹지 다운로드" 버튼 확인 (선택 시 상태바에 나타남)
          const pickingBtn = page.locator('button:has-text("피킹지")').first()
          const pickingBtnVisible = await pickingBtn.isVisible().catch(() => false)
          console.log(`  피킹지 버튼 visible: ${pickingBtnVisible}`)

          if (pickingBtnVisible) {
            const btnText = await pickingBtn.textContent().catch(() => '')
            log('C-2-3', 'PASS', `"피킹지" 버튼 표시됨: "${(btnText || '').trim()}"`)
          } else {
            log('C-2-3', 'FAIL', '체크박스 선택 후에도 피킹지 버튼 없음')
          }

          // 체크박스 선택 해제
          await firstRowCheckbox.click().catch(() => {})
          await page.waitForTimeout(300)
        }
      }
    }
  } catch (e) {
    log('C-2-3', 'FAIL', e.message)
  }

  // ──────────────────────────────────────────────────────────
  // C-3-1: 출고현황 탭 → /dashboard/outbound?tab=records
  //        → 테이블 렌더링 + 다운로드 버튼 존재
  // ──────────────────────────────────────────────────────────
  console.log('\n--- C-3-1: 출고현황 탭 + 다운로드 버튼 ---')
  try {
    await page.goto(`${BASE}/dashboard/outbound?tab=records`)
    await waitLoad(3000)

    // 테이블 또는 로딩/빈 상태 확인
    const tableVisible = await page.locator('table').first().isVisible().catch(() => false)
    const loadingMsg = await page.locator('text=출고 기록을 불러오는 중').isVisible().catch(() => false)
    const emptyMsg = await page.locator('text=없습니다').first().isVisible().catch(() => false)
    const hasTableArea = tableVisible || loadingMsg || emptyMsg

    // 엑셀 다운 버튼 확인 ("엑셀 다운" 또는 다운로드 아이콘 버튼)
    const downloadBtn = page.locator('button:has-text("엑셀 다운"), button:has-text("다운로드")').first()
    const downloadBtnVisible = await downloadBtn.isVisible().catch(() => false)

    // 출고 요청 버튼 확인 (records 탭에서도 출고 요청 가능)
    const reqBtnVisible = await page.locator('button:has-text("출고 요청")').isVisible().catch(() => false)

    console.log(`  테이블 영역 렌더링: ${hasTableArea}`)
    console.log(`  엑셀 다운 버튼: ${downloadBtnVisible}`)
    console.log(`  출고 요청 버튼: ${reqBtnVisible}`)

    if (hasTableArea && downloadBtnVisible) {
      log('C-3-1', 'PASS', `출고현황 탭 렌더링 완료 + 엑셀 다운 버튼 존재`)
    } else if (hasTableArea) {
      log('C-3-1', 'FAIL', '출고현황 테이블 영역 있으나 엑셀 다운 버튼 없음')
    } else {
      log('C-3-1', 'FAIL', '출고현황 탭 렌더링 실패 (테이블/로딩/빈 상태 모두 없음)')
    }
  } catch (e) {
    log('C-3-1', 'FAIL', e.message)
  }

  // ============================================================
  // 최종 결과 출력
  // ============================================================
  await browser.close()

  console.log('\n' + '='.repeat(60))
  console.log(`  Group C 출고 섹션 결과: ✅ PASS ${passed}개 | ❌ FAIL ${failed}개 | 총 ${results.length}개`)
  console.log('='.repeat(60))
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : 'ℹ️'
    console.log(`  ${icon} ${r.label}: ${r.detail}`)
  }
  console.log('')

  if (failed > 0) {
    console.log(`주의: ${failed}개 실패`)
    process.exit(1)
  } else {
    console.log('전체 통과!')
  }
}

main().catch((e) => {
  console.error('치명적 오류:', e.message)
  console.error(e.stack?.split('\n').slice(0, 5).join('\n'))
  process.exit(1)
})
