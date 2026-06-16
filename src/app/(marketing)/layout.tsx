import { Navbar } from "@/components/marketing/navbar";
import { FooterMarketing } from "@/components/marketing/footer-marketing";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <FooterMarketing />
    </div>
  );
}
