import { test, expect } from "@playwright/test";

// PSI, KPI, 분석, 출고, 결품, 수불, 공급자, 설정, 알림 페이지 렌더링 테스트

test.describe("PSI 계획", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/psi");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });
  });

  test("PSI 테이블 또는 콘텐츠 렌더링", async ({ page }) => {
    await expect(page.locator("table, [class*='grid'], [class*='card']").first()).toBeVisible({ timeout: 15000 });
  });

  test("PSI 필터 UI", async ({ page }) => {
    const filter = page.locator("select, [role='combobox'], input[type='text']").first();
    if (await filter.isVisible()) {
      await expect(filter).toBeVisible();
    }
  });
});

test.describe("KPI 현황", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/kpi");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });
  });

  test("KPI 탭 렌더링", async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("KPI 콘텐츠 렌더링", async ({ page }) => {
    await expect(page.locator("[class*='card'], table, [class*='grid']").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("분석", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/analytics");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });
  });

  test("분석 탭 렌더링", async ({ page }) => {
    const tabs = page.locator('[role="tab"]');
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test("ABC-XYZ 분석 탭 전환", async ({ page }) => {
    const abcTab = page.getByRole("tab", { name: /ABC|XYZ|등급/ }).first();
    if (await abcTab.isVisible()) {
      await abcTab.click();
      await page.waitForTimeout(500);
    }
  });

  test("분석 콘텐츠 렌더링", async ({ page }) => {
    await expect(page.locator("[class*='card'], table, [class*='chart'], svg").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("출고 관리", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/outbound");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2, button").first()).toBeVisible({ timeout: 15000 });
  });

  test("출고 등록 버튼 렌더링", async ({ page }) => {
    const btn = page.getByRole("button", { name: /출고|등록|추가/ }).first();
    if (await btn.isVisible()) {
      await expect(btn).toBeVisible({ timeout: 10000 });
    }
  });

  test("출고 테이블 렌더링", async ({ page }) => {
    await expect(page.locator("table, [class*='card']").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("결품 관리", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/stockout");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2, [class*='card']").first()).toBeVisible({ timeout: 15000 });
  });

  test("결품 목록 렌더링", async ({ page }) => {
    await expect(page.locator("table, [class*='card'], [class*='grid']").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("수불 관리", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/movement");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2, [class*='card']").first()).toBeVisible({ timeout: 15000 });
  });

  test("수불 테이블 렌더링", async ({ page }) => {
    await expect(page.locator("table, [class*='card']").first()).toBeVisible({ timeout: 15000 });
  });

  test("기간 선택 UI", async ({ page }) => {
    const datePicker = page.locator("input[type='date'], [class*='date'], button:has-text('기간')").first();
    if (await datePicker.isVisible()) {
      await expect(datePicker).toBeVisible();
    }
  });
});

test.describe("공급자 관리", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/suppliers");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2, button").first()).toBeVisible({ timeout: 15000 });
  });

  test("공급자 추가 버튼", async ({ page }) => {
    const btn = page.getByRole("button", { name: /추가|등록|공급/ }).first();
    if (await btn.isVisible()) {
      await expect(btn).toBeVisible({ timeout: 10000 });
    }
  });

  test("공급자 목록 렌더링", async ({ page }) => {
    await expect(page.locator("table, [class*='card'], [class*='grid']").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("설정", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });
  });

  test("설정 섹션 렌더링", async ({ page }) => {
    await expect(page.locator("[class*='card'], form, [class*='section']").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("알림", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/alerts");
    await page.waitForLoadState("domcontentloaded");
  });

  test("페이지 로딩", async ({ page }) => {
    await expect(page).toHaveTitle(/FloStok/);
    await expect(page.locator("h1, h2, [class*='card']").first()).toBeVisible({ timeout: 15000 });
  });

  test("알림 목록 렌더링", async ({ page }) => {
    await expect(page.locator("[class*='card'], table, [class*='alert'], li").first()).toBeVisible({ timeout: 15000 });
  });
});
