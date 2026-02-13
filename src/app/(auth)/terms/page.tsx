import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <Card className="border-2">
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/signup">
            <ArrowLeft className="mr-2 h-4 w-4" />
            회원가입으로 돌아가기
          </Link>
        </Button>
        <CardTitle className="text-2xl">이용약관</CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none space-y-6 text-sm text-muted-foreground">
        <h3 className="text-base font-semibold text-foreground">제1조 (목적)</h3>
        <p>
          이 약관은 Stock &amp; Logis(이하 &quot;회사&quot;)가 제공하는 FloStok 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차,
          회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제2조 (정의)</h3>
        <p>본 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>&quot;서비스&quot;</strong>: FloStok AI 기반 재고 관리 및 자동 발주 추천 SaaS 플랫폼</li>
          <li><strong>&quot;회원&quot;</strong>: 회원가입을 완료하고 서비스를 이용하는 개인 또는 법인</li>
          <li><strong>&quot;유료서비스&quot;</strong>: 구독료를 지불하고 이용하는 프리미엄 기능</li>
          <li><strong>&quot;콘텐츠&quot;</strong>: 서비스를 통해 제공되는 AI 분석, 발주 추천, 리포트 등 모든 정보 및 데이터</li>
          <li><strong>&quot;고객 데이터&quot;</strong>: 회원이 서비스에 입력하거나 업로드한 재고, 판매, 공급자 정보 등</li>
        </ul>

        <h3 className="text-base font-semibold text-foreground">제3조 (약관의 효력 및 변경)</h3>
        <p>
          본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.
          회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며,
          약관이 변경되는 경우 변경 사유 및 적용 일자를 명시하여 <strong>최소 7일 전에 공지</strong>합니다.
        </p>
        <p>
          회원에게 불리한 약관 변경의 경우 <strong>30일 전에 공지</strong>하며, 회원이 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 계약을 해지할 수 있습니다.
          변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우 변경된 약관에 동의한 것으로 간주합니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제4조 (서비스 이용)</h3>
        <p>
          서비스는 회원가입 후 이용 가능하며, 무료 체험 플랜과 유료 구독 플랜이 제공됩니다.
          회원가입 시 이메일 인증, 조직명, 대표자명 등 필수 정보를 정확하게 입력해야 합니다.
        </p>
        <p>
          회사는 다음 각 호의 경우 회원가입을 승인하지 않거나 사후에 이용 계약을 해지할 수 있습니다.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>타인의 명의를 도용하거나 허위 정보를 기재한 경우</li>
          <li>관련 법령에 위배되거나 사회 질서에 반하는 목적으로 신청한 경우</li>
          <li>기타 회사가 정한 이용 조건에 부합하지 않는 경우</li>
        </ul>

        <h3 className="text-base font-semibold text-foreground">제5조 (서비스 내용 및 변경)</h3>
        <p>FloStok 서비스는 다음의 기능을 포함합니다.</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>AI 기반 수요 예측 및 발주량 추천</li>
          <li>재고 현황 모니터링 및 알림 (품절 위험, 과잉 재고)</li>
          <li>공급자 관리 및 발주서 생성·관리</li>
          <li>KPI 대시보드 (재고회전율, 결품율, 과잉재고율 등)</li>
          <li>ABC-XYZ 재고 분류 및 재고 최적화 분석</li>
        </ul>
        <p>
          회사는 서비스의 품질 향상 또는 운영상의 필요에 따라 서비스의 내용을 변경·추가·삭제할 수 있으며,
          중대한 변경 사항이 발생하는 경우 사전에 공지합니다. 단, 불가피한 사유로 인한 경우 사후 통지할 수 있습니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제6조 (이용요금 및 결제)</h3>
        <p>
          서비스는 무료 체험 플랜과 유료 구독 플랜으로 구분되며, 유료 플랜의 구독료는 서비스 화면에 명시된 금액에 따릅니다.
          결제는 <strong>PortOne 및 토스페이먼츠</strong>를 통해 이루어지며, 신용카드, 계좌이체 등 다양한 결제 수단을 지원합니다.
        </p>
        <p>
          유료 구독은 매월 또는 매년 자동으로 갱신되며, 갱신 7일 전에 이메일로 안내합니다.
          자동 갱신을 원하지 않는 경우 갱신일 이전에 구독을 해지할 수 있습니다.
        </p>
        <p>
          회사는 요금제를 변경할 수 있으며, 기존 회원에게 불리한 요금 인상의 경우 <strong>30일 전에 공지</strong>합니다.
          요금 변경에 동의하지 않는 회원은 구독을 해지할 수 있습니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제7조 (환불 정책)</h3>
        <p>
          무료 체험 기간 내에 서비스를 해지하는 경우 요금이 청구되지 않습니다.
          유료 구독 전환 후 환불을 요청하는 경우, 다음의 기준에 따라 일할 계산하여 환불합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>월간 구독</strong>: 미사용 일수에 비례하여 환불 (사용 7일 이내 100% 환불, 이후 일할 계산)</li>
          <li><strong>연간 구독</strong>: 미사용 개월 수에 비례하여 환불 (사용 30일 이내 100% 환불, 이후 월할 계산)</li>
          <li>환불 수수료는 원칙적으로 부과하지 않으나, 결제 대행사 수수료는 공제될 수 있습니다.</li>
        </ul>
        <p>
          환불은 회원의 요청일로부터 <strong>7영업일 이내</strong>에 원결제 수단으로 처리됩니다.
          환불을 요청하려면 고객센터(logisglobalceo@gmail.com)로 문의하시기 바랍니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제8조 (이용자의 의무)</h3>
        <p>회원은 다음 각 호의 의무를 준수해야 합니다.</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>회원가입 시 제공한 정보가 정확하고 최신 상태로 유지되도록 관리할 의무</li>
          <li>계정 비밀번호를 안전하게 관리하고, 타인에게 공유하지 않을 의무</li>
          <li>서비스를 불법적이거나 부정한 목적으로 이용하지 않을 의무</li>
        </ul>
        <p>회원은 다음 각 호의 행위를 하여서는 안 됩니다.</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>서비스의 소스코드를 리버스 엔지니어링하거나 복제하는 행위</li>
          <li>크롤링, 스크래핑 등 자동화된 수단으로 데이터를 무단 수집하는 행위</li>
          <li>서비스의 안정성을 해치는 해킹, DDoS 공격 등의 행위</li>
          <li>타인의 개인정보를 도용하거나 부정 사용하는 행위</li>
          <li>회사의 사전 서면 동의 없이 서비스를 재판매하거나 제3자에게 재임대하는 행위</li>
        </ul>

        <h3 className="text-base font-semibold text-foreground">제9조 (회사의 의무)</h3>
        <p>
          회사는 서비스의 안정적인 제공을 위해 노력하며, 서비스 장애 발생 시 신속하게 대응합니다.
          단, 천재지변, 불가항력 또는 제3자 서비스(Supabase, Vercel 등)의 장애로 인한 경우 책임이 면제될 수 있습니다.
        </p>
        <p>
          회사는 회원의 개인정보를 관련 법령(개인정보보호법 등)에 따라 보호하며,
          개인정보의 수집·이용·제공에 관한 사항은 별도의 개인정보처리방침에 따릅니다.
        </p>
        <p>
          회사는 서비스 개선, 신규 기능 추가, 보안 업데이트 등을 지속적으로 제공하기 위해 노력합니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제10조 (데이터 소유권)</h3>
        <p>
          <strong>고객 데이터(재고, 판매, 공급자 정보 등)는 회원의 소유</strong>이며, 회사는 서비스 제공 목적 외에는 이를 사용하지 않습니다.
          회사는 회원의 동의 없이 고객 데이터를 제3자에게 제공하거나 판매하지 않습니다.
        </p>
        <p>
          회원이 서비스를 해지하거나 계약이 종료되는 경우, 회사는 고객 데이터를 다음과 같이 처리합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li><strong>해지 후 30일 이내</strong>: 회원이 요청하는 경우 CSV 또는 Excel 형식으로 데이터 다운로드 제공</li>
          <li><strong>해지 후 90일 이후</strong>: 모든 고객 데이터를 안전하게 삭제 (법적 보관 의무가 있는 경우 제외)</li>
        </ul>

        <h3 className="text-base font-semibold text-foreground">제11조 (지적재산권)</h3>
        <p>
          FloStok 서비스의 소프트웨어, UI/UX 디자인, 알고리즘, 콘텐츠 등 모든 지적재산권은 <strong>회사에 귀속</strong>됩니다.
          회원은 서비스를 이용할 권리만을 부여받으며, 회사의 사전 서면 동의 없이 복제, 배포, 개작할 수 없습니다.
        </p>
        <p>
          회원이 서비스를 통해 생성한 리포트, 분석 결과 등은 회원이 자유롭게 활용할 수 있으나,
          이를 재판매하거나 경쟁 서비스 개발에 사용하는 것은 금지됩니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제12조 (책임 제한)</h3>
        <p>
          <strong>서비스에서 제공하는 AI 분석, 발주 추천, 수요 예측 등의 정보는 참고용</strong>이며,
          최종 의사결정 및 그에 따른 결과에 대한 책임은 회원에게 있습니다.
          회사는 회원의 의사결정으로 인한 손실에 대해 책임을 지지 않습니다.
        </p>
        <p>
          회사는 다음 각 호의 경우 책임이 면제됩니다.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>천재지변, 전쟁, 테러 등 불가항력으로 인한 서비스 중단</li>
          <li>회원의 귀책사유(비밀번호 유출, 잘못된 데이터 입력 등)로 인한 손해</li>
          <li>제3자 서비스(결제 대행사, 클라우드 인프라 등)의 장애로 인한 서비스 중단</li>
        </ul>
        <p>
          회사가 배상해야 할 손해가 발생한 경우, 배상 금액은 <strong>회원이 최근 12개월간 지불한 서비스 이용료 총액을 한도</strong>로 합니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제12조의2 (산출물의 성격 및 이용자 책임)</h3>

        <p><strong>① 산출물의 성격</strong></p>
        <p>
          서비스에서 산출되는 수요예측 수량, 공급물량, 발주 추천 수량, 안전재고, 발주점, PSI 계획 등
          모든 수치 정보(이하 &quot;산출물&quot;)는 <strong>의사결정 참고 자료(가이드)</strong>로 제공됩니다.
          산출물은 <strong>확정적 지시나 보증이 아니며</strong>, 실제 발주·생산·재고 운영의 최종 결정은
          전적으로 회원의 판단과 책임 하에 이루어져야 합니다.
        </p>

        <p><strong>② 산출물의 변동 가능성</strong></p>
        <p>
          산출물은 다음 요인에 따라 <strong>동일 제품에 대해서도 크게 다른 수치가 산출</strong>될 수 있으며,
          회원은 이러한 변동 가능성을 충분히 인지하고 서비스를 이용해야 합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>예측 방법 선택 (단순이동평균, 지수평활법, 이중지수평활법 등)</li>
          <li>파라미터 설정 (이동평균 기간, 평활 계수 α/β 값 등)</li>
          <li>SCM 가이드 산출 방식 선택 (출고계획동일, 안전재고보충, 목표재고일수, 수요예측연동, 발주방식별 등)</li>
          <li>ABC-XYZ 보정계수 설정값</li>
          <li>입력 데이터의 정확성과 충분성 (판매 이력 기간, 데이터 누락 여부)</li>
          <li>서비스레벨(Z값), 목표재고일수, 리드타임 등 기준값 설정</li>
        </ul>

        <p><strong>③ 이용자의 검증 의무</strong></p>
        <p>
          회원은 산출물을 실제 발주·생산·재고 운영에 반영하기 전,
          <strong>반드시 다음 사항을 확인</strong>해야 합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>산출 수량의 현실적 적절성 (과거 실적 대비, 시장 상황 고려)</li>
          <li>선택한 옵션(예측방법, 산출방식, 파라미터)의 적합성</li>
          <li>입력 데이터(판매 이력, 리드타임, 안전재고 등)의 정확성</li>
          <li>예측 정확도 지표(MAPE 등)의 신뢰도 수준</li>
        </ul>
        <p>
          검증 없이 산출물을 그대로 적용하여 발생하는 <strong>과잉 발주, 재고 부족,
          결품, 과잉 재고 등의 손해</strong>에 대해 회사는 책임을 지지 않습니다.
        </p>

        <p><strong>④ 부적절한 옵션 선택에 대한 주의</strong></p>
        <p>
          제품 특성에 맞지 않는 예측 방법이나 산출 방식을 선택할 경우,
          산출물이 실제 수요와 <strong>큰 차이</strong>를 보일 수 있습니다.
          회사는 자동 선택 기능을 제공하나, 자동 선택 결과 역시 <strong>참고 사항</strong>이며
          최적을 보장하지 않습니다. 회원은 서비스에서 제공하는 매뉴얼 및 가이드를
          충분히 숙지한 후 옵션을 선택할 것을 권장합니다.
        </p>

        <p><strong>⑤ 데이터 품질에 따른 산출물 정확도</strong></p>
        <p>
          산출물의 정확도는 회원이 입력한 데이터의 <strong>품질, 양, 정확성</strong>에 직접적으로 의존합니다.
          불완전하거나 부정확한 데이터 입력으로 인한 산출물의 오류에 대해 회사는 책임을 지지 않습니다.
          충분한 판매 이력(최소 6개월, 권장 12개월 이상)이 없는 경우
          예측 정확도가 현저히 낮아질 수 있습니다.
        </p>

        <p><strong>⑥ 면책 범위</strong></p>
        <p>
          회사는 산출물의 정확성, 완전성, 적시성에 대해 <strong>명시적·묵시적 보증을 하지 않습니다</strong>.
          회원이 산출물에 기반하여 수행한 발주, 생산, 재고 운영 등의 결과로 발생하는
          <strong>직접적·간접적 손해</strong>(매출 손실, 재고 손실, 기회 비용, 폐기 비용 등)에 대해
          회사는 책임을 지지 않습니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제13조 (계약 해지)</h3>
        <p>
          회원은 언제든지 서비스 내 설정 화면 또는 고객센터를 통해 계약을 해지할 수 있습니다.
          해지 시 환불 정책(제7조)에 따라 처리됩니다.
        </p>
        <p>
          회사는 다음 각 호의 경우 계약을 해지할 수 있습니다.
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>회원이 이용요금을 <strong>3개월 이상 미납</strong>한 경우 (사전 통지 후 14일 경과)</li>
          <li>회원이 제8조(이용자의 의무)에서 금지한 행위를 한 경우</li>
          <li>회원이 허위 정보를 기재하거나 타인의 명의를 도용한 경우</li>
          <li>관련 법령 위반 또는 공공질서 저해 행위를 한 경우</li>
        </ul>
        <p>
          회사가 계약을 해지하는 경우 <strong>최소 7일 전에 이메일로 통지</strong>하며,
          회원은 통지일로부터 7일 이내에 이의를 제기할 수 있습니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제14조 (손해배상)</h3>
        <p>
          회사의 귀책사유로 회원에게 손해가 발생한 경우, 회사는 관련 법령에 따라 손해를 배상합니다.
          다만, 배상 범위는 <strong>직접 손해에 한정</strong>되며, 간접 손해(영업 손실, 기회 손실 등)는 포함하지 않습니다.
        </p>
        <p>
          회원의 귀책사유로 회사에 손해가 발생한 경우(금지 행위로 인한 법적 분쟁, 서비스 장애 유발 등),
          회원은 회사에 손해를 배상할 책임이 있습니다.
        </p>
        <p>
          손해배상 청구는 손해 발생 사실을 안 날로부터 <strong>3개월 이내</strong>에 서면 또는 이메일로 청구해야 하며,
          청구 금액은 회원이 최근 12개월간 지불한 이용료 총액을 한도로 합니다.
        </p>

        <h3 className="text-base font-semibold text-foreground">제15조 (분쟁 해결)</h3>
        <p>
          본 약관의 해석 및 서비스 이용과 관련하여 회사와 회원 간에 분쟁이 발생한 경우,
          양 당사자는 상호 협의를 통해 원만히 해결하도록 노력합니다.
        </p>
        <p>
          협의가 이루어지지 않는 경우, <strong>대한민국 법률</strong>을 준거법으로 하며,
          관할법원은 <strong>서울중앙지방법원</strong>으로 합니다.
        </p>

        <div className="pt-6 border-t mt-8">
          <p className="text-xs text-muted-foreground">
            <strong>회사 정보</strong><br />
            상호: Stock &amp; Logis (스톡앤로지스)<br />
            대표: 이동욱<br />
            이메일: logisglobalceo@gmail.com<br />
            사업자등록번호: (추후 기입)
          </p>
          <p className="text-xs text-muted-foreground mt-4">
            시행일: 2026년 2월 11일
          </p>
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ 본 약관은 초안이며, 법률 전문가의 검수가 필요합니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
