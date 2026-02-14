import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2, Star, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import {
  COMPANY,
  SOLUTION_FEATURES,
  DIFFERENTIATORS,
  COMPETITORS,
  COMPARISON_FEATURES,
} from "@/lib/constants/homepage-data";

export const metadata: Metadata = {
  title: `FloStok 솔루션 | ${COMPANY.name}`,
  description:
    "AI 수요예측, 자동발주, KPI 분석까지 — SCM 전문가가 만든 AI 재고관리 솔루션",
};

const plans = [
  {
    name: "FREE",
    price: "0",
    description: "개인 및 소규모 팀을 위한 무료 플랜",
    features: [
      "제품 50개까지",
      "기본 재고 관리",
      "수동 발주",
      "기본 리포트",
      "이메일 지원",
    ],
    cta: "무료 시작",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "STARTER",
    price: "29,000",
    description: "성장하는 중소기업을 위한 스타터 플랜",
    features: [
      "제품 500개까지",
      "자동 발주 추천",
      "ABC/XYZ 분석",
      "수요 예측 (기본)",
      "이메일 알림",
      "우선 지원",
    ],
    cta: "14일 무료 체험",
    href: "/signup?plan=starter",
    highlighted: false,
  },
  {
    name: "PRO",
    price: "79,000",
    description: "전문적인 재고 관리가 필요한 기업",
    features: [
      "제품 무제한",
      "AI 자동 발주",
      "고급 분석 (ABC/XYZ/EOQ)",
      "수요 예측 (고급)",
      "이메일 + SMS 알림",
      "AI 채팅 어시스턴트",
      "시나리오 시뮬레이션",
      "전담 지원",
    ],
    cta: "14일 무료 체험",
    href: "/signup?plan=pro",
    highlighted: true,
  },
  {
    name: "ENTERPRISE",
    price: "맞춤",
    description: "대기업 및 복잡한 공급망 관리",
    features: [
      "PRO 플랜의 모든 기능",
      "멀티 조직 관리",
      "맞춤형 통합 (ERP 등)",
      "전용 서버 옵션",
      "24/7 전화 지원",
      "온보딩 교육",
      "SLA 보장",
    ],
    cta: "영업팀 문의",
    href: "/contact",
    highlighted: false,
  },
];

export default function SolutionPage() {
  const largeFeatures = SOLUTION_FEATURES.filter((f) => f.size === "large");
  const smallFeatures = SOLUTION_FEATURES.filter((f) => f.size === "small");

  return (
    <div>
      {/* 헤더 */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm">
            AI-Powered SCM Solution
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            FloStok
          </h1>
          <p className="mt-6 text-lg text-gray-300">
            22년 현장 경험이 녹아든 SCM 로직과 AI 기술의 결합.
            <br />
            수요예측부터 KPI 개선 제안까지, End-to-End 재고관리 솔루션.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-4">
            <Button size="lg" asChild>
              <Link href="/signup">
                무료로 시작하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white bg-white/10 text-white hover:bg-white/20"
              asChild
            >
              <Link href="#pricing">가격 보기</Link>
            </Button>
          </div>

          {/* 대시보드 미리보기 */}
          <div className="mt-16 flow-root">
            <div className="relative -m-2 rounded-xl bg-white/5 p-2 ring-1 ring-inset ring-white/10 lg:-m-4 lg:rounded-2xl lg:p-4">
              <Image
                src="/dashboard-preview.png"
                alt="FloStok 대시보드"
                width={1920}
                height={1080}
                className="w-full rounded-md shadow-2xl ring-1 ring-white/10"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 기능 (대형) */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            핵심 AI 기능
          </h2>
          <p className="mt-4 text-center text-gray-600">
            타 솔루션에서는 찾을 수 없는, FloStok만의 차별화 기능
          </p>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {largeFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-50 p-8 ring-1 ring-primary-100"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 부가 기능 */}
      <section className="bg-slate-50 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            올인원 기능
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {smallFeatures.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-4 rounded-xl border bg-white p-5"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <feature.icon className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {feature.title}
                  </h4>
                  <p className="mt-1 text-sm text-gray-500">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 경쟁사 비교표 */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">
              경쟁사 비교
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              FloStok vs 경쟁 솔루션
            </p>
            <p className="mt-4 text-gray-600">
              기능별 상세 비교로 FloStok의 차별화된 가치를 확인하세요
            </p>
          </div>

          <div className="mt-16 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-4 text-left font-semibold text-gray-900">
                    기능
                  </th>
                  <th className="px-4 py-4 text-center font-bold text-primary-600 bg-primary-50 rounded-t-lg min-w-[120px]">
                    {COMPETITORS.floStok}
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-600 min-w-[120px]">
                    {COMPETITORS.compA}
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-600 min-w-[120px]">
                    {COMPETITORS.compB}
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-gray-600 min-w-[120px]">
                    {COMPETITORS.compC}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lastCategory = "";
                  return COMPARISON_FEATURES.map((item, idx) => {
                    const showCategory = item.category !== lastCategory;
                    lastCategory = item.category;
                    return (
                      <>
                        {showCategory && (
                          <tr key={`cat-${item.category}`}>
                            <td
                              colSpan={5}
                              className="px-4 pt-6 pb-2 text-xs font-bold uppercase tracking-wider text-gray-400"
                            >
                              {item.category}
                            </td>
                          </tr>
                        )}
                        <tr
                          key={`feat-${idx}`}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-gray-700">
                            {item.feature}
                          </td>
                          {[item.floStok, item.compA, item.compB, item.compC].map(
                            (score, i) => (
                              <td
                                key={i}
                                className={`px-4 py-3 text-center ${i === 0 ? "bg-primary-50/50" : ""}`}
                              >
                                <div className="flex items-center justify-center gap-0.5">
                                  {score === 0 ? (
                                    <span className="text-gray-300">-</span>
                                  ) : (
                                    Array.from({ length: 5 }).map((_, s) => (
                                      <Star
                                        key={s}
                                        className={`h-3.5 w-3.5 ${
                                          s < score
                                            ? i === 0
                                              ? "fill-primary-500 text-primary-500"
                                              : "fill-gray-300 text-gray-300"
                                            : "text-gray-200"
                                        }`}
                                      />
                                    ))
                                  )}
                                </div>
                              </td>
                            )
                          )}
                        </tr>
                      </>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
            * 비교 데이터는 2025년 기준 공개 정보 및 자체 평가 기준입니다. A사: 국내 중소기업 ERP, B사: 해외 재고관리 SaaS, C사: 글로벌 엔터프라이즈 SCM
          </p>
        </div>
      </section>

      {/* 가격 */}
      <section
        id="pricing"
        className="bg-slate-50 px-6 py-24 sm:py-32 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600">
              가격
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              모든 규모의 비즈니스를 위한 플랜
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-4">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.highlighted
                    ? "border-primary-600 ring-2 ring-primary-600"
                    : ""
                }
              >
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-x-2">
                      {plan.price === "맞춤" ? (
                        <span className="text-4xl font-bold tracking-tight text-gray-900">
                          {plan.price}
                        </span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold tracking-tight text-gray-900">
                            {plan.price}
                          </span>
                          <span className="text-sm font-semibold leading-6 text-gray-600">
                            원/월
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-x-3">
                        <Check
                          className="h-5 w-5 flex-none text-primary-600"
                          aria-hidden="true"
                        />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    asChild
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 컨설팅 패키지 */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700">
              <Headphones className="h-4 w-4" />
              SCM 전문가 컨설팅
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              솔루션 + 컨설팅, 함께하면 더 강력합니다
            </h2>
            <p className="mt-4 text-gray-600">
              FloStok 솔루션에 22년 경력 SCM 전문가의 컨설팅을 결합하여
              <br />
              귀사의 공급망을 근본적으로 개선합니다
            </p>
          </div>

          {/* 무료 진단 배너 */}
          <div className="mt-12 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 p-8 text-center text-white sm:p-12">
            <h3 className="text-2xl font-bold">무료 재고 진단</h3>
            <p className="mt-2 text-primary-100">
              귀사의 재고 현황을 진단하고 개선 가능성을 무료로 알려드립니다
            </p>
            <p className="mt-1 text-sm text-primary-200">
              화상 1회 (2~3시간) + 간이 진단 보고서 제공
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-6"
              asChild
            >
              <Link href="/contact">무료 진단 신청하기</Link>
            </Button>
          </div>

          {/* 컨설팅 패키지 카드 */}
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {/* Light */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Light</CardTitle>
                <CardDescription>
                  연매출 5~15억 기업을 위한 기본 운영 패키지
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-x-1">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      50
                    </span>
                    <span className="text-sm font-semibold text-gray-600">
                      만원/월
                    </span>
                  </div>
                </div>
                <ul className="space-y-3 text-sm">
                  {[
                    "FloStok Pro 포함",
                    "화상 컨설팅 월 1회",
                    "월간 기본 리포트",
                    "이메일 Q&A",
                  ].map((f) => (
                    <li key={f} className="flex gap-x-3">
                      <Check className="h-5 w-5 flex-none text-primary-600" />
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/contact">문의하기</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Standard */}
            <Card className="border-primary-600 ring-2 ring-primary-600">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Standard</CardTitle>
                  <Badge className="bg-primary-600">추천</Badge>
                </div>
                <CardDescription>
                  연매출 15~50억 기업을 위한 표준 운영 패키지
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-x-1">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      80
                    </span>
                    <span className="text-sm font-semibold text-gray-600">
                      만원/월
                    </span>
                  </div>
                </div>
                <ul className="space-y-3 text-sm">
                  {[
                    "FloStok Pro 포함",
                    "화상 컨설팅 월 2회",
                    "월간 KPI 분석 리포트",
                    "분기 담당자 교육",
                    "우선 이메일/전화 지원",
                  ].map((f) => (
                    <li key={f} className="flex gap-x-3">
                      <Check className="h-5 w-5 flex-none text-primary-600" />
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" asChild>
                  <Link href="/contact">문의하기</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Premium */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Premium</CardTitle>
                <CardDescription>
                  연매출 50억+ 기업을 위한 프리미엄 패키지
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-x-1">
                    <span className="text-4xl font-bold tracking-tight text-gray-900">
                      120
                    </span>
                    <span className="text-sm font-semibold text-gray-600">
                      만원/월
                    </span>
                  </div>
                </div>
                <ul className="space-y-3 text-sm">
                  {[
                    "FloStok Pro 포함",
                    "방문 컨설팅 월 1회 + 화상 2회",
                    "월간 심화 분석 리포트",
                    "분기 담당자 교육",
                    "S&OP 프로세스 설계",
                    "24시간 긴급 지원",
                  ].map((f) => (
                    <li key={f} className="flex gap-x-3">
                      <Check className="h-5 w-5 flex-none text-primary-600" />
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/contact">문의하기</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* 가격 정당화 */}
          <div className="mt-12 rounded-xl border bg-slate-50 p-6">
            <h4 className="text-sm font-semibold text-gray-900">
              왜 이 가격인가요?
            </h4>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  Light 월 50만원
                </p>
                <p className="mt-1">
                  월급 250만원 신입 SCM 담당자 대비 1/5 비용으로, AI 솔루션까지
                  포함된 전문가 서비스를 받을 수 있습니다.
                </p>
              </div>
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  Standard 월 80만원
                </p>
                <p className="mt-1">
                  경력 SCM 담당자(월 400만+) 대비 1/5 비용으로, 파트타임
                  전문가의 밀착 관리와 AI 분석을 동시에 제공합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 정부 바우처 안내 */}
          <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-6">
            <h4 className="text-sm font-semibold text-blue-900">
              정부 바우처로 비용 부담을 줄이세요
            </h4>
            <p className="mt-2 text-sm text-blue-700">
              혁신바우처, 스마트공장 등 정부 지원 사업을 활용하면 기업
              자부담을 10~50%까지 줄일 수 있습니다. 정부 바우처 활용에
              관심이 있으시면 문의해 주세요. 바우처 신청 절차 안내부터
              프로젝트 설계까지 함께 준비해 드립니다.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 border-blue-300 text-blue-700 hover:bg-blue-100"
              asChild
            >
              <Link href="/contact">바우처 상담 문의</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
