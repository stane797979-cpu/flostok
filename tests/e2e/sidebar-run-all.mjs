/**
 * sidebar-run-all.mjs
 *
 * Stock & Logis - 전체 사이드바 기능 종합 테스트 오케스트레이터
 * B(구매/입고) → C(출고) → D(재고) → E(관리) → A(계획) → F(도구) 순차 실행
 *
 * 실행: node tests/e2e/sidebar-run-all.mjs
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GROUPS = [
  { id: 'B', name: '구매(입고)', file: 'sidebar-group-b-purchasing.mjs', tests: 18 },
  { id: 'C', name: '출고',       file: 'sidebar-group-c-outbound.mjs',   tests: 12 },
  { id: 'D', name: '재고',       file: 'sidebar-group-d-inventory.mjs',  tests: 10 },
  { id: 'E', name: '관리',       file: 'sidebar-group-e-management.mjs', tests: 21 },
  { id: 'A', name: '계획',       file: 'sidebar-group-a-planning.mjs',   tests: 13 },
  { id: 'F', name: '도구',       file: 'sidebar-group-f-tools.mjs',      tests: 10 },
];

const results = [];
let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

console.log('='.repeat(70));
console.log('  Stock & Logis - 사이드바별 전체 기능 종합 테스트');
console.log('  실행 순서: B(구매/입고) → C(출고) → D(재고) → E(관리) → A(계획) → F(도구)');
console.log('  시작 시각:', new Date().toLocaleString('ko-KR'));
console.log('='.repeat(70));
console.log('');

for (const group of GROUPS) {
  const filePath = resolve(__dirname, group.file);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  [Group ${group.id}] ${group.name} (${group.tests}개 예상)`);
  console.log(`  파일: ${group.file}`);
  console.log(`${'─'.repeat(60)}`);

  const startTime = Date.now();
  let exitCode = 0;
  let output = '';

  try {
    output = execSync(`node "${filePath}"`, {
      encoding: 'utf-8',
      timeout: 300000, // 5분
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: resolve(__dirname, '../../'),
    });
    console.log(output);
  } catch (err) {
    exitCode = err.status || 1;
    output = (err.stdout || '') + '\n' + (err.stderr || '');
    console.log(output);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // 결과 파싱: 다양한 요약 포맷 지원
  let passed = 0;
  let failed = 0;

  // 포맷1: "PASS: 13개 | FAIL: 0개" 또는 "PASS 12개 | FAIL 0개"
  const fmt1 = output.match(/PASS[:\s]*(\d+)\s*개.*?FAIL[:\s]*(\d+)\s*개/);
  // 포맷2: "통과: 13개" + "실패: 0개"
  const fmt2p = output.match(/통과[:\s]*(\d+)\s*개/);
  const fmt2f = output.match(/실패[:\s]*(\d+)\s*개/);
  // 포맷3: "10개 통과 / 0개 실패"
  const fmt3 = output.match(/(\d+)\s*개\s*통과\s*[/|]\s*(\d+)\s*개\s*실패/);

  if (fmt1) {
    passed = parseInt(fmt1[1]) || 0;
    failed = parseInt(fmt1[2]) || 0;
  } else if (fmt3) {
    passed = parseInt(fmt3[1]) || 0;
    failed = parseInt(fmt3[2]) || 0;
  } else if (fmt2p) {
    passed = parseInt(fmt2p[1]) || 0;
    failed = fmt2f ? (parseInt(fmt2f[1]) || 0) : 0;
  } else {
    // fallback: "✅ " 라인 수 카운트 (각 테스트 결과 라인)
    const passLines = (output.match(/^\s*✅/gm) || []).length;
    const failLines = (output.match(/^\s*❌/gm) || []).length;
    passed = passLines;
    failed = failLines;
  }

  totalPassed += passed;
  totalFailed += failed;
  totalTests += passed + failed;

  results.push({
    group: group.id,
    name: group.name,
    passed,
    failed,
    total: passed + failed,
    elapsed,
    exitCode,
  });

  console.log('');
  console.log(`  => Group ${group.id} 완료: ${passed} PASS / ${failed} FAIL (${elapsed}s)`);
  console.log('');
}

// 최종 리포트
console.log('');
console.log('='.repeat(70));
console.log('  최종 종합 리포트');
console.log('='.repeat(70));
console.log('');
console.log('  Group | 섹션       | PASS | FAIL | 합계 | 소요시간 | 상태');
console.log('  ------+------------+------+------+------+----------+------');

for (const r of results) {
  const status = r.failed === 0 ? 'OK' : 'ISSUES';
  console.log(
    `  ${r.group.padEnd(6)}| ${r.name.padEnd(10)} | ${String(r.passed).padStart(4)} | ${String(r.failed).padStart(4)} | ${String(r.total).padStart(4)} | ${r.elapsed.padStart(7)}s | ${status}`
  );
}

console.log('  ------+------------+------+------+------+----------+------');
console.log(
  `  합계  |            | ${String(totalPassed).padStart(4)} | ${String(totalFailed).padStart(4)} | ${String(totalTests).padStart(4)} |          |`
);
console.log('');
console.log(`  성공률: ${totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0}%`);
console.log(`  종료 시각: ${new Date().toLocaleString('ko-KR')}`);
console.log('');

if (totalFailed > 0) {
  console.log(`  *** ${totalFailed}개 테스트 실패 — 상세 로그를 확인하세요 ***`);
  process.exit(1);
} else {
  console.log('  *** 전체 테스트 통과! ***');
  process.exit(0);
}
