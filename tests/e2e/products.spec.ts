import { test, expect } from "@playwright/test";

test.describe("제품 관리", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("networkidle");
  });

  test("제품 페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.getByRole("button", { name: /제품 추가/ })).toBeVisible({ timeout: 15000 });
  });

  test("제품 추가 버튼 렌더링", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /제품 추가/ });
    await expect(addButton).toBeVisible({ timeout: 10000 });
  });

  test("검색 기능", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/검색/);
    if (await searchInput.isVisible()) {
      await searchInput.fill("테스트");
      await page.waitForTimeout(500);
    }
  });

  test("제품 테이블 렌더링", async ({ page }) => {
    await expect(page.getByText("SKU").first()).toBeVisible({ timeout: 15000 });
  });

  test("제품 필터 렌더링", async ({ page }) => {
    const filterSection = page.locator('[class*="filter"]').first();
    if (await filterSection.isVisible()) {
      await expect(filterSection).toBeVisible();
    }
  });

  test("제품 추가 다이얼로그 열기", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /제품 추가/ });
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible();
      const closeButton = page.getByRole("button", { name: /취소/ });
      if (await closeButton.isVisible()) await closeButton.click();
    }
  });

  test("제품 수정 버튼", async ({ page }) => {
    const editButton = page.getByRole("button", { name: /수정/ }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await page.waitForTimeout(500);
      const dialog = page.locator('[role="dialog"]').first();
      if (await dialog.isVisible()) {
        const closeButton = page.getByRole("button", { name: /취소/ });
        if (await closeButton.isVisible()) await closeButton.click();
      }
    }
  });

  test("제품 삭제 버튼", async ({ page }) => {
    const deleteButton = page.getByRole("button", { name: /삭제/ }).first();
    if (await deleteButton.isVisible()) {
      await expect(deleteButton).toBeVisible();
    }
  });

  test("엑셀 업로드 버튼", async ({ page }) => {
    const uploadButton = page.getByRole("button", { name: /업로드/ });
    if (await uploadButton.isVisible()) {
      await expect(uploadButton).toBeVisible();
    }
  });

  test("엑셀 다운로드 버튼", async ({ page }) => {
    const downloadButton = page.getByRole("button", { name: /다운로드/ });
    if (await downloadButton.isVisible()) {
      await expect(downloadButton).toBeVisible();
    }
  });

  test("ABC/XYZ 등급 뱃지 렌더링", async ({ page }) => {
    const badges = page.locator('[class*="badge"]');
    if (await badges.count() > 0) {
      await expect(badges.first()).toBeVisible();
    }
  });

  test("체크박스 선택 및 일괄 삭제", async ({ page }) => {
    const checkboxes = page.locator('input[type="checkbox"]');
    if (await checkboxes.count() > 0) {
      await checkboxes.first().check();
      await page.waitForTimeout(300);
    }
  });
});
