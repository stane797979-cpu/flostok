"use client";

import { useEffect, useRef, useState } from "react";
import { initPostHog, identifyUser, setSuperProperties } from "@/lib/analytics";
import { initSentry, setUser, clearUser } from "@/lib/sentry";
import { createClient } from "@/lib/supabase/client";

/**
 * 분석 및 에러 추적 초기화 컴포넌트
 * - PostHog: 분석, 세션 리플레이, 피처 플래그
 * - Sentry: 에러 추적, 성능 모니터링
 */
export default function AnalyticsProvider() {
  const supabaseRef = useRef(createClient());
  const [userId, setUserId] = useState<string | null>(null);

  // Sentry 및 PostHog 초기화
  useEffect(() => {
    // Sentry 초기화 (동적 import, DSN 없으면 no-op)
    initSentry();

    // PostHog 초기화 (API 키 없으면 no-op)
    initPostHog();

    // 슈퍼 프로퍼티 설정
    setSuperProperties({
      environment: process.env.NODE_ENV,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
      timestamp: new Date().toISOString(),
    });
  }, []);

  // 사용자 인증 상태 추적
  useEffect(() => {
    const supabase = supabaseRef.current;

    const getCurrentUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);
          identifyUser(user.id, {
            email: user.email,
            name: user.user_metadata?.name || user.email?.split("@")[0],
            organizationId: user.user_metadata?.organization_id,
            role: user.user_metadata?.role || "viewer",
            createdAt: user.created_at,
          });
          setUser(user.id, user.email || undefined, user.user_metadata?.name || undefined);
        } else {
          if (userId) {
            if (typeof window !== "undefined" && window.posthog) {
              window.posthog.reset();
            }
            clearUser();
          }
          setUserId(null);
        }
      } catch (error) {
        console.error("사용자 정보 조회 실패:", error);
      }
    };

    getCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        identifyUser(session.user.id, { email: session.user.email });
        setUser(session.user.id, session.user.email || undefined);
      } else {
        setUserId(null);
        if (typeof window !== "undefined" && window.posthog) {
          window.posthog.reset();
        }
        clearUser();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
