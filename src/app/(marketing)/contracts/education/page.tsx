import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "교육/강의 위탁 계약서 | Stock & Logis",
  description: "Stock & Logis 교육 및 강의 위탁 계약서 참고 양식",
};

export default function EducationContractPage() {
  return (
    <div className="bg-white px-6 py-16 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* 안내 문구 */}
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm leading-7 text-amber-900">
            <strong>안내:</strong> 본 계약서는 참고용 초안이며, 실제 계약 체결
            전 반드시 법률 전문가의 검수가 필요합니다.
          </p>
        </div>

        {/* 제목 */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            교육/강의 위탁 계약서
          </h1>
        </div>

        {/* 계약 당사자 */}
        <section className="mb-12 rounded-xl border border-gray-200 bg-gray-50 p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                갑 (교육 의뢰 기업)
              </h2>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <span className="font-semibold">회사명:</span>{" "}
                  <span className="border-b border-gray-400 pb-1">
                    ____________________
                  </span>
                </div>
                <div>
                  <span className="font-semibold">대표자:</span>{" "}
                  <span className="border-b border-gray-400 pb-1">
                    ____________________
                  </span>
                </div>
                <div>
                  <span className="font-semibold">사업자등록번호:</span>{" "}
                  <span className="border-b border-gray-400 pb-1">
                    ____________________
                  </span>
                </div>
                <div>
                  <span className="font-semibold">주소:</span>{" "}
                  <span className="border-b border-gray-400 pb-1">
                    ____________________
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                을 (교육 제공 기업)
              </h2>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <span className="font-semibold">회사명:</span> Stock & Logis
                </div>
                <div>
                  <span className="font-semibold">대표자:</span> 이동욱
                </div>
                <div>
                  <span className="font-semibold">이메일:</span>{" "}
                  logisglobalceo@gmail.com
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 계약 조항 */}
        <div className="space-y-10">
          {/* 제1조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제1조 (목적)
            </h3>
            <p className="text-gray-600 leading-7">
              본 계약은 갑이 을에게 갑의 임직원을 대상으로 한 SCM(Supply Chain
              Management) 전문 교육 및 강의 업무를 위탁하고, 을이 이를
              수행함에 있어 필요한 제반 사항을 정함을 목적으로 합니다.
            </p>
          </article>

          {/* 제2조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제2조 (교육 내용)
            </h3>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">
                  교육 프로그램명:
                </span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ____________________________________
                </span>
              </div>
              <div>
                <p className="mb-2 font-semibold text-gray-700">
                  커리큘럼 구성:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-gray-600">
                  <li>수요예측 (Demand Forecasting)</li>
                  <li>공급계획 (Supply Planning)</li>
                  <li>입출고 관리 (Inbound/Outbound Management)</li>
                  <li>재고관리 (Inventory Management)</li>
                  <li className="text-sm italic text-gray-500">
                    ※ 상기 4단계 중 선택 가능
                  </li>
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">교육 방식:</span>
                <span className="text-gray-600">
                  대면 / 온라인 / 혼합 (택 1)
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">
                  총 교육 시간:
                </span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ________________ 시간
                </span>
              </div>
            </div>
          </article>

          {/* 제3조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제3조 (교육 기간 및 일정)
            </h3>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">
                  교육 시작일:
                </span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ____________________________________
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">
                  교육 종료일:
                </span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ____________________________________
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">
                  세부 시간표:
                </span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ____________________________________
                </span>
              </div>
              <p className="text-sm text-gray-500">
                ※ 구체적인 교육 일정은 별도 합의를 통해 조정할 수 있습니다.
              </p>
            </div>
          </article>

          {/* 제4조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제4조 (수강 대상)
            </h3>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">수강 인원:</span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ________________ 명
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">
                  대상 직급/부서:
                </span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ____________________________________
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">선수 조건:</span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ____________________________________
                </span>
              </div>
              <p className="text-sm text-gray-500">
                ※ 선수 조건이 없는 경우 &apos;없음&apos;으로 표기합니다.
              </p>
            </div>
          </article>

          {/* 제5조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제5조 (교육비 및 지급 조건)
            </h3>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">총 교육비:</span>
                <span className="border-b border-gray-400 pb-1 text-gray-600">
                  ________________________ 원 (부가세 별도)
                </span>
              </div>
              <div>
                <p className="mb-2 font-semibold text-gray-700">지급 방식:</p>
                <ul className="ml-6 list-disc space-y-1 text-gray-600">
                  <li>교육 시작 전 100% 선불, 또는</li>
                  <li>교육 시작 전 50% + 교육 완료 후 50%</li>
                </ul>
              </div>
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <span className="font-semibold text-gray-700">교재비:</span>
                <span className="text-gray-600">교육비에 포함 / 별도 (택 1)</span>
              </div>
              <p className="text-gray-600">
                을은 교육비 수령 후 세금계산서를 발행합니다.
              </p>
            </div>
          </article>

          {/* 제6조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제6조 (강사)
            </h3>
            <ul className="ml-6 list-decimal space-y-3 text-gray-600">
              <li>
                지정 강사는 이동욱 대표 또는 을이 지정하는 SCM 전문 강사로
                합니다.
              </li>
              <li>
                을은 강사를 변경할 경우 갑에게 사전 동의를 받아야 합니다.
              </li>
              <li>
                부득이한 사유로 강사를 변경할 경우, 을은 동일 수준 이상의
                강사를 배정해야 합니다.
              </li>
            </ul>
          </article>

          {/* 제7조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제7조 (교재 및 자료)
            </h3>
            <ul className="ml-6 list-decimal space-y-3 text-gray-600">
              <li>을은 교육에 필요한 교재 및 실습 자료를 제공합니다.</li>
              <li>교재 및 자료의 저작권은 을에게 귀속됩니다.</li>
              <li>
                갑 및 수강생은 교육 목적 내에서만 교재를 사용할 수 있으며,
                제3자에게 복제, 배포, 공유하는 행위를 금지합니다.
              </li>
            </ul>
          </article>

          {/* 제8조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제8조 (수료 기준)
            </h3>
            <ul className="ml-6 list-decimal space-y-3 text-gray-600">
              <li>수료 인정 기준: 총 교육 시간의 80% 이상 출석</li>
              <li>을은 수료 기준을 충족한 수강생에게 수료증을 발급합니다.</li>
              <li>수료증의 유효기간은 발급일로부터 2년입니다.</li>
            </ul>
          </article>

          {/* 제9조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제9조 (취소 및 환불)
            </h3>
            <div className="space-y-4">
              <div>
                <p className="mb-2 font-semibold text-gray-700">
                  갑의 사유로 취소 시:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-gray-600">
                  <li>교육 시작 7일 전 취소: 전액 환불</li>
                  <li>교육 시작 3일 전 취소: 50% 환불</li>
                  <li>교육 시작 당일 및 이후 취소: 환불 불가</li>
                </ul>
              </div>
              <div>
                <p className="mb-2 font-semibold text-gray-700">
                  을의 사유로 취소 시:
                </p>
                <ul className="ml-6 list-disc space-y-2 text-gray-600">
                  <li>전액 환불</li>
                  <li>갑과 협의하여 대체 교육 일정을 제시할 수 있습니다.</li>
                </ul>
              </div>
            </div>
          </article>

          {/* 제10조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제10조 (비밀유지)
            </h3>
            <ul className="ml-6 list-decimal space-y-3 text-gray-600">
              <li>
                갑과 을은 교육 과정에서 알게 된 상대방의 기밀정보를 제3자에게
                누설하거나 본 계약 목적 외로 사용할 수 없습니다.
              </li>
              <li>
                비밀유지 의무는 계약 종료 후 2년간 유지됩니다.
              </li>
            </ul>
          </article>

          {/* 제11조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제11조 (지적재산권)
            </h3>
            <ul className="ml-6 list-decimal space-y-3 text-gray-600">
              <li>
                교재, 자료, 교육 콘텐츠 등 을이 제공하는 모든 자료의 저작권 및
                지적재산권은 을에게 귀속됩니다.
              </li>
              <li>
                갑은 을로부터 교육 수강 목적 범위 내에서만 자료 사용 허가를
                받은 것으로 간주됩니다.
              </li>
            </ul>
          </article>

          {/* 제12조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제12조 (계약 해지)
            </h3>
            <ul className="ml-6 list-decimal space-y-3 text-gray-600">
              <li>
                갑과 을은 상호 합의에 의해 본 계약을 해지할 수 있습니다.
              </li>
              <li>
                일방이 본 계약을 중대하게 위반하고 상대방의 시정 요구에도
                불구하고 14일 이내에 시정하지 않을 경우, 상대방은 계약을 해지할
                수 있습니다.
              </li>
              <li>
                계약 해지 시, 이미 지급된 교육비는 제9조(취소 및 환불) 규정에
                따라 정산합니다.
              </li>
            </ul>
          </article>

          {/* 제13조 */}
          <article>
            <h3 className="mb-4 text-xl font-bold text-gray-900">
              제13조 (분쟁 해결)
            </h3>
            <ul className="ml-6 list-decimal space-y-3 text-gray-600">
              <li>
                본 계약과 관련하여 분쟁이 발생할 경우, 갑과 을은 상호 협의를
                통해 우선 해결하도록 노력합니다.
              </li>
              <li>
                협의가 이루어지지 않을 경우, 서울중앙지방법원을 제1심 관할
                법원으로 합니다.
              </li>
            </ul>
          </article>
        </div>

        {/* 서명란 */}
        <section className="mt-16 space-y-8 border-t-2 border-gray-900 pt-12">
          <p className="text-center text-lg font-semibold text-gray-900">
            본 계약의 체결을 증명하기 위하여 계약서 2통을 작성하고, 갑과 을이
            각각 서명 날인한 후 1통씩 보관합니다.
          </p>

          <div className="grid gap-8 sm:grid-cols-2">
            {/* 갑 서명란 */}
            <div className="rounded-xl border-2 border-gray-300 bg-gray-50 p-8">
              <h3 className="mb-6 text-center text-lg font-bold text-gray-900">
                갑 (교육 의뢰 기업)
              </h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">계약일:</span>
                  <span>20___년 ___월 ___일</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">회사명:</span>
                  <span>____________________</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">대표자:</span>
                  <span>____________________</span>
                </div>
                <div className="mt-12 text-center">
                  <div className="mx-auto h-20 w-32 border border-gray-300 bg-white" />
                  <p className="mt-2 text-xs text-gray-500">(서명 또는 날인)</p>
                </div>
              </div>
            </div>

            {/* 을 서명란 */}
            <div className="rounded-xl border-2 border-gray-300 bg-gray-50 p-8">
              <h3 className="mb-6 text-center text-lg font-bold text-gray-900">
                을 (교육 제공 기업)
              </h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">계약일:</span>
                  <span>20___년 ___월 ___일</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">회사명:</span>
                  <span>Stock & Logis</span>
                </div>
                <div className="flex justify-between border-b border-gray-300 pb-2">
                  <span className="font-semibold">대표자:</span>
                  <span>이동욱</span>
                </div>
                <div className="mt-12 text-center">
                  <div className="mx-auto h-20 w-32 border border-gray-300 bg-white" />
                  <p className="mt-2 text-xs text-gray-500">(서명 또는 날인)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 인쇄 안내 */}
        <div className="mt-12 rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
          <p className="text-sm text-blue-900">
            본 페이지는 인쇄 최적화되어 있습니다. 브라우저의 인쇄 기능(Ctrl+P
            또는 Cmd+P)을 사용하여 출력할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
