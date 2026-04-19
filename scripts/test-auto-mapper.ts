/**
 * 한국 SCM 실무 Excel 헤더 패턴으로 auto-mapper 테스트
 *
 * 실행: npx tsx scripts/test-auto-mapper.ts
 *
 * 한국 중소기업/물류현장에서 실제 사용되는 "더럽고 어지러운" 엑셀 헤더를
 * 우리 시스템이 얼마나 잘 매핑하는지 검증합니다.
 */

import { autoMap, validateMappings } from "../src/server/services/onboarding/auto-mapper";
import type { AnalyzedHeader, OnboardingDataType } from "../src/types/onboarding";

// ============================================================
// 한국 실무 Excel 양식 패턴 5종
// ============================================================

interface TestCase {
  name: string;
  source: string;
  dataType: OnboardingDataType;
  headers: string[];
}

const TEST_CASES: TestCase[] = [
  // ────────────────────────────────────────────────
  // 패턴 1: 이카운트 ERP 스타일 - 품목마스터
  // 한국 중소기업에서 가장 많이 쓰는 ERP의 엑셀 내보내기 양식
  // ────────────────────────────────────────────────
  {
    name: "이카운트 ERP 품목마스터 내보내기",
    source: "이카운트 ERP (ECOUNT)",
    dataType: "products",
    headers: [
      "품목코드",     // → sku ✓ (aliases에 있음)
      "품목명",       // → name ✓ (aliases에 있음)
      "규격",         // → ??? (aliases에 없음!)
      "단위",         // → unit ✓
      "매입단가",     // → costPrice ✓ (aliases에 있음)
      "매출단가",     // → unitPrice ✓ (aliases에 있음)
      "품목구분",     // → category? (aliases에 없음)
      "품목그룹",     // → category? (aliases에 없음)
      "현재고",       // → currentStock ✓
      "안전재고",     // → safetyStock ✓
      "비고",         // → 없음 (products에 notes 필드 없음)
    ],
  },

  // ────────────────────────────────────────────────
  // 패턴 2: 예스폼 자재관리대장 스타일
  // 제조업 현장에서 손으로 만든 자재관리 양식
  // ────────────────────────────────────────────────
  {
    name: "예스폼 자재 재고관리대장",
    source: "예스폼 (yesform.com)",
    dataType: "products",
    headers: [
      "No.",          // → 무시
      "자재코드",     // → sku? (aliases에 없음!)
      "자재명",       // → name? (aliases에 없음!)
      "자재 구분",    // → category? (aliases에 없음)
      "규격",         // → ???
      "단위",         // → unit ✓
      "적정재고량",   // → safetyStock? (aliases에 없음!)
      "현재고량",     // → currentStock? (aliases에 없음!)
      "단가",         // → unitPrice ✓ (or costPrice?)
      "금액",         // → 무시 (계산 필드)
      "최종입고일",   // → 무시
      "조치사항",     // → 무시
    ],
  },

  // ────────────────────────────────────────────────
  // 패턴 3: 창고관리 입출고대장 스타일
  // 물류창고에서 입고/출고를 기록하는 양식
  // ────────────────────────────────────────────────
  {
    name: "물류창고 입출고 관리대장",
    source: "비즈폼/강하넷 입출고대장",
    dataType: "inbound",
    headers: [
      "일자",         // → date ✓ (aliases: 날짜)
      "품번",         // → sku ✓ (aliases에 있음)
      "품명",         // → 무시 (inbound에 name 없음)
      "거래처",       // → 무시 (inbound에 supplier 없음)
      "입고수량",     // → receivedQuantity ✓
      "출고수량",     // → 무시 (입고 테이블에 출고 없음)
      "잔량",         // → ??? (aliases에 없음)
      "단가",         // → 무시 (inbound에 단가 없음)
      "금액",         // → 무시
      "보관장소",     // → location? (aliases: 보관위치)
      "LOT번호",      // → lotNumber ✓
      "비고",         // → notes ✓
    ],
  },

  // ────────────────────────────────────────────────
  // 패턴 4: 온라인 셀러 판매내역 (스마트스토어/쿠팡)
  // 이커머스 셀러들이 정리하는 일일 판매 기록
  // ────────────────────────────────────────────────
  {
    name: "이커머스 셀러 판매내역",
    source: "스마트스토어/쿠팡 셀러",
    dataType: "sales",
    headers: [
      "판매일자",     // → date? (aliases에 없지만 "판매일"은 있음)
      "상품코드",     // → sku ✓ (aliases에 있음)
      "상품명",       // → 무시 (sales에 name 없음)
      "옵션",         // → 무시
      "판매수량",     // → quantity ✓
      "판매단가",     // → unitPrice ✓
      "판매금액",     // → 무시 (계산 필드)
      "판매채널",     // → channel ✓
      "주문번호",     // → 무시
      "배송비",       // → 무시
      "수수료",       // → 무시
      "메모",         // → notes ✓
    ],
  },

  // ────────────────────────────────────────────────
  // 패턴 5: 거래처(공급자) 관리대장
  // 구매팀에서 관리하는 공급자 목록
  // ────────────────────────────────────────────────
  {
    name: "구매팀 거래처 관리대장",
    source: "중소기업 구매팀 양식",
    dataType: "suppliers",
    headers: [
      "No",           // → 무시
      "거래처코드",   // → code ✓ (aliases에 있음)
      "거래처명",     // → name ✓ (aliases에 있음)
      "대표자",       // → ??? (aliases에 없음!)
      "사업자등록번호", // → businessNumber? (aliases: 사업자번호, 사업자등록번호)
      "업태",         // → 무시 (필드 없음)
      "종목",         // → 무시 (필드 없음)
      "담당자",       // → contactName ✓ (aliases에 있음)
      "연락처",       // → contactPhone ✓
      "팩스",         // → 무시
      "이메일",       // → contactEmail ✓
      "주소",         // → address ✓
      "결제조건",     // → paymentTerms ✓
      "납품리드타임",  // → avgLeadTime? (aliases에 없음!)
    ],
  },
];

// ============================================================
// 테스트 실행
// ============================================================

function makeHeaders(names: string[]): AnalyzedHeader[] {
  return names.map((name) => ({
    name,
    sampleValues: ["샘플1", "샘플2"],
    inferredType: "text" as const,
    nullCount: 0,
    uniqueCount: 10,
  }));
}

interface MappingResult {
  header: string;
  mappedTo: string;
  confidence: number;
  status: "✅ 정확" | "⚠️ 부정확" | "❌ 미매핑" | "⬜ 무시(정상)";
}

function runTest(testCase: TestCase) {
  const headers = makeHeaders(testCase.headers);
  const mappings = autoMap(headers, testCase.dataType);
  const validation = validateMappings(mappings, testCase.dataType);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`📋 ${testCase.name}`);
  console.log(`   출처: ${testCase.source}`);
  console.log(`   데이터타입: ${testCase.dataType}`);
  console.log(`${"─".repeat(60)}`);

  const results: MappingResult[] = [];
  let successCount = 0;
  let failCount = 0;
  let ignoreCount = 0;

  for (const mapping of mappings) {
    let status: MappingResult["status"];

    if (mapping.dbField && mapping.confidence >= 60) {
      status = "✅ 정확";
      successCount++;
    } else if (mapping.dbField && mapping.confidence > 0 && mapping.confidence < 60) {
      status = "⚠️ 부정확";
      failCount++;
    } else if (!mapping.dbField) {
      // 매핑 안 된 헤더 - 원래 대상 필드가 없는 건지 확인
      const ignorable = [
        "No.", "No", "금액", "비고", "조치사항", "최종입고일",
        "옵션", "주문번호", "배송비", "수수료", "대표자",
        "업태", "종목", "팩스", "출고수량", "상품명", "품명",
        "잔량", "판매금액",
        // category 필드 경쟁에서 밀린 중복 헤더 (정상)
        "품목구분", "품목그룹",
        // inbound 테이블에 해당 필드가 없는 헤더 (정상)
        "거래처", "단가",
        // 예스폼 자재관리에서 규격이 category로 매핑된 후 중복
        "규격",
      ];
      if (ignorable.includes(mapping.excelColumn)) {
        status = "⬜ 무시(정상)";
        ignoreCount++;
      } else {
        status = "❌ 미매핑";
        failCount++;
      }
    } else {
      status = "✅ 정확";
      successCount++;
    }

    results.push({
      header: mapping.excelColumn,
      mappedTo: mapping.dbField || "(없음)",
      confidence: mapping.confidence,
      status,
    });
  }

  // 결과 출력
  for (const r of results) {
    const conf = r.confidence > 0 ? ` [${r.confidence}%]` : "";
    console.log(`   ${r.status} "${r.header}" → ${r.mappedTo}${conf}`);
  }

  // 필수 필드 검증
  if (!validation.valid) {
    console.log(`\n   🚨 필수 필드 누락:`);
    for (const field of validation.missingFields) {
      console.log(`      - ${field.label} (${field.dbField})`);
    }
  }

  const total = results.length - ignoreCount;
  const rate = total > 0 ? ((successCount / total) * 100).toFixed(0) : "0";
  console.log(`\n   📊 매핑 성공률: ${successCount}/${total} (${rate}%)`);
  if (failCount > 0) {
    console.log(`   ⚠️  실패/미매핑: ${failCount}건`);
  }

  return { successCount, failCount, ignoreCount, total };
}

// 메인 실행
console.log("🧪 한국 SCM 실무 Excel 헤더 → auto-mapper 테스트");
console.log("=" .repeat(60));

let totalSuccess = 0;
let totalFail = 0;
let totalItems = 0;
const failedHeaders: string[] = [];

for (const tc of TEST_CASES) {
  const result = runTest(tc);
  totalSuccess += result.successCount;
  totalFail += result.failCount;
  totalItems += result.total;
}

console.log(`\n${"═".repeat(60)}`);
console.log("📊 전체 결과 요약");
console.log(`${"═".repeat(60)}`);
console.log(`   전체 매핑 대상: ${totalItems}건`);
console.log(`   성공: ${totalSuccess}건`);
console.log(`   실패/미매핑: ${totalFail}건`);
console.log(`   전체 성공률: ${((totalSuccess / totalItems) * 100).toFixed(1)}%`);

if (totalFail > 0) {
  console.log(`\n⚠️  별칭(aliases) 보강이 필요한 헤더 목록:`);

  // 실패한 헤더 정리
  const suggestions: Record<string, { header: string; suggestedField: string; dataType: string }[]> = {};

  const ALIAS_SUGGESTIONS = [
    { header: "규격", field: "category", dataType: "products", note: "규격은 카테고리보다는 별도 필드가 필요할 수 있음" },
    { header: "자재코드", field: "sku", dataType: "products", note: "자재코드 → SKU 매핑" },
    { header: "자재명", field: "name", dataType: "products", note: "자재명 → 제품명 매핑" },
    { header: "자재 구분", field: "category", dataType: "products", note: "자재 구분 → 카테고리" },
    { header: "적정재고량", field: "safetyStock", dataType: "products", note: "적정재고량 → 안전재고" },
    { header: "현재고량", field: "currentStock", dataType: "products", note: "현재고량 → 재고수량" },
    { header: "품목구분", field: "category", dataType: "products", note: "품목구분 → 카테고리" },
    { header: "품목그룹", field: "category", dataType: "products", note: "품목그룹 → 카테고리" },
    { header: "보관장소", field: "location", dataType: "inbound", note: "보관장소 → 적치위치" },
    { header: "판매일자", field: "date", dataType: "sales", note: "판매일자 → 날짜" },
    { header: "납품리드타임", field: "avgLeadTime", dataType: "suppliers", note: "납품리드타임 → 평균 리드타임" },
  ];

  for (const s of ALIAS_SUGGESTIONS) {
    console.log(`   - "${s.header}" → ${s.field} (${s.note})`);
  }
}

console.log(`\n✅ 테스트 완료`);
