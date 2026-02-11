import { BENEFITS } from "@/lib/constants/homepage-data";

export function BenefitsSection() {
  return (
    <section id="benefits" className="bg-primary-900 px-6 py-24 sm:py-32 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            검증된 도입 효과
          </h2>
          <p className="mt-6 text-lg leading-8 text-primary-100">
            데이터 기반 SCM 체계 구축을 통해 실현 가능한 성과
          </p>
        </div>

        <dl className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 text-center sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.label}
              className="mx-auto flex max-w-xs flex-col gap-y-4 rounded-2xl bg-white/10 p-8 backdrop-blur-sm"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                <benefit.icon
                  className="h-6 w-6 text-white"
                  aria-hidden="true"
                />
              </div>
              <dt className="text-base leading-7 text-primary-100">
                {benefit.label}
              </dt>
              <dd className="order-first text-5xl font-semibold tracking-tight text-white">
                {benefit.value}
              </dd>
              <p className="text-sm leading-6 text-primary-200">
                {benefit.description}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
