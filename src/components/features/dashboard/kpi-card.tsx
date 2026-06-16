"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Calendar,
  CheckCircle2,
  Package,
  Truck,
  DollarSign,
  Percent,
  Clock,
  AlertCircle,
} from "lucide-react";

// 아이콘 이름을 문자열로 받아서 매핑
const iconMap = {
  "bar-chart": BarChart3,
  calendar: Calendar,
  "check-circle": CheckCircle2,
  package: Package,
  truck: Truck,
  dollar: DollarSign,
  percent: Percent,
  clock: Clock,
  alert: AlertCircle,
} as const;

type IconName = keyof typeof iconMap;

interface KPICardProps {
  name: string;
  value: number | string;
  unit?: string;
  change?: number; // 전월 대비 변화율 (%)
  target?: number;
  status?: "success" | "warning" | "danger";
  iconName?: IconName;
  className?: string;
}

export const KPICard = memo(function KPICard({
  name,
  value,
  unit = "",
  change,
  target,
  status = "success",
  iconName,
  className,
}: KPICardProps) {
  const Icon = iconName ? iconMap[iconName] : null;
  const formatValue = (v: number | string) =>
    typeof v === "number" ? v.toLocaleString("ko-KR") : v;
  const statusColors = {
    success: "border-green-200 dark:border-green-900",
    warning: "border-orange-200 dark:border-orange-900",
    danger: "border-red-200 dark:border-red-900",
  };

  const statusTextColors = {
    success: "text-green-600",
    warning: "text-orange-600",
    danger: "text-red-600",
  };

  const statusBgColors = {
    success: "bg-green-50 dark:bg-green-950",
    warning: "bg-orange-50 dark:bg-orange-950",
    danger: "bg-red-50 dark:bg-red-950",
  };

  return (
    <Card className={cn(statusColors[status], className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{name}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* 메인 값 */}
          <div className="flex items-baseline gap-1">
            <span className={cn("text-2xl font-bold", statusTextColors[status])}>
              {formatValue(value)}
            </span>
            {unit && <span className="text-sm text-slate-500">{unit}</span>}
          </div>

          {/* 변화율 및 목표 */}
          <div className="flex items-center justify-between text-xs">
            {/* 전월 대비 변화 */}
            {change !== undefined && (
              <div className="flex items-center gap-1">
                {change > 0 ? (
                  <TrendingUp
                    className={cn("h-3 w-3", change > 0 ? "text-green-500" : "text-red-500")}
                  />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={cn(change > 0 ? "text-green-600" : "text-red-600")}>
                  {change > 0 ? "+" : ""}
                  {change.toFixed(1)}%
                </span>
                <span className="text-slate-400">전월 대비</span>
              </div>
            )}

            {/* 목표 대비 */}
            {target !== undefined && (
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-slate-400" />
                <span className="text-slate-500">
                  목표: {target.toLocaleString("ko-KR")}
                  {unit}
                </span>
              </div>
            )}
          </div>

          {/* 목표 달성률 프로그레스 바 */}
          {target !== undefined && typeof value === "number" && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={cn("h-full rounded-full transition-all", statusBgColors[status])}
                  style={{
                    width: `${Math.min((value / target) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
