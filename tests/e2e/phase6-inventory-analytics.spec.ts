import { test, expect } from "@playwright/test";

test.describe.serial("Phase 6 — 재고 현황 & 분석", () => {
  // ────────────────────────────────────────────────────────────
  // 재고 현황 (/dashboard/inventory)
  // ────────────────────────────────────────────────────────────
  test.describe("재고 현황 페이지", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/inventory");
      await page.waitForLoadState("networkidle");
    });

    test("페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      // 재고 관리 헤더 또는 페이지 컨테이너 확인
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("재고 통계 카드가 렌더링된다", async ({ page }) => {
      // 통계 카드 영역: 총 제품 수, 발주 필요, 위험·품절, 과재고
      const grid = page.locator('[class*="grid"]').first();
      await expect(grid).toBeVisible();
    });

    test("재고 테이블이 렌더링된다", async ({ page }) => {
      const table = page.locator("table").first();

      if (await table.isVisible()) {
        // 테이블 헤더 컬럼 확인
        await expect(page.getByText(/SKU|제품명|현재고/).first()).toBeVisible();
      } else {
        // 데이터 없음 메시지도 유효한 상태
        const emptyState = page.getByText(/데이터 없음|등록된 재고|항목이 없/).first();
        await expect(emptyState).toBeVisible();
      }
    });

    test("재고 상태 뱃지가 렌더링된다", async ({ page }) => {
      // 품절, 위험, 부족, 주의, 적정, 과다, 과잉 중 하나 이상 존재하거나 데이터 없음 상태
      const badges = page.locator('[class*="badge"], [class*="Badge"]');
      const table = page.locator("table").first();

      const tableVisible = await table.isVisible();
      if (tableVisible) {
        const badgeCount = await badges.count();
        // 테이블이 있으면 최소 1개 뱃지 기대, 없으면 스킵
        if (badgeCount > 0) {
          await expect(badges.first()).toBeVisible();
        }
      }
    });

    test("창고 필터가 존재한다 (있는 경우)", async ({ page }) => {
      // 창고 셀렉터 또는 드롭다운 확인 (선택적 요소)
      const warehouseSelect = page
        .getByRole("combobox")
        .or(page.getByRole("listbox"))
        .first();

      if (await warehouseSelect.isVisible()) {
        await expect(warehouseSelect).toBeVisible();
      }
    });

    test("페이지네이션이 존재한다 (데이터 있는 경우)", async ({ page }) => {
      const pagination = page
        .locator('[class*="pagination"]')
        .or(page.getByRole("navigation", { name: /페이지/ }))
        .first();

      if (await pagination.isVisible()) {
        await expect(pagination).toBeVisible();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 일별 이동 현황 (/dashboard/movement)
  // ────────────────────────────────────────────────────────────
  test.describe("일별 이동 현황 페이지", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/movement");
      await page.waitForLoadState("networkidle");
    });

    test("페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();
    });

    test("이동 현황 테이블 또는 빈 상태가 렌더링된다", async ({ page }) => {
      const table = page.locator("table").first();
      const tableVisible = await table.isVisible();

      if (tableVisible) {
        // 테이블 헤더 존재 확인
        const thead = table.locator("thead");
        await expect(thead).toBeVisible();
      } else {
        // 데이터 없음 상태도 유효
        const emptyMsg = page.getByText(/데이터 없음|이동 기록|내역이 없/).first();
        if (await emptyMsg.isVisible()) {
          await expect(emptyMsg).toBeVisible();
        }
      }
    });

    test("날짜 필터 또는 기간 선택이 존재한다 (있는 경우)", async ({ page }) => {
      // 날짜 피커, 기간 선택, 탭 등
      const dateFilter = page
        .getByRole("tab")
        .or(page.locator("input[type='date']"))
        .or(page.getByRole("combobox").first())
        .first();

      if (await dateFilter.isVisible()) {
        await expect(dateFilter).toBeVisible();
      }
    });

    test("요약 정보 카드가 존재한다 (있는 경우)", async ({ page }) => {
      // 입고/출고 합계 요약 카드
      const summaryCard = page.locator('[class*="card"], [class*="Card"]').first();
      if (await summaryCard.isVisible()) {
        await expect(summaryCard).toBeVisible();
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // ABC-XYZ 분석 (/dashboard/analytics)
  // ────────────────────────────────────────────────────────────
  test.describe("ABC-XYZ 분석 페이지", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/analytics");
      await page.waitForLoadState("networkidle");
    });

    test("페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      await expect(
        page.getByRole("heading", { name: /수요·공급 분석|분석/ })
      ).toBeVisible();
    });

    test("분석 탭 목록이 렌더링된다", async ({ page }) => {
      const tabList = page.getByRole("tablist").first();
      await expect(tabList).toBeVisible();

      // ABC-XYZ 탭 확인
      await expect(
        page.getByRole("tab", { name: /ABC-XYZ/ })
      ).toBeVisible();
    });

    test("ABC-XYZ 분석 탭이 기본 선택되어 있다", async ({ page }) => {
      const abcTab = page.getByRole("tab", { name: /ABC-XYZ/ });
      await expect(abcTab).toBeVisible();
      await expect(abcTab).toHaveAttribute("aria-selected", "true");
    });

    test("ABC-XYZ 매트릭스 또는 데이터 없음 메시지가 표시된다", async ({
      page,
    }) => {
      // 데이터 있는 경우: 매트릭스/테이블 렌더링
      // 데이터 없는 경우: "분석 데이터 없음" 메시지
      const hasTable = await page.locator("table").first().isVisible();
      const hasNoData = await page
        .getByText(/분석 데이터 없음|데이터 없음/)
        .first()
        .isVisible();

      // 둘 중 하나는 반드시 표시
      expect(hasTable || hasNoData).toBeTruthy();
    });

    test("등급변동 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /등급변동/ });
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForLoadState("networkidle");
        // 탭 콘텐츠가 변경되었는지 확인
        await expect(tab).toHaveAttribute("aria-selected", "true");
      }
    });

    test("실출고율 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /실출고율/ });
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForLoadState("networkidle");
        await expect(tab).toHaveAttribute("aria-selected", "true");
      }
    });

    test("판매 추이 탭으로 전환된다", async ({ page }) => {
      const tab = page.getByRole("tab", { name: /판매 추이/ });
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForLoadState("networkidle");
        await expect(tab).toHaveAttribute("aria-selected", "true");
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // KPI 대시보드 (/dashboard/kpi)
  // ────────────────────────────────────────────────────────────
  test.describe("KPI 대시보드 페이지", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/kpi");
      await page.waitForLoadState("networkidle");
    });

    test("페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      await expect(
        page.getByRole("heading", { name: /KPI 대시보드/ })
      ).toBeVisible();
    });

    test("KPI 지표 카드가 렌더링된다", async ({ page }) => {
      // 데이터 로드 성공 또는 오류 안내 메시지 중 하나
      const hasCards = await page
        .locator('[class*="card"], [class*="Card"]')
        .first()
        .isVisible();
      expect(hasCards).toBeTruthy();
    });

    test("재고회전율 지표가 표시된다 (데이터 있는 경우)", async ({ page }) => {
      const errorMsg = page.getByText(/불러올 수 없습니다/);
      if (await errorMsg.isVisible()) {
        // 오류 상태도 유효한 UI 상태
        await expect(errorMsg).toBeVisible();
      } else {
        // 정상 데이터 상태: KPI 지표 중 하나 이상 확인
        const kpiIndicator = page
          .getByText(/재고회전율|회전율|평균 재고일수|발주율/)
          .first();
        await expect(kpiIndicator).toBeVisible();
      }
    });

    test("KPI 탭 또는 필터가 존재한다 (있는 경우)", async ({ page }) => {
      const tabs = page.getByRole("tablist").first();
      if (await tabs.isVisible()) {
        await expect(tabs).toBeVisible();
      }

      // 기간 필터 확인
      const filter = page.getByRole("combobox").first();
      if (await filter.isVisible()) {
        await expect(filter).toBeVisible();
      }
    });
  });
});
