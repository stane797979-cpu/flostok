"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, Bell, FileText, BarChart3, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getAlerts } from "@/server/actions/alerts";

export function QuickActions() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    getAlerts({ limit: 1 })
      .then((result) => setUnreadCount(result.unreadCount))
      .catch(() => setUnreadCount(0));
  }, []);

  const alertDescription =
    unreadCount === null
      ? "알림 확인"
      : unreadCount > 0
        ? `미확인 ${unreadCount}건`
        : "새 알림 없음";

  const actions = [
    {
      icon: ShoppingCart,
      label: "신규 발주",
      description: "발주서 생성",
      variant: "outline" as const,
      href: "/dashboard/orders",
      className: "border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary",
    },
    {
      icon: Package,
      label: "제품 추가",
      description: "신규 SKU 등록",
      variant: "outline" as const,
      href: "/dashboard/products",
    },
    {
      icon: Bell,
      label: "알림 보기",
      description: alertDescription,
      variant: "outline" as const,
      href: "/dashboard/alerts",
    },
    {
      icon: FileText,
      label: "보고서",
      description: "재고 현황",
      variant: "outline" as const,
      href: "/dashboard/inventory",
    },
    {
      icon: BarChart3,
      label: "분석",
      description: "ABC/XYZ",
      variant: "outline" as const,
      href: "/dashboard/analytics",
    },
    {
      icon: Settings,
      label: "설정",
      description: "시스템 설정",
      variant: "outline" as const,
      href: "/dashboard/settings",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>빠른 액션</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.label}
                variant={action.variant}
                onClick={() => router.push(action.href)}
                className={cn("h-auto flex-col gap-2 p-4", action.className)}
              >
                <Icon className="h-5 w-5" />
                <div className="text-center">
                  <div className="text-sm font-medium">{action.label}</div>
                  <div className="text-xs text-slate-500">{action.description}</div>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
