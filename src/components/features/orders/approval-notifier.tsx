"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { getAlerts, markAlertAsRead } from "@/server/actions/alerts";

// 로그인 직후 미읽은 order_pending 알림을 우측 하단 toast로 표시
export function ApprovalNotifier() {
  const { toast } = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    shown.current = true;

    getAlerts({ unreadOnly: true, limit: 10 }).then(({ alerts: items }) => {
      const pendingAlerts = items.filter((a) => a.type === "order_pending");
      pendingAlerts.forEach((alert) => {
        toast({
          title: alert.title,
          description: alert.message,
          duration: 8000,
        });
        markAlertAsRead(alert.id).catch(console.error);
      });
    }).catch(console.error);
  }, [toast]);

  return null;
}
