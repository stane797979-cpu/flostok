import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "비밀유지 계약서 (NDA) | Stock & Logis",
  description: "Stock & Logis 사업 협력 시 사용되는 비밀유지 계약서 초안입니다.",
};

export default function NDAPage() {
  return (
    <div className="bg-white px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* 안내 메시지 */}
        <div className="mb-12 rounded-lg border border-amber-200 bg-amber-50 p-6">
          <p className="text-sm font-semibold text-amber-900">
            ⚠️ 법률 검토 필요
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            본 계약서는 참고용 초안이며, 실제 사용 전 반드시 법률 전문가의 검수가 필요합니다.
          </p>
        </div>

        {/* 제목 */}
        <div className="border-b-4 border-gray-900 pb-6 text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            비밀유지 계약서
          </h1>
          <p className="mt-2 text-xl text-gray-600">
            Non-Disclosure Agreement (NDA)
          </p>
        </div>

        {/* 서문 */}
        <div className="mt-12">
          <p className="leading-7 text-gray-700">
            아래 갑과 을은 상호 신뢰와 성실을 바탕으로 사업 협력(SCM 컨설팅, 교육, 솔루션 도입 등) 검토 과정에서 교환되는 기밀정보의 보호에 관하여 다음과 같이 양방향 비밀유지 계약(쌍무 계약)을 체결한다.
          </p>
        </div>

        {/* 조항들 */}
        <div className="mt-16 space-y-12">
          {/* 제1조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제1조 (목적)
            </h3>
            <p className="mt-4 leading-7 text-gray-700">
              본 계약은 양 당사자 간 사업 협력 검토를 위한 논의, 자료 교환, 시스템 평가 등의 과정에서 교환되는 기밀정보를 보호하고, 해당 정보가 계약 목적 외의 용도로 사용되거나 무단으로 제3자에게 공개되는 것을 방지함을 목적으로 한다.
            </p>
          </section>

          {/* 제2조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제2조 (기밀정보의 정의)
            </h3>
            <div className="mt-4 space-y-4">
              <p className="leading-7 text-gray-700">
                <strong>1. 기밀정보의 범위:</strong> 본 계약에서 "기밀정보"란 서면, 구두, 전자적 형태 또는 기타 모든 형태로 상대방이 제공하는 다음 각 호의 정보를 의미한다.
              </p>
              <ul className="ml-6 space-y-2 text-gray-700">
                <li className="leading-7">
                  • 사업 계획, 전략, 영업 방법 및 마케팅 정보
                </li>
                <li className="leading-7">
                  • 재무 정보, 가격 정책, 비용 구조
                </li>
                <li className="leading-7">
                  • 고객 정보, 공급자 정보, 거래처 목록
                </li>
                <li className="leading-7">
                  • 기술 자료, 소프트웨어 소스 코드, 알고리즘, 설계 문서
                </li>
                <li className="leading-7">
                  • 재고 데이터, 판매 기록, 수요 예측 정보
                </li>
                <li className="leading-7">
                  • 시스템 접근 권한, 계정 정보, 보안 정책
                </li>
                <li className="leading-7">
                  • 기타 상대방이 서면으로 "기밀" 또는 "Confidential" 표시를 한 정보
                </li>
              </ul>
              <p className="leading-7 text-gray-700">
                <strong>2. 기밀정보의 예외:</strong> 다음 각 호에 해당하는 정보는 기밀정보에서 제외된다.
              </p>
              <ul className="ml-6 space-y-2 text-gray-700">
                <li className="leading-7">
                  • 공개 당시 이미 공지된 정보 또는 이후 수령 당사자의 과실 없이 공지된 정보
                </li>
                <li className="leading-7">
                  • 수령 당사자가 공개받기 전부터 적법하게 보유하고 있던 정보
                </li>
                <li className="leading-7">
                  • 비밀유지 의무 없이 제3자로부터 적법하게 취득한 정보
                </li>
                <li className="leading-7">
                  • 수령 당사자가 상대방의 기밀정보를 사용하지 않고 독자적으로 개발한 정보
                </li>
              </ul>
            </div>
          </section>

          {/* 제3조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제3조 (비밀유지 의무)
            </h3>
            <div className="mt-4 space-y-4">
              <p className="leading-7 text-gray-700">
                <strong>1.</strong> 수령 당사자는 상대방으로부터 제공받은 기밀정보를 본 계약의 목적(사업 협력 검토) 외의 다른 용도로 사용해서는 안 된다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>2.</strong> 수령 당사자는 상대방의 사전 서면 동의 없이 기밀정보를 제3자에게 공개, 누설, 배포해서는 안 된다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>3.</strong> 수령 당사자는 기밀정보에 접근할 수 있는 인원을 업무상 반드시 필요한 자로 최소화하며, 해당 인원에게 본 계약과 동일한 수준의 비밀유지 의무를 부과해야 한다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>4.</strong> 수령 당사자는 자신의 기밀정보를 보호하는 것과 동일한 수준의 합리적 보호 조치를 상대방의 기밀정보에 적용해야 하며, 최소한 상당한 주의(reasonable care)를 기울여야 한다.
              </p>
            </div>
          </section>

          {/* 제4조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제4조 (예외 사항)
            </h3>
            <div className="mt-4 space-y-4">
              <p className="leading-7 text-gray-700">
                <strong>1.</strong> 법원의 명령, 정부 기관의 요청, 법령에 의한 의무로 인해 기밀정보의 공개가 요구되는 경우, 수령 당사자는 해당 정보를 공개할 수 있다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>2.</strong> 단, 수령 당사자는 공개 전 상대방에게 즉시 서면으로 통지하고, 상대방이 공개를 제한하거나 보호 명령을 받을 수 있도록 합리적으로 협조해야 하며, 공개 범위를 법적으로 요구되는 최소한으로 한정해야 한다.
              </p>
            </div>
          </section>

          {/* 제5조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제5조 (유효 기간)
            </h3>
            <div className="mt-4 space-y-4">
              <p className="leading-7 text-gray-700">
                <strong>1.</strong> 본 계약의 유효기간은 계약 체결일로부터 3년간으로 한다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>2.</strong> 본 계약이 종료되더라도 제3조의 비밀유지 의무는 계약 종료일로부터 추가로 2년간 존속한다(총 5년간 비밀유지).
              </p>
              <p className="leading-7 text-gray-700">
                <strong>3.</strong> 양 당사자의 서면 합의로 계약 기간을 연장할 수 있다.
              </p>
            </div>
          </section>

          {/* 제6조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제6조 (위반 시 손해배상)
            </h3>
            <div className="mt-4 space-y-4">
              <p className="leading-7 text-gray-700">
                <strong>1.</strong> 어느 일방이 본 계약상의 의무를 위반하여 상대방에게 손해를 입힌 경우, 위반 당사자는 상대방에게 발생한 모든 직접 손해를 배상할 책임을 진다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>2.</strong> 손해배상과 별도로 피해 당사자는 가처분, 금지명령 등 법적 구제 수단을 행사할 수 있다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>3.</strong> 위반 사실의 입증 책임은 피해 당사자가 부담한다.
              </p>
            </div>
          </section>

          {/* 제7조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제7조 (기밀정보의 반환 및 파기)
            </h3>
            <div className="mt-4 space-y-4">
              <p className="leading-7 text-gray-700">
                <strong>1.</strong> 본 계약이 종료되거나 상대방이 요청하는 경우, 수령 당사자는 30일 이내에 상대방으로부터 제공받은 모든 기밀정보(사본, 발췌본, 요약본 포함)를 반환하거나 파기해야 한다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>2.</strong> 전자 데이터는 복구 불가능한 방법으로 완전히 삭제하고, 서면 자료는 파쇄 처리해야 한다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>3.</strong> 수령 당사자는 반환 또는 파기 완료 후 그 사실을 확인하는 서면을 상대방에게 제출해야 한다.
              </p>
            </div>
          </section>

          {/* 제8조 */}
          <section>
            <h3 className="text-xl font-bold text-gray-900">
              제8조 (분쟁 해결)
            </h3>
            <div className="mt-4 space-y-4">
              <p className="leading-7 text-gray-700">
                <strong>1. 준거법:</strong> 본 계약은 대한민국 법률에 따라 해석되고 집행된다.
              </p>
              <p className="leading-7 text-gray-700">
                <strong>2. 분쟁 해결 절차:</strong> 본 계약과 관련된 분쟁은 먼저 양 당사자 간 협의를 통해 해결하도록 노력하며, 협의가 이루어지지 않을 경우 서울중앙지방법원을 제1심 관할 법원으로 한다.
              </p>
            </div>
          </section>
        </div>

        {/* 서명란 */}
        <div className="mt-20 border-t-2 border-gray-300 pt-12">
          <p className="text-center text-lg font-semibold text-gray-900">
            본 계약의 체결을 증명하기 위하여 계약서 2부를 작성하고, 각 1부씩 보관한다.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* 갑 서명란 */}
            <div className="rounded-lg border-2 border-gray-300 bg-gray-50 p-8">
              <p className="mb-6 text-center text-xl font-bold text-gray-900">
                갑 (기밀 공개 당사자)
              </p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">회사명:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">대표자명:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">주소:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">서명:</p>
                  <div className="mt-1 h-16 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">날짜:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
              </div>
            </div>

            {/* 을 서명란 */}
            <div className="rounded-lg border-2 border-gray-300 bg-gray-50 p-8">
              <p className="mb-6 text-center text-xl font-bold text-gray-900">
                을 (기밀 수령 당사자)
              </p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700">회사명:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">대표자명:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">주소:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">서명:</p>
                  <div className="mt-1 h-16 border-b-2 border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">날짜:</p>
                  <div className="mt-1 h-10 border-b-2 border-gray-400"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 인쇄 안내 */}
        <div className="mt-12 rounded-lg border border-blue-200 bg-blue-50 p-6">
          <p className="text-sm font-semibold text-blue-900">
            💡 인쇄 안내
          </p>
          <p className="mt-2 text-sm leading-6 text-blue-800">
            본 계약서는 인쇄 친화적으로 디자인되었습니다. 브라우저의 인쇄 기능(Ctrl+P 또는 Cmd+P)을 이용하여 PDF로 저장하거나 출력할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
