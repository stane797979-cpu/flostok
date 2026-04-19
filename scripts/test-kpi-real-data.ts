import { chromium, Browser, Page } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface KPIData {
  name: string;
  value: string;
  change: string;
}

interface TestResult {
  testName: string;
  timestamp: string;
  kpiData: KPIData[];
  notes: string[];
  screenshotPath: string;
}

const results: TestResult[] = [];

async function login(page: Page) {
  console.log('🔐 로그인 중...');
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'admin1@stocklogis.com');
  await page.fill('input[type="password"]', 'admin1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**');
  console.log('✅ 로그인 완료');
}

async function captureKPIData(page: Page): Promise<KPIData[]> {
  const kpiCards = await page.locator('[data-testid="kpi-card"], .kpi-card, .card').all();
  const data: KPIData[] = [];

  for (const card of kpiCards) {
    try {
      const name = await card.locator('h3, .card-title, p').first().textContent();
      const value = await card.locator('.text-2xl, .text-3xl, .font-bold').first().textContent();
      const change = await card.locator('.text-sm, .text-xs').filter({ hasText: /[↑↓%]/ }).first().textContent();

      if (name && value) {
        data.push({
          name: name.trim(),
          value: value.trim(),
          change: change?.trim() || 'N/A'
        });
      }
    } catch (e) {
      // Skip cards that don't match the pattern
    }
  }

  return data;
}

async function takeScreenshot(page: Page, filename: string) {
  const path = join('c:', 'Claude_Project', 'test-results', 'screenshots', filename);
  await page.screenshot({ path, fullPage: true });
  console.log(`📸 스크린샷 저장: ${filename}`);
  return path;
}

async function test1_Overview(page: Page) {
  console.log('\n📊 테스트 1: KPI 현황 페이지 전체 확인');
  await page.goto('http://localhost:3000/dashboard/kpi');
  await page.waitForTimeout(2000); // 데이터 로딩 대기

  const kpiData = await captureKPIData(page);
  const screenshotPath = await takeScreenshot(page, 'kpi-01-overview.png');

  console.log('\n7개 KPI 카드 데이터:');
  kpiData.forEach((kpi, idx) => {
    console.log(`  ${idx + 1}. ${kpi.name}: ${kpi.value} (${kpi.change})`);
  });

  results.push({
    testName: '테스트 1: KPI 현황 페이지',
    timestamp: new Date().toISOString(),
    kpiData,
    notes: [`총 ${kpiData.length}개 KPI 카드 발견`],
    screenshotPath
  });
}

async function test2_InventoryAccuracy(page: Page) {
  console.log('\n🔍 테스트 2: 재고정확도 95% 고정값 확인');

  const accuracyCard = await page.locator('text=재고정확도').locator('..').locator('..');
  const accuracyValue = await accuracyCard.locator('.text-2xl, .text-3xl, .font-bold').first().textContent();

  console.log(`재고정확도 값: ${accuracyValue}`);

  const screenshotPath = await takeScreenshot(page, 'kpi-02-accuracy-fixed.png');

  const notes = [];
  if (accuracyValue?.includes('95')) {
    notes.push('⚠️ 재고정확도가 95%로 고정되어 있음 (이슈 확인)');
  } else {
    notes.push('✅ 재고정확도가 동적으로 계산되고 있음');
  }

  results.push({
    testName: '테스트 2: 재고정확도 고정값',
    timestamp: new Date().toISOString(),
    kpiData: [{ name: '재고정확도', value: accuracyValue || 'N/A', change: '' }],
    notes,
    screenshotPath
  });
}

async function test3_ABCFilter(page: Page) {
  console.log('\n🔤 테스트 3: ABC 필터 테스트');

  // A등급 선택
  console.log('  A등급 선택...');
  await page.click('text=A등급');
  await page.waitForTimeout(1500);

  const kpiDataA = await captureKPIData(page);
  const screenshotA = await takeScreenshot(page, 'kpi-03-abc-a-filter.png');

  console.log('\n  A등급 필터 적용 후:');
  kpiDataA.forEach(kpi => console.log(`    ${kpi.name}: ${kpi.value}`));

  // B등급 선택
  console.log('\n  B등급 선택...');
  await page.click('text=B등급');
  await page.waitForTimeout(1500);

  const kpiDataB = await captureKPIData(page);
  const screenshotB = await takeScreenshot(page, 'kpi-04-abc-b-filter.png');

  console.log('\n  B등급 필터 적용 후:');
  kpiDataB.forEach(kpi => console.log(`    ${kpi.name}: ${kpi.value}`));

  results.push({
    testName: '테스트 3: ABC 필터 - A등급',
    timestamp: new Date().toISOString(),
    kpiData: kpiDataA,
    notes: ['ABC 필터: A등급 적용'],
    screenshotPath: screenshotA
  });

  results.push({
    testName: '테스트 3: ABC 필터 - B등급',
    timestamp: new Date().toISOString(),
    kpiData: kpiDataB,
    notes: ['ABC 필터: B등급 적용'],
    screenshotPath: screenshotB
  });

  // 전체로 복원
  await page.click('text=전체');
  await page.waitForTimeout(1000);
}

async function test4_XYZFilter(page: Page) {
  console.log('\n📊 테스트 4: XYZ 필터 테스트');

  // X등급 선택
  console.log('  X등급 선택...');
  const xyzButton = await page.locator('button:has-text("X등급")').first();
  await xyzButton.click();
  await page.waitForTimeout(1500);

  const kpiDataX = await captureKPIData(page);
  const screenshotX = await takeScreenshot(page, 'kpi-05-xyz-x-filter.png');

  console.log('\n  X등급 필터 적용 후:');
  kpiDataX.forEach(kpi => console.log(`    ${kpi.name}: ${kpi.value}`));

  results.push({
    testName: '테스트 4: XYZ 필터 - X등급',
    timestamp: new Date().toISOString(),
    kpiData: kpiDataX,
    notes: ['XYZ 필터: X등급 적용'],
    screenshotPath: screenshotX
  });

  // 전체로 복원
  const allButton = await page.locator('button:has-text("전체")').first();
  await allButton.click();
  await page.waitForTimeout(1000);
}

async function test5_ComboFilter(page: Page) {
  console.log('\n🔀 테스트 5: ABC+XYZ 조합 테스트');

  // A등급 선택
  await page.locator('button:has-text("A등급")').first().click();
  await page.waitForTimeout(500);

  // X등급 선택
  await page.locator('button:has-text("X등급")').first().click();
  await page.waitForTimeout(1500);

  const kpiDataCombo = await captureKPIData(page);
  const screenshotCombo = await takeScreenshot(page, 'kpi-06-ax-combo.png');

  console.log('\n  A등급 + X등급 조합 필터 적용 후:');
  kpiDataCombo.forEach(kpi => console.log(`    ${kpi.name}: ${kpi.value}`));

  // Badge 확인
  const badges = await page.locator('.badge, [class*="badge"]').allTextContents();
  console.log('\n  Badge 텍스트:', badges);

  results.push({
    testName: '테스트 5: ABC+XYZ 조합 (A+X)',
    timestamp: new Date().toISOString(),
    kpiData: kpiDataCombo,
    notes: [`Badge 표시: ${badges.join(', ')}`],
    screenshotPath: screenshotCombo
  });

  // 전체로 복원
  await page.locator('button:has-text("전체")').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("전체")').nth(1).click();
  await page.waitForTimeout(1000);
}

async function test6_MonthlyTrend(page: Page) {
  console.log('\n📈 테스트 6: 월별 추이 탭 (품절률 트렌드 이슈)');

  // 월별 추이 탭 클릭
  await page.click('text=월별 추이');
  await page.waitForTimeout(2000);

  const screenshotTrend = await takeScreenshot(page, 'kpi-07-monthly-trend.png');

  // 차트 데이터 확인
  const chartElements = await page.locator('svg, canvas, [class*="recharts"]').count();
  console.log(`  차트 요소 개수: ${chartElements}`);

  results.push({
    testName: '테스트 6: 월별 추이 탭',
    timestamp: new Date().toISOString(),
    kpiData: [],
    notes: [
      `차트 요소 ${chartElements}개 발견`,
      '품절률 트렌드가 수평선인지 육안 확인 필요'
    ],
    screenshotPath: screenshotTrend
  });
}

async function test7_Improvement(page: Page) {
  console.log('\n💡 테스트 7: 개선 제안 탭');

  // 개선 제안 탭 클릭
  await page.click('text=개선 제안');
  await page.waitForTimeout(2000);

  const screenshotImprovement = await takeScreenshot(page, 'kpi-08-improvement.png');

  // 개선 제안 카드 개수 확인
  const suggestionCards = await page.locator('.card').count();
  console.log(`  개선 제안 카드 개수: ${suggestionCards}`);

  results.push({
    testName: '테스트 7: 개선 제안 탭',
    timestamp: new Date().toISOString(),
    kpiData: [],
    notes: [`개선 제안 카드 ${suggestionCards}개 발견`],
    screenshotPath: screenshotImprovement
  });
}

async function runAllTests() {
  console.log('🚀 KPI 페이지 실데이터 테스트 시작\n');
  console.log('═══════════════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    await login(page);
    await test1_Overview(page);
    await test2_InventoryAccuracy(page);
    await test3_ABCFilter(page);
    await test4_XYZFilter(page);
    await test5_ComboFilter(page);
    await test6_MonthlyTrend(page);
    await test7_Improvement(page);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ 모든 테스트 완료\n');

    // 결과 저장
    const reportPath = join('c:', 'Claude_Project', 'test-results', 'kpi-test-report.json');
    writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`📄 테스트 결과 저장: ${reportPath}`);

    // 요약 출력
    console.log('\n📊 테스트 결과 요약:');
    results.forEach((result, idx) => {
      console.log(`\n${idx + 1}. ${result.testName}`);
      result.notes.forEach(note => console.log(`   ${note}`));
      console.log(`   스크린샷: ${result.screenshotPath}`);
    });

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  } finally {
    await browser.close();
  }
}

runAllTests();
