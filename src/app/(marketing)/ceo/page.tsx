import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPANY,
  CEO_HIGHLIGHT,
  CEO_CAREER_COMPANIES,
  CEO_SKILLS,
  CEO_INDUSTRIES,
} from "@/lib/constants/homepage-data";

export const metadata: Metadata = {
  title: `대표 소개 | ${COMPANY.name}`,
  description: `${CEO_HIGHLIGHT.name} 대표 - 22년 SCM 현장 경력의 전문가`,
};

export default function CeoPage() {
  return (
    <div>
      {/* 헤더 */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:gap-12">
            {/* 프로필 */}
            <div className="flex h-40 w-40 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600">
              <span className="text-6xl font-bold text-white">
                {CEO_HIGHLIGHT.name[0]}
              </span>
            </div>
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-bold text-white sm:text-5xl">
                {CEO_HIGHLIGHT.name}
              </h1>
              <p className="mt-2 text-lg text-gray-400">
                {CEO_HIGHLIGHT.title}
              </p>
              <p className="mt-4 max-w-lg text-gray-300 leading-7">
                {CEO_HIGHLIGHT.summary}
              </p>

              {/* Stats */}
              <div className="mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
                {CEO_HIGHLIGHT.stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-white/10 px-4 py-3 text-center backdrop-blur-sm"
                  >
                    <div className="text-xl font-bold text-white">
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-400">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 인용구 */}
      <section className="bg-primary-50 px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <blockquote className="text-xl font-medium italic text-gray-800">
            &ldquo;{CEO_HIGHLIGHT.quote}&rdquo;
          </blockquote>
        </div>
      </section>

      {/* 주요 경력 */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            주요 경력
          </h2>
          <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-4">
            {CEO_CAREER_COMPANIES.map((company) => (
              <div
                key={company.name}
                className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-3 text-center"
              >
                <p className="text-base font-semibold text-gray-800">
                  {company.name}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {company.industry}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 핵심 역량 & 산업 경험 */}
      <section className="bg-slate-50 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* 핵심 역량 */}
            <div>
              <h3 className="text-xl font-bold text-gray-900">핵심 역량</h3>
              <div className="mt-6 flex flex-wrap gap-2">
                {CEO_SKILLS.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-primary-100 px-3 py-1 text-sm font-medium text-primary-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* 산업 경험 */}
            <div>
              <h3 className="text-xl font-bold text-gray-900">산업 경험</h3>
              <div className="mt-6 flex flex-wrap gap-2">
                {CEO_INDUSTRIES.map((industry) => (
                  <span
                    key={industry}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700"
                  >
                    {industry}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-600 px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white">
            22년 현장 경험으로 귀사의 공급망을 진단해 드립니다
          </h2>
          <div className="mt-8">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/contact">
                무료 재고 진단 신청
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
