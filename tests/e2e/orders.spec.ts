import { test, expect } from '@playwright/test';

test.describe('발주 관리', () => {
  test('발주필요 탭', async ({ page }) => {
    await page.goto('/dashboard/orders?tab=reorder');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('발주 필요').first()).toBeVisible({ timeout: 20000 });
  });

  test('발주현황 탭 - 로딩 후 데이터 표시', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/dashboard/orders?tab=orders');
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 80000 });
    const h1Text = await page.locator('h1').first().textContent();
    expect(h1Text).toContain('발주');
  });

  test('자동발주 탭', async ({ page }) => {
    await page.goto('/dashboard/orders?tab=auto-reorder');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('자동발주').first()).toBeVisible({ timeout: 20000 });
  });

  test('입고현황 탭', async ({ page }) => {
    await page.goto('/dashboard/orders?tab=inbound');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText('입고 현황').first()).toBeVisible({ timeout: 20000 });
  });
});
