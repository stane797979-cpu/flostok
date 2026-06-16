#!/usr/bin/env node
/**
 * Phase 4-7 페이지 캡처 스크립트
 *
 * 사전 조건: http://localhost:3000 에서 로그인된 브라우저 세션 필요
 * 실행 방법: node scripts/capture-pages.mjs
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

const pages = [
  // Phase 4: 재고 현황
  {
    phase: '4-1',
    title: '재고 현황 - 재고 상태 통계 카드',
    url: '/dashboard/inventory',
    checks: [
      '7단계 재고 상태 카드 (품절/위험/부족/주의/적정/과다/과잉)',
      '각 상태별 제품 개수 표시',
      '제품 목록 테이블',
    ],
  },
  {
    phase: '4-2',
    title: '재고 현황 - 검색 기능',
    url: '/dashboard/inventory',
    action: async (page) => {
      const searchInput = await page.locator('input[type="search"], input[placeholder*="검색"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('TEST');
        await page.waitForTimeout(500);
      }
    },
    checks: [
      '검색 입력란 존재',
      '검색어 입력 시 실시간 필터링',
    ],
  },

  // Phase 5: KPI 현황
  {
    phase: '5-1',
    title: 'KPI 현황 - 초기 화면',
    url: '/dashboard/kpi',
    checks: [
      '7개 KPI 카드 (재고회전율, 평균재고일수, 결품률 등)',
      '트렌드 차트 표시',
      'ABC/XYZ 필터',
    ],
  },
  {
    phase: '5-6',
    title: 'KPI 현황 - 월별 추이 탭',
    url: '/dashboard/kpi',
    action: async (page) => {
      const monthlyTab = await page.getByRole('tab', { name: /월별/ });
      if (await monthlyTab.isVisible()) {
        await monthlyTab.click();
        await page.waitForTimeout(1000);
      }
    },
    checks: [
      '월별 추이 탭 전환',
      '월별 스냅샷 테이블',
    ],
  },

  // Phase 6: 결품관리
  {
    phase: '6-1',
    title: '결품관리 - 결품 목록',
    url: '/dashboard/stockout',
    checks: [
      '결품 제품 목록',
      '결품 원인 표시 (발주지연/수요급증/공급지연 등)',
      '결품 기간',
    ],
  },

  // Phase 7: 수불관리
  {
    phase: '7-1',
    title: '수불관리 - 기간 선택 UI',
    url: '/dashboard/movement',
    checks: [
      '기간 선택 UI (시작일/종료일)',
      '수불 내역 테이블',
      '엑셀 다운로드 버튼',
    ],
  },
];

async function capturePages() {
  console.log('🚀 Phase 4-7 페이지 캡처를 시작합니다...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // 로그인 확인
  console.log('🔐 로그인 상태 확인 중...');
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState('networkidle');

  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    console.log('\n❌ 로그인이 필요합니다.');
    console.log('   브라우저에서 로그인 후 다시 실행해주세요.\n');
    await page.waitForTimeout(30000); // 로그인 대기
  } else {
    console.log('✅ 로그인 확인됨\n');
  }

  const results = [];

  for (const testPage of pages) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📍 Phase ${testPage.phase}: ${testPage.title}`);
    console.log(`   URL: ${BASE_URL}${testPage.url}`);
    console.log(`   검증 항목:`);
    testPage.checks.forEach((check) => console.log(`   - ${check}`));

    try {
      // 페이지 이동
      await page.goto(`${BASE_URL}${testPage.url}`, {
        waitUntil: 'networkidle',
        timeout: 20000,
      });

      // 추가 로딩 대기
      await page.waitForTimeout(2000);

      // 커스텀 액션 실행
      if (testPage.action) {
        await testPage.action(page);
      }

      // 스크린샷 촬영
      const filename = `phase-${testPage.phase.replace(/\./g, '-')}.png`;
      const filepath = `test-results/manual/${filename}`;

      await page.screenshot({
        path: filepath,
        fullPage: true,
      });

      console.log(`\n   ✅ 스크린샷 저장: ${filepath}`);

      // 페이지 제목 확인
      const title = await page.title();
      console.log(`   📄 페이지 제목: ${title}`);

      // 현재 URL 확인
      console.log(`   🔗 현재 URL: ${page.url()}`);

      results.push({
        phase: testPage.phase,
        title: testPage.title,
        status: 'PASS',
        screenshot: filepath,
      });

    } catch (error) {
      console.log(`\n   ❌ FAIL: ${error.message}`);
      results.push({
        phase: testPage.phase,
        title: testPage.title,
        status: 'FAIL',
        error: error.message,
      });
    }

    // 다음 페이지로 이동 전 잠시 대기
    await page.waitForTimeout(1000);
  }

  // 결과 요약
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 검증 결과 요약');
  console.log('='.repeat(70));

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} Phase ${result.phase}: ${result.title} — ${result.status}`);
    if (result.status === 'FAIL' && result.error) {
      console.log(`   └─ ${result.error}`);
    } else if (result.screenshot) {
      console.log(`   └─ ${result.screenshot}`);
    }
  });

  console.log(`\n합계: ${passCount} PASS / ${failCount} FAIL`);
  console.log(`\n📁 스크린샷 위치: test-results/manual/\n`);

  // 브라우저 닫지 않고 유지 (수동 확인용)
  console.log('⏸️  브라우저를 열어둡니다. 수동으로 확인 후 종료하세요.');
  await page.waitForTimeout(5000);

  await browser.close();
}

capturePages().catch((error) => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
