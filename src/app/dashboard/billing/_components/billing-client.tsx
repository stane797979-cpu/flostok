"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updateOrganizationPlan } from "@/server/actions/billing";
import { cn } from "@/lib/utils";

interface BillingClientProps {
  currentPlan: string;
  orgId: string;
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "무료",
    description: "시작하기",
    features: ["제품 10개", "기본 재고 관리", "수동 발주"],
    color: "border-slate-200",
  },
  {
    id: "starter",
    name: "Starter",
    price: "₩29,000/월",
    description: "소규모 사업",
    features: ["제품 100개", "수요예측", "자동발주 추천", "엑셀 다운로드"],
    color: "border-blue-200",
  },
  {
    id: "pro",
    name: "Pro",
    price: "₩79,000/월",
    description: "성장 중인 사업",
    features: ["제품 무제한", "AI 수요예측", "자동발주", "ABC-XYZ 분석", "멀티 사용자"],
    color: "border-purple-200",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "무제한",
    description: "대규모/맞춤형",
    features: ["모든 Pro 기능", "무제한 사용자", "API 연동", "전담 지원", "커스텀 리포트"],
    color: "border-green-200",
    recommended: true,
  },
];

export function BillingClient({ currentPlan, orgId }: BillingClientProps) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handlePlanChange = async (planId: string) => {
    if (planId === currentPlan) return;
    setIsUpdating(true);
    try {
      const result = await updateOrganizationPlan(orgId, planId);
      if (result.success) {
        setSelectedPlan(planId);
        toast({
          title: "플랜 변경 완료",
          description: `${PLANS.find((p) => p.id === planId)?.name} 플랜으로 변경되었습니다.`,
        });
        // 서버 컴포넌트 데이터 재검증
        router.refresh();
      } else {
        toast({
          title: "플랜 변경 실패",
          description: result.error || "플랜 변경 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "오류",
        description: "플랜 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          플랜 선택
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-lg border-2 p-4 transition-all",
                plan.color,
                currentPlan === plan.id && "ring-2 ring-primary ring-offset-2",
                plan.recommended && "shadow-md"
              )}
            >
              {plan.recommended && (
                <Badge className="absolute -top-2.5 right-3 bg-green-600 text-xs">추천</Badge>
              )}
              <div className="mb-3">
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div className="mb-4 text-xl font-bold">{plan.price}</div>
              <ul className="mb-4 space-y-1.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={currentPlan === plan.id ? "secondary" : "default"}
                size="sm"
                className="w-full"
                disabled={currentPlan === plan.id || isUpdating}
                onClick={() => handlePlanChange(plan.id)}
              >
                {currentPlan === plan.id ? "현재 플랜" : "선택"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
