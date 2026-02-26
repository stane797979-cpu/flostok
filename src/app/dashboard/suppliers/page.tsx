"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid, LayoutList, Loader2, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { ExcelImportDialog } from "@/components/features/excel/excel-import-dialog";
import { SupplierTable } from "@/components/features/suppliers/supplier-table";
import { SupplierCardView } from "@/components/features/suppliers/supplier-card-view";
import { SupplierFormDialog } from "@/components/features/suppliers/supplier-form-dialog";
import { getSuppliers, deleteSupplier } from "@/server/actions/suppliers";
import { getSupplierScorecards } from "@/server/actions/supplier-scorecard";
import { type Supplier } from "@/server/db/schema";
import { type SupplierScorecard } from "@/server/services/scm/supplier-scorecard";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_PAGE_SIZE = 50;

export default function SuppliersPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; supplier: Supplier | null }>({
    open: false,
    supplier: null,
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [scorecards, setScorecards] = useState<SupplierScorecard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalItems, setTotalItems] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const fetchSuppliers = useCallback(async (page = currentPage, size = pageSize) => {
    try {
      setIsLoading(true);
      const offset = (page - 1) * size;

      // 공급자 목록과 스코어카드를 병렬로 조회
      const [result, scorecardsData] = await Promise.all([
        getSuppliers({ search: search || undefined, limit: size, offset }),
        getSupplierScorecards().catch(() => [] as SupplierScorecard[]),
      ]);

      setSuppliers(result.suppliers);
      setTotalItems(result.total);
      setScorecards(scorecardsData);
    } catch {
      toast({ title: "오류", description: "공급자 목록을 불러오는데 실패했습니다.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [search, currentPage, pageSize, toast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // 검색 시 페이지 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: string) => {
    setPageSize(Number(size));
    setCurrentPage(1);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingSupplier(null);
      fetchSuppliers();
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsDialogOpen(true);
  };

  const handleDelete = (supplier: Supplier) => {
    setDeleteConfirm({ open: true, supplier });
  };

  const handleDeleteConfirmed = async () => {
    const supplier = deleteConfirm.supplier;
    if (!supplier) return;

    const result = await deleteSupplier(supplier.id);
    if (result.success) {
      if (result.isRequest) {
        toast({ title: "삭제 요청 제출됨", description: `${supplier.name} 삭제 요청이 제출되었습니다. 슈퍼관리자 승인 후 삭제됩니다.` });
      } else {
        toast({ title: "삭제 완료", description: `${supplier.name}이(가) 삭제되었습니다.` });
      }
      fetchSuppliers();
    } else {
      toast({ title: "삭제 실패", description: result.error, variant: "destructive" });
    }
    setDeleteConfirm({ open: false, supplier: null });
  };

  return (
    <div className="space-y-6">
      {/* 액션 바 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="공급자명, 담당자, 연락처 검색..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            엑셀 업로드
          </Button>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            공급자 추가
          </Button>
        </div>
      </div>

      {/* 뷰 전환 탭 */}
      <Tabs defaultValue="table" className="space-y-4">
        <TabsList>
          <TabsTrigger value="table" className="gap-2">
            <LayoutList className="h-4 w-4" />
            테이블 뷰
          </TabsTrigger>
          <TabsTrigger value="card" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            카드 뷰
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            <TabsContent value="table">
              <SupplierTable
                suppliers={suppliers}
                scorecards={scorecards}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>

            <TabsContent value="card">
              <SupplierCardView
                suppliers={suppliers}
                scorecards={scorecards}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* 페이지네이션 */}
      {totalItems > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>전체 {totalItems.toLocaleString()}건</span>
            <span>·</span>
            <div className="flex items-center gap-1">
              <span>표시</span>
              <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50개</SelectItem>
                  <SelectItem value="100">100개</SelectItem>
                  <SelectItem value="200">200개</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 공급자 추가/수정 다이얼로그 */}
      <SupplierFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        supplier={editingSupplier}
      />

      {/* 엑셀 임포트 다이얼로그 */}
      <ExcelImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        importType="suppliers"
        onSuccess={() => fetchSuppliers()}
      />

      {/* 공급자 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>공급자 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteConfirm.supplier?.name}&rdquo; 공급자를 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
