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
  ChevronRight,
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
  lowerIsBetter?: boolean; // 낮을수록 좋은 KPI 여부 (달성률 계산에 사용)
  status?: "success" | "warning" | "danger";
  iconName?: IconName;
  className?: string;
  onClick?: () => void; // 드릴다운 클릭 핸들러
}

/**
 * 달성률 계산 (0~100+ 범위)
 * lowerIsBetter: 목표보다 낮으면 달성 (예: 품절률, 재고일수)
 */
function calcAchievementRate(
  value: number,
  target: number,
  lowerIsBetter: boolean
): number {
  if (target === 0) return 0;
  if (lowerIsBetter) {
    // 목표 이하면 100%, 이상이면 비례 감소
    return Math.round((target / Math.max(value, 0.01)) * 100);
  }
  return Math.round((value / target) * 100);
}

export const KPICard = memo(function KPICard({
  name,
  value,
  unit = "",
  change,
  target,
  lowerIsBetter = false,
  status = "success",
  iconName,
  className,
  onClick,
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
    success: "text-green-600 dark:text-green-400",
    warning: "text-orange-600 dark:text-orange-400",
    danger: "text-red-600 dark:text-red-400",
  };

  const statusBgColors = {
    success: "bg-green-500",
    warning: "bg-orange-500",
    danger: "bg-red-500",
  };

  // 달성률 계산
  const achievementRate =
    target !== undefined && typeof value === "number"
      ? calcAchievementRate(value, target, lowerIsBetter)
      : null;

  // 달성률 텍스트 색상
  const achievementTextColor =
    achievementRate === null
      ? ""
      : achievementRate >= 100
      ? "text-green-600 dark:text-green-400"
      : achievementRate >= 80
      ? "text-orange-600 dark:text-orange-400"
      : "text-red-600 dark:text-red-400";

  const isClickable = Boolean(onClick);

  return (
    <Card
      className={cn(
        statusColors[status],
        isClickable &&
          "cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick?.();
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {name}
        </CardTitle>
        <div className="flex items-center gap-1">
          {Icon && <Icon className="h-4 w-4 text-slate-400" />}
          {isClickable && (
            <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* 메인 값 */}
          <div className="flex items-baseline gap-1">
            <span className={cn("text-2xl font-bold", statusTextColors[status])}>
              {formatValue(value)}
            </span>
            {unit && <span className="text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
          </div>

          {/* 달성률 + 목표값 행 */}
          {target !== undefined && achievementRate !== null && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  목표: {target.toLocaleString("ko-KR")}
                  {unit}
                </span>
              </div>
              <span className={cn("font-semibold", achievementTextColor)}>
                달성 {Math.min(achievementRate, 999)}%
              </span>
            </div>
          )}

          {/* 전월 대비 변화 */}
          {change !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              {change > 0 ? (
                <TrendingUp
                  className={cn("h-3 w-3", change > 0 ? "text-green-500" : "text-red-500")}
                />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={cn(change > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                {change > 0 ? "+" : ""}
                {change.toFixed(1)}%
              </span>
              <span className="text-slate-400">전월 대비</span>
            </div>
          )}

          {/* 목표 달성률 프로그레스 바 */}
          {target !== undefined && achievementRate !== null && (
            <div className="mt-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={cn("h-full rounded-full transition-all", statusBgColors[status])}
                  style={{
                    width: `${Math.min(achievementRate, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 드릴다운 안내 (클릭 가능한 카드) */}
          {isClickable && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              클릭하여 상세 보기
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
