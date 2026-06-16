import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: 60000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'https://stock-and-logis.vercel.app',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        storageState: undefined,
        headless: false,
        launchOptions: {
          executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          args: ['--no-sandbox', '--disable-gpu'],
        },
      },
    },
    {
      name: 'auth-pages',
      testMatch: /auth\.spec\.ts/,
      use: {
        storageState: undefined,
        headless: false,
        launchOptions: {
          executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          args: ['--no-sandbox', '--disable-gpu'],
        },
      },
    },
    {
      name: 'chromium',
      testIgnore: [/auth\.spec\.ts/, /psi-realdata-test\.spec\.ts/, /verify-group-c\.spec\.ts/, /verify-phase-4-7\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
        headless: false,
        launchOptions: {
          executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          args: ['--no-sandbox', '--disable-gpu'],
        },
      },
      dependencies: ['setup'],
    },
  ],
});
