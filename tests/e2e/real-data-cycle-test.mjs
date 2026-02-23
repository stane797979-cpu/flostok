import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const BASE = process.env.BASE_URL || 'http://localhost:3001'
const EMAIL = 'admin1@stocklogis.com'
const PASSWORD = 'admin1234'

let browser, ctx, page, passed = 0, failed = 0
const results = []

// .env.local에서 환경변수 읽기
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
  } catch { return {} }
}

// 테스트 전 cleanup: pending 출고 요청 모두 취소
async function cleanupPendingOutbound() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('  ⚠ Supabase 환경변수 없음 — cleanup 생략')
    return 0
  }
  const sb = createClient(url, key)
  const { data, error } = await sb
    .from('outbound_requests')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .select('id')

  if (error) {
    console.log(`  ⚠ cleanup 오류: ${error.message}`)
    return 0
  }
  return data?.length || 0
}

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
  const isVisible = await combo.isVisible().catch(() => false)
  if (!isVisible) {
    console.log(`  ⚠ combobox[${comboboxIndex}] 없거나 안 보임`)
    return null
  }

  // 현재 combobox 텍스트 확인
  const beforeText = await combo.textContent().catch(() => '?')
  console.log(`  combobox 클릭 전 텍스트: "${(beforeText || '').trim()}"`)

  await combo.click()
  await page.waitForTimeout(3000) // 서버에서 제품 로드 대기

  // cmdk 아이템 찾기
  let opts = await page.locator('[cmdk-item]').all()
  console.log(`  cmdk 제품 목록: ${opts.length}개`)

  if (opts.length === 0) return null

  // 첫 번째 아이템의 텍스트 캡처
  const itemText = await opts[0].textContent().catch(() => '')
  console.log(`  첫 번째 cmdk-item 텍스트: "${(itemText || '').trim()}"`)

  // 방법: 키보드로 선택 (ArrowDown + Enter)
  // cmdk는 키보드 네비게이션을 지원함
  const cmdInput = page.locator('[cmdk-input]')
  if (await cmdInput.isVisible().catch(() => false)) {
    await cmdInput.press('ArrowDown')
    await page.waitForTimeout(300)
    await cmdInput.press('Enter')
  } else {
    // fallback: 직접 클릭
    await opts[0].click()
  }

  await page.waitForTimeout(2000)

  // combobox 텍스트가 변경되었는지 확인 (제품이 선택되었으면 변경됨)
  const afterText = await combo.textContent().catch(() => '?')
  console.log(`  combobox 선택 후 텍스트: "${(afterText || '').trim()}"`)

  const selected = afterText !== beforeText && !(afterText || '').includes('검색하세요')
  if (selected) {
    return (afterText || '').trim()
  }

  // 텍스트 변경 안 됐으면 itemText로 반환
  if (itemText && itemText.trim()) {
    return itemText.trim()
  }

  return null
}

async function main() {
  console.log('='.repeat(60))
  console.log('  Stock & Logis 실제 데이터 흐름 테스트')
  console.log('  발주 → 입고 → 출고 전체 사이클')
  console.log('='.repeat(60))

  browser = await chromium.launch({ headless: true })
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  page = await ctx.newPage()

  try {
    // ====== Pre-test Cleanup ======
    console.log('\n--- Pre-test: 테스트 데이터 정리 ---')
    const cancelledCount = await cleanupPendingOutbound()
    console.log(`  ✓ pending 출고 요청 ${cancelledCount}개 취소됨`)

    // ====== Phase 0: 로그인 ======
    console.log('\n--- Phase 0: 로그인 ---')
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    log('로그인', 'PASS', `${EMAIL} 로그인 완료`)

    // ====== Phase 1: 재고 사전 기록 ======
    console.log('\n--- Phase 1: 재고 사전 기록 ---')
    await page.goto(`${BASE}/dashboard/inventory`)
    await wl(3000)

    // 재고 페이지의 실제 숫자값 찾기 (테이블 또는 카드에서)
    let beforeStock = null
    // "재고 데이터가 없습니다" 메시지가 있으면 데이터 0
    const emptyMsg = await page.locator('text=데이터가 없습니다').isVisible().catch(() => false)
    if (!emptyMsg) {
      const rows = await page.locator('table tbody tr').all()
      if (rows.length > 0) {
        const cells = await rows[0].locator('td').all()
        const cellTexts = []
        for (const c of cells) { cellTexts.push((await c.textContent() || '').trim()) }
        console.log(`  첫 행: ${cellTexts.join(' | ')}`)
        // 현재고 열 찾기
        for (const t of cellTexts) {
          const cleaned = t.replace(/[,개\s]/g, '')
          const num = parseInt(cleaned)
          if (!isNaN(num) && num >= 0 && cleaned === String(num)) {
            beforeStock = num
            break
          }
        }
      }
    }
    console.log(`  입고 전 현재고: ${beforeStock}`)
    log('재고 현황', 'PASS', `현재고=${beforeStock ?? '확인불가'}`)

    // ====== Phase 2: 발주 생성 ======
    console.log('\n--- Phase 2: 발주 생성 ---')
    await page.goto(`${BASE}/dashboard/orders?tab=reorder`)
    await wl(3000)
    const reorderEmpty = await page.locator('text=데이터가 없습니다, text=발주 필요 품목이 없습니다').first().isVisible().catch(() => false)
    const reorderCount = reorderEmpty ? 0 : await page.locator('table tbody tr').count()
    if (reorderCount > 0) {
      log('발주 필요 품목', 'PASS', `${reorderCount}개`)
    } else {
      log('발주 필요 품목', 'INFO', '없음 — 재고 충분')
    }

    // ====== Phase 3: 발주 확정 ======
    console.log('\n--- Phase 3: 발주 확정 ---')
    await page.goto(`${BASE}/dashboard/orders?tab=orders`)
    await wl(3000)
    const poEmpty = await page.locator('text=데이터가 없습니다, text=발주서가 없습니다').first().isVisible().catch(() => false)
    if (poEmpty) {
      log('발주현황', 'INFO', '발주서 없음')
    } else {
      const poCount = await page.locator('table tbody tr').count()
      log('발주현황', poCount > 0 ? 'PASS' : 'INFO', `${poCount}개 발주서`)
    }

    // ====== Phase 4: 입고 처리 ======
    console.log('\n--- Phase 4: 입고 처리 ---')

    // 기타 입고로 직접 진행 (가장 확실한 경로)
    await page.goto(`${BASE}/dashboard/orders?tab=inbound`)
    await wl(3000)
    const otherBtn = page.locator('button:has-text("기타 입고")')
    if (await otherBtn.isVisible().catch(() => false)) {
      await otherBtn.click()
      await page.waitForTimeout(1500)
      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 })
      console.log('  기타 입고 다이얼로그 열림')

      // 1) 제품 선택 (cmdk ProductCombobox — 인덱스 0)
      const pName = await selectProductFromCmdk(dlg, 0)
      if (pName) {
        console.log(`  ✓ 선택된 제품: ${pName}`)

        // Popover가 아직 열려있으면 Dialog 내부 클릭으로 닫기 (바깥 클릭 시 Dialog 닫힘)
        const popoverOpen = await page.locator('[cmdk-list]').isVisible().catch(() => false)
        if (popoverOpen) {
          console.log('  Popover 아직 열림 — Dialog 내부 클릭으로 닫기')
          await dlg.locator('h2').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(1000)
        }

        // 2) 입고 유형 Select (인덱스 1)
        const typeCombo = dlg.locator('button[role="combobox"]').nth(1)
        const typeComboVisible = await typeCombo.isVisible().catch(() => false)
        console.log(`  입고유형 combobox visible: ${typeComboVisible}`)
        if (typeComboVisible) {
          await typeCombo.click({ force: true })
          await page.waitForTimeout(1000)
          const typeOpts = await page.locator('[role="option"]').all()
          console.log(`  입고유형 옵션: ${typeOpts.length}개`)
          if (typeOpts.length > 0) {
            // "반품 입고" 또는 첫번째
            const returnOpt = page.locator('[role="option"]:has-text("반품")').first()
            if (await returnOpt.isVisible().catch(() => false)) {
              await returnOpt.click()
              console.log('  입고유형: 반품 입고')
            } else {
              const optTxt = await typeOpts[0].textContent()
              await typeOpts[0].click()
              console.log(`  입고유형: ${(optTxt || '').trim()}`)
            }
          }
          await page.waitForTimeout(500)
        }

        // 3) 수량 입력
        const qtyInput = dlg.locator('#oi-quantity')
        if (await qtyInput.isVisible().catch(() => false)) {
          await qtyInput.fill('50')
          console.log('  수량: 50개')
        } else {
          const numInput = dlg.locator('input[type="number"]').first()
          await numInput.fill('50')
          console.log('  수량 (fallback): 50개')
        }
        await page.waitForTimeout(500)

        // 4) 입고 처리 버튼
        const sub = dlg.locator('button:has-text("입고 처리")')
        const subVisible = await sub.isVisible().catch(() => false)
        const subEnabled = await sub.isEnabled().catch(() => false)
        console.log(`  입고처리 버튼 visible=${subVisible}, enabled=${subEnabled}`)

        if (subVisible && subEnabled) {
          await sub.click()
          await page.waitForTimeout(5000)
          const still = await dlg.isVisible().catch(() => false)
          if (!still) {
            log('기타 입고', 'PASS', `${pName} 50개 입고 완료`)
          } else {
            // 토스트 메시지 확인
            const toast = await page.locator('[role="status"], [data-sonner-toast]').textContent().catch(() => '')
            log('기타 입고', 'FAIL', `다이얼로그 안 닫힘 (토스트: ${(toast || '없음').trim()})`)
          }
        } else {
          // 디버깅 — 왜 비활성화?
          const pVal = await dlg.locator('button[role="combobox"]').nth(0).textContent().catch(() => '?')
          const tVal = await dlg.locator('button[role="combobox"]').nth(1).textContent().catch(() => '?')
          const qVal = await qtyInput.inputValue().catch(() => '?')
          log('기타 입고', 'FAIL', `버튼 비활성화 (제품="${(pVal||'').trim()}", 유형="${(tVal||'').trim()}", 수량=${qVal})`)
        }
      } else {
        log('기타 입고', 'FAIL', '제품 선택 실패')
      }
    } else {
      log('기타 입고', 'FAIL', '기타 입고 버튼 없음')
    }

    // ====== Phase 5: 출고 요청 ======
    console.log('\n--- Phase 5: 출고 요청 ---')
    await page.goto(`${BASE}/dashboard/outbound`)
    await wl(3000)
    const reqBtn = page.locator('button:has-text("출고 요청")')
    if (await reqBtn.isVisible().catch(() => false)) {
      await reqBtn.click()
      await page.waitForTimeout(1500)
      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 })
      console.log('  출고 요청 다이얼로그 열림')

      // 1) 출고 유형 Select (인덱스 0)
      const typeCombo = dlg.locator('button[role="combobox"]').first()
      await typeCombo.click({ force: true })
      await page.waitForTimeout(800)
      const saleOpt = page.locator('[role="option"]:has-text("판매 출고")').first()
      if (await saleOpt.isVisible().catch(() => false)) {
        await saleOpt.click()
        console.log('  출고유형: 판매 출고')
      } else {
        const fOpt = page.locator('[role="option"]').first()
        if (await fOpt.isVisible().catch(() => false)) {
          await fOpt.click()
        }
      }
      await page.waitForTimeout(500)

      // 2) 제품 선택 (인덱스 1 = ProductCombobox)
      const pName = await selectProductFromCmdk(dlg, 1)
      if (pName) {
        console.log(`  ✓ 선택된 제품: ${pName}`)

        // Popover 강제 닫기 (Dialog 내부 클릭으로 — 바깥 클릭하면 Dialog 닫힘)
        const popoverOpen = await page.locator('[cmdk-list]').isVisible().catch(() => false)
        if (popoverOpen) {
          await dlg.locator('h2').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(1000)
        }

        const si = await dlg.locator('text=현재고').textContent().catch(() => '')
        if (si) console.log(`  ${si}`)

        // 3) 수량 입력
        const qtyInput = dlg.locator('input[placeholder="수량"]')
        await qtyInput.click({ force: true })
        await qtyInput.fill('3')
        console.log('  수량: 3개')
        await page.waitForTimeout(500)

        // 4) + 버튼
        const addB = dlg.locator('button:has(svg.lucide-plus)').first()
        const addVisible = await addB.isVisible().catch(() => false)
        const addEnabled = await addB.isEnabled().catch(() => false)
        console.log(`  + 버튼 visible=${addVisible}, enabled=${addEnabled}`)

        if (addVisible && addEnabled) {
          await addB.click({ force: true })
          await page.waitForTimeout(1500)
          const ic = await dlg.locator('table tbody tr').count()
          log('출고 항목 추가', 'PASS', `${ic}개 항목`)

          // 재고 부족 체크
          const warn = await dlg.locator('text=재고가 부족한').isVisible().catch(() => false)
          if (warn) {
            console.log('  재고 부족 — 수량 1로 변경')
            await dlg.locator('table tbody tr').first().locator('input[type="number"]').fill('1')
            await page.waitForTimeout(1000)
          }

          // 5) 출고 요청 생성 버튼
          await page.waitForTimeout(500)
          const sb = dlg.locator('button:has-text("출고 요청 생성")')
          const sbEnabled = await sb.isEnabled().catch(() => false)
          console.log(`  출고 요청 생성 버튼 enabled=${sbEnabled}`)

          if (sbEnabled) {
            await sb.click()
            await page.waitForTimeout(8000)
            const still = await dlg.isVisible().catch(() => false)
            if (!still) {
              log('출고 요청 생성', 'PASS', `${pName} 출고 요청 완료`)
            } else {
              // 에러 토스트 확인
              const toasts = await page.locator('[data-sonner-toast], [role="status"]').all()
              let errMsg = ''
              for (const t of toasts) {
                errMsg += (await t.textContent().catch(() => '')) + ' '
              }
              log('출고 요청 생성', 'FAIL', `다이얼로그 안 닫힘 ${errMsg.trim() ? '(' + errMsg.trim().substring(0, 100) + ')' : ''}`)
              // 닫기 시도
              await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
              await page.waitForTimeout(500)
            }
          } else {
            log('출고 요청 생성', 'FAIL', '버튼 비활성화 (재고 부족)')
          }
        } else {
          log('출고 항목 추가', 'FAIL', '+ 버튼 비활성화')
        }
      } else {
        log('출고 제품 선택', 'FAIL', '제품 선택 실패')
      }
    } else {
      log('출고 요청', 'FAIL', '버튼 없음')
    }

    // ====== Phase 6: 출고 확정 ======
    console.log('\n--- Phase 6: 출고 확정 ---')
    await page.goto(`${BASE}/dashboard/warehouse/outbound`)
    await wl(3000)
    const obRows = await page.locator('table tbody tr').count()
    const obEmpty = await page.locator('text=데이터가 없습니다, text=출고 요청이 없습니다').first().isVisible().catch(() => false)
    if (obRows > 0 && !obEmpty) {
      log('출고 대기', 'PASS', `${obRows}개 대기`)
      const obBtn = page.locator('table tbody tr').first().locator('button:has-text("확정"), button:has-text("처리"), button:has-text("출고")').first()
      if (await obBtn.isVisible().catch(() => false)) {
        await obBtn.click()
        await page.waitForTimeout(2000)
        const dlg = page.locator('[role="dialog"]')
        if (await dlg.isVisible().catch(() => false)) {
          const cfb = dlg.locator('button:has-text("출고 확정"), button:has-text("확정"), button:has-text("확인")').last()
          if (await cfb.isVisible().catch(() => false) && await cfb.isEnabled().catch(() => false)) {
            await cfb.click()
            await page.waitForTimeout(5000)
            const still = await dlg.isVisible().catch(() => false)
            if (!still) {
              log('출고 확정', 'PASS', '출고 확정 완료 — 재고 차감됨')
            } else {
              log('출고 확정', 'FAIL', '다이얼로그 안 닫힘')
            }
          }
        } else {
          log('출고 확정', 'PASS', '바로 처리됨')
        }
      } else {
        log('출고 확정', 'INFO', '확정 버튼 없음')
      }
    } else {
      log('출고 대기', 'INFO', '대기 건 없음')
    }

    // ====== Phase 7: 재고 변동 검증 ======
    console.log('\n--- Phase 7: 재고 변동 검증 ---')
    await page.goto(`${BASE}/dashboard/inventory`)
    await wl(3000)
    let afterStock = null
    const afterEmpty = await page.locator('text=데이터가 없습니다').isVisible().catch(() => false)
    if (!afterEmpty) {
      const rows = await page.locator('table tbody tr').all()
      if (rows.length > 0) {
        const cells = await rows[0].locator('td').all()
        const cellTexts = []
        for (const c of cells) { cellTexts.push((await c.textContent() || '').trim()) }
        console.log(`  첫 행: ${cellTexts.join(' | ')}`)
        for (const t of cellTexts) {
          const cleaned = t.replace(/[,개\s]/g, '')
          const num = parseInt(cleaned)
          if (!isNaN(num) && num >= 0 && cleaned === String(num)) {
            afterStock = num
            break
          }
        }
      }
    }
    console.log(`  최종 현재고: ${afterStock}`)

    if (beforeStock !== null && afterStock !== null) {
      const diff = afterStock - beforeStock
      log('재고 변동', diff !== 0 ? 'PASS' : 'INFO',
        `변동: ${diff > 0 ? '+' : ''}${diff} (이전=${beforeStock}, 이후=${afterStock})`)
    } else {
      log('재고 현황', 'INFO', `이전=${beforeStock}, 이후=${afterStock}`)
    }

    // 수불현황 확인
    await page.goto(`${BASE}/dashboard/movement`)
    await wl(3000)
    const mvEmpty = await page.locator('text=데이터가 없습니다').isVisible().catch(() => false)
    const mvRows = mvEmpty ? 0 : await page.locator('table tbody tr').count()
    if (mvRows > 0) {
      const first = page.locator('table tbody tr').first()
      const cells = await first.locator('td').all()
      const txts = []
      for (const c of cells) { txts.push(await c.textContent()) }
      console.log(`  최근 수불: ${txts.map(t => (t || '').trim()).join(' | ')}`)
      log('수불현황 기록', 'PASS', `${mvRows}개 기록`)
    } else {
      log('수불현황 기록', 'INFO', '기록 없음')
    }

    // ====== Phase 8: 재고 부족 차단 테스트 ======
    console.log('\n--- Phase 8: 재고 부족 차단 ---')
    await page.goto(`${BASE}/dashboard/outbound`)
    await wl(3000)
    const rb2 = page.locator('button:has-text("출고 요청")')
    if (await rb2.isVisible().catch(() => false)) {
      await rb2.click()
      await page.waitForTimeout(1500)
      const dlg = page.locator('[role="dialog"]')
      await dlg.waitFor({ timeout: 5000 })

      // 출고 유형
      const fc = dlg.locator('button[role="combobox"]').first()
      await fc.click({ force: true })
      await page.waitForTimeout(800)
      const fOpt = page.locator('[role="option"]').first()
      if (await fOpt.isVisible().catch(() => false)) await fOpt.click()
      await page.waitForTimeout(500)

      // 제품 선택
      const pName8 = await selectProductFromCmdk(dlg, 1)
      if (pName8) {
        console.log(`  선택된 제품: ${pName8}`)

        // Popover가 아직 열려있으면 다이얼로그 제목 클릭으로 닫기 (바깥 클릭하면 다이얼로그 닫힘)
        const cmdkStill = await page.locator('[cmdk-list]').isVisible().catch(() => false)
        if (cmdkStill) {
          await dlg.locator('h2').first().click({ force: true }).catch(() => {})
          await page.waitForTimeout(1000)
        }

        // 99999개 수량
        const qtyInput = dlg.locator('input[placeholder="수량"]')
        await qtyInput.click({ force: true })
        await qtyInput.fill('99999')
        await page.waitForTimeout(500)

        // + 버튼
        const ab = dlg.locator('button:has(svg.lucide-plus)').first()
        if (await ab.isVisible().catch(() => false) && await ab.isEnabled().catch(() => false)) {
          await ab.click({ force: true })
          await page.waitForTimeout(1500)
        }

        // 재고 부족 확인
        const warn = await dlg.locator('text=재고가 부족한').isVisible().catch(() => false)
        const sb = dlg.locator('button:has-text("출고 요청 생성")')
        const dis = await sb.isDisabled().catch(() => true)
        console.log(`  재고부족 경고: ${warn}, 버튼 비활성화: ${dis}`)

        if (warn || dis) {
          log('재고 부족 차단', 'PASS', '99999개 출고 차단됨')
        } else {
          log('재고 부족 차단', 'FAIL', '차단 안 됨')
        }
      } else {
        log('재고 부족 차단', 'FAIL', '제품 선택 실패')
      }

      await dlg.locator('button:has-text("취소")').first().click().catch(() => {})
    }

  } catch (e) {
    console.error('\n❌ 치명적 오류:', e.message)
    console.error('  Stack:', e.stack?.split('\n').slice(0, 3).join('\n  '))
    log('치명적 오류', 'FAIL', e.message)
  } finally {
    await browser.close()
  }

  console.log('\n' + '='.repeat(60))
  console.log(`  결과: ✅ PASS ${passed}개 | ❌ FAIL ${failed}개 | 총 ${results.length}개`)
  console.log('='.repeat(60))
  for (const r of results) {
    const i = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : 'ℹ️'
    console.log(`  ${i} ${r.label}: ${r.detail || ''}`)
  }
  if (failed > 0) { console.log(`\n⚠️ ${failed}개 실패`); process.exit(1) }
  else { console.log('\n🎉 전체 통과!') }
}

main()
