"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  BellOff,
  CheckCheck,
  Info,
  Package,
  ShieldAlert,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
  type AlertListItem,
} from "@/server/actions/alerts";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const SEVERITY_CONFIG = {
  critical: {
    label: "긴급",
    icon: ShieldAlert,
    color: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
  },
  warning: {
    label: "경고",
    icon: AlertTriangle,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
  },
  info: {
    label: "정보",
    icon: Info,
    color: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
} as const;

const TYPE_LABELS: Record<string, string> = {
  stock_critical: "재고 위험",
  stock_shortage: "재고 부족",
  stock_excess: "재고 과다",
  order_delay: "발주 지연",
  demand_surge: "수요 급증",
  demand_drop: "수요 급감",
  price_change: "가격 변동",
  supplier_issue: "공급자 이슈",
  order_pending: "발주 승인 대기",
  inbound_expected: "입고 예정",
  system: "시스템",
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHour = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(date).toLocaleDateString("ko-KR");
}

export default function AlertsPage() {
  const [alertItems, setAlertItems] = useState<AlertListItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const router = useRouter();

  const loadAlerts = useCallback(async (unreadOnly = false) => {
    setIsLoading(true);
    try {
      const result = await getAlerts({ unreadOnly, limit: 100 });
      setAlertItems(result.alerts);
      setUnreadCount(result.unreadCount);
      setTotal(result.total);
    } catch {
      console.error("알림 조회 실패");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts(activeTab === "unread");
  }, [activeTab, loadAlerts]);

  const handleMarkAsRead = async (alertId: string) => {
    await markAlertAsRead(alertId);
    setAlertItems((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllAsRead = async () => {
    const result = await markAllAlertsAsRead();
    if (result.success) {
      setAlertItems((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setUnreadCount(0);
      toast({ title: "전체 읽음 처리", description: `${result.count}개 알림을 읽음 처리했습니다` });
    }
  };

  const handleDelete = async (alertId: string) => {
    const item = alertItems.find((a) => a.id === alertId);
    await deleteAlert(alertId);
    setAlertItems((prev) => prev.filter((a) => a.id !== alertId));
    setTotal((prev) => prev - 1);
    if (item && !item.isRead) setUnreadCount((prev) => Math.max(0, prev - 1));
    toast({ title: "알림 삭제", description: "알림이 삭제되었습니다" });
  };

  const handleClick = (alert: AlertListItem) => {
    if (!alert.isRead) handleMarkAsRead(alert.id);
    if (alert.actionUrl) router.push(alert.actionUrl);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">알림 센터</h1>
          <p className="mt-1 text-slate-500">
            재고 알림 및 시스템 알림을 확인하세요
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            전체 읽음 처리
          </Button>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>전체 알림</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card className={unreadCount > 0 ? "border-blue-200 bg-blue-50" : ""}>
          <CardHeader className="pb-2">
            <CardDescription className={unreadCount > 0 ? "text-blue-700" : ""}>
              읽지 않은 알림
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", unreadCount > 0 && "text-blue-700")}>
              {unreadCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>긴급 알림</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {alertItems.filter((a) => a.severity === "critical" && !a.isRead).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 알림 리스트 */}
      <Card>
        <CardHeader className="pb-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">전체</TabsTrigger>
              <TabsTrigger value="unread">
                읽지 않음 {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              알림을 불러오는 중...
            </div>
          ) : alertItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <BellOff className="mb-4 h-12 w-12" />
              <p className="text-lg font-medium">
                {activeTab === "unread" ? "읽지 않은 알림이 없습니다" : "알림이 없습니다"}
              </p>
              <p className="mt-1 text-sm">
                재고 변동이 발생하면 자동으로 알림이 생성됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertItems.map((alert) => {
                const severity =
                  SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ||
                  SEVERITY_CONFIG.info;
                const SeverityIcon = severity.icon;

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg border p-4 transition-colors",
                      !alert.isRead
                        ? "border-l-4 border-l-blue-500 bg-blue-50/50 hover:bg-blue-50"
                        : "hover:bg-slate-50",
                      alert.actionUrl && "cursor-pointer"
                    )}
                    onClick={() => handleClick(alert)}
                  >
                    {/* 아이콘 */}
                    <div className={cn("mt-0.5 rounded-full p-1.5", severity.color)}>
                      <SeverityIcon className="h-4 w-4" />
                    </div>

                    {/* 내용 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            !alert.isRead && "text-slate-900"
                          )}
                        >
                          {alert.title}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {TYPE_LABELS[alert.type] || alert.type}
                        </Badge>
                        {!alert.isRead && (
                          <span className={cn("h-2 w-2 rounded-full", severity.dot)} />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{alert.message}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                        <span>{formatRelativeTime(alert.createdAt)}</span>
                        {alert.productSku && (
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {alert.productSku}
                          </span>
                        )}
                        {alert.actionUrl && (
                          <span className="flex items-center gap-1 text-blue-500">
                            <ExternalLink className="h-3 w-3" />
                            바로가기
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 액션 */}
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!alert.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(alert.id);
                          }}
                          title="읽음 처리"
                        >
                          <CheckCheck className="h-4 w-4 text-slate-400" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(alert.id);
                        }}
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
