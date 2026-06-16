"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid, LayoutList, Loader2 } from "lucide-react";
import { SupplierTable } from "@/components/features/suppliers/supplier-table";
import { SupplierCardView } from "@/components/features/suppliers/supplier-card-view";
import { SupplierFormDialog } from "@/components/features/suppliers/supplier-form-dialog";
import { getSuppliers, deleteSupplier } from "@/server/actions/suppliers";
import { type Supplier } from "@/server/db/schema";
import { useToast } from "@/hooks/use-toast";

export default function SuppliersPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSuppliers = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getSuppliers({ search: search || undefined });
      setSuppliers(result.suppliers);
    } catch {
      toast({ title: "오류", description: "공급자 목록을 불러오는데 실패했습니다.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingSupplier(null);
      // 다이얼로그 닫힐 때 목록 갱신
      fetchSuppliers();
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsDialogOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`"${supplier.name}" 공급자를 삭제하시겠습니까?`)) return;

    const result = await deleteSupplier(supplier.id);
    if (result.success) {
      toast({ title: "삭제 완료", description: `${supplier.name}이(가) 삭제되었습니다.` });
      fetchSuppliers();
    } else {
      toast({ title: "삭제 실패", description: result.error, variant: "destructive" });
    }
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
        <Button size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          공급자 추가
        </Button>
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
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>

            <TabsContent value="card">
              <SupplierCardView
                suppliers={suppliers}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* 공급자 추가/수정 다이얼로그 */}
      <SupplierFormDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        supplier={editingSupplier}
      />
    </div>
  );
}
