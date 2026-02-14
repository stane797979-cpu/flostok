"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, RefreshCw, Download, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { exportInventoryToExcel } from "@/server/actions/excel-export";
import { deleteInventoryItem, deleteInventoryItems, deleteAllInventory } from "@/server/actions/inventory";
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 삭제 관련 상태
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

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
    setSelectedIds([]);
    router.refresh();
  };

  // 개별 삭제
  const handleDeleteClick = (item: InventoryItem) => {
    setDeleteTarget(item);
    setDeleteReason("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteInventoryItem(deleteTarget.id, deleteReason || undefined);
      if (result.success) {
        toast({ title: "삭제 완료", description: `${deleteTarget.product.name} 재고가 삭제되었습니다` });
        setDeleteDialogOpen(false);
        handleRefresh();
      } else {
        toast({ title: "삭제 실패", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "재고 삭제 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // 선택 삭제
  const handleBulkDeleteClick = (ids: string[]) => {
    setBulkDeleteIds(ids);
    setDeleteReason("");
    setBulkDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteInventoryItems(bulkDeleteIds, deleteReason || undefined);
      if (result.success) {
        toast({ title: "삭제 완료", description: `${result.deletedCount}건의 재고가 삭제되었습니다` });
        setBulkDeleteDialogOpen(false);
        setSelectedIds([]);
        handleRefresh();
      } else {
        toast({ title: "삭제 실패", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "재고 삭제 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // 전체 삭제
  const handleDeleteAllConfirm = async () => {
    if (!deleteReason.trim()) return;
    setIsDeleting(true);
    try {
      const result = await deleteAllInventory(deleteReason);
      if (result.success) {
        toast({ title: "전체 삭제 완료", description: `${result.deletedCount}건의 재고가 모두 삭제되었습니다` });
        setDeleteAllDialogOpen(false);
        setDeleteReason("");
        handleRefresh();
      } else {
        toast({ title: "삭제 실패", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "전체 재고 삭제 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
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
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => {
                setDeleteReason("");
                setDeleteAllDialogOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              전체 삭제
            </Button>
          )}
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
      <InventoryTable
        items={filtered}
        onAdjust={handleAdjust}
        onDelete={handleDeleteClick}
        onBulkDelete={handleBulkDeleteClick}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* 재고 조정 다이얼로그 */}
      <InventoryAdjustmentDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        target={adjustTarget}
        warehouses={warehouses}
        onSuccess={handleRefresh}
      />

      {/* 개별 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              재고 삭제
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.product.name}</strong> ({deleteTarget?.product.sku})의 재고를 삭제하시겠습니까?
              <br />
              현재고 <strong>{deleteTarget?.currentStock.toLocaleString()}</strong>개가 0으로 처리됩니다.
              변동 이력은 보존됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 선택 삭제 확인 다이얼로그 */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              선택 재고 삭제
            </AlertDialogTitle>
            <AlertDialogDescription>
              선택한 <strong>{bulkDeleteIds.length}건</strong>의 재고를 삭제하시겠습니까?
              모든 수량이 0으로 처리되며, 변동 이력은 보존됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {bulkDeleteIds.length}건 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 전체 삭제 다이얼로그 (사유 필수) */}
      <Dialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              전체 재고 삭제
            </DialogTitle>
            <DialogDescription>
              <strong>모든 재고 ({items.length}건)</strong>를 삭제합니다.
              이 작업은 되돌릴 수 없습니다. 변동 이력은 보존됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="delete-all-reason">삭제 사유 (필수)</Label>
              <Textarea
                id="delete-all-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="전체 삭제 사유를 입력하세요..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAllDialogOpen(false)} disabled={isDeleting}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllConfirm}
              disabled={!deleteReason.trim() || isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              전체 삭제 실행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
