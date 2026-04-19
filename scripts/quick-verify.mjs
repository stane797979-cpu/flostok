import { chromium } from 'playwright';
import fs from 'fs';

const pages = [
  { id: '4-1', url: '/dashboard/inventory', name: '재고현황-통계카드' },
  { id: '5-1', url: '/dashboard/kpi', name: 'KPI현황-초기화면' },
  { id: '6-1', url: '/dashboard/stockout', name: '결품관리-목록' },
  { id: '7-1', url: '/dashboard/movement', name: '수불관리-초기화면' },
];

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n🔐 로그인 페이지를 엽니다...');
  await page.goto('http://localhost:3000/login');
  console.log('⏸️  수동으로 로그인해주세요 (30초 대기)...\n');
  await page.waitForTimeout(30000);

  const results = [];

  for (const testPage of pages) {
    console.log(`\n📍 Phase ${testPage.id}: ${testPage.name}`);
    const fullUrl = `http://localhost:3000${testPage.url}`;

    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      const filename = `phase-${testPage.id}-${testPage.name}.png`;
      await page.screenshot({
        path: `test-results/manual/${filename}`,
        fullPage: true,
      });

      console.log(`   ✅ 스크린샷 저장: ${filename}`);
      results.push({ phase: testPage.id, name: testPage.name, status: 'OK' });

    } catch (err) {
      console.log(`   ❌ 에러: ${err.message}`);
      results.push({ phase: testPage.id, name: testPage.name, status: 'FAIL', error: err.message });
    }

    await page.waitForTimeout(2000);
  }

  console.log('\n\n📊 검증 결과:');
  console.log('='.repeat(60));
  results.forEach(r => {
    const status = r.status === 'OK' ? '✅' : '❌';
    console.log(`${status} Phase ${r.phase}: ${r.name} - ${r.status}`);
    if (r.error) console.log(`   ${r.error}`);
  });

  await browser.close();
})();
