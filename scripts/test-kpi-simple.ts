import { chromium, Browser, Page } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function takeScreenshot(page: Page, filename: string) {
  const path = join('c:', 'Claude_Project', 'test-results', 'screenshots', filename);
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 ${filename} 저장`);
  return path;
}

async function extractKPIValues(page: Page) {
  // 각 KPI 카드의 제목과 값 추출
  const cards = await page.locator('.card').all();
  const kpiData: Record<string, string> = {};

  for (const card of cards) {
    try {
      const titleEl = await card.locator('.text-sm.font-medium.text-slate-500').first();
      const valueEl = await card.locator('.text-2xl.font-bold').first();

      if (await titleEl.count() > 0 && await valueEl.count() > 0) {
        const title = await titleEl.textContent();
        const value = await valueEl.textContent();
        if (title && value) {
          kpiData[title.trim()] = value.trim();
        }
      }
    } catch (e) {
      // Skip
    }
  }

  return kpiData;
}

async function runTests() {
  console.log('🚀 KPI 페이지 실데이터 테스트 시작\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const report: any[] = [];

  try {
    // 로그인
    console.log('🔐 로그인...');
    await page.goto('http://localhost:3000/login');
    await page.waitForTimeout(2000);
    await page.fill('#email', 'admin1@stocklogis.com');
    await page.fill('#password', 'admin1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    console.log('✅ 로그인 완료\n');

    // 테스트 1: 전체 개요
    console.log('📊 테스트 1: KPI 현황 페이지');
    await page.goto('http://localhost:3000/dashboard/kpi');
    await page.waitForTimeout(2000);

    const kpiOverview = await extractKPIValues(page);
    await takeScreenshot(page, 'kpi-01-overview.png');

    console.log('  KPI 값:');
    Object.entries(kpiOverview).forEach(([key, value]) => {
      console.log(`    ${key}: ${value}`);
    });

    report.push({
      test: '테스트 1: 전체 개요',
      kpi: kpiOverview
    });

    // 테스트 2: 재고정확도 확인
    console.log('\n🔍 테스트 2: 재고정확도 고정값 확인');
    const accuracy = kpiOverview['재고 정확도'];
    console.log(`  재고 정확도: ${accuracy}`);

    if (accuracy === '95') {
      console.log('  ⚠️  이슈 확인: 재고정확도가 95%로 고정되어 있습니다.');
      report.push({
        test: '테스트 2: 재고정확도',
        issue: '95% 고정값',
        value: accuracy
      });
    }

    await takeScreenshot(page, 'kpi-02-accuracy-fixed.png');

    // 테스트 3: ABC 필터 - A등급
    console.log('\n🔤 테스트 3: ABC 필터');
    console.log('  A등급 선택...');

    // ABC 필터 찾기 (첫 번째 DropdownMenu)
    const abcTrigger = page.locator('button:has-text("전체 ABC")').first();
    await abcTrigger.click();
    await page.waitForTimeout(500);

    const aGradeOption = page.locator('[role="menuitem"]:has-text("A등급")').first();
    await aGradeOption.click();
    await page.waitForTimeout(2000);

    const kpiA = await extractKPIValues(page);
    await takeScreenshot(page, 'kpi-03-abc-a-filter.png');

    console.log('  A등급 필터 적용 후:');
    Object.entries(kpiA).forEach(([key, value]) => {
      const before = kpiOverview[key];
      if (before !== value) {
        console.log(`    ${key}: ${before} → ${value}`);
      }
    });

    report.push({
      test: '테스트 3: ABC 필터 - A등급',
      kpi: kpiA
    });

    // B등급
    console.log('\n  B등급 선택...');
    await abcTrigger.click();
    await page.waitForTimeout(500);

    const bGradeOption = page.locator('[role="menuitem"]:has-text("B등급")').first();
    await bGradeOption.click();
    await page.waitForTimeout(2000);

    const kpiB = await extractKPIValues(page);
    await takeScreenshot(page, 'kpi-04-abc-b-filter.png');

    console.log('  B등급 필터 적용 후:');
    Object.entries(kpiB).forEach(([key, value]) => {
      const before = kpiOverview[key];
      if (before !== value) {
        console.log(`    ${key}: ${before} → ${value}`);
      }
    });

    report.push({
      test: '테스트 3: ABC 필터 - B등급',
      kpi: kpiB
    });

    // 전체로 복원
    await abcTrigger.click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("전체")').first().click();
    await page.waitForTimeout(1500);

    // 테스트 4: XYZ 필터 - X등급
    console.log('\n📊 테스트 4: XYZ 필터');
    console.log('  X등급 선택...');

    const xyzTrigger = page.locator('button:has-text("전체 XYZ")').first();
    await xyzTrigger.click();
    await page.waitForTimeout(500);

    const xGradeOption = page.locator('[role="menuitem"]:has-text("X등급")').first();
    await xGradeOption.click();
    await page.waitForTimeout(2000);

    const kpiX = await extractKPIValues(page);
    await takeScreenshot(page, 'kpi-05-xyz-x-filter.png');

    console.log('  X등급 필터 적용 후:');
    Object.entries(kpiX).forEach(([key, value]) => {
      const before = kpiOverview[key];
      if (before !== value) {
        console.log(`    ${key}: ${before} → ${value}`);
      }
    });

    report.push({
      test: '테스트 4: XYZ 필터 - X등급',
      kpi: kpiX
    });

    // 전체로 복원
    await xyzTrigger.click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("전체")').nth(1).click();
    await page.waitForTimeout(1500);

    // 테스트 5: ABC + XYZ 조합
    console.log('\n🔀 테스트 5: ABC + XYZ 조합 (A + X)');

    // A등급 선택
    await abcTrigger.click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("A등급")').first().click();
    await page.waitForTimeout(1000);

    // X등급 선택
    await xyzTrigger.click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("X등급")').first().click();
    await page.waitForTimeout(2000);

    const kpiAX = await extractKPIValues(page);
    await takeScreenshot(page, 'kpi-06-ax-combo.png');

    // Badge 확인
    const badge = await page.locator('.badge').textContent();
    console.log(`  Badge: ${badge}`);

    console.log('  A + X 조합 필터 적용 후:');
    Object.entries(kpiAX).forEach(([key, value]) => {
      console.log(`    ${key}: ${value}`);
    });

    report.push({
      test: '테스트 5: ABC + XYZ 조합',
      badge: badge,
      kpi: kpiAX
    });

    // 전체로 복원
    await abcTrigger.click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("전체")').first().click();
    await page.waitForTimeout(500);

    await xyzTrigger.click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("전체")').nth(1).click();
    await page.waitForTimeout(1500);

    // 테스트 6: 월별 추이
    console.log('\n📈 테스트 6: 월별 추이 탭');
    await page.click('button:has-text("월별 추이")');
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'kpi-07-monthly-trend.png');
    console.log('  월별 추이 탭 스크린샷 저장');
    console.log('  ⚠️  품절률 트렌드가 수평선인지 육안 확인 필요');

    report.push({
      test: '테스트 6: 월별 추이',
      note: '품절률 트렌드 수평선 이슈 확인 필요'
    });

    // 테스트 7: 개선 제안
    console.log('\n💡 테스트 7: 개선 제안 탭');
    await page.click('button:has-text("개선 제안")');
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'kpi-08-improvement.png');
    console.log('  개선 제안 탭 스크린샷 저장');

    const suggestionCards = await page.locator('.card').count();
    console.log(`  개선 제안 카드: ${suggestionCards}개`);

    report.push({
      test: '테스트 7: 개선 제안',
      cards: suggestionCards
    });

    // 결과 저장
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ 모든 테스트 완료');

    const reportPath = join('c:', 'Claude_Project', 'test-results', 'kpi-test-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n📄 테스트 결과: ${reportPath}`);
    console.log('📸 스크린샷: test-results/screenshots/*.png');

  } catch (error: any) {
    console.error('\n❌ 오류:', error.message);
    await takeScreenshot(page, 'error.png');
  } finally {
    await browser.close();
  }
}

runTests();
