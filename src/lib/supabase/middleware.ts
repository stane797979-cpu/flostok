import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // 인증이 필요한 라우트 판별 (getUser 호출 전에 먼저 확인)
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  // 공개 라우트는 인증 체크 없이 바로 통과 (50-200ms 절감)
  if (!isAuthRoute && !isProtectedRoute) {
    return supabaseResponse;
  }

  // Supabase URL이 dummy이거나 미설정인 경우 인증 우회 (개발 모드)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes("dummy") ||
    supabaseKey.includes("dummy")
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: 인증/보호 라우트에서만 호출 — 세션 갱신
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 미인증 사용자가 보호된 라우트 접근 시 로그인으로 리다이렉트
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 인증된 사용자가 auth 라우트 접근 시 대시보드로 리다이렉트
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
