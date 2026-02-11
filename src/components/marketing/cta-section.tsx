import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CTA } from "@/lib/constants/homepage-data";

export function CtaSection() {
  return (
    <section
      id="cta"
      className="bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
          {CTA.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-primary-100 whitespace-pre-line sm:mt-6 sm:text-lg sm:leading-8">
          {CTA.subCopy}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-x-6">
          <Button size="lg" variant="secondary" className="w-full sm:w-auto" asChild>
            <Link href="/contact">
              {CTA.ctaPrimary}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full border-white bg-transparent text-white hover:bg-white/10 sm:w-auto"
            asChild
          >
            <Link href="/solution">{CTA.ctaSecondary}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
