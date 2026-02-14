"use client";

import { useState, useEffect } from "react";
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

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    productId: string;
    sku: string;
    productName: string;
    currentStock: number;
    safetyStock: number;
    recommendedQty: number;
    supplierId?: string;
    supplierName?: string;
    leadTime: number;
  } | null;
  warehouses?: WarehouseOption[];
  onSubmit: (data: {
    productId: string;
    quantity: number;
    supplierId: string;
    expectedDate: string;
    warehouseId?: string;
    notes: string;
  }) => void;
}

export function OrderDialog({ open, onOpenChange, product, warehouses = [], onSubmit }: OrderDialogProps) {
  const [quantity, setQuantity] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  // product 변경 시 state 동기화
  useEffect(() => {
    if (product) {
      setQuantity(product.recommendedQty || 0);
      setSupplierId(product.supplierId || "");
      setNotes("");
      // 기본 창고 pre-select
      const defaultWh = warehouses.find((w) => w.isDefault);
      if (defaultWh) setWarehouseId(defaultWh.id);
      else if (warehouses.length > 0) setWarehouseId(warehouses[0].id);
    }
  }, [product, warehouses]);

  // 예상 입고일 계산 (오늘 + 리드타임)
  const getExpectedDate = () => {
    if (!product) return "";
    const date = new Date();
    date.setDate(date.getDate() + product.leadTime);
    return date.toISOString().split("T")[0];
  };

  const handleSubmit = () => {
    if (!product) return;
    onSubmit({
      productId: product.productId,
      quantity,
      supplierId,
      expectedDate: getExpectedDate(),
      warehouseId: warehouseId || undefined,
      notes,
    });
    onOpenChange(false);
    // 초기화
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {product && (
          <>
            <DialogHeader>
              <DialogTitle>발주 생성</DialogTitle>
              <DialogDescription>제품의 발주 정보를 입력하세요.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 제품 정보 */}
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

              {/* 발주 수량 */}
              <div className="space-y-2">
                <Label htmlFor="quantity">발주 수량</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
                <p className="text-xs text-slate-500">추천 수량: {product.recommendedQty}개</p>
              </div>

              {/* 공급자 선택 */}
              <div className="space-y-2">
                <Label htmlFor="supplier">공급자</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="공급자를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.supplierId && product.supplierName && (
                      <SelectItem value={product.supplierId}>{product.supplierName}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* 예상 입고일 */}
              <div className="space-y-2">
                <Label>예상 입고일</Label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  {getExpectedDate() && new Date(getExpectedDate()).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  <span className="ml-2 text-xs text-slate-500">
                    (리드타임 {product.leadTime}일 기준)
                  </span>
                </div>
              </div>

              {/* 입고 예정 창고 */}
              {warehouses.length > 0 && (
                <div className="space-y-2">
                  <Label>입고 예정 창고</Label>
                  <Select value={warehouseId} onValueChange={setWarehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="창고를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code}){wh.isDefault ? " - 기본" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 비고 */}
              <div className="space-y-2">
                <Label htmlFor="notes">비고</Label>
                <Textarea
                  id="notes"
                  placeholder="발주 관련 메모를 입력하세요"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button onClick={handleSubmit} disabled={!supplierId || quantity < 1}>
                발주 실행
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
