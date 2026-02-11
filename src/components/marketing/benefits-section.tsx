import { BENEFITS } from "@/lib/constants/homepage-data";

export function BenefitsSection() {
  return (
    <section id="benefits" className="bg-primary-900 px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            검증된 도입 효과
          </h2>
          <p className="mt-6 text-lg leading-8 text-primary-100">
            데이터 기반 SCM 체계 구축을 통해 실현 가능한 성과
          </p>
        </div>

        <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-4 text-center sm:mt-16 sm:gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-4">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.label}
              className="mx-auto flex max-w-xs flex-col gap-y-2 rounded-2xl bg-white/10 p-4 backdrop-blur-sm sm:gap-y-4 sm:p-8"
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
              <dd className="order-first text-3xl font-semibold tracking-tight text-white sm:text-5xl">
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
