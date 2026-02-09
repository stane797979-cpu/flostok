"use client";

import { useState, useMemo, useRef, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { PSIFilters } from "./psi-filters";
import { PSITable } from "./psi-table";
import { uploadPSIPlanExcel } from "@/server/actions/psi";
import { useToast } from "@/hooks/use-toast";
import type { PSIResult } from "@/server/services/scm/psi-aggregation";

interface PSIClientProps {
  data: PSIResult;
}

export function PSIClient({ data }: PSIClientProps) {
  const [search, setSearch] = useState("");
  const [abcFilter, setAbcFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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
      if (search) {
        const q = search.toLowerCase();
        if (!p.sku.toLowerCase().includes(q) && !p.productName.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (abcFilter !== "all" && p.abcGrade !== abcFilter) return false;
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await uploadPSIPlanExcel(formData);
      if (result.success) {
        toast({ title: "업로드 완료", description: result.message });
      } else {
        toast({ title: "업로드 실패", description: result.message, variant: "destructive" });
      }
    });

    // 같은 파일 재선택 가능하도록 초기화
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PSI 계획</h1>
          <p className="mt-2 text-slate-500">
            수요(Sales) · 공급(Purchase) · 재고(Inventory) 통합 계획표
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            {isPending ? "업로드 중..." : "S&OP / 입고계획 업로드"}
          </Button>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-300" />
          입고(실적)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-orange-100 border border-orange-300" />
          출고(실적)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-purple-100 border border-purple-300" />
          <em>계획/예측 (이탤릭)</em>
        </span>
        <span>S&OP = 공급계획 물량</span>
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
                {filteredProducts.length}개 SKU × {data.periods.length}개월 · 4컬럼(S&OP/입고/출고/기말)
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
