import { Card, CardContent } from "@/components/ui/card";
import { TESTIMONIALS } from "@/lib/constants/homepage-data";

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-primary-600">
            고객 후기
          </h2>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">
            고객이 말하는 Stock & Logis
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <Card key={testimonial.author.name} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col pt-6">
                <blockquote className="flex-1">
                  <p className="text-lg leading-8 text-gray-900">
                    &ldquo;{testimonial.body}&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-x-4 border-t border-gray-200 pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
                    <span className="text-sm font-semibold text-primary-600">
                      {testimonial.author.name[0]}
                    </span>
                  </div>
                  <div className="text-sm leading-6">
                    <div className="font-semibold text-gray-900">
                      {testimonial.author.name}
                    </div>
                    <div className="text-gray-600">
                      {testimonial.author.position} ·{" "}
                      {testimonial.author.company}
                    </div>
                  </div>
                </figcaption>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
