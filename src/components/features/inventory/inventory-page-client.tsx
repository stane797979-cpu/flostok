"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface InventoryPageClientProps {
  items: InventoryItem[];
  stats: InventoryStats;
  warehouses: Warehouse[];
  selectedWarehouseId?: string;
}

export function InventoryPageClient({
  items,
  stats,
  warehouses,
  selectedWarehouseId,
}: InventoryPageClientProps) {
  const [search, setSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<AdjustmentTarget | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // 창고 필터 변경
  const handleWarehouseChange = (value: string) => {
    const url = new URLSearchParams();
    if (value !== "all") {
      url.set("warehouseId", value);
    }
    router.push(`/dashboard/inventory?${url.toString()}`);
  };

  // 클라이언트 검색 필터링
  const filtered = search
    ? items.filter(
        (item) =>
          item.product.name.toLowerCase().includes(search.toLowerCase()) ||
          item.product.sku.toLowerCase().includes(search.toLowerCase())
      )
    : items;

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
      <div className="flex flex-col gap-4">
        {/* 필터 영역 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
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
          <Select
            value={selectedWarehouseId || "all"}
            onValueChange={handleWarehouseChange}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="전체 창고" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 창고</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center justify-end gap-2">
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
      <InventoryTable items={filtered} onAdjust={handleAdjust} />

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
