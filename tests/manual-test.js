const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('브라우저 실행 중...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 먼저 홈페이지 확인
    console.log('\n=== 홈페이지 확인 ===');
    const homeResponse = await page.goto('http://localhost:3000/');
    console.log('홈페이지 상태:', homeResponse?.status());
    await page.waitForTimeout(2000);

    // 대시보드로 직접 이동 시도 (이미 로그인되어 있을 수 있음)
    console.log('\n=== 대시보드 접근 ===');
    const dashResponse = await page.goto('http://localhost:3000/dashboard');
    console.log('대시보드 상태:', dashResponse?.status());
    await page.waitForTimeout(3000);

    const currentURL = page.url();
    console.log('현재 URL:', currentURL);

    // 로그인 페이지로 리다이렉트되었는지 확인
    if (currentURL.includes('/login')) {
      console.log('\n=== 로그인 필요 ===');
      await page.waitForTimeout(3000);

      const emailInput = await page.locator('input#email').count();
      console.log('이메일 입력 필드 발견:', emailInput > 0);

      if (emailInput > 0) {
        await page.fill('input#email', 'admin1@stocklogis.com');
        await page.fill('input#password', 'admin1234');
        await page.click('button[type="submit"]:has-text("로그인")');

        // 로그인 처리 대기
        await page.waitForTimeout(5000);

        // URL 변경 확인
        try {
          await page.waitForURL('**/dashboard**', { timeout: 30000 });
          console.log('✓ 로그인 완료');
        } catch (e) {
          console.log('⚠ 대시보드로 이동하지 못함. 현재 URL:', page.url());
          // 에러 메시지 확인
          const errorMsg = await page.locator('[role="alert"]').textContent().catch(() => '없음');
          console.log('에러 메시지:', errorMsg);
        }
        await page.waitForTimeout(3000);
      } else {
        console.log('⚠ 로그인 폼을 찾을 수 없음');
      }
    } else if (currentURL.includes('/dashboard')) {
      console.log('✓ 이미 로그인되어 있음');
    }

    // 테스트 1: 재고 현황
    console.log('\n=== 테스트 1: 재고 현황 ===');
    await page.goto('http://localhost:3000/dashboard/inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/inv-01-overview.png'),
      fullPage: true
    });
    console.log('✓ inv-01-overview.png 저장');

    // 검색 테스트
    const searchInput = page.locator('input[placeholder*="검색"]').first();
    const searchCount = await searchInput.count();
    if (searchCount > 0) {
      await searchInput.fill('제품');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(__dirname, '../test-results/screenshots/inv-02-search.png'),
        fullPage: true
      });
      console.log('✓ inv-02-search.png 저장');
    }

    // 테스트 2: 재고 조정 다이얼로그
    console.log('\n=== 테스트 2: 재고 조정 다이얼로그 ===');
    await page.goto('http://localhost:3000/dashboard/inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const adjustButton = page.locator('button:has-text("재고 조정")').first();
    const adjustCount = await adjustButton.count();
    if (adjustCount > 0) {
      await adjustButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(__dirname, '../test-results/screenshots/inv-03-adjust-dialog.png'),
        fullPage: true
      });
      console.log('✓ inv-03-adjust-dialog.png 저장');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠ 재고 조정 버튼을 찾을 수 없음');
    }

    // 테스트 3: 결품관리
    console.log('\n=== 테스트 3: 결품관리 ===');
    await page.goto('http://localhost:3000/dashboard/stockout');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/stockout-01-overview.png'),
      fullPage: true
    });
    console.log('✓ stockout-01-overview.png 저장');

    const toggleButton = page.locator('button:has-text("정상화")').first();
    const toggleCount = await toggleButton.count();
    if (toggleCount > 0) {
      await toggleButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(__dirname, '../test-results/screenshots/stockout-02-toggle.png'),
        fullPage: true
      });
      console.log('✓ stockout-02-toggle.png 저장');
    }

    // 테스트 4: 수불관리
    console.log('\n=== 테스트 4: 수불관리 ===');
    await page.goto('http://localhost:3000/dashboard/movement');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/movement-01-overview.png'),
      fullPage: true
    });
    console.log('✓ movement-01-overview.png 저장');

    // 테스트 5: 분석 페이지 - ABC-XYZ
    console.log('\n=== 테스트 5: 분석 페이지 ===');
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/analytics-01-overview.png'),
      fullPage: true
    });
    console.log('✓ analytics-01-overview.png 저장');

    const abcXyzTab = page.locator('button:has-text("ABC-XYZ")').first();
    const abcXyzCount = await abcXyzTab.count();
    if (abcXyzCount > 0) {
      await abcXyzTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(__dirname, '../test-results/screenshots/analytics-02-abc-xyz-matrix.png'),
        fullPage: true
      });
      console.log('✓ analytics-02-abc-xyz-matrix.png 저장');
    }

    // 테스트 6: 재고 회전율
    console.log('\n=== 테스트 6: 재고 회전율 ===');
    const turnoverTab = page.locator('button:has-text("재고 회전율")').first();
    const turnoverCount = await turnoverTab.count();
    if (turnoverCount > 0) {
      await turnoverTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(__dirname, '../test-results/screenshots/analytics-03-turnover.png'),
        fullPage: true
      });
      console.log('✓ analytics-03-turnover.png 저장');
    }

    // 테스트 7: 수요예측
    console.log('\n=== 테스트 7: 수요예측 ===');
    const forecastTab = page.locator('button:has-text("수요예측")').first();
    const forecastCount = await forecastTab.count();
    if (forecastCount > 0) {
      await forecastTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(__dirname, '../test-results/screenshots/analytics-04-forecast.png'),
        fullPage: true
      });
      console.log('✓ analytics-04-forecast.png 저장');
    }

    // 테스트 8: 출고 관리
    console.log('\n=== 테스트 8: 출고 관리 ===');
    await page.goto('http://localhost:3000/dashboard/outbound');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/outbound-01-overview.png'),
      fullPage: true
    });
    console.log('✓ outbound-01-overview.png 저장');

    // 테스트 9: 설정/알림/도움말
    console.log('\n=== 테스트 9: 설정/알림/도움말 ===');
    await page.goto('http://localhost:3000/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/settings-01.png'),
      fullPage: true
    });
    console.log('✓ settings-01.png 저장');

    await page.goto('http://localhost:3000/dashboard/alerts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/alerts-01.png'),
      fullPage: true
    });
    console.log('✓ alerts-01.png 저장');

    await page.goto('http://localhost:3000/dashboard/help');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/help-01.png'),
      fullPage: true
    });
    console.log('✓ help-01.png 저장');

    // 테스트 10: 메인 대시보드
    console.log('\n=== 테스트 10: 메인 대시보드 ===');
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(__dirname, '../test-results/screenshots/dashboard-01-main.png'),
      fullPage: true
    });
    console.log('✓ dashboard-01-main.png 저장');

    console.log('\n✅ 모든 테스트 완료');
    console.log('스크린샷 저장 위치: test-results/screenshots/');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
