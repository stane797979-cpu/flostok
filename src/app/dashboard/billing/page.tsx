/**
 * 결제 및 구독 관리 페이지
 * - 현재 플랜 표시 (DB 기반)
 * - 관리자 플랜 변경 기능
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Construction } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { BillingClient } from "./_components/billing-client";

const PLAN_INFO: Record<string, { label: string; description: string; color: string }> = {
  free: { label: "Free", description: "무료 체험 중", color: "bg-slate-100 text-slate-700" },
  starter: { label: "Starter", description: "스타터 플랜", color: "bg-blue-100 text-blue-700" },
  pro: { label: "Pro", description: "프로 플랜", color: "bg-purple-100 text-purple-700" },
  enterprise: { label: "Enterprise", description: "무제한 이용 가능", color: "bg-green-100 text-green-700" },
};

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan = "free";
  let orgId = "";

  if (user) {
    // 사용자의 조직 정보 조회
    const { data: profile } = await supabase
      .from("users")
      .select("organization_id, role")
      .eq("auth_id", user.id)
      .single();

    if (profile?.organization_id) {
      orgId = profile.organization_id;
      const [org] = await db
        .select({ plan: organizations.plan })
        .from(organizations)
        .where(eq(organizations.id, profile.organization_id))
        .limit(1);

      if (org) {
        currentPlan = org.plan;
      }
    }
  }

  const planInfo = PLAN_INFO[currentPlan] || PLAN_INFO.free;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">결제 및 구독</h1>
        <p className="text-muted-foreground">구독 플랜을 관리하고 결제 내역을 확인하세요</p>
      </div>

      {/* 현재 플랜 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            현재 구독 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge className={planInfo.color + " text-sm"}>
              {planInfo.label} 플랜
            </Badge>
            <span className="text-sm text-muted-foreground">{planInfo.description}</span>
          </div>
        </CardContent>
      </Card>

      {/* 플랜 변경 (관리자용) */}
      <BillingClient currentPlan={currentPlan} orgId={orgId} />

      {/* 결제 시스템 안내 */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Construction className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold text-muted-foreground">결제 시스템 준비 중</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            PortOne + 토스페이먼츠 결제 연동을 준비하고 있습니다.
            현재는 관리자가 직접 플랜을 변경할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
