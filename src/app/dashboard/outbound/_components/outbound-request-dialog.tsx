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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createOutboundRequest } from "@/server/actions/outbound-requests";
import { getInventoryByProductId } from "@/server/actions/inventory";
import { ProductCombobox } from "@/components/features/common/product-combobox";

const OUTBOUND_TYPES = [
  { value: "OUTBOUND_SALE", label: "판매 출고" },
  { value: "OUTBOUND_DISPOSAL", label: "폐기 출고" },
  { value: "OUTBOUND_TRANSFER", label: "이동 출고" },
  { value: "OUTBOUND_SAMPLE", label: "샘플 출고" },
  { value: "OUTBOUND_LOSS", label: "분실/감모" },
  { value: "OUTBOUND_RETURN", label: "반품 출고" },
] as const;

interface OutboundRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface RequestItem {
  id: string;
  productId: string;
  productName?: string;
  productSku?: string;
  quantity: number;
  currentStock: number;
  notes: string;
}

export function OutboundRequestDialog({
  open,
  onOpenChange,
  onSuccess,
}: OutboundRequestDialogProps) {
  const [outboundType, setOutboundType] = useState<string>("");
  const [items, setItems] = useState<RequestItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 새 항목 추가용 임시 상태
  const [tempProductId, setTempProductId] = useState("");
  const [tempQuantity, setTempQuantity] = useState("");
  const [tempCurrentStock, setTempCurrentStock] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);

  const { toast } = useToast();

  // 제품 선택 시 현재고 조회
  useEffect(() => {
    if (!tempProductId) {
      setTempCurrentStock(null);
      return;
    }

    setIsLoadingStock(true);
    getInventoryByProductId(tempProductId)
      .then((inventory) => {
        setTempCurrentStock(inventory?.currentStock ?? 0);
      })
      .catch(() => {
        setTempCurrentStock(0);
      })
      .finally(() => setIsLoadingStock(false));
  }, [tempProductId]);

  // 항목 추가
  const handleAddItem = () => {
    if (!tempProductId || !tempQuantity || Number(tempQuantity) <= 0) {
      toast({
        title: "입력 오류",
        description: "제품과 수량을 입력하세요",
        variant: "destructive",
      });
      return;
    }

    // 중복 체크
    if (items.some((item) => item.productId === tempProductId)) {
      toast({
        title: "중복 항목",
        description: "이미 추가된 제품입니다",
        variant: "destructive",
      });
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: tempProductId,
        quantity: Number(tempQuantity),
        currentStock: tempCurrentStock || 0,
        notes: "",
      },
    ]);

    // 초기화
    setTempProductId("");
    setTempQuantity("");
    setTempCurrentStock(null);
  };

  // 항목 삭제
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // 항목 수량 변경
  const handleItemQuantityChange = (id: string, value: string) => {
    const quantity = Math.max(1, parseInt(value) || 1);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  // 재고 부족 항목 체크
  const insufficientItems = items.filter((item) => item.quantity > item.currentStock);
  const hasStockIssues = insufficientItems.length > 0;

  // 제출
  const handleSubmit = async () => {
    if (!outboundType || items.length === 0) {
      toast({
        title: "입력 오류",
        description: "출고 유형과 최소 1개 이상의 항목을 입력하세요",
        variant: "destructive",
      });
      return;
    }

    if (hasStockIssues) {
      toast({
        title: "재고 부족",
        description: "재고가 부족한 항목이 있습니다. 수량을 조정하세요.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOutboundRequest({
        outboundType,
        items: items.map((item) => ({
          productId: item.productId,
          requestedQuantity: item.quantity,
          notes: item.notes || undefined,
        })),
        notes: notes || undefined,
      });

      if (result.success) {
        toast({
          title: "출고 요청 생성 완료",
          description: "출고 요청이 생성되었습니다. 창고에서 확인 후 처리됩니다.",
        });
        handleClose();
        onSuccess();
      } else {
        toast({
          title: "출고 요청 생성 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("출고 요청 생성 오류:", error);
      toast({
        title: "오류",
        description: "출고 요청 생성 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOutboundType("");
    setItems([]);
    setNotes("");
    setTempProductId("");
    setTempQuantity("");
    setTempCurrentStock(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>출고 요청</DialogTitle>
          <DialogDescription>
            출고를 요청합니다. 창고에서 확인 후 재고가 차감됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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

          {/* 항목 추가 */}
          <div className="space-y-2">
            <Label>제품 추가</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <ProductCombobox
                  value={tempProductId}
                  onValueChange={setTempProductId}
                  disabled={isSubmitting}
                />
              </div>
              <Input
                type="number"
                min="1"
                placeholder="수량"
                className="w-24"
                value={tempQuantity}
                onChange={(e) => setTempQuantity(e.target.value)}
                disabled={isSubmitting}
              />
              <Button
                type="button"
                onClick={handleAddItem}
                disabled={isSubmitting || !tempProductId || !tempQuantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tempProductId && (
              <p className="text-sm text-slate-500">
                현재고:{" "}
                {isLoadingStock
                  ? "조회 중..."
                  : `${tempCurrentStock?.toLocaleString() ?? 0}개`}
              </p>
            )}
          </div>

          {/* 항목 목록 */}
          {items.length > 0 && (
            <div className="space-y-2">
              <Label>출고 항목 ({items.length}개)</Label>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제품 ID</TableHead>
                      <TableHead className="text-right">요청수량</TableHead>
                      <TableHead className="text-right">현재고</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const isInsufficient = item.quantity > item.currentStock;
                      return (
                      <TableRow key={item.id} className={isInsufficient ? "bg-red-50" : ""}>
                        <TableCell className="font-medium">
                          {item.productName || item.productSku || item.productId.slice(0, 8) + "..."}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemQuantityChange(item.id, e.target.value)
                            }
                            className={`w-20 text-right ${isInsufficient ? "border-red-500" : ""}`}
                            disabled={isSubmitting}
                          />
                        </TableCell>
                        <TableCell className={`text-right ${isInsufficient ? "font-medium text-red-600" : ""}`}>
                          {item.currentStock.toLocaleString()}개
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={isSubmitting}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* 재고 부족 경고 */}
          {hasStockIssues && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                재고가 부족한 항목이 {insufficientItems.length}개 있습니다.
                요청 수량이 현재고를 초과하면 출고 요청을 생성할 수 없습니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 메모 */}
          <div className="space-y-2">
            <Label htmlFor="request-notes">요청 메모 (선택)</Label>
            <Textarea
              id="request-notes"
              placeholder="출고 요청 사유를 입력하세요"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !outboundType || items.length === 0 || hasStockIssues}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            출고 요청 생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
