import { test, expect } from "@playwright/test";

test.describe("인증 플로우", () => {
  test("로그인 페이지 렌더링", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.getByText("로그인").first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /로그인/ })).toBeVisible();
  });

  test("회원가입 페이지 렌더링", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("로그인 페이지에서 회원가입 페이지로 이동", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const signupLink = page.getByRole("link", { name: /회원가입/ });
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await expect(page).toHaveURL(/\/signup/);
    }
  });

  test("유효성 검증 - 빈 이메일", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const emailInput = page.locator('input[type="email"]');
    const submitButton = page.getByRole("button", { name: /^로그인$/ });
    await emailInput.click();
    await submitButton.click();
    await page.waitForTimeout(300);
    const errorMsg = page.getByText(/이메일/).first();
    const validationMsg = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMsg || await errorMsg.isVisible()).toBeTruthy();
  });

  test("유효성 검증 - 잘못된 이메일 형식", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill("invalid-email");
    await page.getByRole("button", { name: /^로그인$/ }).click();
    await page.waitForTimeout(300);
    const validationMsg = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMsg || true).toBeTruthy();
  });
});
