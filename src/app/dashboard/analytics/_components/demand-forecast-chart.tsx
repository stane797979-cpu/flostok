"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ReferenceLine, ReferenceArea } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, BarChart3, Target, AlertCircle, Check, ChevronsUpDown, Settings2, Sparkles, Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDemandForecast, getAggregateForecast } from "@/server/actions/analytics";
import { getFulfillmentRateData } from "@/server/actions/fulfillment-rate";
import { FulfillmentRateTable } from "./fulfillment-rate-table";
import { SalesTrendChart } from "./sales-trend-chart";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type MainTab = "sales-trend" | "forecast" | "fulfillment";
type ViewTab = "product" | "abc" | "xyz" | "all";

interface AggregateGroup {
  key: string;
  label: string;
  productCount: number;
  history: Array<{ month: string; value: number }>;
  predicted: Array<{ month: string; value: number }>;
  method: string;
  mape: number;
  confidence: string;
}

interface ForecastData {
  productId: string;
  productName: string;
  method: string;
  confidence: string;
  mape: number;
  selectionReason: string;
  seasonallyAdjusted: boolean;
  isManual: boolean;
  meta: {
    abcGrade: string | null;
    xyzGrade: string | null;
    turnoverRate: number | null;
    yoyGrowthRate: number | null;
    isOverstock: boolean;
    dataMonths: number;
  };
  history: Array<{ month: string; value: number }>;
  predicted: Array<{ month: string; value: number }>;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  abcGrade: string | null;
  xyzGrade: string | null;
}

/** ABC-XYZ 등급 조합 필터 옵션 */
const GRADE_FILTER_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "A", label: "ABC: A" },
  { value: "B", label: "ABC: B" },
  { value: "C", label: "ABC: C" },
  { value: "X", label: "XYZ: X" },
  { value: "Y", label: "XYZ: Y" },
  { value: "Z", label: "XYZ: Z" },
  { value: "AX", label: "AX" },
  { value: "AY", label: "AY" },
  { value: "AZ", label: "AZ" },
  { value: "BX", label: "BX" },
  { value: "BY", label: "BY" },
  { value: "BZ", label: "BZ" },
  { value: "CX", label: "CX" },
  { value: "CY", label: "CY" },
  { value: "CZ", label: "CZ" },
] as const;

const METHOD_LABELS: Record<string, string> = {
  WMA: "가중이동평균 (WMA)",
  SES: "지수평활법 (SES)",
  Holts: "이중지수평활 (Holt's)",
};

const CONFIDENCE_MAP: Record<string, { label: string; color: string }> = {
  high: { label: "높음", color: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300" },
  medium: { label: "보통", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300" },
  low: { label: "낮음", color: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

const ABC_COLORS: Record<string, string> = {
  A: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800",
  B: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800",
  C: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
};

const XYZ_COLORS: Record<string, string> = {
  X: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800",
  Y: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800",
  Z: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
};

const forecastChartConfig = {
  history: { label: "과거 실적", color: "#3b82f6" },
  predicted: { label: "수요 예측", color: "#f59e0b" },
} satisfies ChartConfig;

export function DemandForecastChart() {
  // 메인 탭: 수요예측 / 실출고율
  const [mainTab, setMainTab] = useState<MainTab>("forecast");

  // 뷰 탭: 개별제품 / ABC별 / XYZ별 / 전체
  const [viewTab, setViewTab] = useState<ViewTab>("product");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // 등급 필터
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  // 수동/자동 선택 상태
  const [selectionMode, setSelectionMode] = useState<"auto" | "manual">("auto");
  const [manualMethod, setManualMethod] = useState<string>("WMA");
  const [manualAlpha, setManualAlpha] = useState<string>("0.3");
  const [manualBeta, setManualBeta] = useState<string>("0.1");
  const [manualWindowSize, setManualWindowSize] = useState<string>("3");

  // 집계 예측 상태
  const [aggGroups, setAggGroups] = useState<AggregateGroup[]>([]);
  const [aggLoading, setAggLoading] = useState(false);

  // 실출고율 상태
  type FulfillmentData = Awaited<ReturnType<typeof getFulfillmentRateData>>;
  const [fulfillmentData, setFulfillmentData] = useState<FulfillmentData>(null);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);

  // 등급 필터링된 제품 목록
  const filteredProducts = useMemo(() => {
    if (gradeFilter === "all") return products;

    return products.filter((p) => {
      if (gradeFilter.length === 2) {
        // AX, BY 등 조합 필터
        return p.abcGrade === gradeFilter[0] && p.xyzGrade === gradeFilter[1];
      } else if (["A", "B", "C"].includes(gradeFilter)) {
        return p.abcGrade === gradeFilter;
      } else if (["X", "Y", "Z"].includes(gradeFilter)) {
        return p.xyzGrade === gradeFilter;
      }
      return true;
    });
  }, [products, gradeFilter]);

  // 각 등급 조합별 제품 수 계산
  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    for (const p of products) {
      if (p.abcGrade) counts[p.abcGrade] = (counts[p.abcGrade] || 0) + 1;
      if (p.xyzGrade) counts[p.xyzGrade] = (counts[p.xyzGrade] || 0) + 1;
      if (p.abcGrade && p.xyzGrade) {
        const combo = `${p.abcGrade}${p.xyzGrade}`;
        counts[combo] = (counts[combo] || 0) + 1;
      }
    }
    return counts;
  }, [products]);

  const loadForecast = useCallback(async (
    productId?: string,
    mode?: "auto" | "manual",
    method?: string,
    params?: Record<string, number>
  ) => {
    setIsLoading(true);
    try {
      const options: {
        productId?: string;
        manualMethod?: "SMA" | "SES" | "Holts";
        manualParams?: Record<string, number>;
      } = {};

      if (productId) options.productId = productId;
      if (mode === "manual" && method) {
        options.manualMethod = method as "WMA" | "SES" | "Holts";
        options.manualParams = params;
      }

      const result = await getDemandForecast(options);
      setProducts(result.products);
      setForecast(result.forecast);
      if (result.forecast) {
        setSelectedProductId(result.forecast.productId);
      }
    } catch {
      setForecast(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAggregate = useCallback(async (tab: ViewTab) => {
    if (tab === "product") return;
    setAggLoading(true);
    try {
      const groupBy = tab === "all" ? "all" : tab === "abc" ? "A" : "X";
      const result = await getAggregateForecast({ groupBy });
      setAggGroups(result.groups);
    } catch {
      setAggGroups([]);
    } finally {
      setAggLoading(false);
    }
  }, []);

  const handleTabChange = (tab: ViewTab) => {
    setViewTab(tab);
    if (tab !== "product") {
      loadAggregate(tab);
    }
  };

  const handleMainTabChange = (tab: MainTab) => {
    setMainTab(tab);
    if (tab === "fulfillment" && fulfillmentData === null && !fulfillmentLoading) {
      setFulfillmentLoading(true);
      getFulfillmentRateData()
        .then((data) => setFulfillmentData(data))
        .catch(() => setFulfillmentData(null))
        .finally(() => setFulfillmentLoading(false));
    }
  };

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    if (selectionMode === "manual") {
      const params = buildManualParams();
      loadForecast(productId, "manual", manualMethod, params);
    } else {
      loadForecast(productId);
    }
  };

  const buildManualParams = () => {
    const params: Record<string, number> = {};
    if (manualMethod === "WMA") {
      params.windowSize = Number(manualWindowSize) || 3;
    } else if (manualMethod === "SES") {
      params.alpha = Number(manualAlpha) || 0.3;
    } else if (manualMethod === "Holts") {
      params.alpha = Number(manualAlpha) || 0.3;
      params.beta = Number(manualBeta) || 0.1;
    }
    return params;
  };

  const handleModeChange = (mode: "auto" | "manual") => {
    setSelectionMode(mode);
    if (mode === "auto") {
      loadForecast(selectedProductId || undefined);
    }
  };

  const handleManualApply = () => {
    const params = buildManualParams();
    loadForecast(selectedProductId || undefined, "manual", manualMethod, params);
  };

  // Recharts용 데이터 변환
  const rechartsData = useMemo(() => {
    if (!forecast) return [];

    const historyCount = forecast.history.length;
    const result: Array<{ month: string; history: number | null; predicted: number | null }> = [];

    forecast.history.forEach((h) => {
      result.push({ month: h.month, history: h.value, predicted: null });
    });

    if (result.length > 0 && forecast.predicted.length > 0) {
      result[historyCount - 1].predicted = result[historyCount - 1].history;
    }

    forecast.predicted.forEach((p) => {
      result.push({ month: p.month, history: null, predicted: p.value });
    });

    return result;
  }, [forecast]);

  const boundaryMonth = useMemo(() => {
    if (!forecast || forecast.history.length === 0) return null;
    return forecast.history[forecast.history.length - 1].month;
  }, [forecast]);

  const lastMonth = useMemo(() => {
    if (!forecast || forecast.predicted.length === 0) return null;
    return forecast.predicted[forecast.predicted.length - 1].month;
  }, [forecast]);

  const stats = useMemo(() => {
    if (!forecast) return null;
    const historyValues = forecast.history.map((h) => h.value);
    const avgHistory = historyValues.length > 0
      ? Math.round(historyValues.reduce((a, b) => a + b, 0) / historyValues.length)
      : 0;
    const avgPredicted = forecast.predicted.length > 0
      ? Math.round(forecast.predicted.reduce((a, b) => a + b.value, 0) / forecast.predicted.length)
      : 0;
    const trend = avgHistory > 0 ? ((avgPredicted - avgHistory) / avgHistory) * 100 : 0;
    return { avgHistory, avgPredicted, trend };
  }, [forecast]);

  return (
    <div className="space-y-4">
      {/* 메인 탭: 출고량 추이 / 수요예측 / 실출고율 */}
      <div className="flex gap-1 border-b pb-0">
        {(["sales-trend", "forecast", "fulfillment"] as MainTab[]).map((tab) => {
          const labels: Record<MainTab, string> = { "sales-trend": "출고량 추이", forecast: "수요예측", fulfillment: "실출고율" };
          return (
            <button
              key={tab}
              onClick={() => handleMainTabChange(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                mainTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* 출고량 추이 탭 */}
      {mainTab === "sales-trend" && (
        <SalesTrendChart />
      )}

      {/* 실출고율 탭 */}
      {mainTab === "fulfillment" && (
        <div>
          {fulfillmentLoading ? (
            <div className="flex h-64 items-center justify-center text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              실출고율 데이터 로딩 중...
            </div>
          ) : (
            <FulfillmentRateTable data={fulfillmentData} />
          )}
        </div>
      )}

      {/* 수요예측 */}
      {mainTab === "forecast" && (
      <div className="space-y-4">
      {/* 뷰 탭 */}
      <div className="flex items-center gap-1 flex-wrap">
        {(["product", "abc", "xyz", "all"] as ViewTab[]).map((tab) => {
          const labels: Record<ViewTab, string> = {
            product: "개별 제품",
            abc: "ABC 등급별",
            xyz: "XYZ 등급별",
            all: "전체 집계",
          };
          return (
            <Button
              key={tab}
              size="sm"
              variant={viewTab === tab ? "default" : "outline"}
              onClick={() => handleTabChange(tab)}
              className="h-8 px-3 text-xs"
            >
              {labels[tab]}
            </Button>
          );
        })}
        <Badge variant="outline" className="ml-2 text-xs px-2.5 py-1">
          기준: 최근 12개월 판매 데이터 기반 예측
        </Badge>
      </div>

      {/* 집계 뷰 (ABC / XYZ / 전체) */}
      {viewTab !== "product" && (
        <AggregateView tab={viewTab} groups={aggGroups} loading={aggLoading} />
      )}

      {/* 개별 제품 뷰 */}
      {viewTab === "product" && (
      <div className="space-y-4">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          수요예측 데이터를 분석 중...
        </div>
      ) : products.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">수요예측 데이터 없음</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
              제품을 등록하고 판매 데이터를 입력하면 수요예측 결과가 표시됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
      <>
      {/* 제품 선택 + 방법 선택 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">제품 선택</CardTitle>
          <CardDescription>수요예측을 확인할 제품을 선택하세요</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 등급 조합 필터 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-muted-foreground">등급 필터</Label>
              <span className="text-xs text-muted-foreground">
                ({filteredProducts.length}개 제품)
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {GRADE_FILTER_OPTIONS.map((opt) => {
                const count = gradeCounts[opt.value] || 0;
                if (opt.value !== "all" && count === 0) return null;
                return (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant={gradeFilter === opt.value ? "default" : "outline"}
                    onClick={() => {
                      setGradeFilter(opt.value);
                      // 필터 변경 시 해당 그룹의 첫 제품으로 자동 선택
                      const filtered = opt.value === "all" ? products : products.filter((p) => {
                        if (opt.value.length === 2) return p.abcGrade === opt.value[0] && p.xyzGrade === opt.value[1];
                        if (["A", "B", "C"].includes(opt.value)) return p.abcGrade === opt.value;
                        return p.xyzGrade === opt.value;
                      });
                      if (filtered.length > 0 && !filtered.find(p => p.id === selectedProductId)) {
                        handleProductChange(filtered[0].id);
                      }
                    }}
                    className={cn(
                      "h-7 px-2 text-xs gap-1",
                      opt.value.length === 2 && "font-mono"
                    )}
                  >
                    {opt.label}
                    <span className="text-[10px] opacity-60">{count}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 제품 검색 Combobox */}
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboboxOpen}
                className="w-full justify-between font-normal"
              >
                {selectedProductId
                  ? (() => {
                      const p = products.find((p) => p.id === selectedProductId);
                      return p ? `[${p.sku}] ${p.name}` : "제품을 검색하세요...";
                    })()
                  : "제품을 검색하세요..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="SKU 또는 제품명 검색..." />
                <CommandList>
                  <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
                  <CommandGroup heading={gradeFilter !== "all" ? `${gradeFilter} 등급 (${filteredProducts.length}개)` : undefined}>
                    {filteredProducts.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={`${product.sku} ${product.name}`}
                        onSelect={() => {
                          handleProductChange(product.id);
                          setComboboxOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProductId === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-mono text-xs text-muted-foreground mr-2">
                          [{product.sku}]
                        </span>
                        <span className="flex-1 truncate">{product.name}</span>
                        {product.abcGrade && product.xyzGrade && (
                          <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                            {product.abcGrade}{product.xyzGrade}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <Separator />

          {/* 자동/수동 방법 선택 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">예측 방법</Label>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={selectionMode === "auto" ? "default" : "outline"}
                onClick={() => handleModeChange("auto")}
                className="gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                자동 선택
              </Button>
              <Button
                size="sm"
                variant={selectionMode === "manual" ? "default" : "outline"}
                onClick={() => handleModeChange("manual")}
                className="gap-1.5"
              >
                <Settings2 className="h-3.5 w-3.5" />
                수동 선택
              </Button>
            </div>

            {selectionMode === "manual" && (
              <TooltipProvider delayDuration={200}>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">예측 방법</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 rounded-full bg-slate-200 dark:bg-slate-700 p-[2px] text-slate-500 dark:text-slate-400 cursor-help hover:bg-primary/20 hover:text-primary transition-colors" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            <p className="font-semibold mb-1">예측 방법 비교</p>
                            <p><strong>WMA</strong>: 최근 N개월에 선형 가중치 부여. SMA보다 최근 변화에 민감</p>
                            <p><strong>SES</strong>: 최근 데이터에 더 높은 가중치. 변동 수요에 적합</p>
                            <p><strong>Holt&apos;s</strong>: 수요 수준 + 추세(증감) 동시 반영. 지속적 성장/하락 시 적합</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select value={manualMethod} onValueChange={setManualMethod}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WMA">가중이동평균 (WMA)</SelectItem>
                          <SelectItem value="SES">지수평활법 (SES)</SelectItem>
                          <SelectItem value="Holts">이중지수평활 (Holt&apos;s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {manualMethod === "WMA" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">이동 윈도우 크기</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 rounded-full bg-slate-200 dark:bg-slate-700 p-[2px] text-slate-500 dark:text-slate-400 cursor-help hover:bg-primary/20 hover:text-primary transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                              <p className="font-semibold mb-1">최근 몇 개월의 평균을 사용할지 설정</p>
                              <p>예: 3 → 최근 3개월(100, 120, 140)의 평균 120을 예측값으로 사용</p>
                              <p className="mt-1 text-muted-foreground">작을수록 최근 변화 민감, 클수록 안정적</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="number"
                          min={2}
                          max={12}
                          value={manualWindowSize}
                          onChange={(e) => setManualWindowSize(e.target.value)}
                          className="h-8 text-xs"
                          placeholder="3"
                        />
                      </div>
                    )}

                    {(manualMethod === "SES" || manualMethod === "Holts") && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">평활계수 (α)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 rounded-full bg-slate-200 dark:bg-slate-700 p-[2px] text-slate-500 dark:text-slate-400 cursor-help hover:bg-primary/20 hover:text-primary transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                              <p className="font-semibold mb-1">최근 데이터를 얼마나 중시할지 설정</p>
                              <p>예: 판매량 100→120→140일 때</p>
                              <p>α=0.2 → 과거 비중 높음 → 예측 ~116</p>
                              <p>α=0.8 → 최근 비중 높음 → 예측 ~136</p>
                              <p className="mt-1 text-muted-foreground">안정 수요: 0.1~0.3 / 변동 수요: 0.4~0.6</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="number"
                          min={0.01}
                          max={0.99}
                          step={0.05}
                          value={manualAlpha}
                          onChange={(e) => setManualAlpha(e.target.value)}
                          className="h-8 text-xs"
                          placeholder="0.3"
                        />
                      </div>
                    )}

                    {manualMethod === "Holts" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">추세계수 (β)</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 rounded-full bg-slate-200 dark:bg-slate-700 p-[2px] text-slate-500 dark:text-slate-400 cursor-help hover:bg-primary/20 hover:text-primary transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                              <p className="font-semibold mb-1">추세 변화를 얼마나 빠르게 반영할지 설정</p>
                              <p>예: 매월 +20개씩 증가하다 갑자기 +40으로 바뀌면</p>
                              <p>β=0.1 → 천천히 반영 (기존 +20 유지 경향)</p>
                              <p>β=0.5 → 빠르게 반영 (+40에 가까워짐)</p>
                              <p className="mt-1 text-muted-foreground">안정 추세: 0.05~0.15 / 급변 추세: 0.2~0.5</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Input
                          type="number"
                          min={0.01}
                          max={0.99}
                          step={0.05}
                          value={manualBeta}
                          onChange={(e) => setManualBeta(e.target.value)}
                          className="h-8 text-xs"
                          placeholder="0.1"
                        />
                      </div>
                    )}
                  </div>

                  <Button size="sm" onClick={handleManualApply} className="w-full h-8 text-xs">
                    적용
                  </Button>
                </div>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>

      {!forecast ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold text-muted-foreground">예측 불가</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
              최소 2개월 이상의 판매 데이터가 필요합니다. 판매 데이터를 등록하면 자동으로 수요예측이 실행됩니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 선택 기준 카드 */}
          <Card className="border-blue-100 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-950/40">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-sm text-blue-900 dark:text-blue-100">
                  {forecast.isManual ? "수동 선택" : "자동 선택"} 기준
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* 제품 메타 배지 */}
              <div className="flex flex-wrap gap-1.5">
                {forecast.meta.abcGrade && (
                  <Badge variant="outline" className={cn("text-xs", ABC_COLORS[forecast.meta.abcGrade])}>
                    ABC: {forecast.meta.abcGrade}등급
                  </Badge>
                )}
                {forecast.meta.xyzGrade && (
                  <Badge variant="outline" className={cn("text-xs", XYZ_COLORS[forecast.meta.xyzGrade])}>
                    XYZ: {forecast.meta.xyzGrade}등급
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  데이터: {forecast.meta.dataMonths}개월
                </Badge>
                {forecast.meta.turnoverRate !== null && (
                  <Badge variant="outline" className="text-xs">
                    회전율: {forecast.meta.turnoverRate}회/년
                  </Badge>
                )}
                {forecast.meta.yoyGrowthRate !== null && (
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    forecast.meta.yoyGrowthRate >= 0
                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800"
                      : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800"
                  )}>
                    성장률: {forecast.meta.yoyGrowthRate >= 0 ? "+" : ""}{forecast.meta.yoyGrowthRate}%
                  </Badge>
                )}
                {forecast.meta.isOverstock && (
                  <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800">
                    재고과다
                  </Badge>
                )}
                {forecast.seasonallyAdjusted && (
                  <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800">
                    계절조정
                  </Badge>
                )}
              </div>

              {/* 선택 사유 */}
              <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                {forecast.selectionReason}
              </p>
            </CardContent>
          </Card>

          {/* 요약 카드 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예측 방법</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{METHOD_LABELS[forecast.method] || forecast.method}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {forecast.isManual ? "수동 지정" : "자동 선택됨"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예측 정확도 (FA)</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(() => {
                  const fa = Math.max(0, Math.round((100 - forecast.mape) * 10) / 10);
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-2xl font-bold",
                          fa >= 85 ? "text-green-600" : fa >= 70 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {fa}%
                        </span>
                        <Badge className={cn("text-xs", CONFIDENCE_MAP[forecast.confidence]?.color)}>
                          {CONFIDENCE_MAP[forecast.confidence]?.label || forecast.confidence}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {fa >= 85 ? "매우 정확한 예측" : fa >= 70 ? "양호한 예측 수준" : "변동성이 큰 제품"}
                        <span className="ml-1 text-slate-400">(MAPE {forecast.mape}%)</span>
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 실적</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{stats?.avgHistory.toLocaleString("ko-KR")}개/월</div>
                <p className="mt-1 text-xs text-muted-foreground">과거 {forecast.history.length}개월 평균</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">예측 추세</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-lg font-bold", (stats?.trend ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                  {(stats?.trend ?? 0) >= 0 ? "+" : ""}
                  {stats?.trend.toFixed(1)}%
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  예측 평균: {stats?.avgPredicted.toLocaleString("ko-KR")}개/월
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 차트 */}
          {rechartsData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>수요예측 차트</CardTitle>
                <CardDescription>
                  [{forecast.productName}] 과거 실적(실선) + 미래 예측(점선)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={forecastChartConfig} className="h-[180px] w-full">
                  <LineChart data={rechartsData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(m) => m.slice(2).replace("-", "/")}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v) => v.toLocaleString("ko-KR")}
                    />
                    {boundaryMonth && lastMonth && (
                      <ReferenceArea
                        x1={boundaryMonth}
                        x2={lastMonth}
                        fill="#f0f9ff"
                        fillOpacity={0.5}
                      />
                    )}
                    {boundaryMonth && (
                      <ReferenceLine
                        x={boundaryMonth}
                        stroke="#93c5fd"
                        strokeDasharray="6 3"
                      />
                    )}
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(label) => `${label}`}
                          formatter={(value, name) => {
                            const label = name === "history" ? "실적" : "예측";
                            return [`${Number(value).toLocaleString("ko-KR")}개`, label];
                          }}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="history"
                      stroke="var(--color-history)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="var(--color-predicted)"
                      strokeWidth={2.5}
                      strokeDasharray="8 4"
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* 상세 데이터 테이블 */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <CardTitle className="text-base">월별 상세 데이터</CardTitle>
              <div className="text-right">
                <div className="text-xs text-slate-500">예측 정확도 (FA)</div>
                <div className={cn(
                  "text-lg font-bold",
                  Math.max(0, 100 - forecast.mape) >= 85 ? "text-green-600"
                    : Math.max(0, 100 - forecast.mape) >= 70 ? "text-yellow-600"
                    : "text-red-600"
                )}>
                  {Math.max(0, Math.round((100 - forecast.mape) * 10) / 10)}%
                </div>
                <div className="text-[10px] text-slate-400">FA = 100 - MAPE({forecast.mape}%)</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-slate-500">월</th>
                      <th className="pb-2 pr-4 text-right font-medium text-slate-500">수량</th>
                      <th className="pb-2 font-medium text-slate-500">구분</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.history.map((h) => (
                      <tr key={h.month} className="border-b">
                        <td className="py-2 pr-4">{h.month}</td>
                        <td className="py-2 pr-4 text-right font-medium">{h.value.toLocaleString("ko-KR")}개</td>
                        <td className="py-2">
                          <Badge variant="outline" className="text-xs">실적</Badge>
                        </td>
                      </tr>
                    ))}
                    {forecast.predicted.map((p) => (
                      <tr key={p.month} className="border-b bg-amber-50/50">
                        <td className="py-2 pr-4">{p.month}</td>
                        <td className="py-2 pr-4 text-right font-medium text-amber-700">{p.value.toLocaleString("ko-KR")}개</td>
                        <td className="py-2">
                          <Badge className="bg-amber-100 text-xs text-amber-700">예측</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      </>
      )}
      </div>
      )}
      </div>
      )}
    </div>
  );
}

/** 집계 예측 뷰 컴포넌트 */
function AggregateView({ tab, groups, loading }: { tab: ViewTab; groups: AggregateGroup[]; loading: boolean }) {
  const tabLabel: Record<ViewTab, string> = {
    product: "",
    abc: "ABC 등급별",
    xyz: "XYZ 등급별",
    all: "전체",
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        집계 데이터 분석 중...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex h-40 items-center justify-center text-slate-400 text-sm">
          판매 데이터가 없습니다
        </CardContent>
      </Card>
    );
  }

  const METHOD_LABELS_AGG: Record<string, string> = {
    WMA: "가중이동평균 (WMA)",
    SES: "지수평활법 (SES)",
    Holts: "이중지수평활 (Holt's)",
  };

  const aggChartConfig = {
    history: { label: "과거 실적", color: "#3b82f6" },
    predicted: { label: "수요 예측", color: "#f59e0b" },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6">
      <div className="text-sm font-semibold text-slate-600">{tabLabel[tab]} 수요예측</div>
      {groups.map((group) => {
        const fa = Math.max(0, Math.round((100 - group.mape) * 10) / 10);
        const historyCount = group.history.length;
        const chartData: Array<{ month: string; history: number | null; predicted: number | null }> = [];
        group.history.forEach((h) => chartData.push({ month: h.month, history: h.value, predicted: null }));
        if (chartData.length > 0 && group.predicted.length > 0) {
          chartData[historyCount - 1].predicted = chartData[historyCount - 1].history;
        }
        group.predicted.forEach((p) => chartData.push({ month: p.month, history: null, predicted: p.value }));
        const boundaryMonth = group.history[group.history.length - 1]?.month ?? null;
        const lastMonth = group.predicted[group.predicted.length - 1]?.month ?? null;
        const avgHistory = group.history.length > 0
          ? Math.round(group.history.reduce((s, h) => s + h.value, 0) / group.history.length)
          : 0;
        const avgPredicted = group.predicted.length > 0
          ? Math.round(group.predicted.reduce((s, p) => s + p.value, 0) / group.predicted.length)
          : 0;
        const trend = avgHistory > 0 ? ((avgPredicted - avgHistory) / avgHistory) * 100 : 0;

        return (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base">{group.label}</CardTitle>
                  <CardDescription>제품 {group.productCount}개 합산 | {METHOD_LABELS_AGG[group.method] ?? group.method}</CardDescription>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">FA</div>
                    <div className={cn("text-lg font-bold", fa >= 85 ? "text-green-600" : fa >= 70 ? "text-yellow-600" : "text-red-600")}>
                      {fa}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">예측 추세</div>
                    <div className={cn("text-lg font-bold", trend >= 0 ? "text-green-600" : "text-red-600")}>
                      {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">예측 평균</div>
                    <div className="text-lg font-bold">{avgPredicted.toLocaleString("ko-KR")}개</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={aggChartConfig} className="h-[160px] w-full">
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(m) => m.slice(2).replace("-", "/")} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => v.toLocaleString("ko-KR")} />
                  {boundaryMonth && lastMonth && (
                    <ReferenceArea x1={boundaryMonth} x2={lastMonth} fill="#f0f9ff" fillOpacity={0.5} />
                  )}
                  {boundaryMonth && (
                    <ReferenceLine x={boundaryMonth} stroke="#93c5fd" strokeDasharray="6 3" />
                  )}
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => [`${Number(value).toLocaleString("ko-KR")}개`, name === "history" ? "실적" : "예측"]}
                      />
                    }
                  />
                  <Line type="monotone" dataKey="history" stroke="var(--color-history)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="var(--color-predicted)" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3 }} connectNulls={false} />
                  <ChartLegend content={<ChartLegendContent />} />
                </LineChart>
              </ChartContainer>

              {/* 예측 수량 요약 */}
              <div className="mt-3 flex gap-4 text-xs text-slate-500 border-t pt-3">
                <span>과거 평균: {avgHistory.toLocaleString("ko-KR")}개/월</span>
                {group.predicted.map((p) => (
                  <span key={p.month}>{p.month}: <strong className="text-amber-700">{p.value.toLocaleString("ko-KR")}개</strong></span>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
