import { test, expect } from '@playwright/test';

// 인증된 상태(storageState)를 사용 — playwright.config.ts의 chromium 프로젝트 기본값 적용

// 테스트 전용 데이터 식별자
const TEST_PREFIX = `[E2E-TEST-${Date.now()}]`;

test.describe.serial('Phase 2: 마스터 데이터 관리', () => {
  // ─────────────────────────────────────────────
  // B-6: 제품 등록
  // ─────────────────────────────────────────────
  test('B-6: 제품 등록 페이지에서 신규 제품 생성', async ({ page }) => {
    await page.goto('/dashboard/products');
    await page.waitForLoadState('networkidle');

    // 제품 관리 헤더 확인
    await expect(page.getByText('제품 관리')).toBeVisible();

    // 제품 추가 버튼 클릭
    const addButton = page.getByRole('button', { name: /제품 추가/ });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // 다이얼로그 열림 대기
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();

    // SKU 입력 (테스트 전용 식별자 포함)
    const testSku = `E2E-SKU-${Date.now()}`;
    const skuInput = dialog.getByLabel(/SKU/i);
    await expect(skuInput).toBeVisible();
    await skuInput.fill(testSku);

    // 제품명 입력
    const testProductName = `${TEST_PREFIX} 테스트 제품`;
    const nameInput = dialog.getByLabel(/제품명/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill(testProductName);

    // 단위 선택 (기본값 EA 유지)
    // 단가 입력 (선택적 필드)
    const unitPriceInput = dialog.getByLabel(/단가/i);
    if (await unitPriceInput.isVisible()) {
      await unitPriceInput.fill('10000');
    }

    // 저장 버튼 클릭
    const saveButton = dialog.getByRole('button', { name: /저장|등록|추가/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // 다이얼로그 닫힘 또는 성공 토스트 확인
    await page.waitForTimeout(2000);

    // 다이얼로그가 닫혔거나 성공 메시지가 표시됨
    const dialogClosed = await page.locator('[role="dialog"]').count() === 0;
    const successToast = page.getByText(/추가 완료|등록 완료|성공/i);
    const hasSuccessToast = await successToast.count() > 0;

    expect(dialogClosed || hasSuccessToast).toBeTruthy();
  });

  // ─────────────────────────────────────────────
  // B-10: 제품 검색
  // ─────────────────────────────────────────────
  test('B-10: 제품 목록에서 키워드 검색', async ({ page }) => {
    await page.goto('/dashboard/products');
    await page.waitForLoadState('networkidle');

    // 제품 관리 페이지 확인
    await expect(page.getByText('제품 관리')).toBeVisible();

    // 검색 입력창 확인
    const searchInput = page.getByPlaceholder(/검색|search/i);
    await expect(searchInput).toBeVisible();

    // 검색어 입력 (실제 존재 가능한 일반 키워드)
    await searchInput.fill('제품');

    // 디바운스 대기 후 결과 확인
    await page.waitForTimeout(800);

    // 테이블 또는 빈 상태 메시지가 표시되는지 확인
    const table = page.locator('table').first();
    const emptyMessage = page.getByText(/검색 결과가 없습니다|데이터가 없습니다|없습니다/i);

    const hasTable = await table.isVisible();
    const hasEmptyMsg = await emptyMessage.count() > 0;

    expect(hasTable || hasEmptyMsg).toBeTruthy();

    // 검색어 지우기 — 전체 목록 복원
    await searchInput.clear();
    await page.waitForTimeout(500);

    // 테이블이 다시 렌더링되었는지 확인
    await expect(table).toBeVisible();
  });

  // ─────────────────────────────────────────────
  // B-11: 공급자 등록
  // ─────────────────────────────────────────────
  test('B-11: 공급자 등록 다이얼로그에서 신규 공급자 생성', async ({ page }) => {
    await page.goto('/dashboard/suppliers');
    await page.waitForLoadState('networkidle');

    // 공급자 관리 페이지 확인
    const pageHeader = page.getByText(/공급자|공급업체/i).first();
    await expect(pageHeader).toBeVisible();

    // 공급자 추가 버튼 클릭
    const addButton = page.getByRole('button', { name: /공급자 추가|추가/i }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    // 다이얼로그 열림 대기
    await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 });
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();

    // 공급자명 입력 (필수 필드)
    const testSupplierName = `${TEST_PREFIX} 테스트 공급자`;
    const nameInput = dialog.getByLabel(/공급자명|회사명|이름/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill(testSupplierName);

    // 공급자 코드 입력 (필수 필드)
    const codeInput = dialog.getByLabel(/코드/i);
    if (await codeInput.isVisible()) {
      await codeInput.fill(`E2E-SUP-${Date.now()}`);
    }

    // 담당자 이메일 입력 (선택적)
    const emailInput = dialog.getByLabel(/이메일/i);
    if (await emailInput.isVisible()) {
      await emailInput.fill('e2e-supplier@test.com');
    }

    // 저장 버튼 클릭
    const saveButton = dialog.getByRole('button', { name: /저장|등록|추가/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // 등록 완료 또는 요청 제출 확인
    await page.waitForTimeout(2000);

    const dialogClosed = await page.locator('[role="dialog"]').count() === 0;
    const successToast = page.getByText(/추가 완료|등록 완료|요청 제출|성공/i);
    const hasSuccessToast = await successToast.count() > 0;

    expect(dialogClosed || hasSuccessToast).toBeTruthy();
  });

  // ─────────────────────────────────────────────
  // B-14: 창고 목록 조회
  // ─────────────────────────────────────────────
  test('B-14: 창고 관리 페이지에서 창고 목록 조회', async ({ page }) => {
    await page.goto('/dashboard/warehouses');
    await page.waitForLoadState('networkidle');

    // 창고 관리 헤더 확인
    await expect(page.getByText('창고 관리')).toBeVisible();

    // 페이지 설명 텍스트 확인
    await expect(
      page.getByText(/창고 추가|재고 이동/i)
    ).toBeVisible();

    // 창고 목록 테이블 또는 빈 상태 확인
    const table = page.locator('table').first();
    const emptyMessage = page.getByText(/창고가 없습니다|데이터가 없습니다|등록된 창고/i);
    const addWarehouseButton = page.getByRole('button', { name: /창고 추가/i });

    const hasTable = await table.isVisible();
    const hasEmptyMsg = await emptyMessage.count() > 0;
    const hasAddButton = await addWarehouseButton.isVisible();

    // 테이블이 있거나, 빈 상태 메시지가 있거나, 추가 버튼이 있어야 함
    expect(hasTable || hasEmptyMsg || hasAddButton).toBeTruthy();

    // 창고 추가 버튼 존재 확인
    await expect(addWarehouseButton).toBeVisible();

    // 창고가 있는 경우 테이블 컬럼 헤더 확인
    if (hasTable) {
      // 창고 코드, 창고명 컬럼 중 하나 이상 확인
      const hasCodeHeader = await page.getByText(/창고 코드|코드/i).count() > 0;
      const hasNameHeader = await page.getByText(/창고명|이름/i).count() > 0;
      expect(hasCodeHeader || hasNameHeader).toBeTruthy();
    }
  });
});
