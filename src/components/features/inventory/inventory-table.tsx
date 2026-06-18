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
import { ShoppingCart, MoreHorizontal, Settings2, ArrowUpDown, ArrowUp, ArrowDown, Info, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getInventoryStatus } from "@/lib/constants/inventory-status";

export interface InventoryItem {
  id: string;
  productId: string;
  currentStock: number;
  allocatedStock: number;
  availableStock: number | null;
  daysOfInventory: number | null;
  avgDailySales: number | null;
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

interface RopModalItem {
  name: string;
  sku: string;
  reorderPoint: number;
  safetyStock: number;
  avgDailySales: number | null;
  abcGrade: "A" | "B" | "C" | null;
}

export function InventoryTable({ items, onAdjust }: InventoryTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [ropModalItem, setRopModalItem] = useState<RopModalItem | null>(null);
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
    <>
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

      {/* 모바일 카드 뷰 */}
      <div className="space-y-3 hidden">
        {sorted.length === 0 && (
          <div className="rounded-lg border bg-white p-8 text-center text-slate-500 dark:bg-slate-950">
            재고 데이터가 없습니다
          </div>
        )}
        {sorted.map((item) => {
          const safetyStock = item.product.safetyStock ?? 0;
          const reorderPoint = item.product.reorderPoint ?? 0;
          const status = getInventoryStatus(item.currentStock, safetyStock, reorderPoint);
          const inventoryDays = item.daysOfInventory;

          return (
            <div key={item.id} className="rounded-lg border bg-white p-4 space-y-2 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{item.product.name}</p>
                  <p className="text-xs font-mono text-slate-500">{item.product.sku}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <Badge variant="outline" className={cn("font-medium", status.bgClass, status.textClass, status.borderClass)}>
                    {status.label}
                  </Badge>
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div>
                  <span className="text-slate-500">현재고</span>
                  <span className="ml-1 font-mono font-medium">{item.currentStock.toLocaleString()}</span>
                </div>
                {item.allocatedStock > 0 && (
                  <div>
                    <span className="text-slate-500">할당재고</span>
                    <span className="ml-1 font-mono text-orange-600">{item.allocatedStock.toLocaleString()}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-500">가용재고</span>
                  <span className="ml-1 font-mono font-medium text-blue-600">{Math.max(0, item.currentStock - item.allocatedStock).toLocaleString()}</span>
                </div>
                {inventoryDays !== null && (
                  <div>
                    <span className="text-slate-500">재고일수</span>
                    <span className={cn(
                      "ml-1 font-mono",
                      inventoryDays <= 7 && "font-medium text-red-600",
                      inventoryDays > 7 && inventoryDays <= 14 && "text-orange-600",
                      inventoryDays > 14 && "text-slate-600"
                    )}>
                      {inventoryDays > 365 ? "365+" : inventoryDays}일
                    </span>
                  </div>
                )}
                {item.product.abcGrade && item.product.xyzGrade && (
                  <Badge variant="outline" className="font-mono">
                    {item.product.abcGrade}{item.product.xyzGrade}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 재고 테이블 */}
      <div className="rounded-lg border bg-white dark:bg-slate-950 overflow-x-auto">
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
              <TableHead className={cn("w-[140px] whitespace-nowrap", sortableHeadClass)} onClick={() => handleSort("sku")}>
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
              <TableHead className="text-right text-orange-600">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-end gap-1 cursor-default">
                        할당재고 <Info className="h-3 w-3 text-orange-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      현재고에 포함된 수량 중 출고 예약(홀딩)된 물량. 출고 완료 전이라 실사용 불가.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className="text-right text-blue-600">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-end gap-1 cursor-default">
                        가용재고 <Info className="h-3 w-3 text-blue-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      실제로 사용 가능한 수량. 현재고에서 할당재고를 뺀 값.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("safetyStock")}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-end gap-0.5">
                        안전재고 <span className="text-[10px] text-primary-600">{sortLabel("safetyStock")}</span><SortIcon columnKey="safetyStock" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      현재고에 포함된 수량. 수요 변동·리드타임 지연 대비 최소 보유 버퍼로, 이 수량 이하 시 발주가 필요합니다.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("reorderPoint")}>
                <div className="flex items-center justify-end gap-0.5">발주점 <span className="text-[10px] text-primary-600">{sortLabel("reorderPoint")}</span><SortIcon columnKey="reorderPoint" /></div>
              </TableHead>
              <TableHead className={cn("text-right", sortableHeadClass)} onClick={() => handleSort("daysOfInventory")}>
                <div className="flex items-center justify-end gap-0.5">재고일수 <span className="text-[10px] text-primary-600">{sortLabel("daysOfInventory")}</span><SortIcon columnKey="daysOfInventory" /></div>
              </TableHead>
              <TableHead className={cn("text-center", sortableHeadClass)} onClick={() => handleSort("location")}>
                <div className="flex items-center justify-center gap-0.5">창고구분 <span className="text-[10px] text-primary-600">{sortLabel("location")}</span><SortIcon columnKey="location" /></div>
              </TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="h-24 text-center text-slate-500">
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
                  <TableCell className="font-mono text-sm whitespace-nowrap">{item.product.sku}</TableCell>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className={cn(
                              "cursor-default font-medium",
                              status.bgClass,
                              status.textClass,
                              status.borderClass
                            )}
                          >
                            {status.label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {status.description}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                  <TableCell className="text-right font-mono">
                    {item.allocatedStock > 0 ? (
                      <span className="text-orange-600">{item.allocatedStock.toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-600 font-medium">
                    {Math.max(0, item.currentStock - item.allocatedStock).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-500">
                    {safetyStock.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-500">
                    <span
                      className="cursor-pointer underline decoration-dotted hover:text-slate-700"
                      onClick={() => setRopModalItem({
                        name: item.product.name,
                        sku: item.product.sku,
                        reorderPoint,
                        safetyStock,
                        avgDailySales: item.avgDailySales,
                        abcGrade: item.product.abcGrade,
                      })}
                    >
                      {reorderPoint.toLocaleString()}
                    </span>
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

    {/* 재발주점 산출 근거 모달 */}
    {ropModalItem && (() => {
      const { name, sku, reorderPoint, safetyStock, avgDailySales, abcGrade } = ropModalItem;
      const leadTimeDemand = reorderPoint - safetyStock;
      const leadTime = avgDailySales && avgDailySales > 0
        ? Math.round(leadTimeDemand / avgDailySales)
        : null;
      const serviceLevel = abcGrade === "A" ? "95%" : abcGrade === "B" ? "90%" : "85%";

      return (
        <Dialog open onOpenChange={() => setRopModalItem(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base">{name}</DialogTitle>
              <p className="text-xs text-slate-400 font-mono">{sku}</p>
            </DialogHeader>
            <p className="text-xs font-semibold text-slate-500 mb-2">재발주점(ROP) 산출 근거</p>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">산출 공식</td>
                  <td className="py-2 font-semibold">일평균출고 × 리드타임 + 안전재고</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">일평균 출고</td>
                  <td className="py-2">
                    {avgDailySales != null
                      ? <>{avgDailySales.toFixed(1)}개/일 <span className="text-xs text-slate-400">(최근 30일 기준)</span></>
                      : <span className="text-slate-300">판매실적 없음</span>}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">리드타임 중 수요</td>
                  <td className="py-2">
                    {leadTime != null
                      ? <>{leadTimeDemand}개 <span className="text-xs text-slate-400">(≈ {leadTime}일치)</span></>
                      : <>{leadTimeDemand}개</>}
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">안전재고(SS)</td>
                  <td className="py-2">{safetyStock.toLocaleString()}개</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 text-slate-500">서비스수준</td>
                  <td className="py-2">{serviceLevel} <span className="text-xs text-slate-400">({abcGrade ?? "-"}등급 기준)</span></td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">재발주점</td>
                  <td className="py-2 text-blue-600 font-bold text-base">
                    {reorderPoint.toLocaleString()}개
                    <span className="text-xs text-slate-400 ml-2">= {leadTimeDemand} + {safetyStock}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 leading-relaxed">
              현재고가 <b className="text-slate-700">{reorderPoint.toLocaleString()}개</b> 이하로 떨어지면 리드타임 동안 재고가 소진될 수 있으므로 즉시 발주가 필요합니다.
            </div>
          </DialogContent>
        </Dialog>
      );
    })()}
    </>
  );
}

