import { test, expect } from '@playwright/test';

test.describe('그룹 C: 출고/분석/설정 검증', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 상태 확인
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // 로그인 페이지로 리다이렉트되면 로그인 필요
    if (page.url().includes('/signin')) {
      console.log('로그인이 필요합니다.');
      // 실제 로그인은 수동으로 해야 함
      throw new Error('Please login first');
    }
  });

  test('Phase 8-1: 출고 관리 페이지 렌더링', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/outbound');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 스크린샷 촬영
    await page.screenshot({
      path: 'scripts/screenshots/phase8-1-outbound.png',
      fullPage: true
    });

    // 기본 요소 확인
    const title = page.locator('h1, h2').first();
    await expect(title).toBeVisible();

    console.log('Phase 8-1: 출고 관리 페이지 로드 완료');
  });

  test('Phase 8-2: 출고 등록 UI 확인', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/outbound');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 출고 등록 버튼이나 탭 찾기
    const addButton = page.locator('button:has-text("등록"), button:has-text("추가"), button:has-text("출고")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'scripts/screenshots/phase8-2-outbound-form.png',
        fullPage: true
      });
    } else {
      console.log('출고 등록 버튼을 찾을 수 없음 - 다른 UI 패턴일 수 있음');
      await page.screenshot({
        path: 'scripts/screenshots/phase8-2-outbound-form.png',
        fullPage: true
      });
    }

    console.log('Phase 8-2: 출고 등록 UI 확인 완료');
  });

  test('Phase 9-1: 분석 페이지 탭 확인', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'scripts/screenshots/phase9-1-analytics.png',
      fullPage: true
    });

    // 탭 요소 확인
    const tabs = page.locator('[role="tablist"], .tabs, [data-tabs]');
    if (await tabs.count() > 0) {
      console.log('분석 페이지 탭 구조 확인됨');
    }

    console.log('Phase 9-1: 분석 페이지 로드 완료');
  });

  test('Phase 9-2: ABC-XYZ 분석 탭', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ABC-XYZ 탭 찾기
    const abcTab = page.locator('button:has-text("ABC"), button:has-text("XYZ")').first();

    if (await abcTab.isVisible()) {
      await abcTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'scripts/screenshots/phase9-2-abc-xyz.png',
      fullPage: true
    });

    console.log('Phase 9-2: ABC-XYZ 분석 확인 완료');
  });

  test('Phase 9-3: 재고 회전율 탭', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 재고 회전율 탭 찾기
    const turnoverTab = page.locator('button:has-text("회전율"), button:has-text("회전")').first();

    if (await turnoverTab.isVisible()) {
      await turnoverTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'scripts/screenshots/phase9-3-turnover.png',
      fullPage: true
    });

    console.log('Phase 9-3: 재고 회전율 확인 완료');
  });

  test('Phase 9-4: 다른 분석 탭들', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 모든 탭 버튼 찾기
    const tabButtons = page.locator('[role="tab"], button[data-state]');
    const tabCount = await tabButtons.count();

    console.log(`총 ${tabCount}개의 탭 발견`);

    // 각 탭 클릭하여 스크린샷
    for (let i = 0; i < Math.min(tabCount, 6); i++) {
      await tabButtons.nth(i).click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `scripts/screenshots/phase9-4-tab-${i}.png`,
        fullPage: true
      });
    }

    console.log('Phase 9-4: 다른 분석 탭들 확인 완료');
  });

  test('Phase 10-1: 설정 페이지', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'scripts/screenshots/phase10-1-settings.png',
      fullPage: true
    });

    console.log('Phase 10-1: 설정 페이지 확인 완료');
  });

  test('Phase 10-2: 알림 페이지', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/alerts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'scripts/screenshots/phase10-2-alerts.png',
      fullPage: true
    });

    console.log('Phase 10-2: 알림 페이지 확인 완료');
  });

  test('Phase 10-3: 가이드 페이지', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/help');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'scripts/screenshots/phase10-3-help.png',
      fullPage: true
    });

    console.log('Phase 10-3: 가이드 페이지 확인 완료');
  });

  test('Phase 10-4: 메인 대시보드', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'scripts/screenshots/phase10-4-main-dashboard.png',
      fullPage: true
    });

    // 요약 카드 확인
    const cards = page.locator('[class*="card"], .bg-card, [class*="border"]');
    const cardCount = await cards.count();

    console.log(`Phase 10-4: 메인 대시보드 - ${cardCount}개의 카드 발견`);
  });
});
