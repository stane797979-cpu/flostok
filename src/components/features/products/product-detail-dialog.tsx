"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { type Product } from "@/server/db/schema";
import { getInventoryList } from "@/server/actions/inventory";
import { Package, BarChart3, Truck, Info } from "lucide-react";

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & {
    currentStock?: number;
    status?: {
      key: string;
      label: string;
      bgClass: string;
      textClass: string;
      borderClass: string;
    };
  }) | null;
}

export function ProductDetailDialog({ open, onOpenChange, product }: ProductDetailDialogProps) {
  const [inventoryData, setInventoryData] = useState<{
    currentStock: number;
    availableStock: number | null;
    reservedStock: number | null;
    incomingStock: number | null;
    location: string | null;
    daysOfInventory: number | null;
    inventoryValue: number | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      loadInventory(product.id);
    }
  }, [open, product]);

  const loadInventory = async (productId: string) => {
    setIsLoading(true);
    try {
      const result = await getInventoryList({ productId, limit: 1 });
      if (result.items.length > 0) {
        const item = result.items[0];
        setInventoryData({
          currentStock: item.currentStock,
          availableStock: item.availableStock,
          reservedStock: item.reservedStock,
          incomingStock: item.incomingStock,
          location: item.location,
          daysOfInventory: item.daysOfInventory ? Number(item.daysOfInventory) : null,
          inventoryValue: item.inventoryValue,
        });
      } else {
        setInventoryData(null);
      }
    } catch (error) {
      console.error("재고 조회 오류:", error);
      setInventoryData(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return null;

  const isProductNew = (p: NonNullable<typeof product>): boolean => {
    const metadata = p.metadata as Record<string, unknown> | null;
    const gradeInfo = metadata?.gradeInfo as Record<string, unknown> | undefined;
    return gradeInfo?.isNewProduct === true;
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "-";
    return value.toLocaleString("ko-KR") + "원";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-sm text-slate-500">{product.sku}</span>
            <span>{product.name}</span>
            {product.status && (
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  product.status.bgClass,
                  product.status.textClass,
                  product.status.borderClass
                )}
              >
                {product.status.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* 기본 정보 */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Info className="h-4 w-4" />
              기본 정보
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border p-4">
              <InfoRow label="카테고리" value={product.category || "-"} />
              <InfoRow label="단위" value={product.unit || "EA"} />
              <InfoRow label="판매단가" value={formatCurrency(product.unitPrice)} />
              <InfoRow label="원가" value={formatCurrency(product.costPrice)} />
              <InfoRow label="바코드" value={product.barcode || "-"} />
              <InfoRow
                label="상태"
                value={product.isActive ? "활성" : "비활성"}
              />
              {product.description && (
                <div className="col-span-2">
                  <InfoRow label="설명" value={product.description} />
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* 재고 현황 */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Package className="h-4 w-4" />
              재고 현황
            </h3>
            {isLoading ? (
              <div className="flex h-20 items-center justify-center text-sm text-slate-400">
                재고 정보 조회 중...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border p-4">
                <InfoRow
                  label="현재고"
                  value={`${(inventoryData?.currentStock ?? product.currentStock ?? 0).toLocaleString()}개`}
                  highlight
                />
                <InfoRow
                  label="가용재고"
                  value={inventoryData?.availableStock != null ? `${inventoryData.availableStock.toLocaleString()}개` : "-"}
                />
                <InfoRow
                  label="예약재고"
                  value={inventoryData?.reservedStock != null ? `${inventoryData.reservedStock.toLocaleString()}개` : "-"}
                />
                <InfoRow
                  label="입고예정"
                  value={inventoryData?.incomingStock != null ? `${inventoryData.incomingStock.toLocaleString()}개` : "-"}
                />
                <InfoRow
                  label="재고일수"
                  value={inventoryData?.daysOfInventory != null ? `${inventoryData.daysOfInventory.toFixed(1)}일` : "-"}
                />
                <InfoRow
                  label="재고금액"
                  value={inventoryData?.inventoryValue != null ? formatCurrency(inventoryData.inventoryValue) : "-"}
                />
                <InfoRow
                  label="적치위치"
                  value={inventoryData?.location || "-"}
                />
              </div>
            )}
          </section>

          <Separator />

          {/* 발주 관련 */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Truck className="h-4 w-4" />
              발주 설정
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-lg border p-4">
              <InfoRow label="안전재고" value={`${(product.safetyStock ?? 0).toLocaleString()}개`} />
              <InfoRow label="발주점" value={`${(product.reorderPoint ?? 0).toLocaleString()}개`} />
              <InfoRow label="목표재고" value={product.targetStock != null ? `${product.targetStock.toLocaleString()}개` : "-"} />
              <InfoRow label="MOQ" value={`${(product.moq ?? 1).toLocaleString()}개`} />
              <InfoRow label="리드타임" value={`${product.leadTime ?? 7}일`} />
              <InfoRow
                label="리드타임 표준편차"
                value={product.leadTimeStddev != null ? `${product.leadTimeStddev}일` : "-"}
              />
            </div>
          </section>

          <Separator />

          {/* 등급 */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BarChart3 className="h-4 w-4" />
              분류 등급
            </h3>
            {isProductNew(product) ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-blue-500 text-white border-blue-600 font-bold text-xs">
                    NEW
                  </Badge>
                  <span className="text-sm font-medium text-blue-700">신제품</span>
                </div>
                <p className="text-xs text-blue-600">
                  판매 이력이 3개월 미만이어서 등급이 미분류 상태입니다.
                  충분한 판매 데이터 축적 후 월간 자동 갱신 시 등급이 부여됩니다.
                </p>
              </div>
            ) : (
              <div className="flex gap-4 rounded-lg border p-4">
                <GradeBadge label="ABC" grade={product.abcGrade} />
                <GradeBadge label="XYZ" grade={product.xyzGrade} />
                <GradeBadge label="FMR" grade={product.fmrGrade} />
              </div>
            )}
          </section>

          {/* 등록 정보 */}
          <div className="flex justify-between text-xs text-slate-400">
            <span>등록일: {new Date(product.createdAt).toLocaleDateString("ko-KR")}</span>
            <span>수정일: {new Date(product.updatedAt).toLocaleDateString("ko-KR")}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("font-medium", highlight && "text-blue-600")}>{value}</span>
    </div>
  );
}

function GradeBadge({ label, grade }: { label: string; grade: string | null }) {
  if (!grade) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">{label}:</span>
        <Badge variant="outline" className="text-slate-400">미분류</Badge>
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    A: "bg-green-100 text-green-700 border-green-300",
    B: "bg-yellow-100 text-yellow-700 border-yellow-300",
    C: "bg-red-100 text-red-700 border-red-300",
    X: "bg-blue-100 text-blue-700 border-blue-300",
    Y: "bg-orange-100 text-orange-700 border-orange-300",
    Z: "bg-purple-100 text-purple-700 border-purple-300",
    F: "bg-green-100 text-green-700 border-green-300",
    M: "bg-yellow-100 text-yellow-700 border-yellow-300",
    R: "bg-red-100 text-red-700 border-red-300",
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">{label}:</span>
      <Badge variant="outline" className={cn("font-mono font-bold", colorMap[grade])}>
        {grade}
      </Badge>
    </div>
  );
}
