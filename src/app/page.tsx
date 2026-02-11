import { Navbar } from "@/components/marketing/navbar";
import { FooterMarketing } from "@/components/marketing/footer-marketing";
import { HeroConsulting } from "@/components/marketing/hero-consulting";
import { ServicesOverview } from "@/components/marketing/services-overview";
import { CeoHighlight } from "@/components/marketing/ceo-highlight";
import { CurriculumPreview } from "@/components/marketing/curriculum-preview";
import { SolutionBento } from "@/components/marketing/solution-bento";
import { DifferentiatorsSection } from "@/components/marketing/differentiators-section";
import { BenefitsSection } from "@/components/marketing/benefits-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import { CtaSection } from "@/components/marketing/cta-section";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroConsulting />
        <ServicesOverview />
        <CeoHighlight />
        <CurriculumPreview />
        <SolutionBento />
        <DifferentiatorsSection />
        <BenefitsSection />
        <TestimonialsSection />
        <CtaSection />
      </main>
      <FooterMarketing />
    </div>
  );
}
