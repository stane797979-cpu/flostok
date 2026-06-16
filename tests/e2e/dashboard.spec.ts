import { test, expect } from '@playwright/test';

test.describe('대시보드', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
  });

  test('페이지 타이틀 확인', async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
  });

  test('KPI 카드 4개 표시', async ({ page }) => {
    await expect(page.getByText('총 SKU').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('발주 필요').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('위험 품목')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('과재고').first()).toBeVisible({ timeout: 10000 });
  });

  test('재고상태 분포 차트 표시', async ({ page }) => {
    await expect(page.getByText('재고상태 분포')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('주요 성과 지표 섹션 표시', async ({ page }) => {
    await expect(page.getByText('주요 성과 지표')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('재고회전율')).toBeVisible();
    await expect(page.getByText('평균 재고일수')).toBeVisible();
    await expect(page.getByText('적시 발주율')).toBeVisible();
  });

  test('빠른 액션 표시', async ({ page }) => {
    await expect(page.getByText('빠른 액션')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('신규 발주')).toBeVisible();
    await expect(page.getByText('제품 추가')).toBeVisible();
  });

  test('사이드바 네비게이션 표시', async ({ page }) => {
    await expect(page.getByText('FloStok')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('대시보드')).toBeVisible();
    await expect(page.getByText('PSI 계획')).toBeVisible();
  });
});
