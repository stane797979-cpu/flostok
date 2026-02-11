import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { CURRICULUM } from "@/lib/constants/homepage-data";

export function CurriculumPreview() {
  return (
    <section
      id="curriculum"
      className="bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">
            커리큘럼
          </h2>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
            SCM 실무 역량을 체계적으로
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            수요예측부터 재고관리까지, 4단계로 구성된 실전 중심 교육 과정
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-4 sm:mt-16 sm:gap-6 lg:grid-cols-4">
          {CURRICULUM.map((item, index) => (
            <div key={item.step} className="relative flex flex-col items-center">
              {/* 연결 화살표 (데스크톱, 마지막 아이템 제외) */}
              {index < CURRICULUM.length - 1 && (
                <div className="absolute -right-5 top-10 z-10 hidden lg:block">
                  <ChevronRight className="h-6 w-6 text-primary-300" />
                </div>
              )}

              {/* 카드 */}
              <div className="flex w-full flex-col items-center rounded-xl border bg-white p-4 text-center transition-shadow hover:shadow-md sm:p-6">
                {/* 스텝 번호 */}
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  {item.step}
                </div>

                <h3 className="text-lg font-bold text-gray-900">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs font-medium text-primary-500">
                  {item.subtitle}
                </p>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {item.description.length > 80
                    ? item.description.slice(0, 80) + "..."
                    : item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/curriculum"
            className="inline-flex items-center text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            커리큘럼 상세 보기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
