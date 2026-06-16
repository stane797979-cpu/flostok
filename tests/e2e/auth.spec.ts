import { test, expect } from "@playwright/test";

test.describe("인증 플로우", () => {
  test("로그인 페이지 렌더링", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.getByPlaceholder(/이메일/)).toBeVisible();
    await expect(page.getByPlaceholder(/비밀번호/)).toBeVisible();
    await expect(page.getByRole("button", { name: /로그인/ })).toBeVisible();
  });

  test("회원가입 페이지 렌더링", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.getByPlaceholder(/이메일/)).toBeVisible();
    await expect(page.getByPlaceholder(/비밀번호/)).toBeVisible();
  });

  test("로그인 페이지에서 회원가입 페이지로 이동", async ({ page }) => {
    await page.goto("/login");
    const signupLink = page.getByRole("link", { name: /회원가입/ });
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await expect(page).toHaveURL(/\/signup/);
    }
  });

  test("유효성 검증 - 빈 이메일", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.getByPlaceholder(/이메일/);
    const submitButton = page.getByRole("button", { name: /로그인/ });
    await emailInput.click();
    await submitButton.click();
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test("유효성 검증 - 잘못된 이메일 형식", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.getByPlaceholder(/이메일/);
    await emailInput.fill("invalid-email");
    await page.getByRole("button", { name: /로그인/ }).click();
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toContain("@");
  });
});
