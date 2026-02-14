"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getDeletionRequests,
  approveDeletion,
  rejectDeletion,
} from "@/server/actions/deletion-requests";
import type { DeletionRequest } from "@/server/db/schema/deletion-requests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Check,
  X,
  Eye,
  Loader2,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  Info,
} from "lucide-react";
import Link from "next/link";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: "제품",
  supplier: "공급자",
  purchase_order: "발주서",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기",
  approved: "승인됨",
  rejected: "거부됨",
  completed: "완료",
  cancelled: "취소",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  approved: "secondary",
  rejected: "destructive",
  completed: "secondary",
  cancelled: "outline",
};

const IMPACT_LABELS: Record<string, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export default function DeletionRequestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<string>("pending");
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 상세 보기
  const [detailRequest, setDetailRequest] = useState<DeletionRequest | null>(null);

  // 거부 다이얼로그
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const status = tab === "all" ? "all" : (tab as "pending" | "approved" | "rejected" | "completed");
      const data = await getDeletionRequests(status);
      setRequests(data);
    } catch (error) {
      console.error("삭제 요청 조회 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const result = await approveDeletion(requestId);
      if (result.success) {
        await fetchRequests();
      } else {
        alert(result.error || "승인에 실패했습니다");
      }
    } catch (error) {
      console.error("승인 오류:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectOpen = (requestId: string) => {
    setRejectTargetId(requestId);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectTargetId || !rejectionReason.trim()) return;
    setActionLoading(rejectTargetId);
    try {
      const result = await rejectDeletion(rejectTargetId, rejectionReason);
      if (result.success) {
        setRejectDialogOpen(false);
        await fetchRequests();
      } else {
        alert(result.error || "거부에 실패했습니다");
      }
    } catch (error) {
      console.error("거부 오류:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6" />
            삭제 요청 관리
          </h1>
          <p className="text-sm text-muted-foreground">
            팀원이 요청한 데이터 삭제를 검토하고 승인/거부합니다.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">대기 중</TabsTrigger>
          <TabsTrigger value="completed">완료</TabsTrigger>
          <TabsTrigger value="rejected">거부됨</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {tab === "pending" && "승인 대기 중인 삭제 요청"}
                {tab === "completed" && "처리 완료된 삭제 요청"}
                {tab === "rejected" && "거부된 삭제 요청"}
                {tab === "all" && "전체 삭제 요청"}
              </CardTitle>
              <CardDescription>
                {requests.length}건의 요청이 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  요청이 없습니다.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>유형</TableHead>
                      <TableHead>대상</TableHead>
                      <TableHead>영향도</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>요청자</TableHead>
                      <TableHead>요청일</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {ENTITY_TYPE_LABELS[req.entityType] || req.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {req.entityName || "-"}
                        </TableCell>
                        <TableCell>
                          {req.impactLevel && (
                            <Badge
                              variant={
                                req.impactLevel === "high"
                                  ? "destructive"
                                  : req.impactLevel === "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {IMPACT_LABELS[req.impactLevel] || req.impactLevel}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {req.reason}
                        </TableCell>
                        <TableCell className="text-sm">
                          {req.requestedByName || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(req.requestedAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[req.status] || "outline"}>
                            {STATUS_LABELS[req.status] || req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetailRequest(req)}
                              title="상세 보기"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {req.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleApprove(req.id)}
                                  disabled={actionLoading === req.id}
                                  title="승인"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  {actionLoading === req.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRejectOpen(req.id)}
                                  disabled={actionLoading === req.id}
                                  title="거부"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 상세 보기 다이얼로그 */}
      <Dialog open={!!detailRequest} onOpenChange={() => setDetailRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>삭제 요청 상세</DialogTitle>
          </DialogHeader>
          {detailRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">유형:</span>{" "}
                  <Badge variant="outline">
                    {ENTITY_TYPE_LABELS[detailRequest.entityType]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">대상:</span>{" "}
                  <span className="font-medium">{detailRequest.entityName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">요청자:</span>{" "}
                  {detailRequest.requestedByName}
                </div>
                <div>
                  <span className="text-muted-foreground">요청일:</span>{" "}
                  {formatDate(detailRequest.requestedAt)}
                </div>
                <div>
                  <span className="text-muted-foreground">상태:</span>{" "}
                  <Badge variant={STATUS_VARIANTS[detailRequest.status]}>
                    {STATUS_LABELS[detailRequest.status]}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">영향도:</span>{" "}
                  {detailRequest.impactLevel && IMPACT_LABELS[detailRequest.impactLevel]}
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">삭제 사유:</span>
                <p className="mt-1 text-sm bg-muted p-3 rounded-md">
                  {detailRequest.reason}
                </p>
              </div>

              {detailRequest.rejectionReason && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>거부 사유:</strong> {detailRequest.rejectionReason}
                    <br />
                    <span className="text-xs">
                      거부자: {detailRequest.rejectedByName} ({formatDate(detailRequest.rejectedAt)})
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {detailRequest.approvedByName && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    승인자: {detailRequest.approvedByName} ({formatDate(detailRequest.approvedAt)})
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailRequest(null)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거부 사유 입력 다이얼로그 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>삭제 요청 거부</DialogTitle>
            <DialogDescription>
              거부 사유를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">거부 사유 (필수)</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="거부 사유를 입력해주세요..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={!rejectionReason.trim() || actionLoading !== null}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              거부
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
