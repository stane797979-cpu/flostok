"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Loader2, ArrowRight } from "lucide-react";
import { ProductCombobox } from "@/components/features/common/product-combobox";
import { transferInventory } from "@/server/actions/warehouses";
import { toast } from "sonner";

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface WarehouseTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouses: Warehouse[];
  onSuccess: () => void;
}

export function WarehouseTransferDialog({
  open,
  onOpenChange,
  warehouses,
  onSuccess,
}: WarehouseTransferDialogProps) {
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    // 유효성 검증
    if (!sourceWarehouseId) {
      toast.error("출발 창고를 선택하세요");
      return;
    }

    if (!targetWarehouseId) {
      toast.error("도착 창고를 선택하세요");
      return;
    }

    if (sourceWarehouseId === targetWarehouseId) {
      toast.error("출발 창고와 도착 창고가 같을 수 없습니다");
      return;
    }

    if (!productId) {
      toast.error("제품을 선택하세요");
      return;
    }

    const qty = parseInt(quantity);
    if (!qty || qty <= 0) {
      toast.error("이동 수량은 1 이상이어야 합니다");
      return;
    }

    startTransition(async () => {
      try {
        const result = await transferInventory({
          productId,
          sourceWarehouseId,
          targetWarehouseId,
          quantity: qty,
          notes: notes.trim() || undefined,
        });

        if (result.success) {
          toast.success("재고 이동이 완료되었습니다");

          // 폼 초기화
          setSourceWarehouseId("");
          setTargetWarehouseId("");
          setProductId("");
          setQuantity("");
          setNotes("");

          onSuccess();
          onOpenChange(false);
        } else {
          toast.error(result.error || "재고 이동에 실패했습니다");
        }
      } catch (error) {
        console.error("재고 이동 오류:", error);
        toast.error("서버 오류가 발생했습니다");
      }
    });
  };

  const sourceWarehouse = warehouses.find((w) => w.id === sourceWarehouseId);
  const targetWarehouse = warehouses.find((w) => w.id === targetWarehouseId);

  // 도착 창고 목록 (출발 창고 제외)
  const availableTargetWarehouses = warehouses.filter(
    (w) => w.id !== sourceWarehouseId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>창고 간 재고 이동</DialogTitle>
          <DialogDescription>
            창고 간 재고를 이동합니다. 출발 창고에서 재고가 차감되고 도착 창고에서 증가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 출발 창고 → 도착 창고 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="sourceWarehouse">
                출발 창고 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={sourceWarehouseId}
                onValueChange={setSourceWarehouseId}
                disabled={isPending}
              >
                <SelectTrigger id="sourceWarehouse">
                  <SelectValue placeholder="출발 창고 선택" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="mt-6 h-5 w-5 text-slate-400 shrink-0" />

            <div className="flex-1 space-y-2">
              <Label htmlFor="targetWarehouse">
                도착 창고 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={targetWarehouseId}
                onValueChange={setTargetWarehouseId}
                disabled={isPending || !sourceWarehouseId}
              >
                <SelectTrigger id="targetWarehouse">
                  <SelectValue placeholder="도착 창고 선택" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargetWarehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 제품 선택 */}
          <div className="space-y-2">
            <Label>
              제품 <span className="text-red-500">*</span>
            </Label>
            <ProductCombobox
              value={productId}
              onValueChange={setProductId}
              disabled={isPending}
              placeholder="제품을 검색하세요..."
            />
          </div>

          {/* 이동 수량 */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              이동 수량 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              placeholder="예: 100"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isPending}
            />
          </div>

          {/* 사유 */}
          <div className="space-y-2">
            <Label htmlFor="notes">사유 (선택)</Label>
            <Textarea
              id="notes"
              placeholder="재고 이동 사유를 입력하세요"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              rows={3}
            />
          </div>

          {/* 이동 요약 */}
          {sourceWarehouse && targetWarehouse && productId && quantity && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
              <h4 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                이동 요약
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <span className="font-medium">{sourceWarehouse.name}</span>에서{" "}
                <span className="font-medium">{targetWarehouse.name}</span>으로{" "}
                <span className="font-semibold">{quantity}개</span> 이동
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                처리중...
              </>
            ) : (
              "이동 실행"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
