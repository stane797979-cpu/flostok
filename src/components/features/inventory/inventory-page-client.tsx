"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, RefreshCw, Download, Loader2 } from "lucide-react";
import { exportInventoryToExcel } from "@/server/actions/excel-export";
import { updateStockoutRecord, type StockoutSummary } from "@/server/actions/stockout";
import { useToast } from "@/hooks/use-toast";
import {
  InventoryTable,
  type InventoryItem,
} from "@/components/features/inventory/inventory-table";
import {
  InventoryAdjustmentDialog,
  type AdjustmentTarget,
} from "@/components/features/inventory/inventory-adjustment-dialog";
import { INVENTORY_STATUS } from "@/lib/constants/inventory-status";
import { StockoutClient } from "@/app/dashboard/stockout/_components/stockout-client";
import { cn } from "@/lib/utils";

interface InventoryStats {
  totalProducts: number;
  needsOrder: number;
  outOfStockAndCritical: number;
  excess: number;
}

interface InventoryPageClientProps {
  items: InventoryItem[];
  stats: InventoryStats;
  stockoutData: StockoutSummary;
}

export function InventoryPageClient({ items, stats, stockoutData }: InventoryPageClientProps) {
  const [search, setSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<AdjustmentTarget | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const defaultTab = searchParams.get("tab") === "stockout" ? "stockout" : "inventory";

  const filtered = useMemo(() => {
    setCurrentPage(1);
    return search
      ? items.filter(
          (item) =>
            item.product.name.toLowerCase().includes(search.toLowerCase()) ||
            item.product.sku.toLowerCase().includes(search.toLowerCase())
        )
      : items;
  }, [items, search]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const handleAdjust = (item: InventoryItem) => {
    setAdjustTarget({
      productId: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      currentStock: item.currentStock,
    });
    setAdjustOpen(true);
  };

  const handleRefresh = () => {
    router.refresh();
  };

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const result = await exportInventoryToExcel();
      if (result.success && result.data) {
        const binaryString = atob(result.data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast({ title: "다운로드 완료", description: `${result.data.filename} 파일이 다운로드되었습니다` });
      } else {
        toast({ title: "다운로드 실패", description: result.error || "재고 현황 다운로드에 실패했습니다", variant: "destructive" });
      }
    } catch (error) {
      console.error("재고 현황 다운로드 오류:", error);
      toast({ title: "오류", description: "재고 현황 다운로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }, [toast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">재고 현황 v2</h1>
        <p className="mt-2 text-slate-500">재고 상태 및 수량 관리, 결품 감지 및 조치 추적</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">총 SKU</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">발주 필요</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.needsOrder}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">품절 + 위험</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.outOfStockAndCritical}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">결품 진행중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stockoutData.records.filter((r) => r.actionStatus !== "normalized").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="inventory">재고현황</TabsTrigger>
          <TabsTrigger value="stockout">
            결품관리
            {stockoutData.records.filter((r) => r.actionStatus !== "normalized").length > 0 && (
              <Badge className="ml-2 h-5 bg-red-500 px-1.5 text-[10px] text-white">
                {stockoutData.records.filter((r) => r.actionStatus !== "normalized").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 재고현황 탭 */}
        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="search"
                placeholder="제품명, SKU 검색..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                엑셀 다운로드
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="mr-2 h-4 w-4" />
                새로고침
              </Button>
            </div>
          </div>

          <InventoryTable items={pagedItems} onAdjust={handleAdjust} />

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>페이지당</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                <SelectTrigger className="h-7 w-16 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>개 · 총 {filtered.length}개</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>이전</Button>
              <span className="px-2">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>다음</Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:bg-slate-900">
            {Object.values(INVENTORY_STATUS).map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className={cn("inline-block h-2 w-2 rounded-full", s.dotClass)} />
                <span className={cn("font-medium", s.textClass)}>{s.label}</span>
                <span>{s.description}</span>
              </span>
            ))}
          </div>
        </TabsContent>

        {/* 결품관리 탭 */}
        <TabsContent value="stockout" className="mt-4">
          <StockoutClient data={stockoutData} />
        </TabsContent>
      </Tabs>

      <InventoryAdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        target={adjustTarget}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
