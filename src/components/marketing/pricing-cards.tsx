import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'FREE',
    price: '0',
    description: '개인 및 소규모 팀을 위한 무료 플랜',
    features: [
      '제품 50개까지',
      '기본 재고 관리',
      '수동 발주',
      '기본 리포트',
      '이메일 지원',
    ],
    cta: '무료 시작',
    href: '/signup',
    highlighted: false,
  },
  {
    name: 'STARTER',
    price: '29,000',
    description: '성장하는 중소기업을 위한 스타터 플랜',
    features: [
      '제품 500개까지',
      '자동 발주 추천',
      'ABC/XYZ 분석',
      '수요 예측 (기본)',
      '이메일 알림',
      '우선 지원',
    ],
    cta: '14일 무료 체험',
    href: '/signup?plan=starter',
    highlighted: false,
  },
  {
    name: 'PRO',
    price: '79,000',
    description: '전문적인 재고 관리가 필요한 기업',
    features: [
      '제품 무제한',
      'AI 자동 발주',
      '고급 분석 (ABC/XYZ/EOQ)',
      '수요 예측 (고급)',
      '이메일 + SMS 알림',
      'AI 채팅 어시스턴트',
      '시나리오 시뮬레이션',
      '전담 지원',
    ],
    cta: '14일 무료 체험',
    href: '/signup?plan=pro',
    highlighted: true,
  },
  {
    name: 'ENTERPRISE',
    price: '맞춤',
    description: '대기업 및 복잡한 공급망 관리',
    features: [
      'PRO 플랜의 모든 기능',
      '멀티 조직 관리',
      '맞춤형 통합 (ERP 등)',
      '전용 서버 옵션',
      '24/7 전화 지원',
      '온보딩 교육',
      'SLA 보장',
    ],
    cta: '영업팀 문의',
    href: '/contact',
    highlighted: false,
  },
]

export function PricingCards() {
  return (
    <section id="pricing" className="bg-gray-50 px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-blue-600">가격</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            모든 규모의 비즈니스를 위한 플랜
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            무료 플랜부터 엔터프라이즈까지, 비즈니스에 맞는 플랜을 선택하세요.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlighted ? 'border-blue-600 ring-2 ring-blue-600' : ''}
            >
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="flex items-baseline gap-x-2">
                    {plan.price === '맞춤' ? (
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
                      <Check className="h-5 w-5 flex-none text-blue-600" aria-hidden="true" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
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
  )
}
