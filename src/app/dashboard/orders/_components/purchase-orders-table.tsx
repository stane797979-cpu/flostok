"use client";

import { useState, useMemo, useRef, memo } from "react";
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
import { Eye, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface PurchaseOrderListItem {
  id: string;
  orderNumber: string;
  supplierName: string;
  itemsCount: number;
  totalAmount: number;
  status: "draft" | "ordered" | "pending_receipt" | "received" | "cancelled";
  orderDate: string;
  expectedDate: string | null;
}

interface PurchaseOrdersTableProps {
  orders: PurchaseOrderListItem[];
  onViewClick: (orderId: string) => void;
  onDownloadClick?: (orderId: string) => void;
  selectedIds?: string[];
  onSelectChange?: (ids: string[]) => void;
  className?: string;
}

type SortKey = "orderNumber" | "supplier" | "itemsCount" | "totalAmount" | "status" | "orderDate" | "expectedDate";
type SortDirection = "asc" | "desc";

const STATUS_ORDER = ["draft", "ordered", "pending_receipt", "received", "cancelled"];

export const PurchaseOrdersTable = memo(function PurchaseOrdersTable({ orders, onViewClick, onDownloadClick, selectedIds, onSelectChange, className }: PurchaseOrdersTableProps) {
  // 모든 상태 체크 가능
  const checkableOrders = orders;
  const allCheckableSelected = checkableOrders.length > 0 && checkableOrders.every((o) => selectedIds?.includes(o.id));

  // Shift+클릭 범위 선택을 위한 lastCheckedIndex
  const lastCheckedIndexRef = useRef<number>(-1);

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectChange) return;
    if (checked) {
      onSelectChange(checkableOrders.map((o) => o.id));
    } else {
      onSelectChange([]);
    }
    lastCheckedIndexRef.current = -1;
  };

  const [sortKey, setSortKey] = useState<SortKey>("orderDate");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400" />;
    return sortDir === "asc"
      ? <ArrowUp className="ml-1 h-3 w-3 text-primary-600" />
      : <ArrowDown className="ml-1 h-3 w-3 text-primary-600" />;
  };

  const sortLabel = (columnKey: SortKey) => {
    if (sortKey !== columnKey) return "";
    if (columnKey === "status") return sortDir === "asc" ? "(초안→취소)" : "(취소→초안)";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;

    return [...orders].sort((a, b) => {
      switch (sortKey) {
        case "orderNumber":
          return dir * a.orderNumber.localeCompare(b.orderNumber);
        case "supplier":
          return dir * a.supplierName.localeCompare(b.supplierName);
        case "itemsCount":
          return dir * (a.itemsCount - b.itemsCount);
        case "totalAmount":
          return dir * (a.totalAmount - b.totalAmount);
        case "status":
          return dir * (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
        case "orderDate":
          return dir * (new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
        case "expectedDate": {
          const dateA = a.expectedDate ? new Date(a.expectedDate).getTime() : 0;
          const dateB = b.expectedDate ? new Date(b.expectedDate).getTime() : 0;
          return dir * (dateA - dateB);
        }
        default:
          return 0;
      }
    });
  }, [orders, sortKey, sortDir]);

  // Shift+클릭: 범위 선택 (sorted 배열 참조 필요하므로 sorted 이후 정의)
  const handleSelectOne = (orderId: string, checked: boolean, index: number, shiftKey: boolean) => {
    if (!onSelectChange || !selectedIds) return;

    if (shiftKey && lastCheckedIndexRef.current >= 0) {
      const start = Math.min(lastCheckedIndexRef.current, index);
      const end = Math.max(lastCheckedIndexRef.current, index);
      const rangeIds = sorted
        .slice(start, end + 1)
        .map((o) => o.id);

      const newIds = Array.from(new Set([...selectedIds, ...rangeIds]));
      onSelectChange(newIds);
    } else {
      if (checked) {
        onSelectChange([...selectedIds, orderId]);
      } else {
        onSelectChange(selectedIds.filter((id) => id !== orderId));
      }
    }
    lastCheckedIndexRef.current = index;
  };

  const getStatusBadge = (status: PurchaseOrderListItem["status"]) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">초안</Badge>;
      case "ordered":
        return <Badge className="bg-blue-600">발주완료</Badge>;
      case "pending_receipt":
        return <Badge className="bg-yellow-600">입고대기</Badge>;
      case "received":
        return <Badge className="bg-green-600">입고완료</Badge>;
      case "cancelled":
        return <Badge variant="destructive">취소</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
    }).format(amount);
  };

  if (orders.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        발주 내역이 없습니다
      </div>
    );
  }

  const sortableHeadClass = "cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";

  return (
    <>
      {/* 모바일 카드 뷰 */}
      <div className={cn("space-y-3 md:hidden", className)}>
        {sorted.map((order) => (
          <div key={order.id} className="rounded-lg border bg-white dark:bg-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                <p className="text-sm text-slate-600 truncate">{order.supplierName}</p>
              </div>
              <div className="shrink-0 ml-2">
                {getStatusBadge(order.status)}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-0.5">
                <p className="font-semibold">{formatCurrency(order.totalAmount)}</p>
                <p className="text-slate-500">{formatDate(order.orderDate)} · {order.itemsCount}품목</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onViewClick(order.id)}>
                <Eye className="mr-1 h-4 w-4" />
                상세
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱 테이블 뷰 */}
      <div className={cn("hidden rounded-md border md:block", className)}>
        <Table>
        <TableHeader>
          <TableRow>
            {onSelectChange && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allCheckableSelected}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label="전체 선택"
                />
              </TableHead>
            )}
            <TableHead className={cn("whitespace-nowrap", sortableHeadClass)} onClick={() => handleSort("orderNumber")}>
              <div className="flex items-center gap-0.5">발주번호 <SortIcon columnKey="orderNumber" /><span className="text-[10px] text-primary-600">{sortLabel("orderNumber")}</span></div>
            </TableHead>
            <TableHead className={cn("whitespace-nowrap", sortableHeadClass)} onClick={() => handleSort("supplier")}>
              <div className="flex items-center gap-0.5">공급자 <SortIcon columnKey="supplier" /><span className="text-[10px] text-primary-600">{sortLabel("supplier")}</span></div>
            </TableHead>
            <TableHead className={cn("whitespace-nowrap text-right", sortableHeadClass)} onClick={() => handleSort("itemsCount")}>
              <div className="flex items-center justify-end gap-0.5">품목수 <SortIcon columnKey="itemsCount" /><span className="text-[10px] text-primary-600">{sortLabel("itemsCount")}</span></div>
            </TableHead>
            <TableHead className={cn("whitespace-nowrap text-right", sortableHeadClass)} onClick={() => handleSort("totalAmount")}>
              <div className="flex items-center justify-end gap-0.5">총금액 <SortIcon columnKey="totalAmount" /><span className="text-[10px] text-primary-600">{sortLabel("totalAmount")}</span></div>
            </TableHead>
            <TableHead className={cn("whitespace-nowrap", sortableHeadClass)} onClick={() => handleSort("status")}>
              <div className="flex items-center gap-0.5">상태 <SortIcon columnKey="status" /><span className="text-[10px] text-primary-600">{sortLabel("status")}</span></div>
            </TableHead>
            <TableHead className={cn("whitespace-nowrap", sortableHeadClass)} onClick={() => handleSort("orderDate")}>
              <div className="flex items-center gap-0.5">발주일 <SortIcon columnKey="orderDate" /><span className="text-[10px] text-primary-600">{sortLabel("orderDate")}</span></div>
            </TableHead>
            <TableHead className={cn("whitespace-nowrap", sortableHeadClass)} onClick={() => handleSort("expectedDate")}>
              <div className="flex items-center gap-0.5">예상입고일 <SortIcon columnKey="expectedDate" /><span className="text-[10px] text-primary-600">{sortLabel("expectedDate")}</span></div>
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((order, index) => {
            return (
            <TableRow key={order.id}>
              {onSelectChange && (
                <TableCell>
                  <Checkbox
                    checked={selectedIds?.includes(order.id) ?? false}
                    onClick={(e) => {
                      e.preventDefault();
                      const isCurrentlyChecked = selectedIds?.includes(order.id) ?? false;
                      handleSelectOne(order.id, !isCurrentlyChecked, index, e.shiftKey);
                    }}
                    aria-label={`${order.orderNumber} 선택`}
                  />
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap font-mono text-sm">{order.orderNumber}</TableCell>
              <TableCell className="font-medium">{order.supplierName}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{order.itemsCount}개</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold">
                {formatCurrency(order.totalAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap">{getStatusBadge(order.status)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-slate-600">
                {formatDate(order.orderDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-slate-600">
                {order.expectedDate ? formatDate(order.expectedDate) : "-"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => onViewClick(order.id)}>
                    <Eye className="mr-1 h-4 w-4" />
                    상세
                  </Button>
                  {onDownloadClick && (
                    <Button size="sm" variant="ghost" onClick={() => onDownloadClick(order.id)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </>
  );
});
