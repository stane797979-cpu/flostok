import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CTA } from "@/lib/constants/homepage-data";

export function CtaSection() {
  return (
    <section
      id="cta"
      className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-24 sm:py-32 lg:px-8"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {CTA.headline}
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-100 whitespace-pre-line">
          {CTA.subCopy}
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Button size="lg" variant="secondary" asChild>
            <Link href="/contact">
              {CTA.ctaPrimary}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white bg-transparent text-white hover:bg-white/10"
            asChild
          >
            <Link href="/solution">{CTA.ctaSecondary}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
