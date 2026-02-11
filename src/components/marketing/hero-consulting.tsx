import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HERO, COMPANY } from "@/lib/constants/homepage-data";

export function HeroConsulting() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          {/* 슬로건 뱃지 */}
          <div className="mb-8 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm">
            {COMPANY.slogan}
          </div>

          {/* 헤드라인 */}
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {HERO.headline.split("\n").map((line, i) => (
              <span key={i}>
                {line}
                {i === 0 && <br />}
              </span>
            ))}
          </h1>

          {/* 서브카피 */}
          <p className="mt-6 text-lg leading-8 text-gray-300">
            {HERO.subCopy.split("\n").map((line, i) => (
              <span key={i}>
                {line}
                {i === 0 && <br />}
              </span>
            ))}
          </p>

          {/* CTA */}
          <div className="mt-10 flex items-center justify-center gap-x-4">
            <Button size="lg" asChild>
              <Link href="/contact">
                {HERO.ctaPrimary}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white bg-white/10 text-white hover:bg-white/20"
              asChild
            >
              <Link href="/solution">{HERO.ctaSecondary}</Link>
            </Button>
          </div>
        </div>

        {/* 대시보드 미리보기 */}
        <div className="mt-16 flow-root sm:mt-24">
          <div className="relative -m-2 rounded-xl bg-white/5 p-2 ring-1 ring-inset ring-white/10 lg:-m-4 lg:rounded-2xl lg:p-4">
            <div className="aspect-[16/9] w-full rounded-md bg-slate-800 shadow-2xl ring-1 ring-white/10">
              <div className="flex h-full flex-col items-center justify-center p-8 text-gray-500">
                <div className="text-center">
                  <div className="text-6xl font-bold text-gray-600">
                    Stock &amp; Logis
                  </div>
                  <p className="mt-4 text-sm text-gray-500">
                    대시보드 스크린샷 영역
                  </p>
                  <p className="mt-2 text-xs text-gray-600">
                    실제 배포 시 대시보드 캡처 이미지로 교체
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-x-0 top-[calc(100%-20rem)] -z-10 transform-gpu overflow-hidden blur-3xl">
        <div
          className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-indigo-500 to-purple-600 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>
    </section>
  );
}
