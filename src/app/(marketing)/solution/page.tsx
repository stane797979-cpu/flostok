import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    </div>
  );
}
