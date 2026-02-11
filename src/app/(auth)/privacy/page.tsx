import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <Card className="border-2">
      <CardHeader>
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href="/signup">
            <ArrowLeft className="mr-2 h-4 w-4" />
            회원가입으로 돌아가기
          </Link>
        </Button>
        <CardTitle className="text-2xl">개인정보처리방침</CardTitle>
      </CardHeader>
      <CardContent className="prose prose-sm max-w-none space-y-6 text-sm text-muted-foreground">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-800">
            <strong>안내:</strong> 본 개인정보 처리방침은 초안이며, 법률 전문가의 검수가 필요합니다.
          </p>
        </div>

        <div>
          <p className="mb-4">
            <strong className="text-foreground">Stock &amp; Logis(스톡앤로지스)</strong>
            (이하 &quot;회사&quot;)는 이용자의 개인정보를 중요시하며,
            「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등
            관련 법령을 준수합니다.
          </p>
        </div>

        <section>
          <h3 className="text-base font-semibold text-foreground">1. 수집하는 개인정보</h3>
          <p className="mb-2">
            회사는 FloStok 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>회원가입 시 필수항목:</strong> 이메일 주소, 이름, 비밀번호
            </li>
            <li>
              <strong>선택항목:</strong> 조직명, 직책
            </li>
            <li>
              <strong>서비스 이용 과정에서 수집:</strong> 재고 데이터, 발주 기록, 판매 데이터, 공급자 정보
            </li>
            <li>
              <strong>자동 수집:</strong> IP 주소, 쿠키, 접속 로그, 기기 정보, 브라우저 종류 및 OS
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">2. 개인정보의 수집 및 이용 목적</h3>
          <ul className="ml-4 list-disc space-y-1">
            <li>회원 관리, 본인 확인, 계정 인증 및 보안</li>
            <li>서비스 제공: AI 기반 수요 예측, 자동 발주 추천, KPI 분석, 재고 관리</li>
            <li>서비스 개선 및 신규 기능 개발</li>
            <li>고객 지원 및 문의 응대</li>
            <li>요금 결제 및 정산</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">3. 개인정보의 보유 및 이용 기간</h3>
          <p className="mb-2">
            회사는 원칙적으로 이용자가 회원 탈퇴를 요청한 경우 개인정보를 즉시 파기합니다.
            다만, 관련 법령에 따라 보존이 필요한 경우 아래 기간 동안 보관합니다.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>전자상거래법:</strong> 계약 또는 청약철회 등에 관한 기록 (5년),
              대금결제 및 재화 등의 공급에 관한 기록 (5년),
              소비자 불만 또는 분쟁처리 기록 (3년)
            </li>
            <li>
              <strong>통신비밀보호법:</strong> 접속 기록 (3개월)
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">4. 개인정보의 제3자 제공</h3>
          <p className="mb-2">
            회사는 원칙적으로 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
            다만, 아래의 경우에는 예외로 합니다.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>법령에 특별한 규정이 있는 경우</li>
            <li>수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
          </ul>
          <p className="mt-2">
            개인정보를 제3자에게 제공해야 하는 경우, 사전에 제공받는 자, 제공 목적,
            제공 항목, 보유 기간 등을 고지하고 동의를 받습니다.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">5. 개인정보 처리 위탁</h3>
          <p className="mb-2">
            회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있습니다.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>클라우드 호스팅 및 데이터베이스:</strong> Supabase, Railway
            </li>
            <li>
              <strong>결제 처리:</strong> PortOne, 토스페이먼츠
            </li>
            <li>
              <strong>이메일 발송:</strong> Resend
            </li>
            <li>
              <strong>AI 서비스:</strong> Anthropic (Claude API)
            </li>
          </ul>
          <p className="mt-2">
            회사는 위탁 계약 체결 시 개인정보 보호법 제26조에 따라 위탁업무 수행 목적 외
            개인정보 처리 금지, 기술적·관리적 보호조치, 재위탁 제한 등을 계약서에 명시하고 관리·감독합니다.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">6. 이용자의 권리와 그 행사 방법</h3>
          <p className="mb-2">이용자는 다음과 같은 권리를 행사할 수 있습니다.</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>개인정보 열람 요구</li>
            <li>개인정보 정정 요구</li>
            <li>개인정보 삭제 요구</li>
            <li>개인정보 처리정지 요구</li>
            <li>개인정보 수집·이용·제공에 대한 동의 철회</li>
          </ul>
          <p className="mt-2">
            권리 행사 방법: 서비스 내 설정 페이지를 통해 직접 조회, 정정, 삭제 가능하며,
            개인정보보호책임자에게 이메일(logisglobalceo@gmail.com)로 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">7. 개인정보의 파기</h3>
          <p className="mb-2">
            <strong>파기 시기:</strong> 개인정보 보유 기간이 만료되거나 처리 목적이 달성된 경우 지체 없이 파기합니다.
          </p>
          <p>
            <strong>파기 방법:</strong> 전자적 파일은 복구 불가능한 방법으로 영구 삭제하며,
            종이 문서는 파쇄기로 파쇄하거나 소각합니다.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">8. 개인정보의 안전성 확보 조치</h3>
          <p className="mb-2">회사는 개인정보 보호를 위해 다음과 같은 조치를 취하고 있습니다.</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>개인정보 전송 시 SSL/TLS 암호화 통신 적용</li>
            <li>비밀번호는 해시(Hash) 처리하여 저장</li>
            <li>개인정보 접근 권한 최소화 및 접근 통제</li>
            <li>접속 로그 기록 및 6개월 이상 보관</li>
            <li>정기적인 보안 점검 및 취약점 분석</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">9. 쿠키(Cookie)의 운영</h3>
          <p className="mb-2">
            회사는 이용자에게 맞춤형 서비스를 제공하기 위해 쿠키를 사용합니다.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>쿠키 사용 목적:</strong> 로그인 상태 유지, 사용자 인증, 서비스 이용 패턴 분석 및 개선
            </li>
            <li>
              <strong>쿠키 종류:</strong> 필수 쿠키(인증, 보안), 분석 쿠키(서비스 개선)
            </li>
            <li>
              <strong>쿠키 설정 및 거부:</strong> 브라우저 설정을 통해 쿠키 허용/차단 가능
              (단, 필수 쿠키 차단 시 일부 서비스 이용 제한 가능)
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">10. 개인정보 보호책임자</h3>
          <p className="mb-2">
            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
            이용자의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
          </p>
          <ul className="ml-4 list-none space-y-1">
            <li>
              <strong>성명:</strong> 이동욱
            </li>
            <li>
              <strong>직위:</strong> 대표
            </li>
            <li>
              <strong>이메일:</strong> logisglobalceo@gmail.com
            </li>
          </ul>
          <p className="mt-2">
            개인정보 침해 관련 상담이 필요하신 경우, 개인정보침해신고센터(privacy.kisa.or.kr),
            개인정보분쟁조정위원회(www.kopico.go.kr) 등에 문의하실 수 있습니다.
          </p>
        </section>

        <section>
          <h3 className="text-base font-semibold text-foreground">11. 개인정보 처리방침의 변경 및 고지 의무</h3>
          <p>
            본 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경 내용의 추가,
            삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 웹사이트를 통해 공지합니다.
            중요한 변경의 경우에는 시행 30일 전에 공지합니다.
          </p>
        </section>

        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            <strong>회사명:</strong> Stock &amp; Logis (스톡앤로지스)<br />
            <strong>서비스명:</strong> FloStok<br />
            <strong>대표자:</strong> 이동욱<br />
            <strong>이메일:</strong> logisglobalceo@gmail.com<br />
            <strong>시행일:</strong> 2026년 2월 11일
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
