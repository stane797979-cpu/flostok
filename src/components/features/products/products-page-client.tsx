"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Download, FileUp, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}

export function ProductsPageClient({
  initialProducts,
  categories,
  currentPage,
  totalPages,
  totalItems,
  pageSize,
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

  // URL 쿼리 빌더
  const buildUrl = (overrides: { page?: number; size?: number }) => {
    const url = new URLSearchParams();
    const pg = overrides.page ?? currentPage;
    const sz = overrides.size ?? pageSize;
    if (pg > 1) url.set("page", String(pg));
    if (sz !== 50) url.set("size", String(sz));
    return `/dashboard/products?${url.toString()}`;
  };

  const handlePageChange = (page: number) => {
    router.push(buildUrl({ page }));
  };

  const handlePageSizeChange = (size: string) => {
    router.push(buildUrl({ size: Number(size), page: 1 }));
  };

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
