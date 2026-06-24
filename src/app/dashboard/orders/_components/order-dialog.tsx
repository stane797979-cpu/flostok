"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getProducts } from "@/server/actions/products";
import { getSupplierOptions } from "@/server/actions/suppliers";
import { Search, Upload, Package, FileSpreadsheet, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedProduct {
  productId: string;
  sku: string;
  productName: string;
  currentStock: number;
  safetyStock: number;
  recommendedQty: number;
  supplierId?: string;
  supplierName?: string;
  leadTime: number;
}

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** AI발주 권고에서 특정 제품을 선택한 경우. null이면 직접 발주등록 모드 */
  product: SelectedProduct | null;
  onSubmit: (data: {
    productId: string;
    quantity: number;
    supplierId: string;
    expectedDate: string;
    notes: string;
  }) => void;
  onExcelUpload?: (file: File) => void;
}

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  safetyStock: number;
  leadTime: number;
  primarySupplierId: string | null;
};

type SupplierOption = { id: string; name: string };

type RegisterMode = "single" | "excel";

export function OrderDialog({ open, onOpenChange, product, onSubmit, onExcelUpload }: OrderDialogProps) {
  const [mode, setMode] = useState<RegisterMode>("single");
  const [quantity, setQuantity] = useState(1);
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedDate, setExpectedDate] = useState("");

  // 직접 발주 모드용 state
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // 파일 업로드
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const isDirectMode = product === null;

  // 다이얼로그 열릴 때 초기화
  useEffect(() => {
    if (!open) return;
    setMode("single");
    setUploadFile(null);

    if (product) {
      setQuantity(product.recommendedQty || 1);
      setSupplierId(product.supplierId || "");
      setNotes("");
      const date = new Date();
      date.setDate(date.getDate() + product.leadTime);
      setExpectedDate(date.toISOString().split("T")[0]);
    } else {
      setQuantity(1);
      setSupplierId("");
      setNotes("");
      setSelectedProductId("");
      setProductSearch("");
      setExpectedDate("");
      setIsLoadingProducts(true);
      Promise.all([
        getProducts({ limit: 500 }),
        getSupplierOptions(),
      ]).then(([prodResult, supplierList]) => {
        setProductOptions(
          prodResult.products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            safetyStock: p.safetyStock ?? 0,
            leadTime: p.leadTime ?? 7,
            primarySupplierId: p.primarySupplierId ?? null,
          }))
        );
        setSupplierOptions(supplierList);
      }).finally(() => setIsLoadingProducts(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 직접 모드에서 제품 선택 시 공급자·예상입고일 자동 세팅
  useEffect(() => {
    if (!isDirectMode || !selectedProductId) return;
    const p = productOptions.find((o) => o.id === selectedProductId);
    if (!p) return;
    setSupplierId(p.primarySupplierId || "");
    const date = new Date();
    date.setDate(date.getDate() + p.leadTime);
    setExpectedDate(date.toISOString().split("T")[0]);
  }, [selectedProductId, productOptions, isDirectMode]);

  const handleSubmit = () => {
    if (mode === "excel") {
      if (!uploadFile || !onExcelUpload) return;
      onExcelUpload(uploadFile);
      onOpenChange(false);
      return;
    }
    const productId = isDirectMode ? selectedProductId : product!.productId;
    if (!productId || !supplierId || quantity < 1 || !expectedDate) return;
    onSubmit({ productId, quantity, supplierId, expectedDate, notes });
    onOpenChange(false);
  };

  const filteredProducts = productOptions.filter(
    (p) =>
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const selectedProductInfo = isDirectMode
    ? productOptions.find((p) => p.id === selectedProductId)
    : null;

  const canSubmitSingle = isDirectMode
    ? !!selectedProductId && !!supplierId && quantity >= 1 && !!expectedDate
    : !!supplierId && quantity >= 1;

  const canSubmitExcel = !!uploadFile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>발주 등록</DialogTitle>
          <DialogDescription>
            단일 상품 발주 또는 엑셀 파일로 일괄 등록하세요.
          </DialogDescription>
        </DialogHeader>

        {/* AI발주 권고 모드: 탭 없이 단일 제품 바로 표시 */}
        {!isDirectMode && product ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">제품 정보</div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="font-medium">{product.productName}</div>
                <div className="text-slate-500">SKU: {product.sku}</div>
                <div className="mt-2 flex justify-between text-xs">
                  <span>현재고: {product.currentStock}</span>
                  <span>안전재고: {product.safetyStock}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">발주 수량 <span className="text-red-500">*</span></Label>
              <Input id="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              <p className="text-xs text-slate-500">추천 수량: {product.recommendedQty}개</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">공급자 <span className="text-red-500">*</span></Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="supplier"><SelectValue placeholder="공급자를 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {product.supplierId && product.supplierName && (
                    <SelectItem value={product.supplierId}>{product.supplierName}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected-date">예상 입고일 <span className="text-red-500">*</span></Label>
              <Input id="expected-date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">비고</Label>
              <Textarea id="notes" placeholder="발주 관련 메모를 입력하세요" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
        ) : (
          /* 직접 발주 모드: 단일 상품 / 엑셀 업로드 탭 */
          <div className="space-y-4 py-2">
            {/* 모드 선택 탭 */}
            <div className="flex rounded-lg border border-slate-200 p-1 gap-1">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
                  mode === "single"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Package className="h-4 w-4" />
                단일 상품 발주
              </button>
              <button
                type="button"
                onClick={() => setMode("excel")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
                  mode === "excel"
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <FileSpreadsheet className="h-4 w-4" />
                엑셀 일괄 업로드
              </button>
            </div>

            {mode === "single" && (
              <div className="space-y-4">
                {/* 제품 검색·선택 */}
                <div className="space-y-2">
                  <Label>제품 선택 <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="제품명 또는 SKU 검색..."
                      className="pl-9"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                  {isLoadingProducts ? (
                    <div className="text-xs text-slate-400 py-2">제품 목록 불러오는 중...</div>
                  ) : (
                    <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="제품을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent className="max-h-52">
                        {filteredProducts.length === 0 ? (
                          <div className="py-2 px-3 text-xs text-slate-400">검색 결과 없음</div>
                        ) : (
                          filteredProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              [{p.sku}] {p.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedProductInfo && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 flex gap-4">
                      <span>안전재고: <strong>{selectedProductInfo.safetyStock}</strong></span>
                      <span>리드타임: <strong>{selectedProductInfo.leadTime}일</strong></span>
                    </div>
                  )}
                </div>

                {/* 발주 수량 */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">발주 수량 <span className="text-red-500">*</span></Label>
                  <Input id="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
                </div>

                {/* 공급자 */}
                <div className="space-y-2">
                  <Label htmlFor="supplier">공급자 <span className="text-red-500">*</span></Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger id="supplier"><SelectValue placeholder="공급자를 선택하세요" /></SelectTrigger>
                    <SelectContent>
                      {supplierOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 예상 입고일 */}
                <div className="space-y-2">
                  <Label htmlFor="expected-date">예상 입고일 <span className="text-red-500">*</span></Label>
                  <Input id="expected-date" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
                </div>

                {/* 비고 */}
                <div className="space-y-2">
                  <Label htmlFor="notes">비고</Label>
                  <Textarea id="notes" placeholder="발주 관련 메모를 입력하세요" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>
              </div>
            )}

            {mode === "excel" && (
              <div className="space-y-4">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    uploadFile ? "border-green-400 bg-green-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFile(file);
                      e.target.value = "";
                    }}
                  />
                  <Upload className={cn("mx-auto h-10 w-10 mb-3", uploadFile ? "text-green-500" : "text-slate-400")} />
                  {uploadFile ? (
                    <>
                      <p className="text-sm font-medium text-green-700">{uploadFile.name}</p>
                      <p className="text-xs text-slate-500 mt-1">클릭하여 파일 변경</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">클릭하여 파일 선택</p>
                      <p className="text-xs text-slate-500 mt-1">.xlsx, .xls, .csv 지원</p>
                    </>
                  )}
                </div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">업로드 양식 안내</p>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                      onClick={() => {
                        import("xlsx").then((XLSX) => {
                          const headers = [
                            ["SKU", "수량", "공급자명", "예상입고일", "B/L번호", "컨테이너번호", "메모"],
                            ["SKU-001", 100, "공급자A", "2026-03-01", "BL12345", "CNTR001", "샘플 데이터"],
                          ];
                          const ws = XLSX.utils.aoa_to_sheet(headers);
                          ws["!cols"] = [
                            { wch: 15 }, { wch: 10 }, { wch: 15 },
                            { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
                          ];
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "발주양식");
                          XLSX.writeFile(wb, "발주_업로드_양식.xlsx");
                        });
                      }}
                    >
                      <Download className="h-3 w-3" />
                      양식 다운로드
                    </button>
                  </div>
                  <p>필수 컬럼: SKU, 수량, 공급자명, 예상입고일</p>
                  <p>선택 컬럼: B/L번호, 컨테이너번호, 메모</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button
            onClick={handleSubmit}
            disabled={mode === "excel" ? !canSubmitExcel : (!isDirectMode ? !canSubmitSingle : !canSubmitSingle)}
          >
            {mode === "excel" ? "업로드" : "발주 등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
