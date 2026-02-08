"use client";

import { useMemo, useState } from "react";
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
import { ShoppingCart, ShoppingBag, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReorderItem {
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  safetyStock: number;
  reorderPoint: number;
  daysOfInventory: number;
  recommendedQty: number;
  urgencyLevel: number; // 0: 품절, 1: 위험, 2: 부족, 3: 주의
  supplierId?: string;
  supplierName?: string;
  leadTime: number;
}

interface ReorderItemsTableProps {
  items: ReorderItem[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
  onOrderClick: (item: ReorderItem) => void;
  onBulkOrderClick?: () => void;
  className?: string;
}

type SortKey =
  | "urgency"
  | "sku"
  | "name"
  | "currentStock"
  | "safetyStock"
  | "reorderPoint"
  | "daysOfInventory"
  | "recommendedQty"
  | "supplier";

type SortDirection = "asc" | "desc";

export function ReorderItemsTable({
  items,
  selectedIds,
  onSelectChange,
  onOrderClick,
  onBulkOrderClick,
  className,
}: ReorderItemsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("urgency");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(items.map((item) => item.productId));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (productId: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedIds, productId]);
    } else {
      onSelectChange(selectedIds.filter((id) => id !== productId));
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-primary-600" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-primary-600" />
    );
  };

  const sortLabel = (columnKey: SortKey) => {
    if (sortKey !== columnKey) return "";
    if (columnKey === "urgency") {
      return sortDir === "asc" ? " (품절→주의)" : " (주의→품절)";
    }
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  const sorted = useMemo(() => {
    const compare = (a: ReorderItem, b: ReorderItem): number => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortKey) {
        case "urgency":
          aVal = a.urgencyLevel;
          bVal = b.urgencyLevel;
          break;
        case "sku":
          aVal = a.sku;
          bVal = b.sku;
          break;
        case "name":
          aVal = a.productName;
          bVal = b.productName;
          break;
        case "currentStock":
          aVal = a.currentStock;
          bVal = b.currentStock;
          break;
        case "safetyStock":
          aVal = a.safetyStock;
          bVal = b.safetyStock;
          break;
        case "reorderPoint":
          aVal = a.reorderPoint;
          bVal = b.reorderPoint;
          break;
        case "daysOfInventory":
          aVal = a.daysOfInventory;
          bVal = b.daysOfInventory;
          break;
        case "recommendedQty":
          aVal = a.recommendedQty;
          bVal = b.recommendedQty;
          break;
        case "supplier":
          aVal = a.supplierName || "";
          bVal = b.supplierName || "";
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal, "ko")
          : bVal.localeCompare(aVal, "ko");
      }

      return sortDir === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    };

    return [...items].sort(compare);
  }, [items, sortKey, sortDir]);

  if (items.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-slate-400">
        발주가 필요한 품목이 없습니다
      </div>
    );
  }

  const selectedItems = items.filter((item) => selectedIds.includes(item.productId));
  const canBulkOrder = selectedItems.length > 0 && selectedItems.every((item) => item.supplierId);

  const sortableHeadClass =
    "cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";

  return (
    <div className="space-y-4">
      {/* 일괄 발주 액션 바 */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <Checkbox checked disabled />
            <span className="text-sm font-medium">{selectedIds.length}개 품목 선택됨</span>
            {!canBulkOrder && (
              <Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700">
                일부 품목에 공급자 미지정
              </Badge>
            )}
          </div>
          <Button onClick={onBulkOrderClick} disabled={!canBulkOrder} size="sm">
            <ShoppingBag className="mr-2 h-4 w-4" />
            선택 품목 일괄 발주
          </Button>
        </div>
      )}

      <div className={cn("rounded-md border", className)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.length === items.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className={cn("w-[140px] whitespace-nowrap", sortableHeadClass)} onClick={() => handleSort("urgency")}>
                <div className="flex items-center">
                  긴급도{sortLabel("urgency")}
                  <SortIcon columnKey="urgency" />
                </div>
              </TableHead>
              <TableHead className={cn("w-[120px]", sortableHeadClass)} onClick={() => handleSort("sku")}>
                <div className="flex items-center">
                  SKU{sortLabel("sku")}
                  <SortIcon columnKey="sku" />
                </div>
              </TableHead>
              <TableHead className={sortableHeadClass} onClick={() => handleSort("name")}>
                <div className="flex items-center">
                  제품명{sortLabel("name")}
                  <SortIcon columnKey="name" />
                </div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("currentStock")}>
                <div className="flex items-center justify-end">
                  현재고{sortLabel("currentStock")}
                  <SortIcon columnKey="currentStock" />
                </div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("safetyStock")}>
                <div className="flex items-center justify-end">
                  안전재고{sortLabel("safetyStock")}
                  <SortIcon columnKey="safetyStock" />
                </div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("reorderPoint")}>
                <div className="flex items-center justify-end">
                  발주점{sortLabel("reorderPoint")}
                  <SortIcon columnKey="reorderPoint" />
                </div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("daysOfInventory")}>
                <div className="flex items-center justify-end">
                  재고일수{sortLabel("daysOfInventory")}
                  <SortIcon columnKey="daysOfInventory" />
                </div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("recommendedQty")}>
                <div className="flex items-center justify-end">
                  추천수량{sortLabel("recommendedQty")}
                  <SortIcon columnKey="recommendedQty" />
                </div>
              </TableHead>
              <TableHead className={sortableHeadClass} onClick={() => handleSort("supplier")}>
                <div className="flex items-center">
                  공급자{sortLabel("supplier")}
                  <SortIcon columnKey="supplier" />
                </div>
              </TableHead>
              <TableHead className="w-[100px] text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow key={item.productId}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(item.productId)}
                    onCheckedChange={(checked) => handleSelectOne(item.productId, !!checked)}
                  />
                </TableCell>
                <TableCell>{getUrgencyBadge(item.urgencyLevel)}</TableCell>
                <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                <TableCell className="font-medium">{item.productName}</TableCell>
                <TableCell className="text-right">{item.currentStock}</TableCell>
                <TableCell className="text-right">{item.safetyStock}</TableCell>
                <TableCell className="text-right">{item.reorderPoint}</TableCell>
                <TableCell className="text-right">{item.daysOfInventory.toFixed(1)}일</TableCell>
                <TableCell className="text-right font-semibold text-blue-600">
                  {item.recommendedQty}
                </TableCell>
                <TableCell className="text-sm text-slate-600">{item.supplierName || "-"}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => onOrderClick(item)}>
                    <ShoppingCart className="mr-1 h-4 w-4" />
                    발주
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
