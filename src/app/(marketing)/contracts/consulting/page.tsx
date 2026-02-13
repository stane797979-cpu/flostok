import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SCM 컨설팅 용역 계약서 | Stock & Logis",
  description: "Stock & Logis SCM 컨설팅 용역 계약서 참고 템플릿",
};

export default function ConsultingContractPage() {
  return (
    <div className="bg-white px-6 py-12 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* 안내 메시지 */}
        <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>안내:</strong> 본 계약서는 참고용 초안이며, 실제 계약 체결 전 법률 전문가의 검수가 필요합니다.
          </p>
        </div>

        {/* 제목 */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            SCM 컨설팅 용역 계약서
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Supply Chain Management Consulting Service Agreement
          </p>
        </div>

        {/* 계약 당사자 */}
        <section className="mb-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">갑 (고객사)</p>
              <div className="mt-2 space-y-1">
                <p className="text-gray-900">회사명: __________________</p>
                <p className="text-gray-900">대표자: __________________</p>
                <p className="text-gray-900">주소: ____________________</p>
                <p className="text-gray-900">사업자등록번호: __________</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">을 (공급사)</p>
              <div className="mt-2 space-y-1">
                <p className="text-gray-900">회사명: Stock & Logis</p>
                <p className="text-gray-900">대표자: 이동욱</p>
                <p className="text-gray-900">주소: (등기상 주소)</p>
                <p className="text-gray-900">이메일: logisglobalceo@gmail.com</p>
              </div>
            </div>
          </div>
        </section>

        {/* 전문 */}
        <div className="mb-8">
          <p className="leading-7 text-gray-700">
            갑과 을은 상호 신뢰와 협력을 바탕으로 갑의 공급망관리(SCM) 체계 진단 및 개선을 위한 컨설팅 용역 수행에 관하여 다음과 같이 계약을 체결한다.
          </p>
        </div>

        {/* 조항들 */}
        <div className="space-y-8">
          {/* 제1조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제1조 (목적)
            </h3>
            <p className="leading-7 text-gray-700">
              본 계약은 갑의 SCM(공급망관리) 체계 진단 및 개선을 위한 컨설팅 용역을 을이 수행함에 있어 필요한 제반 사항을 정함을 목적으로 한다.
            </p>
          </article>

          {/* 제2조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제2조 (용역의 범위)
            </h3>
            <p className="mb-3 leading-7 text-gray-700">
              본 계약에 따른 컨설팅 용역의 범위는 별첨 과업내용서(Statement of Work, SOW)에 따른다. 주요 범위는 다음과 같다.
            </p>
            <ul className="ml-6 space-y-2 text-gray-700">
              <li className="list-disc">SCM 프로세스 현황 진단 및 분석</li>
              <li className="list-disc">재고관리 체계 분석 및 최적화 방안 제시</li>
              <li className="list-disc">수요예측 모델 설계 및 정확도 개선</li>
              <li className="list-disc">발주 프로세스 최적화 및 자동화 방안</li>
              <li className="list-disc">주요 KPI 설계 및 모니터링 체계 구축</li>
              <li className="list-disc">S&OP(Sales & Operations Planning) 체계 구축 지원</li>
              <li className="list-disc">SCM 시스템 도입 및 구축 지원</li>
            </ul>
          </article>

          {/* 제3조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제3조 (계약 기간)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 본 계약의 용역 수행 기간은 다음과 같다.
              </p>
              <div className="ml-6 space-y-1 text-gray-700">
                <p>착수일: ________년 ____월 ____일</p>
                <p>완료일: ________년 ____월 ____일</p>
              </div>
              <p className="text-gray-700">
                ② 불가피한 사유로 기간 연장이 필요한 경우, 양 당사자의 서면 합의를 통해 변경할 수 있다.
              </p>
            </div>
          </article>

          {/* 제4조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제4조 (용역 대금 및 지급 조건)
            </h3>
            <div className="space-y-3">
              <p className="text-gray-700">
                ① 본 계약의 총 용역 대금은 다음과 같다.
              </p>
              <div className="ml-6 rounded-md bg-gray-50 p-4">
                <p className="font-semibold text-gray-900">
                  총 대금: ________________원 (부가세 별도)
                </p>
              </div>
              <p className="text-gray-700">
                ② 용역 대금은 다음과 같이 분할 지급한다.
              </p>
              <ul className="ml-6 space-y-2 text-gray-700">
                <li className="list-disc">
                  <strong>착수금 50%:</strong> 계약 체결 후 7영업일 이내
                </li>
                <li className="list-disc">
                  <strong>잔금 50%:</strong> 최종 산출물 검수 완료 후 10영업일 이내
                </li>
              </ul>
              <p className="text-gray-700">
                ③ 을은 각 단계별 대금 청구 시 세금계산서를 발행하며, 갑은 세금계산서 수령 후 명시된 기간 내에 지급한다.
              </p>
            </div>
          </article>

          {/* 제5조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제5조 (변경 관리)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 용역 범위의 변경이 필요한 경우, 양 당사자는 서면 합의를 통해 변경할 수 있다.
              </p>
              <p className="text-gray-700">
                ② 범위 변경으로 인해 추가 비용이 발생하는 경우, 별도 비용을 산정하여 계약 금액을 조정한다.
              </p>
              <p className="text-gray-700">
                ③ 일정 변경이 필요한 경우, 양사 협의를 통해 조정한다.
              </p>
            </div>
          </article>

          {/* 제6조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제6조 (산출물 및 검수)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 을은 별첨 과업내용서에 명시된 산출물을 갑에게 제공한다.
              </p>
              <p className="text-gray-700">
                ② 갑은 산출물 수령 후 10영업일 이내에 검수를 완료하고 그 결과를 을에게 통보한다.
              </p>
              <p className="text-gray-700">
                ③ 검수 결과 수정이 필요한 경우, 을은 2회 이내의 수정 작업을 무상으로 제공한다.
              </p>
              <p className="text-gray-700">
                ④ 검수 완료 시 갑은 검수 완료서에 서명하여 을에게 제공한다.
              </p>
              <p className="text-gray-700">
                ⑤ 컨설팅 산출물에 포함된 수요예측, 발주 추천 수량, 안전재고, 재고 최적화 방안 등의 수치 정보는
                <strong> 의사결정 참고 자료(가이드)</strong>로 제공되는 것이며, 확정적 지시나 보증이 아니다.
                산출물에 포함된 수치의 정확성, 완전성, 적시성에 대해 을은 명시적·묵시적 보증을 하지 않는다.
              </p>
              <p className="text-gray-700">
                ⑥ 갑이 산출물에 포함된 수치를 실제 발주·생산·재고 운영에 반영하고자 하는 경우,
                반드시 <strong>수량의 현실적 적절성 및 적합성을 사전 검증</strong>한 후 최종 의사결정을 하여야 한다.
                검증 없이 산출물의 수치를 그대로 적용하여 발생하는 과잉 발주, 재고 부족, 결품, 과잉 재고 등의
                직접적·간접적 손해에 대한 책임은 전적으로 갑에게 있다.
              </p>
            </div>
          </article>

          {/* 제7조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제7조 (지적재산권)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 본 계약 수행으로 인해 생성된 산출물의 저작권은 잔금 지급 완료 시점에 갑에게 귀속된다.
              </p>
              <p className="text-gray-700">
                ② 다만, 을이 보유한 기존의 방법론, 도구, 프레임워크 및 일반적인 전문지식에 대한 권리는 을에게 유보된다.
              </p>
              <p className="text-gray-700">
                ③ 갑이 보유한 기존 데이터, 자료 및 정보에 대한 권리는 갑에게 유보된다.
              </p>
            </div>
          </article>

          {/* 제8조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제8조 (비밀유지)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 양 당사자는 본 계약 수행 과정에서 취득한 상대방의 기밀정보를 계약 목적 외에 사용하거나 제3자에게 공개하지 않는다.
              </p>
              <p className="text-gray-700">
                ② 비밀유지 의무는 계약 종료 후 3년간 유지된다.
              </p>
              <p className="text-gray-700">
                ③ 다음 각 호의 정보는 기밀정보에서 제외된다.
              </p>
              <ul className="ml-6 space-y-1 text-gray-700">
                <li className="list-disc">공개적으로 이용 가능한 정보</li>
                <li className="list-disc">수령 전에 이미 보유하고 있던 정보</li>
                <li className="list-disc">제3자로부터 적법하게 취득한 정보</li>
                <li className="list-disc">법령에 의해 공개가 요구되는 정보 (사전 통지 필요)</li>
              </ul>
              <p className="text-gray-700">
                ④ 비밀유지 의무 위반 시 위반 당사자는 상대방에게 발생한 손해를 배상할 책임이 있다.
              </p>
            </div>
          </article>

          {/* 제9조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제9조 (갑의 협조 의무)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 갑은 을이 용역을 원활히 수행할 수 있도록 다음 사항을 협조한다.
              </p>
              <ul className="ml-6 space-y-2 text-gray-700">
                <li className="list-disc">컨설팅 수행에 필요한 데이터 및 자료의 적시 제공</li>
                <li className="list-disc">담당자 지정 및 의사결정을 위한 협조</li>
                <li className="list-disc">시스템 접근 권한 부여 (필요한 경우)</li>
                <li className="list-disc">현장 인터뷰 및 미팅 일정 협조</li>
              </ul>
              <p className="text-gray-700">
                ② 갑의 협조 지연으로 인한 일정 지연 책임은 갑에게 있으며, 이 경우 을은 일정 조정을 요청할 수 있다.
              </p>
            </div>
          </article>

          {/* 제10조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제10조 (하자 보증)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 을은 최종 산출물 인도 후 3개월간 무상 하자 보증 책임을 진다.
              </p>
              <p className="text-gray-700">
                ② 하자의 범위는 다음과 같다.
              </p>
              <ul className="ml-6 space-y-1 text-gray-700">
                <li className="list-disc">산출물 내용의 명백한 오류</li>
                <li className="list-disc">과업내용서 대비 누락된 항목</li>
                <li className="list-disc">논리적 일관성이 결여된 부분</li>
              </ul>
              <p className="text-gray-700">
                ③ 다만, 갑의 환경 변화 또는 갑의 요청에 의한 추가 수정은 별도 용역으로 진행한다.
              </p>
            </div>
          </article>

          {/* 제11조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제11조 (계약 해지)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 양 당사자는 서면 합의를 통해 본 계약을 해지할 수 있다.
              </p>
              <p className="text-gray-700">
                ② 상대방이 본 계약상의 중대한 의무를 위반하고 30일 이내에 시정하지 않은 경우, 상대방에게 서면 통보 후 계약을 해지할 수 있다.
              </p>
              <p className="text-gray-700">
                ③ 계약 해지 시, 해지 시점까지 완료된 단계에 대해서는 대금을 정산한다.
              </p>
              <p className="text-gray-700">
                ④ 갑의 사유로 계약을 해지하는 경우, 착수금은 반환하지 않으며 진행분에 대한 대금을 추가 정산한다.
              </p>
              <p className="text-gray-700">
                ⑤ 을의 사유로 계약을 해지하는 경우, 을은 미이행분에 대한 대금을 갑에게 반환한다.
              </p>
            </div>
          </article>

          {/* 제12조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제12조 (손해배상)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 일방 당사자의 귀책 사유로 상대방에게 손해가 발생한 경우, 손해를 발생시킨 당사자는 상대방의 직접 손해를 배상할 책임이 있다.
              </p>
              <p className="text-gray-700">
                ② 손해배상 한도는 본 계약의 총 계약 대금을 초과하지 않는다.
              </p>
              <p className="text-gray-700">
                ③ 간접 손해, 기대 이익의 상실, 영업 손실 등은 배상 범위에서 제외된다.
              </p>
            </div>
          </article>

          {/* 제13조 */}
          <article className="border-b border-gray-200 pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제13조 (불가항력)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 천재지변, 전쟁, 파업, 법령의 제정 또는 개정, 정부의 명령, 감염병 대유행 등 불가항력적인 사유로 계약 이행이 불가능한 경우, 해당 당사자는 책임을 지지 않는다.
              </p>
              <p className="text-gray-700">
                ② 불가항력 사유가 발생한 당사자는 즉시 상대방에게 통보하고, 양 당사자는 협의를 통해 계약 이행 방안을 결정한다.
              </p>
            </div>
          </article>

          {/* 제14조 */}
          <article className="pb-6">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              제14조 (분쟁 해결)
            </h3>
            <div className="space-y-2">
              <p className="text-gray-700">
                ① 본 계약과 관련하여 분쟁이 발생한 경우, 양 당사자는 우선 협의를 통해 해결하도록 노력한다.
              </p>
              <p className="text-gray-700">
                ② 협의로 해결되지 않는 경우, 서울중앙지방법원을 전속 관할 법원으로 한다.
              </p>
            </div>
          </article>
        </div>

        {/* 부칙 */}
        <div className="mt-12 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h3 className="mb-4 text-lg font-bold text-gray-900">부칙</h3>
          <div className="space-y-2 text-gray-700">
            <p>① 본 계약서에 명시되지 않은 사항은 상법 및 민법에 따른다.</p>
            <p>② 본 계약은 양 당사자의 서명 또는 날인으로 효력이 발생한다.</p>
            <p>③ 본 계약서는 2부를 작성하여 갑과 을이 각 1부씩 보관한다.</p>
          </div>
        </div>

        {/* 서명란 */}
        <div className="mt-12">
          <p className="mb-8 text-center text-gray-700">
            본 계약의 성립을 증명하기 위하여 계약서 2부를 작성하고, 갑과 을이 기명날인 또는 서명한 후 각각 1부씩 보관한다.
          </p>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {/* 갑 서명란 */}
            <div className="rounded-lg border border-gray-300 p-6">
              <p className="mb-4 text-center text-sm font-semibold text-gray-700">
                갑 (고객사)
              </p>
              <div className="space-y-3 text-gray-700">
                <p>계약일: ______년 ___월 ___일</p>
                <p>회사명: _____________________</p>
                <p>대표자: _____________________</p>
                <div className="mt-6 h-20 border-b border-gray-300">
                  <p className="text-right text-xs text-gray-500">(서명 또는 날인)</p>
                </div>
              </div>
            </div>

            {/* 을 서명란 */}
            <div className="rounded-lg border border-gray-300 p-6">
              <p className="mb-4 text-center text-sm font-semibold text-gray-700">
                을 (공급사)
              </p>
              <div className="space-y-3 text-gray-700">
                <p>계약일: ______년 ___월 ___일</p>
                <p>회사명: Stock & Logis</p>
                <p>대표자: 이동욱</p>
                <div className="mt-6 h-20 border-b border-gray-300">
                  <p className="text-right text-xs text-gray-500">(서명 또는 날인)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 별첨 - 과업내용서 템플릿 */}
        <div className="mt-16 border-t-4 border-gray-900 pt-12">
          <h2 className="mb-8 text-2xl font-bold text-gray-900">
            [별첨 1] 과업내용서 (Statement of Work)
          </h2>

          <div className="space-y-8">
            {/* 1. 프로젝트 개요 */}
            <section className="rounded-lg border border-gray-200 p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                1. 프로젝트 개요
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-700">
                    프로젝트명
                  </p>
                  <p className="text-gray-600">
                    _______________________________________________
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold text-gray-700">
                    배경 및 목표
                  </p>
                  <div className="min-h-[80px] rounded border border-gray-200 bg-white p-3 text-gray-600">
                    (프로젝트 배경, 기대효과, 목표를 기술)
                  </div>
                </div>
              </div>
            </section>

            {/* 2. 용역 범위 */}
            <section className="rounded-lg border border-gray-200 p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                2. 용역 범위
              </h3>
              <div className="min-h-[120px] rounded border border-gray-200 bg-white p-4">
                <ul className="space-y-2 text-gray-600">
                  <li>• (예: Phase 1 - 현황 진단 및 분석)</li>
                  <li>• (예: Phase 2 - 개선 방안 설계)</li>
                  <li>• (예: Phase 3 - 시스템 구축 지원)</li>
                  <li>• (예: Phase 4 - 안정화 및 이관)</li>
                </ul>
              </div>
            </section>

            {/* 3. 주요 산출물 */}
            <section className="rounded-lg border border-gray-200 p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                3. 주요 산출물
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-300 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        Phase
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        산출물명
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        형식
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[1, 2, 3, 4].map((phase) => (
                      <tr key={phase} className="bg-white">
                        <td className="px-4 py-3 text-gray-600">Phase {phase}</td>
                        <td className="px-4 py-3 text-gray-600">
                          ____________________
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          (예: PPT, Excel)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. 프로젝트 일정 */}
            <section className="rounded-lg border border-gray-200 p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                4. 프로젝트 일정
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-300 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        Phase
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        주요 활동
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        기간
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[1, 2, 3, 4].map((phase) => (
                      <tr key={phase} className="bg-white">
                        <td className="px-4 py-3 text-gray-600">Phase {phase}</td>
                        <td className="px-4 py-3 text-gray-600">
                          _________________________
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          __주
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 5. 투입 인력 */}
            <section className="rounded-lg border border-gray-200 p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                5. 투입 인력
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-300 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        역할
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        인원
                      </th>
                      <th className="px-4 py-3 font-semibold text-gray-700">
                        주요 업무
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr className="bg-white">
                      <td className="px-4 py-3 text-gray-600">프로젝트 매니저</td>
                      <td className="px-4 py-3 text-gray-600">1명</td>
                      <td className="px-4 py-3 text-gray-600">
                        전체 프로젝트 관리
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-4 py-3 text-gray-600">SCM 컨설턴트</td>
                      <td className="px-4 py-3 text-gray-600">__명</td>
                      <td className="px-4 py-3 text-gray-600">
                        프로세스 진단 및 설계
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="px-4 py-3 text-gray-600">데이터 분석가</td>
                      <td className="px-4 py-3 text-gray-600">__명</td>
                      <td className="px-4 py-3 text-gray-600">
                        데이터 분석 및 모델링
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 6. 협조 사항 */}
            <section className="rounded-lg border border-gray-200 p-6">
              <h3 className="mb-4 text-lg font-bold text-gray-900">
                6. 고객사 협조 사항
              </h3>
              <div className="min-h-[100px] rounded border border-gray-200 bg-white p-4">
                <ul className="space-y-2 text-gray-600">
                  <li>• 프로젝트 담당자 지정 및 의사결정 라인 구성</li>
                  <li>• 관련 데이터 및 자료 제공 (판매 이력, 재고 데이터 등)</li>
                  <li>• 인터뷰 대상자 섭외 및 일정 조율</li>
                  <li>• 시스템 접근 권한 제공 (필요 시)</li>
                  <li>• 프로젝트 룸 또는 미팅 공간 제공</li>
                </ul>
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}
