"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  TruckIcon,
  Package,
  CalendarIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface AutoReorderRecommendation {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  recommendedQty: number;
  urgencyLevel: number; // 0: 품절, 1: 위험, 2: 부족, 3: 주의
  supplierId?: string;
  supplierName?: string;
  leadTime: number;
  estimatedCost: number;
  expectedDate: string;
  reason: string; // 발주 사유
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface AutoReorderRecommendationsTableProps {
  recommendations: AutoReorderRecommendation[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onApprove?: (ids: string[]) => void;
  onReject?: (ids: string[]) => void;
  isLoading?: boolean;
  className?: string;
}

export function AutoReorderRecommendationsTable({
  recommendations,
  selectedIds,
  onSelectChange,
  onApprove,
  onReject,
  isLoading = false,
  className,
}: AutoReorderRecommendationsTableProps) {
  const [actionInProgress, setActionInProgress] = useState(false);

  // 정렬 상태
  type SortKey =
    | "status"
    | "urgency"
    | "sku"
    | "name"
    | "currentStock"
    | "safetyStock"
    | "reorderPoint"
    | "recommendedQty"
    | "estimatedCost"
    | "supplier";
  type SortDirection = "asc" | "desc";

  const [sortKey, setSortKey] = useState<SortKey>("urgency");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const STATUS_ORDER = ["pending", "approved", "rejected"];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey)
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary-600" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary-600" />
    );
  };

  const sortLabel = (columnKey: SortKey) => {
    if (sortKey !== columnKey) return "";
    if (columnKey === "urgency")
      return sortDir === "asc" ? "(품절→주의)" : "(주의→품절)";
    if (columnKey === "status")
      return sortDir === "asc" ? "(대기→거부)" : "(거부→대기)";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const sortableHeadClass =
    "cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";

  // 정렬된 추천 목록
  const sortedRecommendations = useMemo(() => {
    const sorted = [...recommendations];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case "status":
          comparison =
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
        case "urgency":
          comparison = a.urgencyLevel - b.urgencyLevel;
          break;
        case "sku":
          comparison = a.sku.localeCompare(b.sku);
          break;
        case "name":
          comparison = a.productName.localeCompare(b.productName);
          break;
        case "currentStock":
          comparison = a.currentStock - b.currentStock;
          break;
        case "safetyStock":
          comparison = a.safetyStock - b.safetyStock;
          break;
        case "reorderPoint":
          comparison = a.reorderPoint - b.reorderPoint;
          break;
        case "recommendedQty":
          comparison = a.recommendedQty - b.recommendedQty;
          break;
        case "estimatedCost":
          comparison = a.estimatedCost - b.estimatedCost;
          break;
        case "supplier":
          comparison = (a.supplierName || "").localeCompare(
            b.supplierName || ""
          );
          break;
      }

      return sortDir === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [recommendations, sortKey, sortDir]);

  const getUrgencyBadge = (level: number) => {
    switch (level) {
      case 0:
        return (
          <Badge variant="destructive" className="bg-black">
            품절
          </Badge>
        );
      case 1:
        return <Badge variant="destructive">위험</Badge>;
      case 2:
        return (
          <Badge variant="destructive" className="bg-orange-600">
            부족
          </Badge>
        );
      case 3:
        return (
          <Badge variant="default" className="bg-yellow-600">
            주의
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: AutoReorderRecommendation["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="whitespace-nowrap border-blue-300 bg-blue-50 text-blue-700">
            <AlertCircle className="mr-1 h-3 w-3" />
            대기중
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="whitespace-nowrap border-green-300 bg-green-50 text-green-700">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            승인됨
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="whitespace-nowrap border-red-300 bg-red-50 text-red-700">
            <XCircle className="mr-1 h-3 w-3" />
            거부됨
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // pending 상태만 선택 가능
      const pendingIds = sortedRecommendations
        .filter((r) => r.status === "pending")
        .map((r) => r.id);
      onSelectChange(pendingIds);
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, id]);
    } else {
      onSelectChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const handleApprove = async () => {
    if (selectedIds.length === 0 || !onApprove) return;
    setActionInProgress(true);
    try {
      await onApprove(selectedIds);
      onSelectChange([]);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (selectedIds.length === 0 || !onReject) return;
    setActionInProgress(true);
    try {
      await onReject(selectedIds);
      onSelectChange([]);
    } finally {
      setActionInProgress(false);
    }
  };

  if (recommendations.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>자동 발주 추천 없음</AlertTitle>
        <AlertDescription>
          현재 자동 발주가 필요한 품목이 없습니다. 재고 상태가 발주점 이하일 때 자동으로 추천이
          생성됩니다.
        </AlertDescription>
      </Alert>
    );
  }

  const pendingCount = recommendations.filter((r) => r.status === "pending").length;
  const approvedCount = recommendations.filter((r) => r.status === "approved").length;
  const rejectedCount = recommendations.filter((r) => r.status === "rejected").length;

  const totalEstimatedCost = recommendations
    .filter((r) => selectedIds.includes(r.id))
    .reduce((sum, r) => sum + r.estimatedCost, 0);

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>대기중</CardDescription>
            <CardTitle className="text-3xl">{pendingCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">승인 대기중인 자동 발주 추천</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>승인됨</CardDescription>
            <CardTitle className="text-3xl text-green-600">{approvedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">발주서로 전환된 추천</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>거부됨</CardDescription>
            <CardTitle className="text-3xl text-red-600">{rejectedCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">거부된 추천</p>
          </CardContent>
        </Card>
      </div>

      {/* 일괄 승인/거부 액션 바 */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Checkbox checked disabled />
            <span className="text-sm font-medium">{selectedIds.length}개 추천 선택됨</span>
            <Badge variant="secondary" className="text-xs">
              예상 비용: ₩{totalEstimatedCost.toLocaleString()}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleReject}
              disabled={actionInProgress}
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <XCircle className="mr-2 h-4 w-4" />
              거부
            </Button>
            <Button onClick={handleApprove} disabled={actionInProgress} size="sm">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              승인 및 발주
            </Button>
          </div>
        </div>
      )}

      {/* 추천 목록 테이블 */}
      <div className={cn("rounded-md border", className)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    selectedIds.length > 0 &&
                    selectedIds.length === recommendations.filter((r) => r.status === "pending").length
                  }
                  onCheckedChange={handleSelectAll}
                  disabled={pendingCount === 0}
                />
              </TableHead>
              <TableHead
                className={cn("w-[90px] whitespace-nowrap", sortableHeadClass)}
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center">
                  상태
                  <SortIcon columnKey="status" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("status")}
                  </span>
                </div>
              </TableHead>
              <TableHead
                className={cn("w-[90px] whitespace-nowrap", sortableHeadClass)}
                onClick={() => handleSort("urgency")}
              >
                <div className="flex items-center">
                  긴급도
                  <SortIcon columnKey="urgency" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("urgency")}
                  </span>
                </div>
              </TableHead>
              <TableHead
                className={cn("w-[110px]", sortableHeadClass)}
                onClick={() => handleSort("sku")}
              >
                <div className="flex items-center">
                  SKU
                  <SortIcon columnKey="sku" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("sku")}
                  </span>
                </div>
              </TableHead>
              <TableHead className={sortableHeadClass} onClick={() => handleSort("name")}>
                <div className="flex items-center">
                  제품명
                  <SortIcon columnKey="name" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("name")}
                  </span>
                </div>
              </TableHead>
              <TableHead
                className={cn("text-right", sortableHeadClass)}
                onClick={() => handleSort("currentStock")}
              >
                <div className="flex items-center justify-end">
                  현재고
                  <SortIcon columnKey="currentStock" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("currentStock")}
                  </span>
                </div>
              </TableHead>
              <TableHead
                className={cn("text-right", sortableHeadClass)}
                onClick={() => handleSort("safetyStock")}
              >
                <div className="flex items-center justify-end">
                  안전재고
                  <SortIcon columnKey="safetyStock" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("safetyStock")}
                  </span>
                </div>
              </TableHead>
              <TableHead
                className={cn("text-right", sortableHeadClass)}
                onClick={() => handleSort("reorderPoint")}
              >
                <div className="flex items-center justify-end">
                  발주점
                  <SortIcon columnKey="reorderPoint" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("reorderPoint")}
                  </span>
                </div>
              </TableHead>
              <TableHead
                className={cn("text-right", sortableHeadClass)}
                onClick={() => handleSort("recommendedQty")}
              >
                <div className="flex items-center justify-end">
                  추천수량
                  <SortIcon columnKey="recommendedQty" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("recommendedQty")}
                  </span>
                </div>
              </TableHead>
              <TableHead
                className={cn("text-right", sortableHeadClass)}
                onClick={() => handleSort("estimatedCost")}
              >
                <div className="flex items-center justify-end">
                  예상비용
                  <SortIcon columnKey="estimatedCost" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("estimatedCost")}
                  </span>
                </div>
              </TableHead>
              <TableHead className={sortableHeadClass} onClick={() => handleSort("supplier")}>
                <div className="flex items-center">
                  공급자
                  <SortIcon columnKey="supplier" />
                  <span className="ml-1 text-[10px] text-slate-500">
                    {sortLabel("supplier")}
                  </span>
                </div>
              </TableHead>
              <TableHead>예상입고일</TableHead>
              <TableHead className="min-w-[150px]">발주 사유</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecommendations.map((recommendation) => {
              const isPending = recommendation.status === "pending";
              const isDisabled = !isPending || isLoading;

              return (
                <TableRow
                  key={recommendation.id}
                  className={cn(!isPending && "bg-slate-50 opacity-60")}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(recommendation.id)}
                      onCheckedChange={(checked) =>
                        handleSelectOne(recommendation.id, !!checked)
                      }
                      disabled={isDisabled}
                    />
                  </TableCell>
                  <TableCell>{getStatusBadge(recommendation.status)}</TableCell>
                  <TableCell>{getUrgencyBadge(recommendation.urgencyLevel)}</TableCell>
                  <TableCell className="font-mono text-xs">{recommendation.sku}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-slate-400" />
                      {recommendation.productName}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{recommendation.currentStock}</TableCell>
                  <TableCell className="text-right">{recommendation.safetyStock}</TableCell>
                  <TableCell className="text-right">{recommendation.reorderPoint}</TableCell>
                  <TableCell className="text-right font-semibold text-blue-600">
                    {recommendation.recommendedQty}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₩{recommendation.estimatedCost.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <TruckIcon className="h-3 w-3" />
                      {recommendation.supplierName || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <CalendarIcon className="h-3 w-3" />
                      {recommendation.expectedDate}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {recommendation.reason}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 하단 정보 */}
      {pendingCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>자동 발주 승인 안내</AlertTitle>
          <AlertDescription>
            추천된 발주를 승인하면 자동으로 발주서가 생성되어 공급자에게 전송됩니다. 승인 전에
            수량과 공급자를 다시 한번 확인해주세요.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
