"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid, LayoutList, Loader2, Download, Upload, FileDown } from "lucide-react";
import { SupplierTable } from "@/components/features/suppliers/supplier-table";
import { SupplierCardView } from "@/components/features/suppliers/supplier-card-view";
import { SupplierFormDialog } from "@/components/features/suppliers/supplier-form-dialog";
import { getSuppliers, deleteSupplier, exportSuppliersExcel, downloadSupplierTemplate, importSuppliersExcel } from "@/server/actions/suppliers";
import { type Supplier } from "@/server/db/schema";
import { useToast } from "@/hooks/use-toast";

export default function SuppliersPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [excelLoading, setExcelLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const triggerDownload = (data: number[], filename: string) => {
    const buf = new Uint8Array(data);
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    setExcelLoading(true);
    try {
      const result = await exportSuppliersExcel();
      triggerDownload(result.data, result.filename);
      toast({ title: "다운로드 완료", description: `${suppliers.length}개 공급업체 데이터를 내보냈습니다.` });
    } catch {
      toast({ title: "오류", description: "엑셀 다운로드에 실패했습니다.", variant: "destructive" });
    } finally {
      setExcelLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setExcelLoading(true);
    try {
      const result = await downloadSupplierTemplate();
      triggerDownload(result.data, result.filename);
    } catch {
      toast({ title: "오류", description: "템플릿 다운로드에 실패했습니다.", variant: "destructive" });
    } finally {
      setExcelLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setExcelLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));
      const result = await importSuppliersExcel(data);
      if (result.success) {
        toast({
          title: "업로드 완료",
          description: `등록 ${result.imported}건, 건너뜀 ${result.skipped}건${result.errors.length > 0 ? ` (오류 ${result.errors.length}건)` : ""}`,
        });
        fetchSuppliers();
      } else {
        toast({ title: "업로드 실패", description: result.errors[0] ?? "알 수 없는 오류", variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "파일 처리 중 오류가 발생했습니다.", variant: "destructive" });
    } finally {
      setExcelLoading(false);
    }
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
      {/* 숨김 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 액션 바 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadTemplate}
            disabled={excelLoading}
          >
            <FileDown className="mr-1.5 h-4 w-4" />
            양식 다운로드
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            disabled={excelLoading || suppliers.length === 0}
          >
            {excelLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            엑셀 다운로드
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={excelLoading}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            엑셀 업로드
          </Button>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
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
