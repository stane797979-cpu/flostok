"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PSIFilters } from "./psi-filters";
import { PSITable } from "./psi-table";
import type { PSIResult } from "@/server/services/scm/psi-aggregation";

interface PSIClientProps {
  data: PSIResult;
}

export function PSIClient({ data }: PSIClientProps) {
  const [search, setSearch] = useState("");
  const [abcFilter, setAbcFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // 카테고리 목록 추출
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of data.products) {
      if (p.category) cats.add(p.category);
    }
    return Array.from(cats).sort();
  }, [data.products]);

  // 필터링
  const filteredProducts = useMemo(() => {
    return data.products.filter((p) => {
      // 텍스트 검색
      if (search) {
        const q = search.toLowerCase();
        if (!p.sku.toLowerCase().includes(q) && !p.productName.toLowerCase().includes(q)) {
          return false;
        }
      }
      // ABC 등급 필터
      if (abcFilter !== "all" && p.abcGrade !== abcFilter) return false;
      // 카테고리 필터
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      return true;
    });
  }, [data.products, search, abcFilter, categoryFilter]);

  // 요약 통계
  const totalSKU = data.totalProducts;
  const stockoutCount = data.products.filter((p) => p.currentStock === 0).length;
  const belowSafetyCount = data.products.filter(
    (p) => p.currentStock > 0 && p.currentStock < p.safetyStock
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">PSI 계획</h1>
        <p className="mt-2 text-slate-500">
          수요(Sales) · 공급(Purchase) · 재고(Inventory) 통합 계획표
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">전체 SKU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSKU}개</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">조회 기간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.periods.length}개월</div>
            <p className="text-xs text-muted-foreground">
              {data.periods[0]} ~ {data.periods[data.periods.length - 1]}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">품절</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stockoutCount}개</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">안전재고 미달</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{belowSafetyCount}개</div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 + 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>PSI 통합 테이블</CardTitle>
              <CardDescription>
                {filteredProducts.length}개 SKU × {data.periods.length}개월
              </CardDescription>
            </div>
            <Badge variant="outline">{filteredProducts.length} / {totalSKU}</Badge>
          </div>
          <PSIFilters
            search={search}
            onSearchChange={setSearch}
            abcFilter={abcFilter}
            onAbcFilterChange={setAbcFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories}
          />
        </CardHeader>
        <CardContent className="p-0">
          <PSITable products={filteredProducts} periods={data.periods} />
        </CardContent>
      </Card>
    </div>
  );
}
