"use client";

import { useState, useEffect, useTransition } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getApprovalSteps,
  approveStep,
  rejectStep,
  submitForApproval,
  resubmitForApproval,
} from "@/server/actions/purchase-order-approvals";
import type { PurchaseOrderApproval } from "@/server/db/schema";

type StepStatus = "waiting" | "pending" | "approved" | "rejected";

function statusMeta(status: StepStatus) {
  switch (status) {
    case "approved":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        circle: "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-600 dark:text-emerald-400",
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-400",
        label: "승인",
      };
    case "rejected":
      return {
        icon: <XCircle className="h-4 w-4" />,
        circle: "border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:border-red-600 dark:text-red-400",
        badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-400",
        label: "반려",
      };
    case "pending":
      return {
        icon: <Clock className="h-4 w-4 animate-pulse" />,
        circle: "border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:border-amber-500 dark:text-amber-400",
        badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400",
        label: "검토 중",
      };
    default:
      return {
        icon: <Clock className="h-4 w-4" />,
        circle: "border-slate-300 bg-slate-50 text-slate-400 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-500",
        badge: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
        label: "대기",
      };
  }
}

interface ApprovalTimelineProps {
  purchaseOrderId: string;
  orderStatus: string;
  onApprovalChange?: () => void;
}

export function ApprovalTimeline({ purchaseOrderId, orderStatus, onApprovalChange }: ApprovalTimelineProps) {
  const [steps, setSteps] = useState<PurchaseOrderApproval[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const loadSteps = async () => {
    if (!purchaseOrderId) return;
    setIsLoading(true);
    try {
      const data = await getApprovalSteps(purchaseOrderId);
      setSteps(data);
    } catch {
      // 조용히 실패 — 결재라인이 없는 발주서는 정상
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!purchaseOrderId) return;
    loadSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrderId]);

  const isRejected = steps.some((s) => s.status === "rejected");
  const isAllApproved = steps.every((s) => s.status === "approved") && steps.length > 0;
  const approvedCount = steps.filter((s) => s.status === "approved").length;

  function handleApprove(stepId: string) {
    const comment = comments[stepId] ?? "";
    startTransition(async () => {
      const result = await approveStep(stepId, comment || undefined);
      if (result.success) {
        toast({ title: "승인 완료", description: "결재가 승인되었습니다" });
        await loadSteps();
        onApprovalChange?.();
      } else {
        toast({ title: "승인 실패", description: result.error, variant: "destructive" });
      }
    });
    setComments((p) => { const n = { ...p }; delete n[stepId]; return n; });
  }

  function handleReject(stepId: string) {
    const comment = comments[stepId]?.trim();
    if (!comment) {
      toast({ title: "반려 사유 필요", description: "반려 사유를 입력해주세요", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      const result = await rejectStep(stepId, comment);
      if (result.success) {
        toast({ title: "반려 완료", description: "결재가 반려되었습니다" });
        await loadSteps();
        onApprovalChange?.();
      } else {
        toast({ title: "반려 실패", description: result.error, variant: "destructive" });
      }
    });
    setComments((p) => { const n = { ...p }; delete n[stepId]; return n; });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitForApproval(purchaseOrderId);
      if (result.success) {
        toast({ title: "결재 상신", description: "결재가 상신되었습니다" });
        await loadSteps();
        onApprovalChange?.();
      } else {
        toast({ title: "상신 실패", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleResubmit() {
    startTransition(async () => {
      const result = await resubmitForApproval(purchaseOrderId);
      if (result.success) {
        toast({ title: "재상신 완료", description: "결재가 재상신되었습니다" });
        await loadSteps();
        onApprovalChange?.();
      } else {
        toast({ title: "재상신 실패", description: result.error, variant: "destructive" });
      }
    });
  }

  if (isLoading) {
    return <div className="text-sm text-slate-400 py-4 text-center">결재라인 불러오는 중...</div>;
  }

  // 결재라인이 없고 draft 상태면 상신 버튼 표시
  if (steps.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">결재라인</span>
        </div>
        {orderStatus === "draft" && (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending}
            className="h-8 text-xs"
          >
            결재 상신
          </Button>
        )}
        {orderStatus !== "draft" && (
          <p className="text-xs text-slate-400">결재라인이 없습니다</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">결재라인</span>
          {isAllApproved && <Badge className="bg-emerald-600 text-xs px-2">최종승인</Badge>}
          {isRejected && <Badge variant="destructive" className="text-xs px-2">반려</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{approvedCount} / {steps.length} 완료</span>
          {isRejected && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleResubmit}
              disabled={isPending}
              className="h-7 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 text-xs dark:border-amber-600 dark:text-amber-400"
            >
              <RotateCcw className="h-3 w-3" />
              재상신
            </Button>
          )}
        </div>
      </div>

      {/* 타임라인 */}
      <div className="relative">
        <div className="absolute left-[17px] top-5 bottom-5 w-0.5 bg-slate-200 dark:bg-slate-700" />

        <div className="space-y-2">
          {steps.map((step, idx) => {
            const meta = statusMeta(step.status as StepStatus);
            const isStepPending = step.status === "pending";

            return (
              <div key={step.id} className="relative flex gap-3">
                <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${meta.circle}`}>
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0 py-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">{idx + 1}단계</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {step.roleName}
                    </span>
                    {step.approverName && (
                      <span className="text-xs text-slate-500">{step.approverName}</span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>
                      {meta.label}
                    </span>
                    {step.actedAt && (
                      <span className="text-xs text-slate-400">
                        {new Date(step.actedAt).toLocaleString("ko-KR", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  {step.comment && (
                    <div className={`mt-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                      step.status === "rejected"
                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
                        : "border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                    }`}>
                      {step.status === "rejected" && (
                        <span className="mr-1 inline-flex items-center gap-0.5 font-semibold">
                          <AlertTriangle className="h-3 w-3" /> 반려 사유:
                        </span>
                      )}
                      {step.comment}
                    </div>
                  )}

                  {isStepPending && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        rows={2}
                        placeholder="의견을 입력하세요 (반려 시 필수)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:ring-blue-900/40"
                        value={comments[step.id] ?? ""}
                        onChange={(e) =>
                          setComments((p) => ({ ...p, [step.id]: e.target.value }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          onClick={() => handleApprove(step.id)}
                          disabled={isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleReject(step.id)}
                          disabled={isPending}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          반려
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
