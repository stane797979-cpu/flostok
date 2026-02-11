import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPANY, CURRICULUM } from "@/lib/constants/homepage-data";

export const metadata: Metadata = {
  title: `커리큘럼 | ${COMPANY.name}`,
  description:
    "수요예측부터 재고관리까지, 4단계로 구성된 SCM 실무 교육 커리큘럼",
};

export default function CurriculumPage() {
  return (
    <div>
      {/* 헤더 */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold text-primary-400">Curriculum</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            SCM 실무 교육 커리큘럼
          </h1>
          <p className="mt-6 text-lg text-gray-300">
            22년간 제조·유통 현장에서 검증된 실전 노하우를
            <br />
            실무자가 바로 적용할 수 있는 4단계 과정으로 전달합니다.
          </p>
        </div>
      </section>

      {/* 4단계 커리큘럼 상세 */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-20">
          {CURRICULUM.map((step) => (
            <div key={step.step} className="relative">
              {/* 스텝 번호 & 제목 */}
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-600 text-xl font-bold text-white">
                  {step.step}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {step.title}
                  </h2>
                  <p className="text-sm font-medium text-primary-500">
                    {step.subtitle}
                  </p>
                </div>
              </div>

              {/* 설명 */}
              <p className="mt-6 text-gray-600 leading-7">
                {step.description}
              </p>

              {/* 토픽 목록 */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {step.topics.map((topic) => (
                  <div key={topic} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary-500" />
                    <span className="text-sm text-gray-700">{topic}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-50 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            교육 프로그램에 관심이 있으신가요?
          </h2>
          <p className="mt-6 text-lg text-gray-600">
            기업 맞춤형 교육, 그룹 교육, 1:1 코칭 등 다양한 형태로 진행 가능합니다.
          </p>
          <div className="mt-10">
            <Button size="lg" asChild>
              <Link href="/contact">
                교육 문의하기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
