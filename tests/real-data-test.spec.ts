import { test, expect } from '@playwright/test';

test.describe('실데이터 검증 테스트', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', 'admin1@stocklogis.com');
    await page.fill('input[type="password"]', 'admin1234');
    await page.click('button[type="submit"]');
    // 로그인 완료 대기
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    await page.waitForTimeout(2000); // 데이터 로드 대기
  });

  test('테스트 1: 재고 현황 페이지', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 01: 전체 뷰
    await page.screenshot({
      path: 'test-results/screenshots/inv-01-overview.png',
      fullPage: true
    });

    // 검색 테스트
    const searchInput = page.locator('input[placeholder*="검색"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('제품');
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/screenshots/inv-02-search.png',
        fullPage: true
      });
    }
  });

  test('테스트 2: 재고 조정 다이얼로그', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/inventory');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 재고 조정 버튼 찾기
    const adjustButton = page.locator('button:has-text("재고 조정")').first();
    if (await adjustButton.count() > 0) {
      await adjustButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/screenshots/inv-03-adjust-dialog.png',
        fullPage: true
      });

      // 다이얼로그 닫기
      await page.keyboard.press('Escape');
    }
  });

  test('테스트 3: 결품관리 페이지', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/stockout');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/screenshots/stockout-01-overview.png',
      fullPage: true
    });

    // 토글 버튼 찾기
    const toggleButton = page.locator('button:has-text("정상화")').first();
    if (await toggleButton.count() > 0) {
      await toggleButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/screenshots/stockout-02-toggle.png',
        fullPage: true
      });
    }
  });

  test('테스트 4: 수불관리 페이지', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/movement');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/screenshots/movement-01-overview.png',
      fullPage: true
    });
  });

  test('테스트 5: 분석 페이지 - ABC-XYZ', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/screenshots/analytics-01-overview.png',
      fullPage: true
    });

    // ABC-XYZ 탭 클릭
    const abcXyzTab = page.locator('button:has-text("ABC-XYZ")').first();
    if (await abcXyzTab.count() > 0) {
      await abcXyzTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/screenshots/analytics-02-abc-xyz-matrix.png',
        fullPage: true
      });
    }
  });

  test('테스트 6: 분석 페이지 - 재고 회전율', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const turnoverTab = page.locator('button:has-text("재고 회전율")').first();
    if (await turnoverTab.count() > 0) {
      await turnoverTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/screenshots/analytics-03-turnover.png',
        fullPage: true
      });
    }
  });

  test('테스트 7: 분석 페이지 - 수요예측', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const forecastTab = page.locator('button:has-text("수요예측")').first();
    if (await forecastTab.count() > 0) {
      await forecastTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/screenshots/analytics-04-forecast.png',
        fullPage: true
      });
    }
  });

  test('테스트 8: 출고 관리 페이지', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/outbound');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/screenshots/outbound-01-overview.png',
      fullPage: true
    });
  });

  test('테스트 9: 설정/알림/도움말', async ({ page }) => {
    // 설정
    await page.goto('http://localhost:3000/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/screenshots/settings-01.png',
      fullPage: true
    });

    // 알림
    await page.goto('http://localhost:3000/dashboard/alerts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/screenshots/alerts-01.png',
      fullPage: true
    });

    // 도움말
    await page.goto('http://localhost:3000/dashboard/help');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/screenshots/help-01.png',
      fullPage: true
    });
  });

  test('테스트 10: 메인 대시보드', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/screenshots/dashboard-01-main.png',
      fullPage: true
    });
  });
});
