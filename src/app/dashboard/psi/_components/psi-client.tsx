"use client";

import { useState, useMemo, useRef, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Download, Calculator } from "lucide-react";
import { PSIFilters } from "./psi-filters";
import { PSITable } from "./psi-table";
import { uploadPSIPlanExcel, generateSOPQuantities, type SOPMethod } from "@/server/actions/psi";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { PSIResult } from "@/server/services/scm/psi-aggregation";

interface PSIClientProps {
  data: PSIResult;
}

const SOP_METHODS: Array<{ value: SOPMethod; label: string; description: string }> = [
  {
    value: "match_outbound",
    label: "출고계획 동일",
    description: "S&OP = 출고P (출고할 만큼 공급)",
  },
  {
    value: "safety_stock",
    label: "안전재고 보충",
    description: "S&OP = max(0, 출고P + 안전재고 - 기초재고)",
  },
  {
    value: "target_days",
    label: "목표재고일수",
    description: "S&OP = max(0, 출고P + max(일평균출고×목표일수, 안전재고) - 기초재고)",
  },
  {
    value: "forecast",
    label: "수요예측 연동",
    description: "S&OP = 수요예측 시스템 데이터 활용",
  },
];

export function PSIClient({ data }: PSIClientProps) {
  const [search, setSearch] = useState("");
  const [abcFilter, setAbcFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [sopMethod, setSopMethod] = useState<SOPMethod>("safety_stock");
  const [targetDays, setTargetDays] = useState(30);
  const [sopDialogOpen, setSopDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

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
        router.refresh();
      } else {
        toast({ title: "업로드 실패", description: result.message, variant: "destructive" });
      }
    });

    // 같은 파일 재선택 가능하도록 초기화
    e.target.value = "";
  };

  const handleDownloadTemplate = () => {
    import("xlsx").then((XLSX) => {
      // 미래 기간 추출 (현재월 포함)
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const futurePeriods = data.periods.filter((p) => p >= currentPeriod);

      // 헤더 생성: SKU + 각 기간별 S&OP/출고계획
      const headers: string[] = ["SKU"];
      for (const period of futurePeriods) {
        headers.push(`${period} S&OP`);
        headers.push(`${period} 출고계획`);
      }

      // 기존 데이터를 포함한 행 생성
      const rows: (string | number)[][] = data.products.map((product) => {
        const row: (string | number)[] = [product.sku];
        for (const period of futurePeriods) {
          const month = product.months.find((m) => m.period === period);
          row.push(month?.sopQuantity || 0);
          row.push(month?.outboundPlan || 0);
        }
        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // 컬럼 너비 설정
      const colWidths: Array<{ wch: number }> = [{ wch: 15 }];
      for (let i = 0; i < futurePeriods.length * 2; i++) {
        colWidths.push({ wch: 14 });
      }
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PSI계획");
      XLSX.writeFile(wb, "PSI_계획_데이터.xlsx");
    });
  };

  const handleGenerateSOP = () => {
    startTransition(async () => {
      const result = await generateSOPQuantities(
        sopMethod,
        sopMethod === "target_days" ? targetDays : undefined
      );
      if (result.success) {
        toast({ title: "S&OP 산출 완료", description: result.message });
        setSopDialogOpen(false);
        router.refresh();
      } else {
        toast({ title: "S&OP 산출 실패", description: result.message, variant: "destructive" });
      }
    });
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
        <div className="flex gap-2">
          {/* S&OP 자동 산출 */}
          <Dialog open={sopDialogOpen} onOpenChange={setSopDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Calculator className="mr-1 h-4 w-4" />
                S&OP 자동 산출
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>S&OP 공급계획 자동 산출</DialogTitle>
                <DialogDescription>
                  출고계획(출고P) 기반으로 S&OP 수량을 자동 산출합니다.
                  미래 7개월분이 일괄 생성됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {SOP_METHODS.map((m) => (
                  <label
                    key={m.value}
                    className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      sopMethod === m.value
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sop-method"
                      value={m.value}
                      checked={sopMethod === m.value}
                      onChange={() => setSopMethod(m.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">{m.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                    </div>
                  </label>
                ))}

                {sopMethod === "target_days" && (
                  <div className="flex items-center gap-2 pl-7">
                    <Label htmlFor="target-days" className="text-sm whitespace-nowrap">
                      목표 재고일수
                    </Label>
                    <Input
                      id="target-days"
                      type="number"
                      min={1}
                      max={365}
                      value={targetDays}
                      onChange={(e) => setTargetDays(Number(e.target.value) || 30)}
                      className="w-20 h-8"
                    />
                    <span className="text-sm text-muted-foreground">일</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSopDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleGenerateSOP} disabled={isPending}>
                  {isPending ? "산출 중..." : "S&OP 산출"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
          >
            <Download className="mr-1 h-4 w-4" />
            데이터 내보내기
          </Button>
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
            {isPending ? "업로드 중..." : "데이터 업로드"}
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
          <em>계획/예측 (이탤릭, 보라 배경)</em>
        </span>
        <span>P = 계획(Plan) · A = 실적(Actual)</span>
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
                {filteredProducts.length}개 SKU × {data.periods.length}개월 · 7컬럼(S&OP/입고P·A/출고P·A/기말P·A)
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
