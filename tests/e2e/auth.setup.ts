import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // 로그인 페이지로 이동
  await page.goto('http://localhost:3000/login');

  // 이메일/비밀번호 입력 (테스트 계정 사용)
  await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
  await page.fill('input[type="password"], input[name="password"]', 'test1234');

  // 로그인 버튼 클릭
  await page.click('button[type="submit"]');

  // 대시보드 페이지로 이동 대기
  await page.waitForURL('**/dashboard**', { timeout: 10000 });

  // 인증 상태 저장
  await page.context().storageState({ path: authFile });
});
