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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestInventoryAdjustment, getInventoryHistory } from "@/server/actions/inventory";
import { useToast } from "@/hooks/use-toast";
import { Loader2, History } from "lucide-react";
import type { InventoryHistory } from "@/server/db/schema";

function changeTypeLabel(changeType: string): string {
  const labels: Record<string, string> = {
    INBOUND: "입고",
    OUTBOUND: "출고",
    INBOUND_ADJUSTMENT: "조정 입고",
    OUTBOUND_ADJUSTMENT: "조정 출고",
    SALE: "판매",
    RETURN: "반품",
  };
  return labels[changeType] || changeType;
}

export interface AdjustmentTarget {
  productId: string;
  sku: string;
  name: string;
  currentStock: number;
}

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

interface InventoryAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: AdjustmentTarget | null;
  warehouses?: WarehouseOption[];
  onSuccess: () => void;
}

export function InventoryAdjustmentDialog({
  open,
  onOpenChange,
  target,
  warehouses = [],
  onSuccess,
}: InventoryAdjustmentDialogProps) {
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<InventoryHistory[]>([]);
  const { toast } = useToast();

  // 다이얼로그 열릴 때 이력 로드 + 기본 창고 설정
  useEffect(() => {
    if (open && target) {
      getInventoryHistory({ productId: target.productId, limit: 10 })
        .then((result) => setHistoryRecords(result.records))
        .catch(() => setHistoryRecords([]));
      // 기본 창고 pre-select
      const defaultWh = warehouses.find((w) => w.isDefault);
      if (defaultWh) setWarehouseId(defaultWh.id);
      else if (warehouses.length > 0) setWarehouseId(warehouses[0].id);
    }
  }, [open, target, warehouses]);

  const quantityNum = Number(quantity) || 0;
  const expectedStock =
    direction === "increase"
      ? (target?.currentStock ?? 0) + quantityNum
      : (target?.currentStock ?? 0) - quantityNum;

  const handleSubmit = async () => {
    if (!target || quantityNum <= 0) return;

    setIsSubmitting(true);
    try {
      const result = await requestInventoryAdjustment({
        productId: target.productId,
        changeType: direction === "increase" ? "INBOUND_ADJUSTMENT" : "OUTBOUND_ADJUSTMENT",
        quantity: quantityNum,
        warehouseId: warehouseId || undefined,
        notes: notes || undefined,
        location: location || undefined,
      });

      if (result.success) {
        if (result.isRequest) {
          // 승인 요청이 생성된 경우
          toast({
            title: "재고 조정 요청 제출됨",
            description: `${target.name} 조정 요청이 제출되었습니다. 슈퍼관리자 승인 후 반영됩니다.`,
          });
        } else {
          // 즉시 처리된 경우 (superadmin)
          toast({
            title: "재고 조정 완료",
            description: `${target.name}: ${result.stockBefore} → ${result.stockAfter}`,
          });
        }
        handleClose();
        onSuccess();
      } else {
        toast({
          title: "재고 조정 실패",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "오류 발생",
        description: "재고 조정 처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDirection("increase");
    setQuantity("");
    setWarehouseId("");
    setLocation("");
    setNotes("");
    onOpenChange(false);
  };

  if (!target) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>재고 조정</DialogTitle>
          <DialogDescription>
            재고 수량을 수동으로 조정합니다. 변동 이력이 기록됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 제품 정보 (읽기 전용) */}
          <div className="rounded-lg border bg-slate-50 p-3 dark:bg-slate-900">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-slate-500">SKU</span>
              <span className="font-mono font-medium">{target.sku}</span>
              <div className="row-span-2 text-right">
                <span className="block text-xs text-slate-500">현재고</span>
                <span className="text-2xl font-bold leading-tight">{target.currentStock.toLocaleString()}</span>
              </div>
              <span className="text-slate-500">제품명</span>
              <span className="font-medium truncate">{target.name}</span>
            </div>
          </div>

          {/* 창고 선택 */}
          {warehouses.length > 0 && (
            <div className="space-y-2">
              <Label>창고 <span className="text-red-500">*</span></Label>
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

          {/* 조정 유형 */}
          <div className="space-y-2">
            <Label>조정 유형</Label>
            <Select
              value={direction}
              onValueChange={(v: string) => setDirection(v as "increase" | "decrease")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">증가 (조정 입고)</SelectItem>
                <SelectItem value="decrease">감소 (조정 출고)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 수량 */}
          <div className="space-y-2">
            <Label htmlFor="quantity">수량</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              placeholder="조정 수량 입력"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* 예상 결과 미리보기 */}
          {quantityNum > 0 && (
            <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-950">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                예상 결과: {target.currentStock.toLocaleString()}{" "}
                {direction === "increase" ? "+" : "−"} {quantityNum.toLocaleString()} ={" "}
                <span className="font-bold">{expectedStock.toLocaleString()}</span>
              </p>
              {direction === "decrease" && expectedStock < 0 && (
                <p className="mt-1 text-xs text-red-600">
                  재고가 부족합니다. 현재고보다 많은 수량을 출고할 수 없습니다.
                </p>
              )}
            </div>
          )}

          {/* 창고 위치 */}
          <div className="space-y-2">
            <Label htmlFor="location">창고 위치 (선택)</Label>
            <Input
              id="location"
              placeholder="예: A-01-02"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* 사유 */}
          <div className="space-y-2">
            <Label htmlFor="notes">사유 (선택)</Label>
            <Textarea
              id="notes"
              placeholder="재고 조정 사유를 입력하세요"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* 변경 이력 */}
        {historyRecords.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                <History className="h-3.5 w-3.5" />
                최근 변경 이력
              </h4>
              <div className="max-h-40 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <tbody className="divide-y">
                    {historyRecords.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap px-2 py-1.5">
                          <Badge
                            variant="outline"
                            className={
                              h.changeAmount > 0
                                ? "text-[10px] border-green-200 text-green-700"
                                : "text-[10px] border-red-200 text-red-700"
                            }
                          >
                            {h.changeAmount > 0 ? "+" : ""}{h.changeAmount}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">
                          {h.stockBefore} → {h.stockAfter}
                        </td>
                        <td className="max-w-[180px] truncate px-2 py-1.5 text-slate-400">
                          {h.notes || changeTypeLabel(h.changeType)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-slate-400">
                          {new Date(h.createdAt).toLocaleDateString("ko-KR", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              quantityNum <= 0 ||
              (direction === "decrease" && expectedStock < 0)
            }
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            조정 적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
