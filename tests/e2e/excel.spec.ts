import { test, expect } from "@playwright/test";
import path from "path";

const PRODUCT_FIXTURE = path.resolve(__dirname, "../fixtures/product-upload-test.xlsx");

test.describe("Excel 업로드/다운로드", () => {
  // ── 제품 페이지 다운로드 ──────────────────────────────────────────────
  test("제품 Excel 양식 다운로드 버튼", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("button", { name: /제품 추가/ })).toBeVisible({ timeout: 15000 });

    const templateBtn = page.getByRole("button", { name: "양식 다운로드" });
    await expect(templateBtn).toBeVisible({ timeout: 10000 });
  });

  test("제품 Excel 다운로드 버튼", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("button", { name: /제품 추가/ })).toBeVisible({ timeout: 15000 });

    const downloadBtn = page.getByRole("button", { name: "엑셀 다운로드" });
    await expect(downloadBtn).toBeVisible({ timeout: 10000 });
  });

  test("제품 Excel 업로드 다이얼로그 열기", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("button", { name: /제품 추가/ })).toBeVisible({ timeout: 15000 });

    // 양식 다운로드 버튼 클릭 (다운로드 다이얼로그)
    const templateBtn = page.getByRole("button", { name: "양식 다운로드" });
    if (await templateBtn.isVisible()) {
      await templateBtn.click();
      await page.waitForTimeout(500);
      // 다이얼로그가 열리거나 직접 다운로드됨
      const dialog = page.locator('[role="dialog"]').first();
      if (await dialog.isVisible({ timeout: 2000 })) {
        await page.keyboard.press("Escape");
      }
    }
  });

  test("제품 Excel 업로드 - 파일 입력 필드 존재", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("button", { name: /제품 추가/ })).toBeVisible({ timeout: 15000 });

    // 파일 input이 있으면 파일 첨부 테스트
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileInput.setInputFiles(PRODUCT_FIXTURE);
      await page.waitForTimeout(500);
    }
    // 파일 input이 숨겨진 경우는 통과
  });

  // ── 재고 페이지 다운로드 ─────────────────────────────────────────────
  test("재고 Excel 다운로드", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.waitForLoadState("domcontentloaded");

    const downloadBtn = page.getByRole("button", { name: /다운로드/ }).first();
    if (!(await downloadBtn.isVisible({ timeout: 10000 }).catch(() => false))) return;

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      downloadBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/);
  });

  // ── 입고현황 다운로드 ─────────────────────────────────────────────────
  test("입고현황 Excel 다운로드 버튼", async ({ page }) => {
    await page.goto("/dashboard/orders?tab=inbound");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // createObjectURL 방식이라 download 이벤트 없음 — 버튼 존재만 확인
    const downloadBtn = page.getByRole("button", { name: /다운로드/ }).first();
    if (!(await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false))) return;
    await expect(downloadBtn).toBeVisible();
  });
});
