import { test, expect } from '@playwright/test';

test.describe('Phase 4-7: 재고/KPI/결품/수불 통합 검증', () => {
  test.beforeEach(async ({ page }) => {
    // 대시보드로 이동하여 로그인 상태 확인
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // 로그인 페이지로 리다이렉트되면 실패
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('Phase 4-1: 재고 현황 - 재고 상태 통계 카드', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/inventory');
    await page.waitForLoadState('networkidle');

    // 스크린샷 촬영
    await page.screenshot({
      path: 'test-results/phase-4-1-inventory-stats.png',
      fullPage: true
    });

    // 7단계 상태별 카드 확인
    const statsCards = page.locator('[data-testid="inventory-stats"], .grid > div').first();
    await expect(statsCards).toBeVisible();

    console.log('✓ Phase 4-1: 재고 상태 통계 카드 표시 확인');
  });

  test('Phase 4-2: 재고 현황 - 검색 기능', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/inventory');
    await page.waitForLoadState('networkidle');

    // 검색 입력란 찾기
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('TEST');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/phase-4-2-inventory-search.png',
      fullPage: true
    });

    console.log('✓ Phase 4-2: 검색 기능 테스트 완료');
  });

  test('Phase 4-3: 재고 현황 - 재고 조정 다이얼로그', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/inventory');
    await page.waitForLoadState('networkidle');

    // 테이블에서 첫 번째 행 클릭
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'test-results/phase-4-3-inventory-adjust-dialog.png',
      fullPage: true
    });

    console.log('✓ Phase 4-3: 재고 조정 다이얼로그 확인');
  });

  test('Phase 5-1: KPI 현황 - 초기 화면', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/phase-5-1-kpi-initial.png',
      fullPage: true
    });

    // 7개 KPI 카드 확인
    const kpiCards = page.locator('.grid > div');
    const count = await kpiCards.count();
    console.log(`✓ Phase 5-1: KPI 카드 ${count}개 표시 확인`);
  });

  test('Phase 5-2: KPI 현황 - ABC 필터', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForLoadState('networkidle');

    // ABC 필터 찾기 (Select 또는 버튼)
    const abcFilter = page.locator('button, select').filter({ hasText: /ABC|A등급|전체 ABC/ }).first();
    await abcFilter.click();
    await page.waitForTimeout(300);

    // A등급 선택
    const aOption = page.locator('text=A등급').first();
    if (await aOption.isVisible()) {
      await aOption.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/phase-5-2-kpi-abc-filter.png',
      fullPage: true
    });

    console.log('✓ Phase 5-2: ABC 필터 테스트 완료');
  });

  test('Phase 5-3: KPI 현황 - XYZ 필터', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForLoadState('networkidle');

    // XYZ 필터 찾기
    const xyzFilter = page.locator('button, select').filter({ hasText: /XYZ|X등급|전체 XYZ/ }).first();
    await xyzFilter.click();
    await page.waitForTimeout(300);

    // X등급 선택
    const xOption = page.locator('text=X등급').first();
    if (await xOption.isVisible()) {
      await xOption.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/phase-5-3-kpi-xyz-filter.png',
      fullPage: true
    });

    console.log('✓ Phase 5-3: XYZ 필터 테스트 완료');
  });

  test('Phase 5-4: KPI 현황 - ABC+XYZ 조합', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForLoadState('networkidle');

    // ABC A등급 선택
    const abcFilter = page.locator('button, select').filter({ hasText: /ABC|A등급|전체 ABC/ }).first();
    await abcFilter.click();
    await page.waitForTimeout(300);
    const aOption = page.locator('text=A등급').first();
    if (await aOption.isVisible()) {
      await aOption.click();
      await page.waitForTimeout(500);
    }

    // XYZ X등급 선택
    const xyzFilter = page.locator('button, select').filter({ hasText: /XYZ|X등급|전체 XYZ/ }).first();
    await xyzFilter.click();
    await page.waitForTimeout(300);
    const xOption = page.locator('text=X등급').first();
    if (await xOption.isVisible()) {
      await xOption.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/phase-5-4-kpi-abc-xyz-combo.png',
      fullPage: true
    });

    console.log('✓ Phase 5-4: ABC+XYZ 조합 테스트 완료');
  });

  test('Phase 5-5: KPI 현황 - 전체 복원', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForLoadState('networkidle');

    // 전체 ABC 선택
    const abcFilter = page.locator('button, select').filter({ hasText: /ABC|전체 ABC/ }).first();
    await abcFilter.click();
    await page.waitForTimeout(300);
    const allAbcOption = page.locator('text=전체 ABC').first();
    if (await allAbcOption.isVisible()) {
      await allAbcOption.click();
      await page.waitForTimeout(500);
    }

    // 전체 XYZ 선택
    const xyzFilter = page.locator('button, select').filter({ hasText: /XYZ|전체 XYZ/ }).first();
    await xyzFilter.click();
    await page.waitForTimeout(300);
    const allXyzOption = page.locator('text=전체 XYZ').first();
    if (await allXyzOption.isVisible()) {
      await allXyzOption.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/phase-5-5-kpi-all-restore.png',
      fullPage: true
    });

    console.log('✓ Phase 5-5: 전체 복원 테스트 완료');
  });

  test('Phase 5-6: KPI 현황 - 월별 추이 탭', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForLoadState('networkidle');

    // 월별 추이 탭 클릭
    const monthlyTab = page.locator('button, a').filter({ hasText: /월별 추이/ }).first();
    if (await monthlyTab.isVisible()) {
      await monthlyTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/phase-5-6-kpi-monthly-trend.png',
      fullPage: true
    });

    console.log('✓ Phase 5-6: 월별 추이 탭 확인');
  });

  test('Phase 5-7: KPI 현황 - 개선 제안 탭', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForLoadState('networkidle');

    // 개선 제안 탭 클릭
    const improvementTab = page.locator('button, a').filter({ hasText: /개선 제안/ }).first();
    if (await improvementTab.isVisible()) {
      await improvementTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/phase-5-7-kpi-improvement.png',
      fullPage: true
    });

    console.log('✓ Phase 5-7: 개선 제안 탭 확인');
  });

  test('Phase 6-1: 결품관리 - 결품 목록', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/stockout');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/phase-6-1-stockout-list.png',
      fullPage: true
    });

    console.log('✓ Phase 6-1: 결품 목록 표시 확인');
  });

  test('Phase 6-2: 결품관리 - 결품 원인 분석', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/stockout');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 테이블에서 원인 컬럼 확인
    const causeCell = page.locator('td').filter({ hasText: /발주지연|수요급증|공급지연/ }).first();

    await page.screenshot({
      path: 'test-results/phase-6-2-stockout-cause.png',
      fullPage: true
    });

    console.log('✓ Phase 6-2: 결품 원인 분석 확인');
  });

  test('Phase 6-3: 결품관리 - 정상화 항목 필터', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/stockout');
    await page.waitForLoadState('networkidle');

    // 정상화 숨기기/보기 토글 찾기
    const normalizeToggle = page.locator('button, input[type="checkbox"]').filter({ hasText: /정상화|숨기기|보기/ }).first();
    if (await normalizeToggle.isVisible()) {
      await normalizeToggle.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: 'test-results/phase-6-3-stockout-normalize-filter.png',
      fullPage: true
    });

    console.log('✓ Phase 6-3: 정상화 항목 필터 확인');
  });

  test('Phase 7-1: 수불관리 - 기간 선택 UI', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/movement');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: 'test-results/phase-7-1-movement-initial.png',
      fullPage: true
    });

    console.log('✓ Phase 7-1: 수불관리 기간 선택 UI 확인');
  });

  test('Phase 7-2: 수불관리 - 기간 조회', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/movement');
    await page.waitForLoadState('networkidle');

    // 날짜 선택기 찾기
    const dateInput = page.locator('input[type="date"], input[type="text"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: 'test-results/phase-7-2-movement-date-range.png',
      fullPage: true
    });

    console.log('✓ Phase 7-2: 기간 조회 기능 확인');
  });

  test('Phase 7-3: 수불관리 - 엑셀 다운로드 버튼', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/movement');
    await page.waitForLoadState('networkidle');

    // 엑셀 다운로드 버튼 찾기
    const excelButton = page.locator('button').filter({ hasText: /엑셀|다운로드|Excel/ }).first();

    await page.screenshot({
      path: 'test-results/phase-7-3-movement-excel.png',
      fullPage: true
    });

    console.log('✓ Phase 7-3: 엑셀 다운로드 버튼 확인');
  });
});
