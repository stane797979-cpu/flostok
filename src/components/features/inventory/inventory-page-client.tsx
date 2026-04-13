"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw, Download, Loader2 } from "lucide-react";
import { exportInventoryToExcel } from "@/server/actions/excel-export";
import { useToast } from "@/hooks/use-toast";
import {
  InventoryTable,
  type InventoryItem,
} from "@/components/features/inventory/inventory-table";
import {
  InventoryAdjustmentDialog,
  type AdjustmentTarget,
} from "@/components/features/inventory/inventory-adjustment-dialog";

interface InventoryStats {
  totalProducts: number;
  needsOrder: number;
  outOfStockAndCritical: number;
  excess: number;
}

interface InventoryPageClientProps {
  items: InventoryItem[];
  stats: InventoryStats;
}

export function InventoryPageClient({ items, stats }: InventoryPageClientProps) {
  const [search, setSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<AdjustmentTarget | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const { toast } = useToast();

  // 클라이언트 검색 필터링
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

        toast({
          title: "다운로드 완료",
          description: `${result.data.filename} 파일이 다운로드되었습니다`,
        });
      } else {
        toast({
          title: "다운로드 실패",
          description: result.error || "재고 현황 다운로드에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("재고 현황 다운로드 오류:", error);
      toast({
        title: "오류",
        description: "재고 현황 다운로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  }, [toast]);

  return (
    <div className="space-y-6">
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
            <div className="text-2xl font-bold text-orange-600">
              {stats.outOfStockAndCritical}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">과재고</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.excess}</div>
          </CardContent>
        </Card>
      </div>

      {/* 액션 바 */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            엑셀 다운로드
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </div>
      </div>

      {/* 재고 테이블 */}
      <InventoryTable items={pagedItems} onAdjust={handleAdjust} />

      {/* 페이지네이션 */}
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

      {/* 재고 조정 다이얼로그 */}
      <InventoryAdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        target={adjustTarget}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
