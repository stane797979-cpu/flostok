"use client";

import { useState, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, TruckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkOrderItem {
  productId: string;
  sku: string;
  productName: string;
  recommendedQty: number;
  supplierId?: string;
  supplierName?: string;
  leadTime: number;
}

interface BulkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: BulkOrderItem[];
  onSubmit: (data: {
    items: Array<{
      productId: string;
      quantity: number;
      supplierId: string;
    }>;
    notes: string;
  }) => void;
  className?: string;
}

export function BulkOrderDialog({
  open,
  onOpenChange,
  items,
  onSubmit,
  className,
}: BulkOrderDialogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  // 초기 수량 설정
  useMemo(() => {
    const initialQuantities: Record<string, number> = {};
    items.forEach((item) => {
      initialQuantities[item.productId] = item.recommendedQty;
    });
    setQuantities(initialQuantities);
  }, [items]);

  // 공급자별 그룹화
  const groupedBySupplier = useMemo(() => {
    const groups = new Map<string, BulkOrderItem[]>();
    items.forEach((item) => {
      if (!item.supplierId) return;
      const supplierItems = groups.get(item.supplierId) || [];
      supplierItems.push(item);
      groups.set(item.supplierId, supplierItems);
    });
    return groups;
  }, [items]);

  const handleQuantityChange = (productId: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const handleSubmit = () => {
    const orderItems = items
      .filter((item) => item.supplierId && quantities[item.productId] > 0)
      .map((item) => ({
        productId: item.productId,
        quantity: quantities[item.productId] || item.recommendedQty,
        supplierId: item.supplierId!,
      }));

    if (orderItems.length === 0) {
      return;
    }

    onSubmit({
      items: orderItems,
      notes,
    });

    // 초기화
    setNotes("");
    onOpenChange(false);
  };

  if (items.length === 0) return null;

  const totalItems = items.length;
  const totalSuppliers = groupedBySupplier.size;
  const hasInvalidItems = items.some((item) => !item.supplierId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] sm:max-w-[700px]", className)}>
        <DialogHeader>
          <DialogTitle>일괄 발주 생성</DialogTitle>
          <DialogDescription>
            선택된 {totalItems}개 품목을 {totalSuppliers}개 공급자에게 발주합니다.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-6 py-4">
            {/* 공급자별 품목 목록 */}
            {Array.from(groupedBySupplier.entries()).map(([supplierId, supplierItems], index) => {
              const supplierName = supplierItems[0]?.supplierName || "알 수 없는 공급자";
              const avgLeadTime =
                supplierItems.reduce((sum, item) => sum + item.leadTime, 0) / supplierItems.length;

              return (
                <div key={supplierId} className="space-y-3">
                  {index > 0 && <Separator />}

                  {/* 공급자 헤더 */}
                  <div className="flex items-center gap-2">
                    <TruckIcon className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <div className="font-semibold">{supplierName}</div>
                      <div className="text-xs text-slate-500">
                        {supplierItems.length}개 품목 · 평균 리드타임 {avgLeadTime.toFixed(0)}일
                      </div>
                    </div>
                  </div>

                  {/* 품목 목록 */}
                  <div className="space-y-2 pl-7">
                    {supplierItems.map((item) => (
                      <div
                        key={item.productId}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <Package className="mt-1 h-4 w-4 text-slate-400" />
                          <div className="flex-1 space-y-2">
                            <div>
                              <div className="text-sm font-medium">{item.productName}</div>
                              <div className="text-xs text-slate-500">SKU: {item.sku}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Label htmlFor={`qty-${item.productId}`} className="text-xs">
                                수량
                              </Label>
                              <Input
                                id={`qty-${item.productId}`}
                                type="number"
                                min={1}
                                value={quantities[item.productId] || item.recommendedQty}
                                onChange={(e) =>
                                  handleQuantityChange(item.productId, Number(e.target.value))
                                }
                                className="h-8 w-24"
                              />
                              <Badge variant="secondary" className="text-xs">
                                추천: {item.recommendedQty}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 공급자가 없는 품목 경고 */}
            {hasInvalidItems && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <div className="text-sm font-medium text-yellow-800">
                  일부 품목은 공급자가 지정되지 않아 발주에서 제외됩니다
                </div>
                <div className="mt-2 space-y-1">
                  {items
                    .filter((item) => !item.supplierId)
                    .map((item) => (
                      <div key={item.productId} className="text-xs text-yellow-700">
                        • {item.productName} ({item.sku})
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 비고 */}
            <div className="space-y-2">
              <Label htmlFor="notes">비고</Label>
              <Textarea
                id="notes"
                placeholder="일괄 발주 관련 메모를 입력하세요"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={totalSuppliers === 0 || hasInvalidItems}>
            {totalSuppliers}개 발주서 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
