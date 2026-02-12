import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AnalyticsProvider from "@/components/analytics-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = "https://flostok-production.up.railway.app";

export const metadata: Metadata = {
  title: {
    default: "Stock & Logis | SCM 컨설팅 · 교육 · AI 재고관리 솔루션",
    template: "%s | Stock & Logis",
  },
  description:
    "22년 현장 경력의 SCM 전문가가 직접 설계한 컨설팅, 교육, 그리고 AI 솔루션. 재고는 줄이고 이익은 높이는 SCM의 정석.",
  keywords: [
    "SCM 컨설팅",
    "재고관리",
    "물류 컨설팅",
    "수요예측",
    "안전재고",
    "발주 자동화",
    "ABC XYZ 분석",
    "S&OP",
    "공급망관리",
    "AI 재고관리",
    "FloStok",
  ],
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "Stock & Logis",
    title: "Stock & Logis | SCM 컨설팅 · 교육 · AI 재고관리 솔루션",
    description:
      "22년 현장 경력의 SCM 전문가가 직접 설계한 컨설팅, 교육, 그리고 AI 솔루션. 재고는 줄이고 이익은 높이는 SCM의 정석.",
    images: [{ url: "/logo.jpg", width: 480, height: 120, alt: "Stock & Logis" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
