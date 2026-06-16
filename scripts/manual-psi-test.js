/**
 * PSI 및 발주 스코어링 수동 테스트 스크립트
 * Node.js로 직접 Playwright 실행
 */

const { chromium } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  // 스크린샷 디렉토리 생성
  const screenshotDir = path.join(process.cwd(), 'test-results', 'screenshots');
  await fs.mkdir(screenshotDir, { recursive: true });

  console.log('🚀 Playwright 브라우저 시작...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ============================================
    // 로그인
    // ============================================
    console.log('\n📝 Step 1: 로그인');
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('#email', { timeout: 10000 });

    // 로그인 전 스크린샷
    await page.screenshot({
      path: path.join(screenshotDir, 'login-01-before.png'),
      fullPage: true
    });

    await page.click('#email');
    await page.keyboard.type('admin1@stocklogis.com', { delay: 50 });
    await page.click('#password');
    await page.keyboard.type('admin1234', { delay: 50 });

    console.log('  📝 이메일/비밀번호 입력 완료');

    await page.click('button[type="submit"]');
    console.log('  🖱️ 로그인 버튼 클릭');

    // 로그인 처리 대기
    await page.waitForTimeout(3000);

    // 로그인 후 스크린샷
    await page.screenshot({
      path: path.join(screenshotDir, 'login-02-after.png'),
      fullPage: true
    });

    const currentUrl = page.url();
    console.log(`  현재 URL: ${currentUrl}`);

    // 에러 메시지 확인
    const errorElement = await page.locator('[role="alert"], .text-destructive, .alert-destructive').first();
    const hasError = await errorElement.isVisible().catch(() => false);

    if (hasError) {
      const errorText = await errorElement.textContent();
      console.log(`  ❌ 로그인 에러: ${errorText}`);
    }

    // 대시보드로 이동되었는지 확인
    if (!currentUrl.includes('/dashboard')) {
      console.log('  ⚠️ 대시보드로 자동 리다이렉트되지 않음.');
      console.log('  ℹ️ 인증 상태를 확인 중...');

      // 쿠키 확인
      const cookies = await page.context().cookies();
      const hasAuthCookie = cookies.some(c => c.name.includes('auth') || c.name.includes('session'));
      console.log(`  🍪 인증 쿠키 존재: ${hasAuthCookie}`);

      if (!hasAuthCookie) {
        console.log('  ❌ 로그인 실패. 테스트를 종료합니다.');
        return;
      }

      console.log('  ⏭️ 수동으로 대시보드로 이동합니다.');
      await page.goto('http://localhost:3000/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    console.log('✅ 로그인 완료');

    // ============================================
    // 테스트 1: PSI 페이지 전체 확인
    // ============================================
    console.log('\n📊 테스트 1: PSI 페이지 전체 확인');
    await page.goto('http://localhost:3000/dashboard/psi');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(screenshotDir, 'psi-01-overview.png'),
      fullPage: true
    });
    console.log('  ✅ 스크린샷 저장: psi-01-overview.png');

    // PSI 테이블 데이터 추출
    const rows = await page.locator('table tbody tr').count();
    console.log(`  📌 총 제품 수: ${rows}개`);

    if (rows > 0) {
      const firstRow = page.locator('table tbody tr').first();
      const headers = await page.locator('table thead th').allTextContents();
      const cells = await firstRow.locator('td, th').allTextContents();

      console.log('\n  📋 첫 번째 제품 PSI 데이터:');
      headers.forEach((header, idx) => {
        console.log(`    ${header}: ${cells[idx] || 'N/A'}`);
      });
    }

    // ============================================
    // 테스트 2: PSI 필터 테스트
    // ============================================
    console.log('\n🔍 테스트 2: PSI 필터 테스트');

    // ABC 등급 필터 확인
    const abcFilterExists = await page.locator('button, select').filter({ hasText: /ABC|등급/ }).count() > 0;
    if (abcFilterExists) {
      console.log('  📌 ABC 등급 필터 발견');
      const abcFilter = page.locator('button, select').filter({ hasText: /ABC|등급/ }).first();
      await abcFilter.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: path.join(screenshotDir, 'psi-02-abc-filter.png'),
        fullPage: true
      });
      console.log('  ✅ 스크린샷 저장: psi-02-abc-filter.png');
    } else {
      console.log('  ⚠️ ABC 등급 필터를 찾을 수 없습니다');
    }

    // 검색 기능 테스트
    const searchInput = page.locator('input[type="search"], input[placeholder*="검색"]').first();
    const searchExists = await searchInput.count() > 0;
    if (searchExists) {
      console.log('  📌 검색 입력란 발견');
      await searchInput.fill('SKU');
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: path.join(screenshotDir, 'psi-03-search.png'),
        fullPage: true
      });
      console.log('  ✅ 스크린샷 저장: psi-03-search.png');

      // 검색 초기화
      await searchInput.clear();
      await page.waitForTimeout(500);
    }

    // ============================================
    // 테스트 3: PSI SCM 가이드 확인
    // ============================================
    console.log('\n🎯 테스트 3: PSI SCM 가이드 확인');
    const scmGuideRow = page.locator('tr').filter({ hasText: /SCM|가이드|발주제안|권장/ });
    const scmGuideExists = await scmGuideRow.count() > 0;

    if (scmGuideExists) {
      console.log('  📌 SCM 가이드 행 발견');
      const guideCells = await scmGuideRow.first().locator('td, th').allTextContents();
      console.log('  📋 SCM 가이드 값:', guideCells.join(' | '));

      await page.screenshot({
        path: path.join(screenshotDir, 'psi-04-scm-guide.png'),
        fullPage: true
      });
      console.log('  ✅ 스크린샷 저장: psi-04-scm-guide.png');
    } else {
      console.log('  ⚠️ SCM 가이드 행을 찾을 수 없습니다');
    }

    // ============================================
    // 테스트 4: 발주필요 페이지 (발주 스코어링)
    // ============================================
    console.log('\n📦 테스트 4: 발주필요 페이지 (발주 스코어링)');
    await page.goto('http://localhost:3000/dashboard/orders');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 발주필요 탭 찾기
    const needTab = page.locator('button, [role="tab"]').filter({ hasText: /발주필요|발주 필요/ }).first();
    const needTabExists = await needTab.count() > 0;

    if (needTabExists) {
      await needTab.click();
      await page.waitForTimeout(1500);
      console.log('  📌 발주필요 탭 클릭 완료');
    }

    await page.screenshot({
      path: path.join(screenshotDir, 'orders-01-need.png'),
      fullPage: true
    });
    console.log('  ✅ 스크린샷 저장: orders-01-need.png');

    // 발주필요 품목 확인
    const needItems = await page.locator('table tbody tr').count();
    console.log(`  📌 발주필요 품목 수: ${needItems}개`);

    if (needItems > 0) {
      const headers = await page.locator('table thead th').allTextContents();
      const firstRowCells = await page.locator('table tbody tr').first().locator('td, th').allTextContents();

      console.log('\n  📋 첫 번째 발주필요 품목:');
      headers.forEach((header, idx) => {
        console.log(`    ${header}: ${firstRowCells[idx] || 'N/A'}`);
      });

      // 우선순위 스코어 확인
      const scoreIdx = headers.findIndex(h => h.includes('우선순위') || h.includes('스코어'));
      if (scoreIdx >= 0) {
        console.log(`  🎯 우선순위 스코어: ${firstRowCells[scoreIdx]}`);
      }

      // ABC 등급 확인
      const abcIdx = headers.findIndex(h => h.includes('ABC'));
      if (abcIdx >= 0) {
        console.log(`  🏷️ ABC 등급: ${firstRowCells[abcIdx]}`);
      }
    } else {
      console.log('  ℹ️ 현재 발주필요 품목이 없습니다. 재고 상태가 적정합니다.');
    }

    // ============================================
    // 테스트 5: 발주현황 페이지
    // ============================================
    console.log('\n📋 테스트 5: 발주현황 페이지');
    const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /발주현황|발주 현황/ }).first();
    const statusTabExists = await statusTab.count() > 0;

    if (statusTabExists) {
      await statusTab.click();
      await page.waitForTimeout(1500);
      console.log('  📌 발주현황 탭 클릭 완료');
    }

    await page.screenshot({
      path: path.join(screenshotDir, 'orders-02-status.png'),
      fullPage: true
    });
    console.log('  ✅ 스크린샷 저장: orders-02-status.png');

    // 발주서 목록 확인
    const poRows = await page.locator('table tbody tr').count();
    console.log(`  📌 발주서 건수: ${poRows}개`);

    if (poRows > 0) {
      // 첫 번째 발주서 클릭하여 상세 보기
      await page.locator('table tbody tr').first().click();
      await page.waitForTimeout(1500);

      // 다이얼로그 확인
      const dialog = page.locator('[role="dialog"], .dialog, [data-state="open"]').first();
      const dialogVisible = await dialog.isVisible().catch(() => false);

      if (dialogVisible) {
        await page.screenshot({
          path: path.join(screenshotDir, 'orders-03-detail.png'),
          fullPage: true
        });
        console.log('  ✅ 스크린샷 저장: orders-03-detail.png');

        // 다이얼로그 닫기
        const closeButton = page.locator('[role="dialog"] button').filter({ hasText: /닫기|취소|확인/ }).first();
        if (await closeButton.count() > 0) {
          await closeButton.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // ============================================
    // 테스트 6: 입고현황 페이지
    // ============================================
    console.log('\n📥 테스트 6: 입고현황 페이지');
    const inboundTab = page.locator('button, [role="tab"]').filter({ hasText: /입고현황|입고 현황/ }).first();
    const inboundTabExists = await inboundTab.count() > 0;

    if (inboundTabExists) {
      await inboundTab.click();
      await page.waitForTimeout(1500);
      console.log('  📌 입고현황 탭 클릭 완료');
    }

    await page.screenshot({
      path: path.join(screenshotDir, 'orders-04-inbound.png'),
      fullPage: true
    });
    console.log('  ✅ 스크린샷 저장: orders-04-inbound.png');

    // 입고 기록 확인
    const inboundRows = await page.locator('table tbody tr').count();
    console.log(`  📌 입고 기록 건수: ${inboundRows}개`);

    if (inboundRows > 0) {
      const headers = await page.locator('table thead th').allTextContents();
      const firstRowCells = await page.locator('table tbody tr').first().locator('td, th').allTextContents();

      console.log('\n  📋 최근 입고 기록:');
      headers.slice(0, 5).forEach((header, idx) => {
        console.log(`    ${header}: ${firstRowCells[idx] || 'N/A'}`);
      });
    }

    // ============================================
    // 테스트 7: 입항스케줄 탭
    // ============================================
    console.log('\n🚢 테스트 7: 입항스케줄 탭');
    const shipmentTab = page.locator('button, [role="tab"]').filter({ hasText: /입항|스케줄/ }).first();
    const shipmentTabExists = await shipmentTab.count() > 0;

    if (shipmentTabExists) {
      await shipmentTab.click();
      await page.waitForTimeout(1500);
      console.log('  📌 입항스케줄 탭 클릭 완료');

      await page.screenshot({
        path: path.join(screenshotDir, 'orders-05-shipment.png'),
        fullPage: true
      });
      console.log('  ✅ 스크린샷 저장: orders-05-shipment.png');

      const shipmentRows = await page.locator('table tbody tr').count();
      console.log(`  📌 입항 스케줄 건수: ${shipmentRows}개`);
    } else {
      console.log('  ⚠️ 입항스케줄 탭을 찾을 수 없습니다');
    }

    // ============================================
    // 완료
    // ============================================
    console.log('\n✅ 모든 테스트 완료!');
    console.log(`📸 스크린샷 저장 위치: ${screenshotDir}`);

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
