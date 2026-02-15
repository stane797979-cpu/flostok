"use client";

import { useState } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreHorizontal, Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { type Product } from "@/server/db/schema";

type SortField = "sku" | "name" | "category" | "safetyStock" | "status" | "abcXyzGrade";
type SortOrder = "asc" | "desc";

interface ProductWithStatus extends Product {
  status: {
    key: string;
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
  };
  currentStock?: number;
  supplierName?: string;
}

export type { ProductWithStatus };

function isNewProduct(product: ProductWithStatus): boolean {
  const metadata = product.metadata as Record<string, unknown> | null;
  const gradeInfo = metadata?.gradeInfo as Record<string, unknown> | undefined;
  return gradeInfo?.isNewProduct === true;
}

interface ProductTableProps {
  products?: ProductWithStatus[];
  onView?: (product: ProductWithStatus) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string, name: string) => void;
  onBulkDelete?: (ids: string[], names: string[]) => void;
}

export function ProductTable({ products = [], onView, onEdit, onDelete, onBulkDelete }: ProductTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const ABC_XYZ_ORDER: Record<string, number> = {
    AX: 1, AY: 2, AZ: 3, BX: 4, BY: 5, BZ: 6, CX: 7, CY: 8, CZ: 9,
  };

  const getAbcXyzOrder = (p: ProductWithStatus) => {
    if (!p.abcGrade || !p.xyzGrade) return 99;
    return ABC_XYZ_ORDER[`${p.abcGrade}${p.xyzGrade}`] ?? 99;
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (!sortField) return 0;

    let cmp = 0;

    if (sortField === "status") {
      cmp = a.status.label.localeCompare(b.status.label);
    } else if (sortField === "abcXyzGrade") {
      cmp = getAbcXyzOrder(a) - getAbcXyzOrder(b);
    } else {
      const aValue = (a[sortField as keyof typeof a] as string | number) || "";
      const bValue = (b[sortField as keyof typeof b] as string | number) || "";
      if (typeof aValue === "string" && typeof bValue === "string") {
        cmp = aValue.localeCompare(bValue);
      } else {
        cmp = Number(aValue) - Number(bValue);
      }
    }

    return sortOrder === "asc" ? cmp : -cmp;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    const names = products.filter((p) => selectedIds.has(p.id)).map((p) => p.name);
    onBulkDelete?.(ids, names);
    setSelectedIds(new Set());
  };

  const isAllSelected = products.length > 0 && selectedIds.size === products.length;
  const isSomeSelected = selectedIds.size > 0;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-400" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  if (products.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border bg-white text-slate-400 dark:bg-slate-950">
        등록된 제품이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 대량 액션 바 */}
      {isSomeSelected && (
        <div className="flex items-center gap-4 rounded-lg bg-slate-100 p-3 dark:bg-slate-800">
          <span className="text-sm font-medium">{selectedIds.size}개 항목 선택됨</span>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            일괄 삭제
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
            선택 해제
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-white dark:bg-slate-950">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox checked={isAllSelected} onCheckedChange={handleSelectAll} />
              </TableHead>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort("sku")}
                >
                  SKU
                  <SortIcon field="sku" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort("name")}
                >
                  제품명
                  <SortIcon field="name" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort("category")}
                >
                  카테고리
                  <SortIcon field="category" />
                </Button>
              </TableHead>
              <TableHead className="text-right">현재고</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort("safetyStock")}
                >
                  안전재고
                  <SortIcon field="safetyStock" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort("status")}
                >
                  상태
                  <SortIcon field="status" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => handleSort("abcXyzGrade")}
                >
                  등급
                  <SortIcon field="abcXyzGrade" />
                </Button>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.map((product) => (
              <TableRow
                key={product.id}
                className={cn(selectedIds.has(product.id) && "bg-slate-50 dark:bg-slate-900")}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(product.id)}
                    onCheckedChange={(checked) => handleSelectOne(product.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-slate-500">{product.category || "-"}</TableCell>
                <TableCell className="text-right font-mono">
                  {(product.currentStock ?? 0).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-slate-500">
                  {(product.safetyStock ?? 0).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      product.status.bgClass,
                      product.status.textClass,
                      product.status.borderClass
                    )}
                  >
                    {product.status.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {isNewProduct(product) ? (
                      <Badge className="bg-blue-500 text-white border-blue-600 font-bold text-xs">
                        NEW
                      </Badge>
                    ) : product.abcGrade && product.xyzGrade ? (
                      <Badge variant="outline" className="font-mono">
                        {product.abcGrade}{product.xyzGrade}
                      </Badge>
                    ) : product.abcGrade || product.xyzGrade ? (
                      <Badge variant="outline" className="font-mono text-slate-400">
                        {product.abcGrade || "?"}{product.xyzGrade || "?"}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                    {product.fmrGrade && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono text-[10px] px-1.5 cursor-help",
                                product.fmrGrade === "F" && "border-red-300 bg-red-50 text-red-700",
                                product.fmrGrade === "M" && "border-yellow-300 bg-yellow-50 text-yellow-700",
                                product.fmrGrade === "R" && "border-slate-300 bg-slate-50 text-slate-500",
                              )}
                            >
                              {product.fmrGrade}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-medium">
                              {product.fmrGrade === "F" && "Fast Moving (고빈도 출고)"}
                              {product.fmrGrade === "M" && "Medium Moving (중빈도 출고)"}
                              {product.fmrGrade === "R" && "Rare Moving (저빈도 출고)"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {product.fmrGrade === "F" && "월 10회 이상 출고 — 상시 재고 확보 필요"}
                              {product.fmrGrade === "M" && "월 4~9회 출고 — 정기 보충 관리"}
                              {product.fmrGrade === "R" && "월 3회 이하 출고 — 재고 최소화 또는 주문생산 검토"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView?.(product)}>
                        <Eye className="mr-2 h-4 w-4" />
                        상세 보기
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit?.(product)}>
                        <Edit className="mr-2 h-4 w-4" />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => onDelete?.(product.id, product.name)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
