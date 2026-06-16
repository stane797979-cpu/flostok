"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getRecentActivities } from "@/server/actions/activity-logs";
import type { ActivityLog } from "@/server/actions/activity-logs";

interface Activity {
  id: string;
  type: "stock_in" | "stock_out" | "alert" | "order";
  title: string;
  description: string;
  timestamp: string;
  severity: "critical" | "warning" | "info";
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "생성",
  UPDATE: "수정",
  DELETE: "삭제",
  IMPORT: "임포트",
  EXPORT: "다운로드",
};

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

function mapLogToActivity(log: ActivityLog): Activity {
  const typeMap: Record<string, Activity["type"]> = {
    inbound_record: "stock_in",
    outbound_record: "stock_out",
    inventory: "stock_in",
    purchase_order: "order",
    product: "order",
    supplier: "order",
    sales_record: "stock_out",
    excel_import: "stock_in",
    excel_export: "stock_out",
    organization_settings: "alert",
  };

  const severityMap: Record<string, Activity["severity"]> = {
    DELETE: "warning",
    CREATE: "info",
    UPDATE: "info",
    IMPORT: "info",
    EXPORT: "info",
  };

  return {
    id: log.id,
    type: typeMap[log.entityType] || "order",
    title: ACTION_LABELS[log.action] || log.action,
    description: log.description,
    timestamp: formatRelativeTime(log.createdAt),
    severity: severityMap[log.action] || "info",
  };
}

// 목업 데이터 — DB 로그가 없을 때 폴백
const FALLBACK_ACTIVITIES: Activity[] = [
  {
    id: "1",
    type: "alert",
    title: "안내",
    description: "활동 로그가 아직 기록되지 않았습니다",
    timestamp: "-",
    severity: "info",
  },
];

export function RecentActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getRecentActivities(8)
      .then((logs) => {
        if (logs.length > 0) {
          setActivities(logs.map(mapLogToActivity));
        } else {
          setActivities(FALLBACK_ACTIVITIES);
        }
      })
      .catch(() => {
        setActivities(FALLBACK_ACTIVITIES);
      })
      .finally(() => {
        setLoaded(true);
      });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>최근 활동</span>
          <Clock className="h-4 w-4 text-slate-400" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-400">
            로딩 중...
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const icon = {
                stock_in: TrendingUp,
                stock_out: TrendingDown,
                alert: AlertTriangle,
                order: Package,
              }[activity.type];

              const Icon = icon;

              const severityColors = {
                critical: "text-red-500 bg-red-50 dark:bg-red-950",
                warning: "text-orange-500 bg-orange-50 dark:bg-orange-950",
                info: "text-blue-500 bg-blue-50 dark:bg-blue-950",
              };

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      severityColors[activity.severity || "info"]
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <span className="text-xs text-slate-500">
                        {activity.timestamp}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {activity.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
