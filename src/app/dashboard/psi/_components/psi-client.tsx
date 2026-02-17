"use client";

import { useState, useMemo, useRef, useTransition, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Download, Calculator, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { PSIFilters } from "./psi-filters";
import { PSITable } from "./psi-table";
import { uploadPSIPlanExcel, generateSOPQuantities, getPSIData, type SOPMethod } from "@/server/actions/psi";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import type { PSIResult } from "@/server/services/scm/psi-aggregation";

interface PSIClientProps {
  data: PSIResult;
}

const SOP_METHODS: Array<{ value: SOPMethod; label: string; description: string }> = [
  {
    value: "by_order_method",
    label: "발주방식별 자동",
    description: "제품별 설정(정량/정기)에 따라 자동으로 다른 공식 적용. 미설정 시 안전재고 보충.",
  },
  {
    value: "match_outbound",
    label: "출고계획 동일",
    description: "SCM = 출고계획 수량 (출고예상량 만큼 공급)",
  },
  {
    value: "safety_stock",
    label: "안전재고 보충",
    description: "SCM = max(0, 출고P + 안전재고 - 기초재고)",
  },
  {
    value: "target_days",
    label: "목표재고일수",
    description: "SCM = max(0, 출고P + max(일평균출고×목표일수, 안전재고) - 기초재고)",
  },
  {
    value: "forecast",
    label: "수요예측 연동",
    description: "SCM = AI 수요예측 데이터 활용",
  },
];

export function PSIClient({ data: initialData }: PSIClientProps) {
  const [data, setData] = useState(initialData);
  const [monthOffset, setMonthOffset] = useState(0);
  const [isLoadingPSI, setIsLoadingPSI] = useState(false);
  const [search, setSearch] = useState("");
  const [abcFilter, setAbcFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [sopMethod, setSopMethod] = useState<SOPMethod>("by_order_method");
  const [targetDays, setTargetDays] = useState(30);
  const [fixedQtySubMethod, setFixedQtySubMethod] = useState<SOPMethod>("safety_stock");
  const [fixedPeriodSubMethod, setFixedPeriodSubMethod] = useState<SOPMethod>("target_days");
  const [sopDialogOpen, setSopDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  // 월 이동 (기간 창 이동)
  const loadPSIWithOffset = useCallback(async (offset: number) => {
    setIsLoadingPSI(true);
    try {
      const result = await getPSIData(offset);
      setData(result);
      setMonthOffset(offset);
    } catch (error) {
      console.error("PSI 데이터 조회 오류:", error);
      toast({ title: "오류", description: "PSI 데이터를 불러오지 못했습니다", variant: "destructive" });
    } finally {
      setIsLoadingPSI(false);
    }
  }, [toast]);

  const handlePrevPeriod = useCallback(() => {
    loadPSIWithOffset(monthOffset - 3);
  }, [monthOffset, loadPSIWithOffset]);

  const handleNextPeriod = useCallback(() => {
    loadPSIWithOffset(monthOffset + 3);
  }, [monthOffset, loadPSIWithOffset]);

  const handleResetPeriod = useCallback(() => {
    loadPSIWithOffset(0);
  }, [loadPSIWithOffset]);

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

      // 헤더 생성: SKU + 발주방식 + 각 기간별 SCM/출고계획
      const headers: string[] = ["SKU", "발주방식"];
      for (const period of futurePeriods) {
        headers.push(`${period} SCM`);
        headers.push(`${period} 출고계획`);
      }

      // 기존 데이터를 포함한 행 생성
      const rows: (string | number)[][] = data.products.map((product) => {
        const omLabel = product.orderMethod === "fixed_quantity" ? "정량"
          : product.orderMethod === "fixed_period" ? "정기"
          : "";
        const row: (string | number)[] = [product.sku, omLabel];
        for (const period of futurePeriods) {
          const month = product.months.find((m) => m.period === period);
          row.push(month?.sopQuantity || 0);
          row.push(month?.outboundPlan || 0);
        }
        return row;
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // 컬럼 너비 설정
      const colWidths: Array<{ wch: number }> = [{ wch: 15 }, { wch: 10 }];
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
        sopMethod === "target_days" ? targetDays : undefined,
        sopMethod === "by_order_method" ? {
          fixedQuantityMethod: fixedQtySubMethod,
          fixedPeriodMethod: fixedPeriodSubMethod,
          targetDays,
        } : undefined
      );
      if (result.success) {
        toast({ title: "SCM 가이드 산출 완료", description: result.message });
        setSopDialogOpen(false);
        router.refresh();
      } else {
        toast({ title: "SCM 가이드 산출 실패", description: result.message, variant: "destructive" });
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
                SCM 가이드 산출
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>SCM 가이드 수량 자동 산출</DialogTitle>
                <DialogDescription>
                  출고계획 수량 기반으로 SCM 공급 가이드 수량을 자동 산출합니다.
                  미래 6개월분이 일괄 생성됩니다.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {SOP_METHODS.map((m) => (
                  <div key={m.value}>
                    <label
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

                    {/* 발주방식별 자동 → 정량/정기 서브메서드 (바로 아래 표시) */}
                    {m.value === "by_order_method" && sopMethod === "by_order_method" && (
                      <div className="space-y-3 pl-7 border-l-2 border-purple-200 ml-3 mt-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-300 text-blue-700 bg-blue-50">정량</Badge>
                            정량발주 제품 산출방식
                          </Label>
                          <Select value={fixedQtySubMethod} onValueChange={(v) => setFixedQtySubMethod(v as SOPMethod)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="match_outbound">출고계획 동일</SelectItem>
                              <SelectItem value="safety_stock">안전재고 보충</SelectItem>
                              <SelectItem value="target_days">목표재고일수</SelectItem>
                              <SelectItem value="forecast">수요예측 연동</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700 bg-green-50">정기</Badge>
                            정기발주 제품 산출방식
                          </Label>
                          <Select value={fixedPeriodSubMethod} onValueChange={(v) => setFixedPeriodSubMethod(v as SOPMethod)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="match_outbound">출고계획 동일</SelectItem>
                              <SelectItem value="safety_stock">안전재고 보충</SelectItem>
                              <SelectItem value="target_days">목표재고일수</SelectItem>
                              <SelectItem value="forecast">수요예측 연동</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(fixedQtySubMethod === "target_days" || fixedPeriodSubMethod === "target_days") && (
                          <div className="flex items-center gap-2">
                            <Label htmlFor="sub-target-days" className="text-xs whitespace-nowrap">
                              목표 재고일수
                            </Label>
                            <Input
                              id="sub-target-days"
                              type="number"
                              min={1}
                              max={365}
                              value={targetDays}
                              onChange={(e) => setTargetDays(Number(e.target.value) || 30)}
                              className="w-20 h-8"
                            />
                            <span className="text-xs text-muted-foreground">일</span>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">미설정 제품은 안전재고 보충 적용</p>
                      </div>
                    )}

                    {/* 목표재고일수 → 일수 입력 (바로 아래 표시) */}
                    {m.value === "target_days" && sopMethod === "target_days" && (
                      <div className="flex items-center gap-2 pl-7 mt-2">
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
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSopDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleGenerateSOP} disabled={isPending}>
                  {isPending ? "산출 중..." : "SCM 산출"}
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
            양식 다운로드
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
            {isPending ? "업로드 중..." : "출고계획 업로드"}
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
        <span className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-300 text-blue-700 bg-blue-50">정량</Badge>
          정량발주
        </span>
        <span className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-700 bg-green-50">정기</Badge>
          정기발주
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[9px] font-bold text-sky-500">A</span>
          <span>자동예측(F/C)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-[9px] font-bold text-amber-500">M</span>
          <span>수동예측(F/C)</span>
        </span>
        <span>SCM = AI가이드 · P = 계획 · A = 실적</span>
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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePrevPeriod} disabled={isLoadingPSI}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 text-center">
                {isLoadingPSI ? (
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  <>
                    <div className="text-lg font-bold">{data.periods.length}개월</div>
                    <p className="text-xs text-muted-foreground">
                      {data.periods[0]} ~ {data.periods[data.periods.length - 1]}
                    </p>
                  </>
                )}
              </div>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleNextPeriod} disabled={isLoadingPSI}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {monthOffset !== 0 && (
              <Button variant="ghost" size="sm" className="mt-1 h-6 w-full text-xs text-muted-foreground" onClick={handleResetPeriod} disabled={isLoadingPSI}>
                현재로 돌아가기
              </Button>
            )}
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
                {filteredProducts.length}개 SKU × {data.periods.length}개월 · 발주방식 + 7컬럼(SCM/입고P·A/출고P·A/기말P·A)
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
