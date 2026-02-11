import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Quote } from "lucide-react";
import { CEO_HIGHLIGHT } from "@/lib/constants/homepage-data";

export function CeoHighlight() {
  return (
    <section id="ceo" className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">
            대표 소개
          </h2>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
            현장을 아는 SCM 전문가
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* 프로필 이미지 영역 */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="h-48 w-48 overflow-hidden rounded-full ring-4 ring-primary-100 sm:h-64 sm:w-64">
                <Image
                  src="/ceo-profile.png"
                  alt={CEO_HIGHLIGHT.name}
                  width={256}
                  height={256}
                  className="h-full w-full object-cover object-[center_35%]"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 rounded-full bg-white px-4 py-2 shadow-lg">
                <span className="text-sm font-semibold text-gray-900">
                  22년+ SCM
                </span>
              </div>
            </div>
          </div>

          {/* 소개 텍스트 */}
          <div>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                {CEO_HIGHLIGHT.name}
              </h3>
              <p className="text-gray-500">{CEO_HIGHLIGHT.title}</p>
            </div>

            <div className="mb-6 flex gap-3">
              <Quote className="mt-1 h-8 w-8 flex-shrink-0 text-primary-300" />
              <blockquote className="text-lg italic text-gray-700">
                {CEO_HIGHLIGHT.quote}
              </blockquote>
            </div>

            <p className="mb-8 text-gray-600 leading-7">
              {CEO_HIGHLIGHT.summary}
            </p>

            {/* Stats */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {CEO_HIGHLIGHT.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg bg-white p-4 text-center shadow-sm"
                >
                  <div className="text-2xl font-bold text-primary-600">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/ceo"
              className="inline-flex items-center text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
            >
              경력 상세 보기
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
