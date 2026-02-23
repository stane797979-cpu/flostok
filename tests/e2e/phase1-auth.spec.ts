import { test, expect } from '@playwright/test';

// 인증이 필요 없는 테스트 — storageState를 빈 값으로 오버라이드
test.use({ storageState: { cookies: [], origins: [] } });

test.describe.serial('Phase 1: 인증 테스트', () => {
  test('A-4: 올바른 자격증명으로 로그인 성공 후 대시보드 이동', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 이메일 입력
    await page.locator('input[type="email"], input[name="email"]').fill('test@example.com');

    // 비밀번호 입력
    await page.locator('input[type="password"], input[name="password"]').fill('test1234');

    // 로그인 버튼 클릭
    await page.locator('button[type="submit"]').click();

    // 대시보드로 리다이렉트 확인 (최대 15초 대기)
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await expect(page).toHaveURL(/dashboard/);
  });

  test('A-5: 잘못된 자격증명으로 로그인 시 에러 메시지 표시', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 존재하지 않는 계정 정보 입력
    await page.locator('input[type="email"], input[name="email"]').fill('notexist@example.com');
    await page.locator('input[type="password"], input[name="password"]').fill('wrongpassword');

    // 로그인 버튼 클릭
    await page.locator('button[type="submit"]').click();

    // 에러 메시지 표시 대기 (로그인 페이지에 머물러야 함)
    await page.waitForTimeout(3000);

    // URL이 /login에 머물러 있어야 함
    await expect(page).toHaveURL(/login/);

    // 에러 Alert 또는 에러 메시지 텍스트 확인
    const errorAlert = page.locator('[role="alert"]');
    const hasAlert = await errorAlert.count() > 0;
    if (hasAlert) {
      await expect(errorAlert.first()).toBeVisible();
    } else {
      // Alert가 없을 경우 에러 텍스트 직접 확인
      const errorText = page.getByText(/올바르지 않습니다|실패|invalid|오류/i);
      await expect(errorText.first()).toBeVisible();
    }
  });

  test('A-6: 미인증 상태에서 /dashboard 접근 시 /login으로 리다이렉트', async ({ page }) => {
    // 인증 없이 대시보드 직접 접근
    await page.goto('/dashboard');

    // 로그인 페이지로 리다이렉트되어야 함
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(/login/);

    // 로그인 폼이 표시되어야 함
    await expect(
      page.locator('input[type="email"], input[name="email"]')
    ).toBeVisible();
  });
});
