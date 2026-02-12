import type { Metadata } from "next";
import { ABOUT, HISTORY, COMPANY, DIFFERENTIATORS } from "@/lib/constants/homepage-data";

export const metadata: Metadata = {
  title: `회사 소개 | ${COMPANY.name}`,
  description: ABOUT.visionDetail,
};

export default function AboutPage() {
  return (
    <div>
      {/* 비전 / 미션 */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-lg font-semibold text-primary-400 sm:text-xl">About Us</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {COMPANY.name}
          </h1>
          <p className="mt-2 text-lg italic text-gray-400">
            {COMPANY.slogan}
          </p>
        </div>
      </section>

      {/* 비전 & 미션 */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="rounded-2xl border border-primary-100 bg-primary-50 p-8">
            <p className="text-sm font-semibold text-primary-600">Vision</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              {ABOUT.vision}
            </h2>
            <p className="mt-4 text-gray-600 leading-7">
              {ABOUT.visionDetail}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
            <p className="text-sm font-semibold text-primary-600">Mission</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              {ABOUT.mission}
            </h2>
            <p className="mt-4 text-gray-600 leading-7">
              {ABOUT.missionDetail}
            </p>
          </div>
        </div>
      </section>

      {/* 핵심 가치 */}
      <section className="bg-slate-50 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            핵심 가치
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {ABOUT.values.map((value) => (
              <div key={value.title} className="rounded-xl bg-white p-8 shadow-sm">
                <p className="text-xs font-semibold text-primary-500">
                  {value.titleEn}
                </p>
                <h3 className="mt-2 text-xl font-bold text-gray-900">
                  {value.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-gray-600">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 변별력 */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            타 업체와 다른 4가지 이유
          </h2>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2">
            {DIFFERENTIATORS.map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-gray-100 bg-gray-50 p-8"
              >
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-sm font-bold text-primary-600">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-gray-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 연혁 */}
      <section className="bg-slate-50 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            연혁
          </h2>
          <div className="mt-16 space-y-0">
            {HISTORY.map((item, index) => (
              <div key={item.year} className="relative flex gap-6 pb-12">
                {/* 타임라인 라인 */}
                {index < HISTORY.length - 1 && (
                  <div className="absolute left-[1.1rem] top-10 h-full w-0.5 bg-primary-200" />
                )}
                {/* 연도 원형 */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                  &apos;{item.year.slice(-2)}
                </div>
                {/* 내용 */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {item.year}
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {item.events.map((event) => (
                      <li
                        key={event}
                        className="text-sm leading-6 text-gray-600"
                      >
                        {event}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
