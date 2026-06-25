"use client";

import { useState, useEffect, useTransition } from "react";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle,
  RotateCcw, FileSearch, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getApprovalSteps,
  approveStep,
  rejectStep,
  submitForApproval,
  resubmitForApproval,
  getOrderReviewData,
  type OrderReviewData,
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
        label: "완료",
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

function GradeTag({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  const colorMap: Record<string, string> = {
    A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    B: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    C: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    X: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    Y: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Z: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${colorMap[value] ?? "bg-slate-100 text-slate-600"}`}>
      {label}-{value}
    </span>
  );
}

function ReviewPanel({ data }: { data: OrderReviewData }) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">검토 — 재고 영향 분석</p>
      {data.items.map((item) => {
        const shortageAbs = Math.abs(item.shortage);
        const isShort = item.shortage < 0;
        const daysImprove = item.daysOfStockAfter - item.daysOfStockNow;

        return (
          <div key={item.productId} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            {/* 제품 헤더 */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-mono text-slate-400">{item.sku}</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.name}</span>
              <GradeTag label="ABC" value={item.abcGrade} />
              <GradeTag label="XYZ" value={item.xyzGrade} />
            </div>

            {/* 발주 전/후 비교 그리드 */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              {/* 발주 전 */}
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-700">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">발주 전</p>
                <div className="space-y-1">
                  <Row label="현재고" value={`${item.currentStock.toLocaleString()} ${""}`} />
                  <Row label="안전재고" value={`${item.safetyStock.toLocaleString()}`} />
                  <Row
                    label="재고 부족"
                    value={isShort ? `${shortageAbs.toLocaleString()} 부족` : "여유"}
                    valueClass={isShort ? "text-red-600 font-semibold" : "text-emerald-600"}
                  />
                  <Row
                    label="재고일수"
                    value={item.daysOfStockNow >= 999 ? "판매없음" : `${item.daysOfStockNow}일`}
                    valueClass={item.daysOfStockNow < item.leadTime ? "text-red-600 font-semibold" : ""}
                  />
                  <Row
                    label="연간회전율"
                    value={item.turnoverNow > 0 ? `${item.turnoverNow}회` : "-"}
                  />
                </div>
              </div>

              {/* 발주 후 */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800/40 dark:bg-blue-900/20">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-500">발주 후</p>
                <div className="space-y-1">
                  <Row label="발주수량" value={`+${item.orderQty.toLocaleString()}`} valueClass="text-blue-600 font-semibold" />
                  <Row label="예상재고" value={`${item.stockAfter.toLocaleString()}`} />
                  <Row label="재고 상태" value="여유" valueClass="text-emerald-600" />
                  <Row
                    label="재고일수"
                    value={item.daysOfStockAfter >= 999 ? "판매없음" : `${item.daysOfStockAfter}일`}
                    valueClass="text-blue-600 font-semibold"
                  />
                  <Row
                    label="연간회전율"
                    value={item.turnoverAfter > 0 ? `${item.turnoverAfter}회` : "-"}
                  />
                </div>
              </div>
            </div>

            {/* 개선 요약 */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
              <span className="text-[10px] text-slate-400">발주 효과:</span>
              {daysImprove > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                  <TrendingUp className="h-3 w-3" />
                  재고일수 +{daysImprove}일 확보
                </span>
              ) : daysImprove < 0 ? (
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500">
                  <TrendingDown className="h-3 w-3" />
                  재고일수 {daysImprove}일
                </span>
              ) : (
                <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
                  <Minus className="h-3 w-3" />
                  변화없음
                </span>
              )}
              <span className="text-[10px] text-slate-400">·</span>
              <span className="text-[10px] text-slate-500">
                일평균판매 {item.avgDailySales > 0 ? `${item.avgDailySales}개/일` : "실적없음"}
              </span>
              <span className="text-[10px] text-slate-400">·</span>
              <span className="text-[10px] text-slate-500">리드타임 {item.leadTime}일</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className={`text-[11px] font-medium text-slate-700 dark:text-slate-200 text-right ${valueClass}`}>{value}</span>
    </div>
  );
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
  const [reviewData, setReviewData] = useState<OrderReviewData | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const { toast } = useToast();

  const loadSteps = async () => {
    if (!purchaseOrderId) return;
    setIsLoading(true);
    try {
      const data = await getApprovalSteps(purchaseOrderId);
      setSteps(data);
    } catch {
      // 결재라인 없는 발주서는 정상
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

  // 팀장 단계 = stepOrder 2이면서 pending인 단계
  const managerStep = steps.find((s) => s.stepOrder === 2 && s.status === "pending");

  async function handleToggleReview() {
    if (reviewOpen) { setReviewOpen(false); return; }
    if (reviewData) { setReviewOpen(true); return; }
    setReviewLoading(true);
    try {
      const data = await getOrderReviewData(purchaseOrderId);
      setReviewData(data);
      setReviewOpen(true);
    } catch {
      toast({ title: "데이터 로드 실패", variant: "destructive" });
    } finally {
      setReviewLoading(false);
    }
  }

  function handleApprove(stepId: string) {
    startTransition(async () => {
      const result = await approveStep(stepId, comments[stepId] || undefined);
      if (result.success) {
        toast({ title: "승인 완료", description: "발주가 확정되었습니다" });
        setComments((p) => { const n = { ...p }; delete n[stepId]; return n; });
        await loadSteps();
        onApprovalChange?.();
      } else {
        toast({ title: "승인 실패", description: result.error, variant: "destructive" });
      }
    });
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
        toast({ title: "반려 완료", description: "발주서가 초안으로 돌아갔습니다" });
        setComments((p) => { const n = { ...p }; delete n[stepId]; return n; });
        await loadSteps();
        onApprovalChange?.();
      } else {
        toast({ title: "반려 실패", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await submitForApproval(purchaseOrderId);
      if (result.success) {
        toast({ title: "상신 완료", description: "팀장 검토 대기 중입니다" });
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
        toast({ title: "재상신 완료" });
        setReviewData(null);
        setReviewOpen(false);
        await loadSteps();
        onApprovalChange?.();
      } else {
        toast({ title: "재상신 실패", description: result.error, variant: "destructive" });
      }
    });
  }

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-slate-400">결재라인 불러오는 중...</div>;
  }

  // 아직 상신 전
  if (steps.length === 0) {
    return (
      <div className="space-y-2">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">결재라인</span>
        {orderStatus === "draft" ? (
          <div>
            <p className="mb-2 text-xs text-slate-500">발주 상신 시 구매담당 자동완료 → 팀장 승인 후 발주확정됩니다.</p>
            <Button size="sm" onClick={handleSubmit} disabled={isPending} className="h-8 text-xs">
              발주 상신
            </Button>
          </div>
        ) : (
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
          {isAllApproved && <Badge className="bg-emerald-600 text-xs px-2">발주확정</Badge>}
          {isRejected && <Badge variant="destructive" className="text-xs px-2">반려</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{approvedCount} / {steps.length} 완료</span>
          {isRejected && (
            <Button size="sm" variant="outline" onClick={handleResubmit} disabled={isPending}
              className="h-7 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 text-xs dark:border-amber-600 dark:text-amber-400">
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
            const isPendingStep = step.status === "pending";
            const isManagerPending = step.stepOrder === 2 && isPendingStep;

            return (
              <div key={step.id} className="relative flex gap-3">
                <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${meta.circle}`}>
                  {meta.icon}
                </div>

                <div className="flex-1 min-w-0 py-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">{idx + 1}단계</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{step.roleName}</span>
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
                    {/* 근거검토 버튼 — 모든 단계에서 표시 */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleToggleReview}
                      disabled={reviewLoading}
                      className="ml-1 h-6 gap-1 border-blue-300 text-blue-600 hover:bg-blue-50 text-[11px] px-2 dark:border-blue-700 dark:text-blue-400"
                    >
                      <FileSearch className="h-3 w-3" />
                      {reviewLoading ? "로딩..." : reviewOpen ? "검토 닫기" : "검토"}
                    </Button>
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

                  {/* 근거검토 패널 */}
                  {reviewOpen && reviewData && (
                    <ReviewPanel data={reviewData} />
                  )}

                  {/* 승인/반려 액션 */}
                  {isPendingStep && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        rows={2}
                        placeholder={step.stepOrder === 2 ? "승인 의견 또는 반려 사유를 입력하세요 (반려 시 필수)" : "의견을 입력하세요 (선택)"}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:ring-blue-900/40"
                        value={comments[step.id] ?? ""}
                        onChange={(e) => setComments((p) => ({ ...p, [step.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm"
                          className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          onClick={() => handleApprove(step.id)} disabled={isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {step.stepOrder === 2 ? "승인 (발주확정)" : "승인"}
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs"
                          onClick={() => handleReject(step.id)} disabled={isPending}>
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
