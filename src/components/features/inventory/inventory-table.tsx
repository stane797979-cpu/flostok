"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShoppingCart, MoreHorizontal, Settings2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInventoryStatus } from "@/lib/constants/inventory-status";

export interface InventoryItem {
  id: string;
  productId: string;
  currentStock: number;
  availableStock: number | null;
  daysOfInventory: number | null;
  location: string | null;
  product: {
    sku: string;
    name: string;
    safetyStock: number | null;
    reorderPoint: number | null;
    abcGrade: "A" | "B" | "C" | null;
    xyzGrade: "X" | "Y" | "Z" | null;
  };
}

interface InventoryTableProps {
  items: InventoryItem[];
  onAdjust: (item: InventoryItem) => void;
}

type SortKey = "sku" | "name" | "status" | "abcXyzGrade" | "currentStock" | "safetyStock" | "reorderPoint" | "daysOfInventory" | "location";

const ABC_XYZ_ORDER: Record<string, number> = {
  AX: 1, AY: 2, AZ: 3, BX: 4, BY: 5, BZ: 6, CX: 7, CY: 8, CZ: 9,
};
type SortDirection = "asc" | "desc";

const STATUS_ORDER = [
  "out_of_stock",
  "critical",
  "shortage",
  "caution",
  "optimal",
  "excess",
  "overstock",
];

export function InventoryTable({ items, onAdjust }: InventoryTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const router = useRouter();

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
    if (columnKey === "status") {
      return sortDir === "asc" ? "(위험→과잉)" : "(과잉→위험)";
    }
    return sortDir === "asc" ? "↑" : "↓";
  };

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;

    return [...items].sort((a, b) => {
      switch (sortKey) {
        case "sku":
          return dir * a.product.sku.localeCompare(b.product.sku);
        case "name":
          return dir * a.product.name.localeCompare(b.product.name);
        case "status": {
          const statusA = getInventoryStatus(a.currentStock, a.product.safetyStock ?? 0, a.product.reorderPoint ?? 0);
          const statusB = getInventoryStatus(b.currentStock, b.product.safetyStock ?? 0, b.product.reorderPoint ?? 0);
          return dir * (STATUS_ORDER.indexOf(statusA.key) - STATUS_ORDER.indexOf(statusB.key));
        }
        case "abcXyzGrade": {
          const aKey = a.product.abcGrade && a.product.xyzGrade ? `${a.product.abcGrade}${a.product.xyzGrade}` : null;
          const bKey = b.product.abcGrade && b.product.xyzGrade ? `${b.product.abcGrade}${b.product.xyzGrade}` : null;
          return dir * ((aKey ? ABC_XYZ_ORDER[aKey] ?? 99 : 99) - (bKey ? ABC_XYZ_ORDER[bKey] ?? 99 : 99));
        }
        case "currentStock":
          return dir * (a.currentStock - b.currentStock);
        case "safetyStock":
          return dir * ((a.product.safetyStock ?? 0) - (b.product.safetyStock ?? 0));
        case "reorderPoint":
          return dir * ((a.product.reorderPoint ?? 0) - (b.product.reorderPoint ?? 0));
        case "daysOfInventory":
          return dir * ((a.daysOfInventory ?? 9999) - (b.daysOfInventory ?? 9999));
        case "location":
          return dir * (a.location ?? "").localeCompare(b.location ?? "");
        default:
          return 0;
      }
    });
  }, [items, sortKey, sortDir]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sorted.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const isAllSelected = selectedIds.length === sorted.length && sorted.length > 0;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < sorted.length;

  const sortableHeadClass = "cursor-pointer select-none hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors";

  return (
    <div className="space-y-4">
      {/* 대량 액션 바 */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-4 dark:bg-slate-900">
          <span className="text-sm font-medium">{selectedIds.length}개 항목 선택됨</span>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={() => router.push("/dashboard/orders")}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              일괄 발주 생성
            </Button>
          </div>
        </div>
      )}

      {/* 재고 테이블 */}
      <div className="rounded-lg border bg-white dark:bg-slate-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="전체 선택"
                  className={cn(isSomeSelected && "data-[state=checked]:bg-slate-400")}
                />
              </TableHead>
              <TableHead className={cn("w-[100px]", sortableHeadClass)} onClick={() => handleSort("sku")}>
                <div className="flex items-center gap-0.5">SKU <span className="text-[10px] text-primary-600">{sortLabel("sku")}</span><SortIcon columnKey="sku" /></div>
              </TableHead>
              <TableHead className={sortableHeadClass} onClick={() => handleSort("name")}>
                <div className="flex items-center gap-0.5">제품명 <span className="text-[10px] text-primary-600">{sortLabel("name")}</span><SortIcon columnKey="name" /></div>
              </TableHead>
              <TableHead className={sortableHeadClass} onClick={() => handleSort("status")}>
                <div className="flex items-center gap-0.5">상태 <span className="text-[10px] text-primary-600">{sortLabel("status")}</span><SortIcon columnKey="status" /></div>
              </TableHead>
              <TableHead className={sortableHeadClass} onClick={() => handleSort("abcXyzGrade")}>
                <div className="flex items-center gap-0.5">등급 <span className="text-[10px] text-primary-600">{sortLabel("abcXyzGrade")}</span><SortIcon columnKey="abcXyzGrade" /></div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("currentStock")}>
                <div className="flex items-center justify-end gap-0.5">현재고 <span className="text-[10px] text-primary-600">{sortLabel("currentStock")}</span><SortIcon columnKey="currentStock" /></div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("safetyStock")}>
                <div className="flex items-center justify-end gap-0.5">안전재고 <span className="text-[10px] text-primary-600">{sortLabel("safetyStock")}</span><SortIcon columnKey="safetyStock" /></div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("reorderPoint")}>
                <div className="flex items-center justify-end gap-0.5">발주점 <span className="text-[10px] text-primary-600">{sortLabel("reorderPoint")}</span><SortIcon columnKey="reorderPoint" /></div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("daysOfInventory")}>
                <div className="flex items-center justify-end gap-0.5">재고일수 <span className="text-[10px] text-primary-600">{sortLabel("daysOfInventory")}</span><SortIcon columnKey="daysOfInventory" /></div>
              </TableHead>
              <TableHead className={cn("text-center", sortableHeadClass)} onClick={() => handleSort("location")}>
                <div className="flex items-center justify-center gap-0.5">위치 <span className="text-[10px] text-primary-600">{sortLabel("location")}</span><SortIcon columnKey="location" /></div>
              </TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-slate-500">
                  재고 데이터가 없습니다
                </TableCell>
              </TableRow>
            )}
            {sorted.map((item) => {
              const safetyStock = item.product.safetyStock ?? 0;
              const reorderPoint = item.product.reorderPoint ?? 0;
              const status = getInventoryStatus(item.currentStock, safetyStock, reorderPoint);
              const needsOrder = ["out_of_stock", "critical", "shortage", "caution"].includes(
                status.key
              );
              const inventoryDays = item.daysOfInventory;
              const isSelected = selectedIds.includes(item.id);

              return (
                <TableRow
                  key={item.id}
                  className={cn(isSelected && "bg-slate-50 dark:bg-slate-900")}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(item.id, checked as boolean)}
                      aria-label={`${item.product.name} 선택`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.product.sku}</TableCell>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        status.bgClass,
                        status.textClass,
                        status.borderClass
                      )}
                    >
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.product.abcGrade && item.product.xyzGrade ? (
                      <Badge variant="outline" className="font-mono">
                        {item.product.abcGrade}{item.product.xyzGrade}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.currentStock.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-500">
                    {safetyStock.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-500">
                    {reorderPoint.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {inventoryDays !== null ? (
                      <span
                        className={cn(
                          inventoryDays <= 7 && "font-medium text-red-600",
                          inventoryDays > 7 && inventoryDays <= 14 && "text-orange-600",
                          inventoryDays > 14 && inventoryDays <= 30 && "text-yellow-600",
                          inventoryDays > 30 && "text-green-600"
                        )}
                      >
                        {inventoryDays > 365 ? "365+" : inventoryDays}일
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-slate-500">
                    {item.location || "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAdjust(item)}>
                          <Settings2 className="mr-2 h-4 w-4" />
                          재고 조정
                        </DropdownMenuItem>
                        {needsOrder && (
                          <DropdownMenuItem onClick={() => router.push("/dashboard/orders")}>
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            발주 생성
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
