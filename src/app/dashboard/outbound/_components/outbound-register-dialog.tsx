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
import { Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getInventoryByProductId, processInventoryTransaction } from "@/server/actions/inventory";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { InventoryChangeTypeKey } from "@/server/services/inventory/types";
import { ProductCombobox } from "@/components/features/common/product-combobox";

const OUTBOUND_TYPES = [
  { value: "OUTBOUND_SALE", label: "판매 출고" },
  { value: "OUTBOUND_DISPOSAL", label: "폐기 출고" },
  { value: "OUTBOUND_TRANSFER", label: "이동 출고" },
  { value: "OUTBOUND_SAMPLE", label: "샘플 출고" },
  { value: "OUTBOUND_LOSS", label: "분실/감모" },
  { value: "OUTBOUND_RETURN", label: "반품 출고" },
] as const;

interface OutboundRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function OutboundRegisterDialog({ open, onOpenChange, onSuccess }: OutboundRegisterDialogProps) {
  const [productId, setProductId] = useState("");
  const [outboundType, setOutboundType] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const { toast } = useToast();

  // 제품 선택 시 현재고 조회
  useEffect(() => {
    if (!productId) {
      setCurrentStock(null);
      return;
    }

    setIsLoadingStock(true);
    getInventoryByProductId(productId)
      .then((inventory) => {
        setCurrentStock(inventory?.currentStock ?? 0);
      })
      .catch(() => {
        setCurrentStock(0);
      })
      .finally(() => setIsLoadingStock(false));
  }, [productId]);

  // 예상 재고 계산
  const estimatedStock = currentStock !== null && quantity ? currentStock - Number(quantity) : null;
  const isStockInsufficient = estimatedStock !== null && estimatedStock < 0;

  const handleSubmit = async () => {
    if (!productId || !outboundType || !quantity) return;

    if (isStockInsufficient) {
      toast({
        title: "재고 부족",
        description: "출고 수량이 현재고보다 많습니다",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await processInventoryTransaction({
        productId,
        changeType: outboundType as InventoryChangeTypeKey,
        quantity: Number(quantity),
        notes: notes || undefined,
      });

      if (result.success) {
        toast({
          title: "출고 처리 완료",
          description: `${OUTBOUND_TYPES.find((t) => t.value === outboundType)?.label} 처리가 완료되었습니다`,
        });
        handleClose();
        onSuccess();
      } else {
        toast({
          title: "출고 처리 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "오류 발생",
        description: "출고 처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setProductId("");
    setOutboundType("");
    setQuantity("");
    setNotes("");
    setCurrentStock(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>출고 등록</DialogTitle>
          <DialogDescription>
            제품 출고를 직접 등록합니다. 재고가 자동으로 차감됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 제품 선택 — Combobox */}
          <div className="space-y-2">
            <Label>제품</Label>
            <ProductCombobox
              value={productId}
              onValueChange={setProductId}
              disabled={isSubmitting}
            />
          </div>

          {/* 현재고 표시 */}
          {productId && (
            <div className="space-y-2">
              <Label>현재고</Label>
              <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm">
                {isLoadingStock ? (
                  <span className="text-muted-foreground">조회 중...</span>
                ) : (
                  <span className="font-medium">{currentStock?.toLocaleString() ?? 0}개</span>
                )}
              </div>
            </div>
          )}

          {/* 출고 유형 */}
          <div className="space-y-2">
            <Label>출고 유형</Label>
            <Select value={outboundType} onValueChange={setOutboundType}>
              <SelectTrigger>
                <SelectValue placeholder="출고 유형을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {OUTBOUND_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 수량 */}
          <div className="space-y-2">
            <Label htmlFor="outbound-quantity">출고 수량</Label>
            <Input
              id="outbound-quantity"
              type="number"
              min="1"
              placeholder="출고 수량"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* 예상 재고 미리보기 */}
          {productId && quantity && Number(quantity) > 0 && (
            <div className="space-y-2">
              <Label>출고 후 예상 재고</Label>
              <div
                className={`flex h-9 items-center rounded-md border px-3 text-sm font-medium ${
                  isStockInsufficient
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "bg-muted"
                }`}
              >
                {estimatedStock !== null ? `${estimatedStock.toLocaleString()}개` : "-"}
              </div>
            </div>
          )}

          {/* 재고 부족 경고 */}
          {isStockInsufficient && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                재고가 부족합니다. 출고 수량을 줄이거나 입고 후 다시 시도하세요.
              </AlertDescription>
            </Alert>
          )}

          {/* 메모 */}
          <div className="space-y-2">
            <Label htmlFor="outbound-notes">메모 (선택)</Label>
            <Textarea
              id="outbound-notes"
              placeholder="출고 사유를 입력하세요"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !productId ||
              !outboundType ||
              !quantity ||
              Number(quantity) <= 0 ||
              isStockInsufficient
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            출고 등록
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
