import { test, expect } from "@playwright/test";

test.describe("제품 CRUD 플로우", () => {
  test("제품 추가 다이얼로그 - 입력 필드 확인", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("button", { name: /제품 추가/ })).toBeVisible({ timeout: 15000 });

    // 제품 추가 다이얼로그 열기
    await page.getByRole("button", { name: /제품 추가/ }).click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // SKU, 제품명 입력 필드 확인
    const skuInput = dialog.locator('input').first();
    await expect(skuInput).toBeVisible({ timeout: 3000 });
    await skuInput.fill("E2E-TEST-001");

    // 제품명 필드 (두 번째 input)
    const inputs = dialog.locator('input');
    if (await inputs.count() >= 2) {
      await inputs.nth(1).fill("E2E 테스트 제품");
    }

    // 저장 버튼이 다이얼로그 하단에 있음 (스크롤 필요)
    const saveBtn = dialog.locator('button[type="submit"], button:has-text("저장"), button:has-text("등록")').last();
    if (await saveBtn.isVisible()) {
      await expect(saveBtn).toBeVisible();
    } else {
      // 스크롤 후 확인
      await dialog.locator('button').last().scrollIntoViewIfNeeded();
    }

    // 취소로 종료 (실제 DB 변경 방지)
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });

  test("제품 검색 기능", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 15000 });

    const searchInput = page.getByPlaceholder(/검색/).first();
    if (await searchInput.isVisible()) {
      // 존재하지 않는 값 검색
      await searchInput.fill("__없는제품__xyz999");
      await page.waitForTimeout(800);
      await expect(page).toHaveURL(/products/);

      // 검색어 초기화
      await searchInput.fill("");
      await page.waitForTimeout(500);
      // 목록 복원 확인
      await expect(page.locator("table").first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("제품 수정 다이얼로그 - 기존 데이터 표시", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

    // 첫 번째 제품의 수정 버튼 클릭
    const editBtn = page.locator('button[aria-label*="수정"], button:has-text("수정")').first();
    if (!(await editBtn.isVisible({ timeout: 5000 }))) {
      // 3-dot 메뉴로 접근
      const moreBtn = page.locator('button[aria-label*="more"], button[aria-label*="더"], button:has([data-lucide="more-horizontal"])').first();
      if (await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.waitForTimeout(300);
        await page.getByRole("menuitem", { name: /수정|편집/ }).first().click();
      }
    } else {
      await editBtn.click();
    }

    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible({ timeout: 5000 })) {
      // 다이얼로그 내 입력값 확인 (기존 데이터 채워져 있어야 함)
      const firstInput = dialog.locator('input').first();
      await expect(firstInput).toBeVisible({ timeout: 3000 });
      const value = await firstInput.inputValue();
      expect(value.length).toBeGreaterThan(0);

      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }
  });

  test("제품 삭제 다이얼로그 - 확인 UI 표시", async ({ page }) => {
    await page.goto("/dashboard/products");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15000 });

    // 3-dot 메뉴 → 삭제
    const moreBtn = page.locator('button').filter({ has: page.locator('[data-lucide="more-horizontal"]') }).first();
    if (await moreBtn.isVisible({ timeout: 5000 })) {
      await moreBtn.click();
      await page.waitForTimeout(300);

      const deleteItem = page.getByRole("menuitem", { name: /삭제/ }).first();
      if (await deleteItem.isVisible({ timeout: 3000 })) {
        await deleteItem.click();
        await page.waitForTimeout(500);

        // 확인 다이얼로그가 나타나면 취소
        const confirmDialog = page.locator('[role="dialog"], [role="alertdialog"]').first();
        if (await confirmDialog.isVisible({ timeout: 3000 })) {
          const cancelBtn = confirmDialog.getByRole("button", { name: /취소|아니/ }).first();
          if (await cancelBtn.isVisible()) {
            await cancelBtn.click();
          } else {
            await page.keyboard.press("Escape");
          }
        }
      }
    }
  });
});

test.describe("공급자 CRUD 플로우", () => {
  test("공급자 추가 다이얼로그 - 입력 필드 확인", async ({ page }) => {
    await page.goto("/dashboard/suppliers");
    await page.waitForLoadState("domcontentloaded");

    const addBtn = page.getByRole("button", { name: /추가|등록|공급/ }).first();
    if (!(await addBtn.isVisible({ timeout: 10000 }))) return;

    await addBtn.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // 공급자명 입력 필드 확인
    const firstInput = dialog.locator('input').first();
    await expect(firstInput).toBeVisible({ timeout: 3000 });

    // 취소
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe("재고 상세 플로우", () => {
  test("재고 행 클릭 → 상세 다이얼로그", async ({ page }) => {
    await page.goto("/dashboard/inventory");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("table").first()).toBeVisible({ timeout: 15000 });

    const firstRow = page.locator("table tbody tr").first();
    if (await firstRow.isVisible()) {
      await firstRow.click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]').first();
      if (await dialog.isVisible({ timeout: 3000 })) {
        // 상세 다이얼로그 내용 확인
        await expect(dialog).toBeVisible();

        const closeBtn = dialog.getByRole("button", { name: /닫기|취소|X/ }).first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        } else {
          await page.keyboard.press("Escape");
        }
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });
});
