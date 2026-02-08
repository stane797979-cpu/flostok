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

export function PurchaseOrdersTable({ orders, onViewClick, onDownloadClick, selectedIds, onSelectChange, className }: PurchaseOrdersTableProps) {
  const cancellableStatuses: PurchaseOrderListItem["status"][] = ["draft", "ordered"];
  const cancellableOrders = orders.filter((o) => cancellableStatuses.includes(o.status));
  const allCancellableSelected = cancellableOrders.length > 0 && cancellableOrders.every((o) => selectedIds?.includes(o.id));

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectChange) return;
    if (checked) {
      onSelectChange(cancellableOrders.map((o) => o.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (orderId: string, checked: boolean) => {
    if (!onSelectChange || !selectedIds) return;
    if (checked) {
      onSelectChange([...selectedIds, orderId]);
    } else {
      onSelectChange(selectedIds.filter((id) => id !== orderId));
    }
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
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {onSelectChange && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allCancellableSelected}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label="취소 가능 발주 전체 선택"
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
          {sorted.map((order) => {
            const isCancellable = cancellableStatuses.includes(order.status);
            return (
            <TableRow key={order.id}>
              {onSelectChange && (
                <TableCell>
                  {isCancellable ? (
                    <Checkbox
                      checked={selectedIds?.includes(order.id) ?? false}
                      onCheckedChange={(checked) => handleSelectOne(order.id, !!checked)}
                      aria-label={`${order.orderNumber} 선택`}
                    />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
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
  );
}
