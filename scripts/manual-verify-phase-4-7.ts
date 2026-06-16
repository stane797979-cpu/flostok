import { chromium } from 'playwright';

/**
 * Phase 4-7 수동 검증 스크립트
 *
 * 사용법:
 * 1. 먼저 브라우저에서 http://localhost:3000/login 에 로그인
 * 2. 이 스크립트를 실행하여 각 페이지 스크린샷 촬영
 */

async function verifyPhases() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📋 Phase 4-7 검증을 시작합니다...\n');
  console.log('⚠️  먼저 브라우저에서 로그인을 완료해주세요.\n');

  const pages = [
    // Phase 4: 재고 현황
    {
      phase: '4-1',
      name: '재고 현황 - 통계 카드',
      url: 'http://localhost:3000/dashboard/inventory',
      checks: ['재고 상태 통계 카드 (7단계)', '품절/위험/부족/주의/적정/과다/과잉'],
    },
    {
      phase: '4-2',
      name: '재고 현황 - 검색',
      url: 'http://localhost:3000/dashboard/inventory',
      checks: ['검색 입력란', 'SKU/제품명 필터링'],
    },

    // Phase 5: KPI 현황
    {
      phase: '5-1',
      name: 'KPI 현황 - 초기',
      url: 'http://localhost:3000/dashboard/kpi',
      checks: ['7개 KPI 카드', '트렌드 차트'],
    },
    {
      phase: '5-2',
      name: 'KPI 현황 - ABC 필터',
      url: 'http://localhost:3000/dashboard/kpi',
      checks: ['ABC 필터 드롭다운', 'A등급 선택 시 KPI 변경'],
    },
    {
      phase: '5-6',
      name: 'KPI 현황 - 월별 추이',
      url: 'http://localhost:3000/dashboard/kpi',
      checks: ['월별 추이 탭', '월별 스냅샷 테이블'],
    },
    {
      phase: '5-7',
      name: 'KPI 현황 - 개선 제안',
      url: 'http://localhost:3000/dashboard/kpi',
      checks: ['개선 제안 탭', '목표 대비 개선 카드'],
    },

    // Phase 6: 결품관리
    {
      phase: '6-1',
      name: '결품관리 - 목록',
      url: 'http://localhost:3000/dashboard/stockout',
      checks: ['결품 제품 목록', '제품별 원인 표시'],
    },

    // Phase 7: 수불관리
    {
      phase: '7-1',
      name: '수불관리 - 초기',
      url: 'http://localhost:3000/dashboard/movement',
      checks: ['기간 선택 UI', '수불 내역 테이블', '엑셀 다운로드 버튼'],
    },
  ];

  for (const testPage of pages) {
    console.log(`\n🔍 Phase ${testPage.phase}: ${testPage.name}`);
    console.log(`   URL: ${testPage.url}`);
    console.log(`   검증 항목:`);
    testPage.checks.forEach(check => console.log(`   - ${check}`));

    await page.goto(testPage.url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const filename = `phase-${testPage.phase}-${testPage.name.replace(/\s+/g, '-')}.png`;
    await page.screenshot({
      path: `test-results/manual/${filename}`,
      fullPage: true,
    });

    console.log(`   ✅ 스크린샷 저장: test-results/manual/${filename}`);
    console.log(`   ⏸️  페이지를 확인하세요 (5초 대기)...`);
    await page.waitForTimeout(5000);
  }

  console.log('\n\n✅ 모든 페이지 검증 완료!');
  console.log('📁 스크린샷 위치: test-results/manual/\n');

  await browser.close();
}

verifyPhases().catch(console.error);
