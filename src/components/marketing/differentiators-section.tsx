import { DIFFERENTIATORS } from "@/lib/constants/homepage-data";

export function DifferentiatorsSection() {
  return (
    <section
      id="differentiators"
      className="bg-white px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">
            왜 Stock & Logis인가
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            타 업체와 다른 4가지 이유
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2">
          {DIFFERENTIATORS.map((item, index) => (
            <div
              key={item.title}
              className="relative rounded-2xl border border-gray-100 bg-gray-50 p-8 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-bold text-primary-600">
                  0{index + 1}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
