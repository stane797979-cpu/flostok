import { test, expect } from '@playwright/test';

test.describe.serial('Phase 0: 환경 검증', () => {
  test('0-1: 헬스체크 API 정상 응답', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'healthy');
    expect(body).toHaveProperty('timestamp');
  });

  test('0-2: 로그인 페이지 정상 렌더링', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // 이메일 입력 필드 존재 확인
    await expect(
      page.locator('input[type="email"], input[name="email"]')
    ).toBeVisible();

    // 비밀번호 입력 필드 존재 확인
    await expect(
      page.locator('input[type="password"], input[name="password"]')
    ).toBeVisible();

    // 로그인 제목 확인
    await expect(page.getByText('로그인')).toBeVisible();

    // 제출 버튼 확인
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('0-3: 대시보드 페이지 정상 로드', async ({ page }) => {
    // storageState(인증 쿠키)가 적용된 상태에서 대시보드로 이동
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // 인증된 상태이므로 /dashboard URL이 유지되어야 함
    await expect(page).toHaveURL(/dashboard/);

    // 대시보드 핵심 UI 요소 확인
    await expect(page.getByText('총 SKU')).toBeVisible();
  });
});
