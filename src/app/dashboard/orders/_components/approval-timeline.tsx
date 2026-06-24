"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertTriangle, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { approveStep, rejectStep, submitForApproval, resubmitForApproval } from "@/server/actions/purchase-order-approvals";
import { useToast } from "@/hooks/use-toast";
import type { PurchaseOrderApproval } from "@/server/db/schema";

interface ApprovalTimelineProps {
  purchaseOrderId: string;
  orderStatus: string;
  steps: PurchaseOrderApproval[];
  onChanged: () => void;
}

export function ApprovalTimeline({
  purchaseOrderId,
  orderStatus,
  steps,
  onChanged,
}: ApprovalTimelineProps) {
  const { toast } = useToast();
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const isRejected = steps.some((s) => s.status === "rejected");
  const isFullyApproved = steps.length > 0 && steps.every((s) => s.status === "approved");
  const isDraft = orderStatus === "draft";

  async function handleSubmit() {
    setLoading("submit");
    const res = await submitForApproval(purchaseOrderId);
    setLoading(null);
    if (res.success) {
      toast({ title: "결재 상신 완료", description: "결재라인이 시작되었습니다" });
      onChanged();
    } else {
      toast({ title: "오류", description: res.error, variant: "destructive" });
    }
  }

  async function handleApprove(stepId: string) {
    setLoading(stepId + "-approve");
    const res = await approveStep(stepId, commentMap[stepId]);
    setLoading(null);
    if (res.success) {
      toast({ title: "승인 완료" });
      setCommentMap((p) => { const n = { ...p }; delete n[stepId]; return n; });
      onChanged();
    } else {
      toast({ title: "오류", description: res.error, variant: "destructive" });
    }
  }

  async function handleReject(stepId: string) {
    const comment = commentMap[stepId]?.trim();
    if (!comment) {
      toast({ title: "반려 사유 필요", description: "반려 사유를 입력해주세요", variant: "destructive" });
      return;
    }
    setLoading(stepId + "-reject");
    const res = await rejectStep(stepId, comment);
    setLoading(null);
    if (res.success) {
      toast({ title: "반려 처리 완료", description: "발주서가 초안으로 되돌아갔습니다" });
      setCommentMap((p) => { const n = { ...p }; delete n[stepId]; return n; });
      onChanged();
    } else {
      toast({ title: "오류", description: res.error, variant: "destructive" });
    }
  }

  async function handleResubmit() {
    setLoading("resubmit");
    const res = await resubmitForApproval(purchaseOrderId);
    setLoading(null);
    if (res.success) {
      toast({ title: "재상신 완료", description: "결재라인이 1단계부터 재시작됩니다" });
      onChanged();
    } else {
      toast({ title: "오류", description: res.error, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          결재라인
          {isFullyApproved && (
            <Badge className="bg-emerald-600 text-xs">최종승인</Badge>
          )}
          {isRejected && (
            <Badge variant="destructive" className="text-xs">반려</Badge>
          )}
        </h4>

        {/* 초안 상태 → 결재 상신 버튼 */}
        {isDraft && steps.length === 0 && (
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading === "submit"}
            className="gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            {loading === "submit" ? "상신 중..." : "결재 상신"}
          </Button>
        )}

        {/* 반려 상태 → 재상신 버튼 */}
        {isRejected && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResubmit}
            disabled={loading === "resubmit"}
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {loading === "resubmit" ? "재상신 중..." : "재상신"}
          </Button>
        )}
      </div>

      {/* 결재라인 없음 (draft, 아직 상신 전) */}
      {steps.length === 0 && (
        <p className="text-xs text-slate-400 py-2">
          결재 상신 버튼을 눌러 결재라인을 시작하세요.
        </p>
      )}

      {/* 타임라인 */}
      {steps.length > 0 && (
        <div className="relative">
          {/* 세로 연결선 */}
          <div className="absolute left-[17px] top-5 bottom-5 w-0.5 bg-slate-200 dark:bg-slate-700" />

          <div className="space-y-3">
            {steps.map((step) => {
              const meta = stepMeta(step.status);
              const isPending = step.status === "pending";
              const loadingApprove = loading === step.id + "-approve";
              const loadingReject = loading === step.id + "-reject";

              return (
                <div key={step.id} className="relative flex gap-3">
                  {/* 아이콘 */}
                  <div
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${meta.circleCls}`}
                  >
                    {meta.icon}
                  </div>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0 pb-1 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400">{step.stepOrder}단계</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {step.roleName}
                      </span>
                      {step.approverName && (
                        <span className="text-sm text-slate-500">({step.approverName})</span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badgeCls}`}>
                        {meta.label}
                      </span>
                      {step.actedAt && (
                        <span className="text-xs text-slate-400">
                          {new Date(step.actedAt).toLocaleString("ko-KR", {
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    {/* 의견/반려사유 */}
                    {step.comment && (
                      <div className={`mt-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                        step.status === "rejected"
                          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-400"
                          : "border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {step.status === "rejected" && (
                          <span className="mr-1 font-semibold flex items-center gap-1 mb-0.5">
                            <AlertTriangle className="h-3 w-3" /> 반려 사유:
                          </span>
                        )}
                        {step.comment}
                      </div>
                    )}

                    {/* 결재 액션 영역 */}
                    {isPending && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={2}
                          placeholder="의견을 입력하세요 (반려 시 필수)"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                          value={commentMap[step.id] ?? ""}
                          onChange={(e) =>
                            setCommentMap((p) => ({ ...p, [step.id]: e.target.value }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                            onClick={() => handleApprove(step.id)}
                            disabled={loadingApprove || loadingReject}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {loadingApprove ? "처리 중..." : "승인"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5 text-xs h-8"
                            onClick={() => handleReject(step.id)}
                            disabled={loadingApprove || loadingReject}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {loadingReject ? "처리 중..." : "반려"}
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
      )}
    </div>
  );
}

function stepMeta(status: PurchaseOrderApproval["status"]) {
  switch (status) {
    case "approved":
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        circleCls: "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:border-emerald-600 dark:text-emerald-400",
        badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
        label: "승인",
      };
    case "rejected":
      return {
        icon: <XCircle className="h-4 w-4" />,
        circleCls: "border-red-400 bg-red-50 text-red-600 dark:bg-red-900/30 dark:border-red-600 dark:text-red-400",
        badgeCls: "border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400",
        label: "반려",
      };
    case "pending":
      return {
        icon: <Clock className="h-4 w-4 animate-pulse" />,
        circleCls: "border-amber-400 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:border-amber-500 dark:text-amber-400",
        badgeCls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
        label: "검토 중",
      };
    default: // waiting
      return {
        icon: <Clock className="h-4 w-4" />,
        circleCls: "border-slate-300 bg-slate-50 text-slate-400 dark:bg-slate-800 dark:border-slate-600",
        badgeCls: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
        label: "대기",
      };
  }
}
