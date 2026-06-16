import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import AnalyticsProvider from "@/components/analytics-provider";

export const metadata: Metadata = {
  title: "FloStok - AI SCM 솔루션",
  description: "AI 기반 재고 관리 및 자동 발주 추천 SaaS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" forcedTheme="light" disableTransitionOnChange>
          <AnalyticsProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
