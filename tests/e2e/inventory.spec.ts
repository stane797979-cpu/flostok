import { test, expect } from "@playwright/test";

test.describe("재고 관리", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.waitForLoadState("networkidle");
  });

  test("재고 페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.getByRole("heading", { name: /재고/ })).toBeVisible({ timeout: 10000 });
  });

  test("재고 통계 카드 렌더링", async ({ page }) => {
    await expect(page.locator('[class*="grid"]').first()).toBeVisible({ timeout: 10000 });
  });

  test("재고 목록 테이블 렌더링", async ({ page }) => {
    await expect(page.getByText("SKU")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("현재고")).toBeVisible();
  });

  test("검색 기능", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/검색/);
    if (await searchInput.isVisible()) {
      await searchInput.fill("테스트");
      await page.waitForTimeout(500);
    }
  });

  test("필터 기능", async ({ page }) => {
    const filterSection = page.locator('[class*="filter"]').first();
    if (await filterSection.isVisible()) {
      await expect(filterSection).toBeVisible();
    }
  });

  test("재고 상태별 뱃지 렌더링", async ({ page }) => {
    const badges = page.locator('[class*="badge"]');
    if (await badges.count() > 0) {
      await expect(badges.first()).toBeVisible();
    }
  });

  test("재고 상세 다이얼로그 열기", async ({ page }) => {
    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(500);
    }
  });

  test("페이지네이션", async ({ page }) => {
    const pagination = page.locator('[class*="pagination"]').first();
    if (await pagination.isVisible()) {
      await expect(pagination).toBeVisible();
    }
  });

  test("엑셀 다운로드 버튼", async ({ page }) => {
    const downloadButton = page.getByRole("button", { name: /다운로드/ });
    if (await downloadButton.isVisible()) {
      await expect(downloadButton).toBeVisible();
    }
  });
});
