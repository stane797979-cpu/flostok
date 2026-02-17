"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download, FileUp, Loader2 } from "lucide-react";
import { ProductTable, type ProductWithStatus } from "@/components/features/products/product-table";
import { ProductFilters } from "@/components/features/products/product-filters";
import { ProductFormDialog } from "@/components/features/products/product-form-dialog";
import { ProductDeleteDialog } from "@/components/features/products/product-delete-dialog";
import { ProductDetailDialog } from "@/components/features/products/product-detail-dialog";
import { ExcelImportDialog } from "@/components/features/excel/excel-import-dialog";
import { type Product } from "@/server/db/schema";
import { exportProductsToExcel } from "@/server/actions/data-export";
import { useRouter } from "next/navigation";

interface ProductsPageClientProps {
  initialProducts: (Product & {
    currentStock?: number;
    status: {
      key: string;
      label: string;
      bgClass: string;
      textClass: string;
      borderClass: string;
    };
  })[];
  categories: string[];
}

export function ProductsPageClient({
  initialProducts,
  categories,
}: ProductsPageClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductWithStatus | null>(null);
  const [deletingProductIds, setDeletingProductIds] = useState<string[]>([]);
  const [deletingProductNames, setDeletingProductNames] = useState<string[]>([]);

  const handleAddProduct = useCallback(() => {
    setEditingProduct(null);
    setFormDialogOpen(true);
  }, []);

  const handleViewProduct = useCallback((product: ProductWithStatus) => {
    setViewingProduct(product);
    setDetailDialogOpen(true);
  }, []);

  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product);
    setFormDialogOpen(true);
  }, []);

  const handleDeleteProduct = useCallback((id: string, name: string) => {
    setDeletingProductIds([id]);
    setDeletingProductNames([name]);
    setDeleteDialogOpen(true);
  }, []);

  const handleBulkDelete = useCallback((ids: string[], names: string[]) => {
    setDeletingProductIds(ids);
    setDeletingProductNames(names);
    setDeleteDialogOpen(true);
  }, []);

  const [downloading, setDownloading] = useState(false);

  const downloadBase64 = (base64: string, filename: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDownload = async () => {
    setDownloading(true);
    try {
      const result = await exportProductsToExcel();
      if (result.success && result.data) {
        downloadBase64(result.data.buffer, result.data.filename);
      } else {
        alert(result.error || "다운로드에 실패했습니다");
      }
    } catch {
      alert("다운로드 중 오류가 발생했습니다");
    } finally {
      setDownloading(false);
    }
  };

  // 검색 필터 적용
  const filteredProducts = searchQuery
    ? initialProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : initialProducts;

  return (
    <div className="space-y-6">
      {/* 액션 바 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="제품명, SKU 검색..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <FileUp className="mr-2 h-4 w-4" />
            엑셀 업로드
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            엑셀 다운로드
          </Button>
          <Button size="sm" onClick={handleAddProduct}>
            <Plus className="mr-2 h-4 w-4" />
            제품 추가
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <ProductFilters />

      {/* 제품 테이블 */}
      <ProductTable
        products={filteredProducts}
        onView={handleViewProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        onBulkDelete={handleBulkDelete}
      />

      {/* 제품 상세보기 다이얼로그 */}
      <ProductDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        product={viewingProduct}
      />

      {/* 제품 등록/수정 다이얼로그 */}
      <ProductFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        product={editingProduct}
        categories={categories}
      />

      {/* 삭제 확인 다이얼로그 */}
      <ProductDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        productIds={deletingProductIds}
        productNames={deletingProductNames}
      />

      {/* 엑셀 임포트 다이얼로그 */}
      <ExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importType="products"
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
