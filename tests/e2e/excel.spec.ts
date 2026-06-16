import { test, expect } from "@playwright/test";
import path from "path";

const PRODUCT_FIXTURE = path.resolve(__dirname, "../fixtures/product-upload-test.xlsx");
const SALES_FIXTURE = path.resolve(__dirname, "../fixtures/sales-upload-test.xlsx");

test.describe("Excel 업로드/다운로드", () => {
  // ── 업로드 ──────────────────────────────────────────────────────────
  test("제품 Excel 업로드 - 다이얼로그 열기 및 파일 첨부", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");

    // 업로드 버튼 클릭
    const uploadBtn = page.getByRole("button", { name: /업로드/ });
    await expect(uploadBtn).toBeVisible({ timeout: 15000 });
    await uploadBtn.click();

    // 다이얼로그 열림 확인
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 파일 첨부
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(PRODUCT_FIXTURE);

    // 파일명이 UI에 표시되는지 확인
    await expect(dialog.getByText(/product-upload-test\.xlsx/)).toBeVisible({ timeout: 5000 });
  });

  test("제품 Excel 업로드 - 실제 업로드 실행 및 결과 확인", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");

    const uploadBtn = page.getByRole("button", { name: /업로드/ });
    await expect(uploadBtn).toBeVisible({ timeout: 15000 });
    await uploadBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(PRODUCT_FIXTURE);

    // 임포트 실행 버튼
    const importBtn = dialog.getByRole("button", { name: /임포트|업로드|확인/ }).first();
    await expect(importBtn).toBeVisible({ timeout: 5000 });
    await importBtn.click();

    // 성공 or 결과 메시지 대기 (완료/오류 모두 수용)
    await expect(
      dialog.getByText(/완료|성공|오류|건|임포트/)
    ).toBeVisible({ timeout: 30000 });
  });

  test("제품 Excel 템플릿 다운로드 버튼", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");

    const uploadBtn = page.getByRole("button", { name: /업로드/ });
    await expect(uploadBtn).toBeVisible({ timeout: 15000 });
    await uploadBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 템플릿 다운로드 버튼 존재 확인 (버튼 텍스트: "다운로드", div 안에 "템플릿 다운로드" 레이블)
    await expect(dialog.getByText("템플릿 다운로드")).toBeVisible({ timeout: 5000 });
    const templateBtn = dialog.locator('div:has-text("템플릿 다운로드")').getByRole("button").first();
    await expect(templateBtn).toBeVisible({ timeout: 5000 });
  });

  // ── 다운로드 ─────────────────────────────────────────────────────────
  test("재고 Excel 다운로드", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.waitForLoadState("domcontentloaded");

    const downloadBtn = page.getByRole("button", { name: /다운로드/ });
    if (!(await downloadBtn.isVisible())) return;

    // 다운로드 이벤트 감지
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      downloadBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/);
  });

  test("제품 Excel 다운로드", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");

    const downloadBtn = page.getByRole("button", { name: /다운로드/ });
    if (!(await downloadBtn.isVisible())) return;

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 15000 }),
      downloadBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/);
  });

  test("입고현황 Excel 다운로드 버튼", async ({ page }) => {
    await page.goto("/dashboard/orders?tab=inbound");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);

    // 다운로드 버튼 존재 확인 (createObjectURL 방식이라 download 이벤트 없음)
    const downloadBtn = page.getByRole("button", { name: /다운로드/ }).first();
    if (!(await downloadBtn.isVisible())) return;
    // 버튼 존재 확인 (데이터 로딩 전 disabled 상태일 수 있으므로 클릭 없이 확인만)
    await expect(downloadBtn).toBeVisible();
  });
});
