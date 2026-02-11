import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOLUTION_FEATURES, COMPANY } from "@/lib/constants/homepage-data";

export function SolutionBento() {
  const largeFeatures = SOLUTION_FEATURES.filter((f) => f.size === "large");
  const smallFeatures = SOLUTION_FEATURES.filter((f) => f.size === "small");

  return (
    <section
      id="solution"
      className="bg-slate-50 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">
            {COMPANY.solutionName}
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            AI가 관리하는 스마트한 재고 시스템
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            22년 현장 경험이 녹아든 SCM 로직 + AI 기술의 결합
          </p>
        </div>

        {/* 대형 카드 - 핵심 변별력 */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
          {largeFeatures.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-50 p-8 ring-1 ring-primary-100 transition-shadow hover:shadow-lg"
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

        {/* 소형 카드 - 부가 기능 */}
        <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {smallFeatures.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 rounded-xl border bg-white p-5 transition-shadow hover:shadow-sm"
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

        <div className="mt-12 text-center">
          <Link
            href="/solution"
            className="inline-flex items-center text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            솔루션 자세히 보기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
