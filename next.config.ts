import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 스트릭트 모드: 개발 환경에서 추가 검사
  reactStrictMode: true,

  // 이미지 최적화
  images: {
    formats: ["image/avif", "image/webp"],
    unoptimized: false,
    // 외부 이미지 도메인 허용 (필요시 추가)
    remotePatterns: [],
  },

  // 온디맨드 엔트리 설정: 개발 시 성능 개선
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },

  // 컴파일러 최적화
  compiler: {
    // 프로덕션에서 console 제거
    removeConsole: process.env.NODE_ENV === "production",
  },

  // CI/CD에서 lint/type-check를 별도 실행하므로 빌드 시 생략 (메모리 절약)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 소스맵은 디버깅 시에만 활성화 (빌드 메모리/시간 절약)
  productionBrowserSourceMaps: false,

  // CI/CD에서 type-check를 별도 실행하므로 빌드 시 생략 (메모리 절약)
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: "./tsconfig.json",
  },

  // 실험적 기능 최적화
  experimental: {
    // PPR (Partial Prerendering) — Next.js 15 실험적 기능
    // ppr: false, // 안정화 시 true로 변경

    // 서버 액션 최적화
    serverActions: {
      bodySizeLimit: "2mb", // 기본 1mb에서 증가
    },

    // 패키지 임포트 최적화 (트리셰이킹 강화)
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "sonner",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-popover",
      "@radix-ui/react-checkbox",
    ],
  },

  // 웹팩 설정
  webpack: (config) => {
    return config;
  },

  // 헤더 최적화 (보안 + 캐싱)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
      {
        // 정적 자산 장기 캐싱 (JS, CSS, 이미지)
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
