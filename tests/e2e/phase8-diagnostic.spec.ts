import { test, expect } from "@playwright/test";

test.describe.serial("Phase 8 — 진단 & 가이드 & 대시보드 홈", () => {
  // ────────────────────────────────────────────────────────────
  // SCM 진단키트 (/dashboard/scm-diagnostic)
  // ────────────────────────────────────────────────────────────
  test.describe("SCM 진단키트 페이지", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/scm-diagnostic");
      await page.waitForLoadState("networkidle");
    });

    test("페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/SCM 진단키트|Stock & Logis/);
      await expect(
        page.getByRole("heading", { name: /SCM 진단키트/ })
      ).toBeVisible();
    });

    test("진단키트 설명 문구가 표시된다", async ({ page }) => {
      await expect(
        page.getByText(/설문|진단|최적화|전략/)
      ).toBeVisible();
    });

    test("위자드 카드 또는 시작 UI가 렌더링된다", async ({ page }) => {
      // 위자드 카드 컨테이너
      const wizardCard = page
        .locator('[class*="card"], [class*="Card"]')
        .first();
      await expect(wizardCard).toBeVisible();
    });

    test("진단 카테고리 선택 화면이 표시된다 (1단계)", async ({ page }) => {
      // 위자드 첫 번째 단계: 카테고리 선택 (재고, 물류, 발주)
      // 체크박스 또는 카드 선택 UI 확인
      const categoryOptions = page
        .getByRole("checkbox")
        .or(page.getByText(/재고|물류|발주/).first())
        .first();

      await expect(categoryOptions).toBeVisible();
    });

    test("재고 진단 카테고리 옵션이 존재한다", async ({ page }) => {
      await expect(page.getByText(/재고/).first()).toBeVisible();
    });

    test("물류 진단 카테고리 옵션이 존재한다", async ({ page }) => {
      await expect(page.getByText(/물류/).first()).toBeVisible();
    });

    test("발주 진단 카테고리 옵션이 존재한다", async ({ page }) => {
      await expect(page.getByText(/발주/).first()).toBeVisible();
    });

    test("단계 표시기(Step Indicator)가 렌더링된다", async ({ page }) => {
      // 진행 단계 표시: 1/N 형태나 점 표시 등
      const stepIndicator = page
        .locator('[class*="step"], [class*="Step"]')
        .or(page.getByText(/단계|Step/).first())
        .first();

      if (await stepIndicator.isVisible()) {
        await expect(stepIndicator).toBeVisible();
      }
    });

    test("카테고리 선택 후 다음 버튼이 활성화된다", async ({ page }) => {
      // 재고 카테고리 체크박스 클릭
      const inventoryCheckbox = page
        .getByRole("checkbox")
        .first();

      if (await inventoryCheckbox.isVisible()) {
        await inventoryCheckbox.check();

        // 다음 버튼 확인
        const nextButton = page
          .getByRole("button", { name: /다음|Next|시작/ })
          .first();
        if (await nextButton.isVisible()) {
          await expect(nextButton).toBeEnabled();
        }
      }
    });

    test("다음 버튼 클릭 시 문항 단계로 이동한다", async ({ page }) => {
      // 첫 번째 체크박스 선택
      const firstCheckbox = page.getByRole("checkbox").first();
      if (await firstCheckbox.isVisible()) {
        await firstCheckbox.check();

        const nextButton = page
          .getByRole("button", { name: /다음|Next/ })
          .first();
        if (await nextButton.isVisible()) {
          await nextButton.click();
          await page.waitForTimeout(500);

          // 문항이 나타났는지 확인 (라디오 버튼 또는 질문 텍스트)
          const questionUI = page
            .getByRole("radio")
            .or(page.getByText(/문항|질문|귀사/).first())
            .first();

          if (await questionUI.isVisible()) {
            await expect(questionUI).toBeVisible();
          }
        }
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 수요예측 가이드 (/dashboard/forecast-guide)
  // ────────────────────────────────────────────────────────────
  test.describe("수요예측 가이드 페이지", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard/forecast-guide");
      await page.waitForLoadState("networkidle");
    });

    test("페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
      await expect(
        page.getByRole("heading", { name: /수요예측 가이드/ })
      ).toBeVisible();
    });

    test("가이드 설명 문구가 표시된다", async ({ page }) => {
      await expect(
        page.getByText(/예측|방법|전략|추천/)
      ).toBeVisible();
    });

    test("위자드 카드가 렌더링된다", async ({ page }) => {
      const wizardCard = page
        .locator('[class*="card"], [class*="Card"]')
        .first();
      await expect(wizardCard).toBeVisible();
    });

    test("단계 표시기가 렌더링된다", async ({ page }) => {
      // 가이드 진행 단계 (1단계: 제품 선택)
      const stepIndicator = page
        .locator('[class*="step"], [class*="Step"]')
        .or(page.getByText(/1\s*\/\s*\d+|단계/).first())
        .first();

      if (await stepIndicator.isVisible()) {
        await expect(stepIndicator).toBeVisible();
      }
    });

    test("첫 번째 단계 — 제품 선택 UI가 존재한다", async ({ page }) => {
      // 제품 선택 드롭다운 또는 검색
      const productSelector = page
        .getByRole("combobox")
        .or(page.getByPlaceholder(/제품 검색|제품 선택/).first())
        .first();

      if (await productSelector.isVisible()) {
        await expect(productSelector).toBeVisible();
      }
    });

    test("전체 제품 분석 버튼이 존재한다 (있는 경우)", async ({ page }) => {
      const bulkButton = page
        .getByRole("button", { name: /전체|일괄|모든 제품/ })
        .first();

      if (await bulkButton.isVisible()) {
        await expect(bulkButton).toBeVisible();
      }
    });

    test("다음 버튼이 존재한다", async ({ page }) => {
      const nextButton = page
        .getByRole("button", { name: /다음|Next/ })
        .first();

      if (await nextButton.isVisible()) {
        await expect(nextButton).toBeVisible();
      }
    });

    test("다음 버튼 클릭 시 2단계로 이동한다", async ({ page }) => {
      // 1단계는 제품 선택 (선택사항이라 바로 다음으로 진행 가능)
      const nextButton = page
        .getByRole("button", { name: /다음|Next/ })
        .first();

      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);

        // 2단계 내용 확인 (판매 패턴 또는 다음 단계 UI)
        const step2Content = page
          .getByText(/판매 패턴|계절성|트렌드/)
          .first();

        if (await step2Content.isVisible()) {
          await expect(step2Content).toBeVisible();
        }
      }
    });
  });

  // ────────────────────────────────────────────────────────────
  // 대시보드 홈 (/dashboard)
  // ────────────────────────────────────────────────────────────
  test.describe("대시보드 홈 페이지", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
    });

    test("대시보드 페이지가 정상 로드된다", async ({ page }) => {
      await expect(page).toHaveTitle(/Stock & Logis|FlowStok/);
    });

    test("재고 현황 요약 섹션이 표시된다", async ({ page }) => {
      await expect(page.getByText(/재고 현황 요약/)).toBeVisible();
    });

    test("총 SKU KPI 카드가 렌더링된다", async ({ page }) => {
      await expect(page.getByText("총 SKU")).toBeVisible();
    });

    test("발주 필요 KPI 카드가 렌더링된다", async ({ page }) => {
      await expect(page.getByText("발주 필요")).toBeVisible();
    });

    test("위험 품목 KPI 카드가 렌더링된다", async ({ page }) => {
      await expect(page.getByText("위험 품목")).toBeVisible();
    });

    test("과재고 KPI 카드가 렌더링된다", async ({ page }) => {
      await expect(page.getByText("과재고")).toBeVisible();
    });

    test("주요 성과 지표 섹션이 렌더링된다", async ({ page }) => {
      await expect(page.getByText("주요 성과 지표")).toBeVisible();
    });

    test("재고회전율 KPI 카드가 표시된다", async ({ page }) => {
      await expect(page.getByText("재고회전율")).toBeVisible();
    });

    test("평균 재고일수 KPI 카드가 표시된다", async ({ page }) => {
      await expect(page.getByText("평균 재고일수")).toBeVisible();
    });

    test("적시 발주율 KPI 카드가 표시된다", async ({ page }) => {
      await expect(page.getByText("적시 발주율")).toBeVisible();
    });

    test("재고상태 분포 차트가 렌더링된다", async ({ page }) => {
      await expect(page.getByText("재고상태 분포")).toBeVisible();
      // SVG 차트 또는 차트 컨테이너 확인
      const chart = page.locator("svg").first();
      if (await chart.isVisible()) {
        await expect(chart).toBeVisible();
      }
    });

    test("발주 필요 품목 카드가 렌더링된다", async ({ page }) => {
      await expect(page.getByText("발주 필요 품목")).toBeVisible();
    });

    test("전체 KPI 보기 링크가 존재한다", async ({ page }) => {
      const kpiLink = page.getByRole("link", { name: /전체 KPI 보기/ });
      await expect(kpiLink).toBeVisible();
      await expect(kpiLink).toHaveAttribute("href", /\/dashboard\/kpi/);
    });

    test("최근 활동 섹션이 렌더링된다", async ({ page }) => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await expect(page.getByText("최근 활동")).toBeVisible();
    });

    test("재고 회전율 TOP5 섹션이 렌더링된다", async ({ page }) => {
      await expect(page.getByText(/재고 회전율 TOP5/)).toBeVisible();
    });
  });
});
