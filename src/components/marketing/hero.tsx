import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            AI가 관리하는
            <br />
            스마트한 재고 시스템
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            복잡한 재고 관리, 수동 발주에 지치셨나요?
            <br />
            FloStok이 AI로 최적의 재고 수준을 유지하고 자동으로 발주를 추천합니다.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Button size="lg" asChild>
              <Link href="/signup">
                무료로 시작하기 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">자세히 알아보기</Link>
            </Button>
          </div>
        </div>

        {/* Dashboard Screenshot Mockup */}
        <div className="mt-16 flow-root sm:mt-24">
          <div className="relative -m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
            <div className="aspect-[16/9] w-full rounded-md bg-white shadow-2xl ring-1 ring-gray-900/10">
              <div className="flex h-full flex-col items-center justify-center p-8 text-gray-400">
                <div className="text-center">
                  <div className="text-6xl font-bold text-gray-300">FloStok</div>
                  <p className="mt-4 text-sm">대시보드 스크린샷 영역</p>
                  <p className="mt-2 text-xs text-gray-300">
                    실제 배포 시 대시보드 캡처 이미지로 교체
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
        <div
          className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-blue-200 to-blue-400 opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>
    </section>
  )
}
