"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { getActivityLogs } from "@/server/actions/activity-logs";
import type { ActivityLog } from "@/server/actions/activity-logs";

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CREATE: { label: "생성", variant: "default" },
  UPDATE: { label: "수정", variant: "secondary" },
  DELETE: { label: "삭제", variant: "destructive" },
  IMPORT: { label: "임포트", variant: "outline" },
  EXPORT: { label: "엑스포트", variant: "outline" },
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: "제품",
  supplier: "공급업체",
  inventory: "재고",
  purchase_order: "발주서",
  sales_record: "판매 기록",
  inbound_record: "입고 기록",
  outbound_record: "출고 기록",
  organization_settings: "조직 설정",
  excel_import: "Excel 임포트",
  excel_export: "Excel 엑스포트",
};

function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

type SortKey = "createdAt" | "userName" | "action" | "entityType" | "description";
type SortDir = "asc" | "desc";

function SortIcon({ column, sortKey, sortDir }: { column: string; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3" />
    : <ArrowDown className="ml-1 inline h-3 w-3" />;
}

const PAGE_SIZE = 50;

export function ActivityLogTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // 필터
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // 정렬
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }, [sortKey]);

  const loadLogs = useCallback(async (pageNum: number) => {
    setIsLoading(true);
    try {
      const result = await getActivityLogs({
        action: actionFilter !== "all" ? actionFilter : undefined,
        entityType: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error) {
      console.error("활동 로그 조회 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, entityTypeFilter, startDate, endDate]);

  useEffect(() => {
    setPage(0);
    loadLogs(0);
  }, [loadLogs]);

  const handlePrevPage = () => {
    const newPage = Math.max(0, page - 1);
    setPage(newPage);
    loadLogs(newPage);
  };

  const handleNextPage = () => {
    const maxPage = Math.ceil(total / PAGE_SIZE) - 1;
    const newPage = Math.min(maxPage, page + 1);
    setPage(newPage);
    loadLogs(newPage);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const sortedLogs = useMemo(() => {
    if (!sortKey) return logs;
    return [...logs].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortKey) {
        case "createdAt":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case "userName":
          aVal = (a.userName || "").toLowerCase();
          bVal = (b.userName || "").toLowerCase();
          break;
        case "action":
          aVal = a.action.toLowerCase();
          bVal = b.action.toLowerCase();
          break;
        case "entityType":
          aVal = (ENTITY_TYPE_LABELS[a.entityType] || a.entityType).toLowerCase();
          bVal = (ENTITY_TYPE_LABELS[b.entityType] || b.entityType).toLowerCase();
          break;
        case "description":
          aVal = (a.description || "").toLowerCase();
          bVal = (b.description || "").toLowerCase();
          break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [logs, sortKey, sortDir]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>활동 로그</CardTitle>
        <CardDescription>
          시스템 내 모든 입출력 활동이 연/월/일/시간으로 기록됩니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 필터 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">작업 유형</label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="CREATE">생성</SelectItem>
                <SelectItem value="UPDATE">수정</SelectItem>
                <SelectItem value="DELETE">삭제</SelectItem>
                <SelectItem value="IMPORT">임포트</SelectItem>
                <SelectItem value="EXPORT">엑스포트</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">대상 유형</label>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="product">제품</SelectItem>
                <SelectItem value="supplier">공급업체</SelectItem>
                <SelectItem value="inventory">재고</SelectItem>
                <SelectItem value="purchase_order">발주서</SelectItem>
                <SelectItem value="sales_record">판매 기록</SelectItem>
                <SelectItem value="inbound_record">입고 기록</SelectItem>
                <SelectItem value="outbound_record">출고 기록</SelectItem>
                <SelectItem value="excel_import">Excel 임포트</SelectItem>
                <SelectItem value="excel_export">Excel 엑스포트</SelectItem>
                <SelectItem value="organization_settings">조직 설정</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">시작일</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">종료일</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px] cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("createdAt")}>
                  날짜/시간<SortIcon column="createdAt" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead className="w-[100px] cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("userName")}>
                  사용자<SortIcon column="userName" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead className="w-[80px] cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("action")}>
                  작업<SortIcon column="action" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead className="w-[100px] cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("entityType")}>
                  대상<SortIcon column="entityType" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
                <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("description")}>
                  설명<SortIcon column="description" sortKey={sortKey} sortDir={sortDir} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-400">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-400">
                    활동 로그가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                sortedLogs.map((log) => {
                  const actionInfo = ACTION_LABELS[log.action] || {
                    label: log.action,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {log.userName || "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={actionInfo.variant}>
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {log.description}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* 페이지네이션 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            총 {total}건
            {totalPages > 1 && ` (${page + 1}/${totalPages} 페이지)`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevPage}
                disabled={page === 0 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextPage}
                disabled={page >= totalPages - 1 || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
