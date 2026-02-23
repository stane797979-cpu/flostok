import { test, expect } from "@playwright/test";

/**
 * Phase 9 — 종단간 사용자 시나리오
 *
 * SCM 핵심 플로우:
 * 대시보드 → 제품 목록 → 발주 → 입고 → 출고 → 재고 → 분석
 *
 * 각 페이지 정상 로드 + 사이드바 네비게이션 동작 검증.
 * 데이터 없음 상태(빈 조직)도 유효한 상태로 처리.
 */
test.describe.serial("Phase 9 — 종단간 SCM 시나리오", () => {
  // ────────────────────────────────────────────────────────────
  // 사이드바 네비게이션 구조 확인
  // ────────────────────────────────────────────────────────────
  test.describe("사이드바 네비게이션", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
    });

    test("사이드바가 렌더링된다", async ({ page }) => {
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeVisible();
    });

    test("대시보드 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /대시보드/ });
      await expect(link.first()).toBeVisible();
    });

    test("PSI 계획 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /PSI 계획/ });
      await expect(link.first()).toBeVisible();
    });

    test("수요·공급 분석 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /수요·공급 분석/ });
      await expect(link.first()).toBeVisible();
    });

    test("발주관리 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /발주관리/ });
      await expect(link.first()).toBeVisible();
    });

    test("재고 현황 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /재고 현황/ });
      await expect(link.first()).toBeVisible();
    });

    test("제품 관리 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /제품 관리/ });
      await expect(link.first()).toBeVisible();
    });

    test("설정 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /설정/ });
      await expect(link.first()).toBeVisible();
    });

    test("SCM 진단키트 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /SCM 진단키트/ });
      await expect(link.first()).toBeVisible();
    });

    test("KPI 링크가 사이드바에 존재한다", async ({ page }) => {
      const link = page.getByRole("link", { name: /KPI/ });
      await expect(link.first()).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 전체 플로우: 대시보드 → 제품 → 발주 → 입고 → 출고 → 재고 → 분석
  // ────────────────────────────────────────────────────────────
  test.describe("SCM 핵심 플로우 — 페이지 순차 이동", () => {
    test("1단계: 대시보드 홈 정상 로드", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      await expect(page.getByText("총 SKU")).toBeVisible();
      await expect(page.getByText("발주 필요")).toBeVisible();
    });

    test("2단계: 제품 관리 페이지 정상 로드", async ({ page }) => {
      await page.goto("/dashboard/products");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      // 제품 관리 헤더 또는 페이지 컨테이너 확인
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("3단계: 발주 관리 페이지 정상 로드", async ({ page }) => {
      await page.goto("/dashboard/orders");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("4단계: 입고 관리 페이지 정상 로드", async ({ page }) => {
      await page.goto("/dashboard/warehouse/inbound");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/입고예정|Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("5단계: 출고 관리 페이지 정상 로드", async ({ page }) => {
      await page.goto("/dashboard/outbound");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("6단계: 재고 현황 페이지 정상 로드", async ({ page }) => {
      await page.goto("/dashboard/inventory");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("7단계: 수요·공급 분석 페이지 정상 로드", async ({ page }) => {
      await page.goto("/dashboard/analytics");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      await expect(
        page.getByRole("heading", { name: /수요·공급 분석|분석/ })
      ).toBeVisible();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 사이드바 클릭으로 실제 페이지 이동 확인
  // ────────────────────────────────────────────────────────────
  test.describe("사이드바 클릭 네비게이션", () => {
    test("대시보드 → 재고 현황 이동", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const inventoryLink = page
        .getByRole("link", { name: /재고 현황/ })
        .first();
      await inventoryLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/inventory/);
    });

    test("대시보드 → 발주관리 이동", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const ordersLink = page
        .getByRole("link", { name: /발주관리/ })
        .first();
      await ordersLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/orders/);
    });

    test("대시보드 → 수요·공급 분석 이동", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const analyticsLink = page
        .getByRole("link", { name: /수요·공급 분석/ })
        .first();
      await analyticsLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/analytics/);
    });

    test("대시보드 → KPI 이동", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const kpiLink = page
        .getByRole("link", { name: /KPI/ })
        .first();
      await kpiLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/kpi/);
    });

    test("대시보드 → 설정 이동", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const settingsLink = page
        .getByRole("link", { name: /설정/ })
        .first();
      await settingsLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/settings/);
    });

    test("대시보드 → SCM 진단키트 이동", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const diagnosticLink = page
        .getByRole("link", { name: /SCM 진단키트/ })
        .first();
      await diagnosticLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/scm-diagnostic/);
    });

    test("대시보드 → 수요예측 가이드 이동", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      const guideLink = page
        .getByRole("link", { name: /수요예측 가이드/ })
        .first();
      await guideLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/forecast-guide/);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 대시보드 내 링크 동작 확인
  // ────────────────────────────────────────────────────────────
  test.describe("대시보드 홈 내부 링크 동작", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
    });

    test("'전체 KPI 보기' 링크가 /dashboard/kpi로 이동한다", async ({
      page,
    }) => {
      const kpiLink = page.getByRole("link", { name: /전체 KPI 보기/ });
      await expect(kpiLink).toBeVisible();
      await kpiLink.click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/dashboard\/kpi/);
    });

    test("'전체 보기' 링크가 발주 페이지로 이동한다", async ({ page }) => {
      const ordersLink = page.getByRole("link", { name: /전체 보기/ });
      if (await ordersLink.first().isVisible()) {
        await ordersLink.first().click();
        await page.waitForLoadState("networkidle");

        await expect(page).toHaveURL(/\/dashboard\/orders/);
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 추가 페이지 로드 확인 (기타 라우트)
  // ────────────────────────────────────────────────────────────
  test.describe("추가 라우트 정상 로드", () => {
    test("수불관리 페이지가 정상 로드된다", async ({ page }) => {
      await page.goto("/dashboard/movement");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("공급업체 페이지가 정상 로드된다", async ({ page }) => {
      await page.goto("/dashboard/suppliers");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("결품관리 페이지가 정상 로드된다", async ({ page }) => {
      await page.goto("/dashboard/stockout");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("PSI 계획 페이지가 정상 로드된다", async ({ page }) => {
      await page.goto("/dashboard/psi");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("창고 관리 페이지가 정상 로드된다", async ({ page }) => {
      await page.goto("/dashboard/warehouses");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("알림 페이지가 정상 로드된다", async ({ page }) => {
      await page.goto("/dashboard/alerts");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });
  });
});
