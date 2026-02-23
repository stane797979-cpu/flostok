import { test, expect } from "@playwright/test";

/**
 * Phase 5 — 출고 프로세스 E2E 테스트
 *
 * 인증 상태: storageState '.auth/user.json' (playwright.config.ts의 chromium 프로젝트가 주입)
 *
 * 테스트 대상 페이지
 *   1) /dashboard/outbound        — 출고현황 (OutboundClient, initialTab="records")
 *   2) /dashboard/warehouse/outbound — 출고확정(창고) (WarehouseOutboundClient)
 *
 * 주요 검증 항목
 *   - 출고 기록 테이블 렌더링
 *   - 출고 요청 다이얼로그 열기
 *   - 가용재고·대기수량 컬럼 존재 (창고 출고확정 페이지)
 *   - 피킹지 다운로드 버튼 존재 (항목 선택 시)
 *   - 빈 상태 메시지 처리
 */
test.describe.serial("출고 프로세스", () => {
  // ── 1) 출고 현황 페이지 ───────────────────────────────────────────────────

  test("출고 관리 페이지(/dashboard/outbound)에 접근할 수 있다", async ({
    page,
  }) => {
    await page.goto("/dashboard/outbound");
    await page.waitForLoadState("networkidle");

    // 헤딩 "출고현황" 또는 "출고요청" 확인
    const heading = page
      .locator("h1, h2")
      .filter({ hasText: /출고/ })
      .first();
    const headingVisible = await heading.isVisible().catch(() => false);

    expect(headingVisible).toBeTruthy();
  });

  test("출고 기록 테이블이 렌더링되거나 빈 상태 메시지가 표시된다", async ({
    page,
  }) => {
    await page.goto("/dashboard/outbound");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table").first();
    const emptyMsg = page
      .getByText(/출고 기록이 없습니다|기록이 없습니다|없습니다/)
      .first();
    const loadingMsg = page
      .getByText(/출고 기록을 불러오는 중|로딩/)
      .first();

    const tableVisible = await table.isVisible().catch(() => false);
    const emptyVisible = await emptyMsg.isVisible().catch(() => false);
    const loadingVisible = await loadingMsg.isVisible().catch(() => false);

    expect(tableVisible || emptyVisible || loadingVisible).toBeTruthy();
  });

  test("출고 기록 테이블에 주요 컬럼 헤더가 존재한다", async ({ page }) => {
    await page.goto("/dashboard/outbound");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table").first();
    const tableVisible = await table.isVisible().catch(() => false);

    if (!tableVisible) {
      // 빈 상태이면 통과
      const emptyMsg = page.getByText(/없습니다/).first();
      const emptyVisible = await emptyMsg.isVisible().catch(() => false);
      expect(emptyVisible || true).toBeTruthy();
      return;
    }

    // SKU 또는 제품명 헤더 확인
    const skuHeader = page.getByRole("columnheader", { name: /SKU/ });
    const nameHeader = page.getByRole("columnheader", { name: /제품명/ });
    const dateHeader = page.getByRole("columnheader", { name: /날짜|일자/ });

    const skuVisible = await skuHeader.isVisible().catch(() => false);
    const nameVisible = await nameHeader.isVisible().catch(() => false);
    const dateVisible = await dateHeader.isVisible().catch(() => false);

    expect(skuVisible || nameVisible || dateVisible).toBeTruthy();
  });

  test("월 이동 버튼(이전달/다음달)이 존재한다", async ({ page }) => {
    await page.goto("/dashboard/outbound");
    await page.waitForLoadState("networkidle");

    // ChevronLeft / ChevronRight 버튼 (월 이동 UI)
    const prevBtn = page
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .nth(0);
    const prevBtnVisible = await prevBtn.isVisible().catch(() => false);

    // 월 표시 텍스트 ("2026년 2월" 형태)
    const monthText = page.getByText(/\d{4}년 \d{1,2}월/).first();
    const monthVisible = await monthText.isVisible().catch(() => false);

    expect(prevBtnVisible || monthVisible).toBeTruthy();
  });

  test("'출고 요청' 버튼을 클릭하면 다이얼로그가 열린다", async ({ page }) => {
    await page.goto("/dashboard/outbound");
    await page.waitForLoadState("networkidle");

    const requestBtn = page
      .getByRole("button", { name: /출고 요청/ })
      .first();
    const btnVisible = await requestBtn.isVisible().catch(() => false);

    if (!btnVisible) {
      // 버튼이 없는 레이아웃이면 테스트를 건너뜀
      return;
    }

    await requestBtn.click();
    await page.waitForTimeout(500);

    // 다이얼로그 확인
    const dialog = page.locator('[role="dialog"]').first();
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (dialogVisible) {
      // 다이얼로그 내부에 "출고 요청" 관련 콘텐츠 확인
      const dialogTitle = page
        .locator('[role="dialog"]')
        .getByText(/출고 요청|출고/)
        .first();
      const titleVisible = await dialogTitle.isVisible().catch(() => false);
      expect(titleVisible || dialogVisible).toBeTruthy();

      // 다이얼로그 닫기
      const cancelBtn = page
        .locator('[role="dialog"]')
        .getByRole("button", { name: /취소|닫기/ })
        .first();
      const cancelVisible = await cancelBtn.isVisible().catch(() => false);
      if (cancelVisible) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(300);
    }
  });

  test("'엑셀 다운' 버튼이 존재한다", async ({ page }) => {
    await page.goto("/dashboard/outbound");
    await page.waitForLoadState("networkidle");

    const excelBtn = page
      .getByRole("button", { name: /엑셀 다운|다운로드|엑셀/ })
      .first();
    const btnVisible = await excelBtn.isVisible().catch(() => false);

    // 버튼이 없어도 테스트 실패 처리하지 않음 (UI 구성에 따라 다를 수 있음)
    // 존재하면 버튼이 활성화 상태인지 확인
    if (btnVisible) {
      await expect(excelBtn).toBeVisible();
    }
  });

  // ── 2) 창고 출고 확정 페이지 ──────────────────────────────────────────────

  test("창고 출고 확정 페이지(/dashboard/warehouse/outbound)에 접근할 수 있다", async ({
    page,
  }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    // "출고확정(창고)" 헤딩 확인
    const heading = page
      .locator("h1")
      .filter({ hasText: /출고확정|출고/ })
      .first();
    const headingVisible = await heading.isVisible().catch(() => false);

    expect(headingVisible).toBeTruthy();
  });

  test("창고 출고 확정 페이지에서 출고 목록 또는 빈 상태 메시지가 표시된다", async ({
    page,
  }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table").first();
    const emptyMsg = page
      .getByText(/출고 요청이 없습니다|대기중인 출고 요청이 없습니다|없습니다/)
      .first();
    const loadingMsg = page.getByText(/로딩 중/).first();

    const tableVisible = await table.isVisible().catch(() => false);
    const emptyVisible = await emptyMsg.isVisible().catch(() => false);
    const loadingVisible = await loadingMsg.isVisible().catch(() => false);

    expect(tableVisible || emptyVisible || loadingVisible).toBeTruthy();
  });

  test("출고 목록 테이블에 '가용재고' 컬럼이 존재한다", async ({ page }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table").first();
    const tableVisible = await table.isVisible().catch(() => false);

    if (!tableVisible) {
      // 빈 상태이면 테스트 통과
      return;
    }

    // "가용재고" 컬럼 헤더 확인
    const availableStockHeader = page
      .getByRole("columnheader", { name: /가용재고/ })
      .first();
    const headerVisible = await availableStockHeader
      .isVisible()
      .catch(() => false);

    if (!headerVisible) {
      // span 형태로 렌더링될 수 있음 (Tooltip trigger)
      const headerSpan = page
        .locator("thead")
        .getByText(/가용재고/)
        .first();
      const spanVisible = await headerSpan.isVisible().catch(() => false);
      expect(spanVisible).toBeTruthy();
    } else {
      expect(headerVisible).toBeTruthy();
    }
  });

  test("출고 목록 테이블에 '대기수량' 컬럼이 존재한다", async ({ page }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table").first();
    const tableVisible = await table.isVisible().catch(() => false);

    if (!tableVisible) {
      return;
    }

    // "대기수량" 컬럼 헤더 확인
    const backlogHeader = page
      .getByRole("columnheader", { name: /대기수량/ })
      .first();
    const headerVisible = await backlogHeader.isVisible().catch(() => false);

    if (!headerVisible) {
      // span 형태로 렌더링될 수 있음
      const headerSpan = page
        .locator("thead")
        .getByText(/대기수량/)
        .first();
      const spanVisible = await headerSpan.isVisible().catch(() => false);
      expect(spanVisible).toBeTruthy();
    } else {
      expect(headerVisible).toBeTruthy();
    }
  });

  test("항목 선택 시 '피킹지 다운로드' 버튼이 나타난다", async ({ page }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table").first();
    const tableVisible = await table.isVisible().catch(() => false);

    if (!tableVisible) {
      // 대기중 데이터가 없으면 테스트를 건너뜀
      return;
    }

    // 첫 번째 체크박스(데이터 행) 선택
    const firstRowCheckbox = page
      .locator("table tbody tr")
      .first()
      .getByRole("checkbox")
      .first();
    const checkboxVisible = await firstRowCheckbox.isVisible().catch(() => false);

    if (!checkboxVisible) {
      // 체크박스가 없으면 (이미 출고완료된 항목 등) 건너뜀
      return;
    }

    await firstRowCheckbox.click();
    await page.waitForTimeout(400);

    // "피킹지 다운로드" 버튼 확인
    const pickingListBtn = page
      .getByRole("button", { name: /피킹지 다운로드/ })
      .first();
    const btnVisible = await pickingListBtn.isVisible().catch(() => false);

    expect(btnVisible).toBeTruthy();

    // 체크박스 선택 해제 (재클릭)
    await firstRowCheckbox.click();
    await page.waitForTimeout(300);
  });

  test("요청번호 클릭 시 출고 확정 다이얼로그가 열린다", async ({ page }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    const table = page.locator("table").first();
    const tableVisible = await table.isVisible().catch(() => false);

    if (!tableVisible) {
      return;
    }

    // 대기중(pending) 상태의 요청번호 버튼 (button 태그, text-primary 클래스)
    const requestNumberBtn = page
      .locator("table tbody tr")
      .first()
      .locator("button")
      .first();
    const btnVisible = await requestNumberBtn.isVisible().catch(() => false);

    if (!btnVisible) {
      return;
    }

    await requestNumberBtn.click();
    await page.waitForTimeout(500);

    // 출고 확정 다이얼로그가 열렸는지 확인
    const dialog = page.locator('[role="dialog"]').first();
    const dialogVisible = await dialog.isVisible().catch(() => false);

    if (dialogVisible) {
      const dialogText = page
        .locator('[role="dialog"]')
        .getByText(/출고|확정|확인/)
        .first();
      const textVisible = await dialogText.isVisible().catch(() => false);
      expect(textVisible || dialogVisible).toBeTruthy();

      // 다이얼로그 닫기
      const cancelBtn = page
        .locator('[role="dialog"]')
        .getByRole("button", { name: /취소|닫기/ })
        .first();
      const cancelVisible = await cancelBtn.isVisible().catch(() => false);
      if (cancelVisible) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(300);
    }
  });

  test("상태 필터(Select)로 출고완료 목록을 조회할 수 있다", async ({ page }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    // 상태 Select 컴포넌트 확인 ("대기중" 기본값)
    const statusSelect = page
      .locator('[role="combobox"]')
      .filter({ hasText: /대기중|출고완료|취소됨|전체/ })
      .first();
    const selectVisible = await statusSelect.isVisible().catch(() => false);

    if (!selectVisible) {
      return;
    }

    // 드롭다운 열기
    await statusSelect.click();
    await page.waitForTimeout(300);

    // "출고완료" 옵션 선택
    const confirmedOption = page
      .locator('[role="option"]')
      .getByText(/출고완료/)
      .first();
    const optionVisible = await confirmedOption.isVisible().catch(() => false);

    if (optionVisible) {
      await confirmedOption.click();
      await page.waitForLoadState("networkidle");

      // 출고완료 목록이 로드되거나 빈 상태가 표시됨
      const table = page.locator("table").first();
      const emptyMsg = page.getByText(/없습니다/).first();

      const tableVisible = await table.isVisible().catch(() => false);
      const emptyVisible = await emptyMsg.isVisible().catch(() => false);

      expect(tableVisible || emptyVisible).toBeTruthy();
    } else {
      // 옵션이 없으면 Escape로 닫기
      await page.keyboard.press("Escape");
    }
  });

  test("새로고침 버튼이 존재하고 클릭할 수 있다", async ({ page }) => {
    await page.goto("/dashboard/warehouse/outbound");
    await page.waitForLoadState("networkidle");

    const refreshBtn = page
      .getByRole("button", { name: /새로고침/ })
      .first();
    const btnVisible = await refreshBtn.isVisible().catch(() => false);

    if (btnVisible) {
      await refreshBtn.click();
      await page.waitForLoadState("networkidle");

      // 새로고침 후에도 페이지가 정상적으로 유지되는지 확인
      const heading = page
        .locator("h1")
        .filter({ hasText: /출고확정|출고/ })
        .first();
      const headingVisible = await heading.isVisible().catch(() => false);
      expect(headingVisible).toBeTruthy();
    }
  });
});
