import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { join } from 'path';

test.describe('PSI 및 발주 스코어링 실데이터 검증', () => {
  test.beforeAll(async () => {
    // 스크린샷 디렉토리 생성
    await mkdir(join(process.cwd(), 'test-results', 'screenshots'), { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin1@stocklogis.com');
    await page.fill('input[type="password"]', 'admin1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('테스트 1: PSI 페이지 전체 확인', async ({ page }) => {
    // PSI 페이지로 이동
    await page.goto('/dashboard/psi');
    await page.waitForLoadState('networkidle');

    // 스크린샷 1: 전체 개요
    await page.screenshot({
      path: 'test-results/screenshots/psi-01-overview.png',
      fullPage: true
    });

    // 첫 번째 제품의 PSI 데이터 확인
    const firstProduct = await page.locator('table tbody tr').first();
    await expect(firstProduct).toBeVisible();

    // PSI 테이블의 각 행 데이터 추출
    const rows = await page.locator('table tbody tr').all();
    console.log('총 제품 수:', rows.length);

    if (rows.length > 0) {
      // 첫 번째 제품 클릭하여 상세 보기 (있을 경우)
      const firstCell = await firstProduct.locator('td').first();
      const productName = await firstCell.textContent();
      console.log('첫 번째 제품:', productName);

      // 테이블 헤더와 값들을 읽어서 기록
      const headers = await page.locator('table thead th').allTextContents();
      const firstRowCells = await firstProduct.locator('td').allTextContents();

      console.log('\nPSI 테이블 구조:');
      headers.forEach((header, idx) => {
        console.log(`${header}: ${firstRowCells[idx] || 'N/A'}`);
      });
    }
  });

  test('테스트 2: PSI 필터 테스트', async ({ page }) => {
    await page.goto('/dashboard/psi');
    await page.waitForLoadState('networkidle');

    // ABC 등급 필터 확인
    const abcFilter = page.locator('select, [role="combobox"]').filter({ hasText: /ABC|등급/ }).first();
    if (await abcFilter.isVisible()) {
      await abcFilter.click();

      // A등급 선택 (옵션이 있을 경우)
      const aOption = page.locator('[role="option"]').filter({ hasText: 'A' }).first();
      if (await aOption.isVisible()) {
        await aOption.click();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'test-results/screenshots/psi-02-abc-a-filter.png',
          fullPage: true
        });
      }
    }

    // 카테고리 필터 확인
    const categoryFilter = page.locator('select, [role="combobox"]').filter({ hasText: /카테고리/ }).first();
    if (await categoryFilter.isVisible()) {
      await page.screenshot({
        path: 'test-results/screenshots/psi-03-category-filter.png',
        fullPage: true
      });
    }

    // 검색 기능 테스트
    const searchInput = page.locator('input[type="search"], input[placeholder*="검색"]').first();
    if (await searchInput.isVisible()) {
      // 첫 번째 제품의 SKU를 가져와서 검색
      const firstSKU = await page.locator('table tbody tr td').first().textContent();
      if (firstSKU) {
        await searchInput.fill(firstSKU.slice(0, 5)); // 일부만 입력
        await page.waitForTimeout(500);

        await page.screenshot({
          path: 'test-results/screenshots/psi-04-search.png',
          fullPage: true
        });
      }
    }
  });

  test('테스트 3: PSI SCM 가이드 확인', async ({ page }) => {
    await page.goto('/dashboard/psi');
    await page.waitForLoadState('networkidle');

    // "SCM 가이드" 행 찾기
    const scmGuideRow = page.locator('tr').filter({ hasText: /SCM|가이드|발주제안/ });

    if (await scmGuideRow.count() > 0) {
      console.log('SCM 가이드 행 발견');

      // 가이드 값들 추출
      const guideCells = await scmGuideRow.first().locator('td').allTextContents();
      console.log('SCM 가이드 값들:', guideCells);

      await page.screenshot({
        path: 'test-results/screenshots/psi-05-scm-guide.png',
        fullPage: true
      });
    } else {
      console.log('SCM 가이드 행을 찾을 수 없습니다.');
    }
  });

  test('테스트 4: 발주필요 페이지 (발주 스코어링)', async ({ page }) => {
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');

    // 발주필요 탭 클릭
    const needTab = page.locator('button, [role="tab"]').filter({ hasText: /발주필요|발주 필요/ }).first();
    if (await needTab.isVisible()) {
      await needTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/screenshots/orders-01-need.png',
      fullPage: true
    });

    // 발주필요 품목 확인
    const needItems = await page.locator('table tbody tr').all();
    console.log('발주필요 품목 수:', needItems.length);

    if (needItems.length > 0) {
      // 첫 번째 품목의 데이터 확인
      const headers = await page.locator('table thead th').allTextContents();
      const firstRowCells = await needItems[0].locator('td').allTextContents();

      console.log('\n발주필요 품목 데이터:');
      headers.forEach((header, idx) => {
        console.log(`${header}: ${firstRowCells[idx] || 'N/A'}`);
      });

      // 우선순위 스코어 확인
      const scoreColumn = headers.findIndex(h => h.includes('우선순위') || h.includes('스코어'));
      if (scoreColumn >= 0) {
        console.log('우선순위 스코어:', firstRowCells[scoreColumn]);
      }

      // ABC 등급 확인
      const abcColumn = headers.findIndex(h => h.includes('ABC'));
      if (abcColumn >= 0) {
        console.log('ABC 등급:', firstRowCells[abcColumn]);
      }
    } else {
      console.log('현재 발주필요 품목이 없습니다. 재고 상태가 적정합니다.');
    }
  });

  test('테스트 5: 발주현황 페이지', async ({ page }) => {
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');

    // 발주현황 탭 클릭
    const statusTab = page.locator('button, [role="tab"]').filter({ hasText: /발주현황|발주 현황/ }).first();
    if (await statusTab.isVisible()) {
      await statusTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/screenshots/orders-02-status.png',
      fullPage: true
    });

    // 발주서 목록 확인
    const poRows = await page.locator('table tbody tr').all();
    console.log('발주서 건수:', poRows.length);

    if (poRows.length > 0) {
      // 발주서 상태별 분포 확인
      const statuses = await page.locator('table tbody tr td').filter({ hasText: /대기|승인|진행|완료|취소/ }).allTextContents();
      console.log('발주서 상태 분포:', statuses);

      // 첫 번째 발주서 클릭하여 상세 보기
      await poRows[0].click();
      await page.waitForTimeout(1000);

      // 상세 다이얼로그 스크린샷
      const dialog = page.locator('[role="dialog"], .dialog');
      if (await dialog.isVisible()) {
        await page.screenshot({
          path: 'test-results/screenshots/orders-03-detail.png',
          fullPage: true
        });
      }
    }
  });

  test('테스트 6: 입고현황 페이지', async ({ page }) => {
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');

    // 입고현황 탭 클릭
    const inboundTab = page.locator('button, [role="tab"]').filter({ hasText: /입고현황|입고 현황/ }).first();
    if (await inboundTab.isVisible()) {
      await inboundTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: 'test-results/screenshots/orders-04-inbound.png',
      fullPage: true
    });

    // 입고 기록 확인
    const inboundRows = await page.locator('table tbody tr').all();
    console.log('입고 기록 건수:', inboundRows.length);

    if (inboundRows.length > 0) {
      const headers = await page.locator('table thead th').allTextContents();
      const firstRowCells = await inboundRows[0].locator('td').allTextContents();

      console.log('\n최근 입고 기록:');
      headers.forEach((header, idx) => {
        console.log(`${header}: ${firstRowCells[idx] || 'N/A'}`);
      });
    }
  });

  test('테스트 7: 입항스케줄 탭', async ({ page }) => {
    await page.goto('/dashboard/orders');
    await page.waitForLoadState('networkidle');

    // 입항스케줄 탭 클릭
    const shipmentTab = page.locator('button, [role="tab"]').filter({ hasText: /입항|스케줄/ }).first();
    if (await shipmentTab.isVisible()) {
      await shipmentTab.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'test-results/screenshots/orders-05-shipment.png',
        fullPage: true
      });

      // 입항 스케줄 데이터 확인
      const shipmentRows = await page.locator('table tbody tr').all();
      console.log('입항 스케줄 건수:', shipmentRows.length);
    } else {
      console.log('입항스케줄 탭을 찾을 수 없습니다.');
    }
  });
});
