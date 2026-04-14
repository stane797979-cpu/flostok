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
import { Button } from "@/components/ui/button";
import type { ABCGrade, XYZGrade, FMRGrade } from "@/server/services/scm/abc-xyz-analysis";

export interface ProductAnalysis {
  id: string;
  sku: string;
  name: string;
  abcGrade: ABCGrade;
  xyzGrade: XYZGrade;
  fmrGrade?: FMRGrade | null;
  combinedGrade: string;
  combinedGradeFMR?: string;
  revenue: number;
  variationRate: number;
  avgMonthlyCount?: number;
  strategy: string;
}

interface ABCXYZTableProps {
  products: ProductAnalysis[];
  selectedGrade: string | null;
}

type SortField = "name" | "abcGrade" | "xyzGrade" | "fmrGrade" | "revenue" | "variationRate" | "avgMonthlyCount";
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
  F: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  M: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  R: "bg-slate-100 text-slate-600 hover:bg-slate-100",
};

export function ABCXYZTable({ products, selectedGrade }: ABCXYZTableProps) {
  const [abcFilter, setAbcFilter] = useState<string>("all");
  const [xyzFilter, setXyzFilter] = useState<string>("all");
  const [fmrFilter, setFmrFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

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
      const aValue = a[sortField] ?? "";
      const bValue = b[sortField] ?? "";

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
      if (sortDirection === "asc") setSortDirection("desc");
      else if (sortDirection === "desc") { setSortDirection(null); setSortField("revenue"); }
      else setSortDirection("asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    if (sortDirection === "asc") return <ArrowUp className="h-4 w-4 text-slate-900" />;
    if (sortDirection === "desc") return <ArrowDown className="h-4 w-4 text-slate-900" />;
    return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
  };

  const pagedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>제품 목록</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={abcFilter} onValueChange={(v) => { setAbcFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="ABC 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ABC 전체</SelectItem>
                <SelectItem value="A">A등급</SelectItem>
                <SelectItem value="B">B등급</SelectItem>
                <SelectItem value="C">C등급</SelectItem>
              </SelectContent>
            </Select>

            <Select value={xyzFilter} onValueChange={(v) => { setXyzFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="XYZ 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">XYZ 전체</SelectItem>
                <SelectItem value="X">X등급</SelectItem>
                <SelectItem value="Y">Y등급</SelectItem>
                <SelectItem value="Z">Z등급</SelectItem>
              </SelectContent>
            </Select>

            <Select value={fmrFilter} onValueChange={(v) => { setFmrFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="FMR 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">FMR 전체</SelectItem>
                <SelectItem value="F">F등급 (고빈도)</SelectItem>
                <SelectItem value="M">M등급 (중빈도)</SelectItem>
                <SelectItem value="R">R등급 (저빈도)</SelectItem>
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
                  <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-slate-900">
                    제품명 <SortIcon field="name" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button onClick={() => handleSort("abcGrade")} className="mx-auto flex items-center gap-1 hover:text-slate-900">
                    ABC <SortIcon field="abcGrade" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button onClick={() => handleSort("xyzGrade")} className="mx-auto flex items-center gap-1 hover:text-slate-900">
                    XYZ <SortIcon field="xyzGrade" />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button onClick={() => handleSort("fmrGrade")} className="mx-auto flex items-center gap-1 hover:text-slate-900">
                    FMR <SortIcon field="fmrGrade" />
                  </button>
                </TableHead>
                <TableHead className="text-center font-semibold">3중 등급</TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort("revenue")} className="ml-auto flex items-center gap-1 hover:text-slate-900">
                    매출액 <SortIcon field="revenue" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort("variationRate")} className="ml-auto flex items-center gap-1 hover:text-slate-900">
                    변동계수 <SortIcon field="variationRate" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button onClick={() => handleSort("avgMonthlyCount")} className="ml-auto flex items-center gap-1 hover:text-slate-900">
                    월출고건수 <SortIcon field="avgMonthlyCount" />
                  </button>
                </TableHead>
                <TableHead className="min-w-48">권장 조치</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-slate-400">
                    조건에 맞는 제품이 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                pagedProducts.map((product) => (
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
                        <Badge className={FMR_BADGE_COLORS[product.fmrGrade]}>
                          {product.fmrGrade}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono font-bold tracking-wider">
                        {product.combinedGradeFMR || product.combinedGrade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {product.revenue.toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {product.variationRate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-500">
                      {product.avgMonthlyCount?.toFixed(1) ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{product.strategy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {/* 페이지네이션 */}
        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>페이지당</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>개 · 총 {filteredProducts.length}개</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>이전</Button>
            <span className="px-2">{currentPage} / {Math.max(1, Math.ceil(filteredProducts.length / pageSize))}</span>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= Math.ceil(filteredProducts.length / pageSize)} onClick={() => setCurrentPage((p) => p + 1)}>다음</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
