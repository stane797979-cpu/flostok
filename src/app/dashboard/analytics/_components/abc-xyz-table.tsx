"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ABCGrade, XYZGrade, FMRGrade } from "@/server/services/scm/abc-xyz-analysis";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ProductAnalysis {
  id: string;
  sku: string;
  name: string;
  abcGrade: ABCGrade;
  xyzGrade: XYZGrade;
  fmrGrade?: FMRGrade | null;
  combinedGrade: string;
  revenue: number;
  variationRate: number;
  strategy: string;
}

interface ABCXYZTableProps {
  products: ProductAnalysis[];
  selectedGrade: string | null;
}

type SortField = "name" | "abcGrade" | "xyzGrade" | "revenue" | "variationRate";
type SortDirection = "asc" | "desc" | null;

const ABC_BADGE_COLORS: Record<ABCGrade, string> = {
  A: "bg-green-100 text-green-800 hover:bg-green-100",
  B: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  C: "bg-slate-100 text-slate-800 hover:bg-slate-100",
};

const XYZ_BADGE_COLORS: Record<XYZGrade, string> = {
  X: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  Y: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  Z: "bg-orange-100 text-orange-800 hover:bg-orange-100",
};

const FMR_BADGE_COLORS: Record<FMRGrade, string> = {
  F: "border-red-300 bg-red-50 text-red-700",
  M: "border-yellow-300 bg-yellow-50 text-yellow-700",
  R: "border-slate-300 bg-slate-50 text-slate-500",
};

export function ABCXYZTable({ products, selectedGrade }: ABCXYZTableProps) {
  const [abcFilter, setAbcFilter] = useState<string>("all");
  const [xyzFilter, setXyzFilter] = useState<string>("all");
  const [fmrFilter, setFmrFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // 필터링
  let filteredProducts = products;

  if (selectedGrade) {
    filteredProducts = filteredProducts.filter((p) => p.combinedGrade === selectedGrade);
  }

  if (abcFilter !== "all") {
    filteredProducts = filteredProducts.filter((p) => p.abcGrade === abcFilter);
  }

  if (xyzFilter !== "all") {
    filteredProducts = filteredProducts.filter((p) => p.xyzGrade === xyzFilter);
  }

  if (fmrFilter !== "all") {
    filteredProducts = filteredProducts.filter((p) => p.fmrGrade === fmrFilter);
  }

  // 정렬
  if (sortDirection) {
    filteredProducts = [...filteredProducts].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue, "ko")
          : bValue.localeCompare(aValue, "ko");
      }

      const aNum = Number(aValue);
      const bNum = Number(bValue);
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortField("revenue");
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-4 w-4 text-slate-900" />;
    }
    if (sortDirection === "desc") {
      return <ArrowDown className="h-4 w-4 text-slate-900" />;
    }
    return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>제품 목록</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <Select value={abcFilter} onValueChange={setAbcFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="ABC 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="A">A등급</SelectItem>
                <SelectItem value="B">B등급</SelectItem>
                <SelectItem value="C">C등급</SelectItem>
              </SelectContent>
            </Select>

            <Select value={xyzFilter} onValueChange={setXyzFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="XYZ 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="X">X등급</SelectItem>
                <SelectItem value="Y">Y등급</SelectItem>
                <SelectItem value="Z">Z등급</SelectItem>
              </SelectContent>
            </Select>

            <Select value={fmrFilter} onValueChange={setFmrFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="FMR 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="F">F (고빈도)</SelectItem>
                <SelectItem value="M">M (중빈도)</SelectItem>
                <SelectItem value="R">R (저빈도)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm text-slate-500">총 {filteredProducts.length}개 제품</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">SKU</TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1 hover:text-slate-900"
                  >
                    제품명
                    <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort("abcGrade")}
                    className="mx-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    ABC
                    <SortIcon field="abcGrade" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    onClick={() => handleSort("xyzGrade")}
                    className="mx-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    XYZ
                    <SortIcon field="xyzGrade" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help border-b border-dashed border-slate-400">FMR</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="font-medium">출고 빈도 분석 (Fast-Medium-Rare)</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          ABC가 &quot;얼마나 많이 팔리는가&quot;(금액)라면,
                          FMR은 &quot;얼마나 자주 출고되는가&quot;(횟수)를 측정합니다.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("revenue")}
                    className="ml-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    매출액
                    <SortIcon field="revenue" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort("variationRate")}
                    className="ml-auto flex items-center gap-1 hover:text-slate-900"
                  >
                    변동계수
                    <SortIcon field="variationRate" />
                  </button>
                </TableHead>
                <TableHead className="min-w-64">권장 조치</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-slate-400">
                    조건에 맞는 제품이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={ABC_BADGE_COLORS[product.abcGrade]}>
                        {product.abcGrade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={XYZ_BADGE_COLORS[product.xyzGrade]}>
                        {product.xyzGrade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.fmrGrade ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={cn("font-mono cursor-help", FMR_BADGE_COLORS[product.fmrGrade])}
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
                                {product.fmrGrade === "F" && "월 10회 이상 출고"}
                                {product.fmrGrade === "M" && "월 4~9회 출고"}
                                {product.fmrGrade === "R" && "월 3회 이하 출고"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {product.revenue.toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {product.variationRate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{product.strategy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
