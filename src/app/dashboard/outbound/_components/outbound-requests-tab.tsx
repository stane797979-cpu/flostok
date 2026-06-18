"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, RefreshCw, Clock } from "lucide-react";
import { getOutboundRequests } from "@/server/actions/outbound-requests";
import { OutboundRequestDialog } from "./outbound-request-dialog";
import { useToast } from "@/hooks/use-toast";

interface OutboundRequest {
  id: string;
  requestNumber: string;
  status: string;
  outboundType: string;
  outboundTypeLabel: string;
  requestedByName: string | null;
  itemsCount: number;
  totalQuantity: number;
  createdAt: Date;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "대기중", className: "bg-orange-600" },
  holding: { label: "홀딩", className: "bg-yellow-500" },
  partial: { label: "부분출고(잔량대기)", className: "bg-purple-600" },
  confirmed: { label: "출고완료", className: "bg-green-600" },
  cancelled: { label: "취소됨", className: "bg-slate-500" },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return d.toLocaleDateString("ko-KR");
}

export function OutboundRequestsTab() {
  const [requests, setRequests] = useState<OutboundRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getOutboundRequests({
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setRequests(result.requests);
    } catch (error) {
      console.error("출고요청 목록 조회 오류:", error);
      toast({
        title: "조회 실패",
        description: "출고요청 목록을 불러오지 못했습니다",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>출고 요청 목록</CardTitle>
              <CardDescription>등록된 출고 요청을 조회하고 새 요청을 등록합니다</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">대기중</SelectItem>
                  <SelectItem value="partial">부분출고(잔량대기)</SelectItem>
                  <SelectItem value="confirmed">출고완료</SelectItem>
                  <SelectItem value="cancelled">취소됨</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadRequests} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                새로고침
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                출고 요청 등록
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              로딩 중...
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <p className="text-lg font-medium">출고 요청이 없습니다</p>
              <p className="mt-1 text-sm">출고 요청 등록 버튼을 눌러 새 요청을 생성하세요</p>
            </div>
          ) : (
            <>
              <div className="mb-3 text-sm text-slate-500">총 {requests.length}건</div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>요청번호</TableHead>
                      <TableHead>출고유형</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>요청자</TableHead>
                      <TableHead className="text-center">품목수</TableHead>
                      <TableHead className="text-center">총수량</TableHead>
                      <TableHead>요청일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => {
                      const config = statusConfig[req.status] || {
                        label: req.status,
                        className: "bg-slate-600",
                      };
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.requestNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{req.outboundTypeLabel}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={config.className}>{config.label}</Badge>
                          </TableCell>
                          <TableCell>{req.requestedByName || "-"}</TableCell>
                          <TableCell className="text-center">{req.itemsCount}개</TableCell>
                          <TableCell className="text-center">
                            {req.totalQuantity.toLocaleString()}개
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-700">
                              {new Date(req.createdAt).toLocaleDateString("ko-KR")}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {formatTimeAgo(req.createdAt)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <OutboundRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          toast({ title: "출고 요청 완료", description: "출고 요청이 생성되었습니다" });
          loadRequests();
        }}
      />
    </div>
  );
}
