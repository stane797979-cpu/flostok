"use client";

import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Package } from "lucide-react";
import { confirmInbound, closeOrderWithPartialInbound, type ConfirmInboundInput } from "@/server/actions/inbound";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface InboundDialogItem {
  orderItemId: string;
  productId: string;
  productSku: string;
  productName: string;
  orderedQuantity: number;
  receivedQuantity: number; // 이미 입고된 수량
  unitPrice: number;
}

interface InboundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  items: InboundDialogItem[];
}

export function InboundDialog({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  items,
}: InboundDialogProps) {
  const [inboundQuantities, setInboundQuantities] = useState<Record<string, number>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [lotNumbers, setLotNumbers] = useState<Record<string, string>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const { toast } = useToast();

  // 입고 가능한 항목만 필터링 (아직 전량 입고되지 않은 항목)
  const availableItems = items.filter(
    (item) => item.receivedQuantity < item.orderedQuantity
  );

  // 전체 입고 버튼 클릭
  const handleFullInbound = () => {
    const quantities: Record<string, number> = {};
    availableItems.forEach((item) => {
      quantities[item.orderItemId] = item.orderedQuantity - item.receivedQuantity;
    });
    setInboundQuantities(quantities);
  };

  // 입고 수량 변경
  const handleQuantityChange = (orderItemId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setInboundQuantities((prev) => ({
      ...prev,
      [orderItemId]: numValue,
    }));
  };

  // 입고 확인 처리
  const handleSubmit = async () => {
    // 입고 수량이 입력된 항목만 필터링
    const inboundItems = availableItems
      .filter((item) => {
        const qty = inboundQuantities[item.orderItemId] || 0;
        return qty > 0;
      })
      .map((item) => {
        const receivedQty = inboundQuantities[item.orderItemId] || 0;
        const remainingQty = item.orderedQuantity - item.receivedQuantity;

        return {
          orderItemId: item.orderItemId,
          productId: item.productId,
          expectedQuantity: remainingQty,
          receivedQuantity: receivedQty,
          location: locations[item.orderItemId],
          lotNumber: lotNumbers[item.orderItemId],
          expiryDate: expiryDates[item.orderItemId] || undefined,
        };
      });

    if (inboundItems.length === 0) {
      toast({
        title: "입고 실패",
        description: "입고 수량을 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    // 입고 수량 검증
    for (const inboundItem of inboundItems) {
      const item = availableItems.find((i) => i.orderItemId === inboundItem.orderItemId);
      if (!item) continue;

      const remainingQty = item.orderedQuantity - item.receivedQuantity;
      if (inboundItem.receivedQuantity > remainingQty) {
        toast({
          title: "입고 실패",
          description: `${item.productName}: 입고 수량이 잔여 수량(${remainingQty})을 초과합니다`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const input: ConfirmInboundInput = {
        orderId,
        items: inboundItems,
        notes: notes || undefined,
      };

      const result = await confirmInbound(input);

      if (result.success) {
        const totalReceived = inboundItems.reduce(
          (sum, item) => sum + item.receivedQuantity,
          0
        );
        toast({
          title: "입고 처리 완료",
          description: `${inboundItems.length}개 품목, 총 ${totalReceived}개 입고되었습니다`,
        });

        // 초기화
        setInboundQuantities({});
        setLocations({});
        setLotNumbers({});
        setExpiryDates({});
        setNotes("");
        onOpenChange(false);
      } else {
        toast({
          title: "입고 처리 실패",
          description: result.error || "알 수 없는 오류가 발생했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("입고 처리 오류:", error);
      toast({
        title: "입고 처리 실패",
        description: "서버 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 잔여 포기 및 완료 처리
  const handleCloseOrder = async () => {
    if (!confirm("잔여수량을 포기하고 발주를 완료 처리하시겠습니까?")) return;

    setIsClosing(true);
    try {
      const result = await closeOrderWithPartialInbound(orderId, notes || "잔여수량 포기 처리");
      if (result.success) {
        toast({
          title: "완료 처리됨",
          description: "부분입고 상태로 발주가 완료 처리되었습니다",
        });
        onOpenChange(false);
      } else {
        toast({
          title: "완료 처리 실패",
          description: result.error || "알 수 없는 오류가 발생했습니다",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "완료 처리 실패",
        description: "서버 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
    }
  };

  // 기입고 수량이 있는지 확인 (부분입고 완료 버튼 표시 조건)
  const hasAnyReceived = items.some((item) => item.receivedQuantity > 0);

  // 입고 상태 뱃지
  const getStatusBadge = (item: InboundDialogItem) => {
    const receivedQty = item.receivedQuantity + (inboundQuantities[item.orderItemId] || 0);
    const orderedQty = item.orderedQuantity;

    if (receivedQty === 0) {
      return <Badge variant="outline">미입고</Badge>;
    } else if (receivedQty < orderedQty) {
      return <Badge className="bg-yellow-600">부분입고</Badge>;
    } else {
      return <Badge className="bg-green-600">입고완료</Badge>;
    }
  };

  if (availableItems.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>입고 확인</DialogTitle>
            <DialogDescription>발주번호: {orderNumber}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">모든 항목이 입고 완료되었습니다</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>입고 확인</DialogTitle>
          <DialogDescription>발주번호: {orderNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 전체 입고 버튼 */}
          <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-2 text-sm text-blue-900">
              <Package className="h-5 w-5" />
              <span>전체 입고 처리를 원하시면 아래 버튼을 클릭하세요</span>
            </div>
            <Button size="sm" onClick={handleFullInbound} disabled={isSubmitting}>
              전체 입고
            </Button>
          </div>

          {/* 입고 항목 테이블 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">SKU</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead className="w-[100px] text-center">발주수량</TableHead>
                  <TableHead className="w-[100px] text-center">기입고</TableHead>
                  <TableHead className="w-[100px] text-center">잔여수량</TableHead>
                  <TableHead className="w-[120px] text-center">입고수량</TableHead>
                  <TableHead className="w-[100px]">상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableItems.map((item) => {
                  const remainingQty = item.orderedQuantity - item.receivedQuantity;
                  const inboundQty = inboundQuantities[item.orderItemId] || 0;
                  const hasError = inboundQty > remainingQty;

                  return (
                    <TableRow key={item.orderItemId}>
                      <TableCell className="font-mono text-sm">{item.productSku}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        <div className="flex gap-2 mt-2">
                          <Input
                            placeholder="위치"
                            value={locations[item.orderItemId] || ""}
                            onChange={(e) =>
                              setLocations((prev) => ({
                                ...prev,
                                [item.orderItemId]: e.target.value,
                              }))
                            }
                            className="h-8 text-xs"
                            disabled={isSubmitting}
                          />
                          <Input
                            placeholder="LOT"
                            value={lotNumbers[item.orderItemId] || ""}
                            onChange={(e) =>
                              setLotNumbers((prev) => ({
                                ...prev,
                                [item.orderItemId]: e.target.value,
                              }))
                            }
                            className="h-8 text-xs"
                            disabled={isSubmitting}
                          />
                          <Input
                            type="date"
                            placeholder="유통기한"
                            title="유통기한"
                            value={expiryDates[item.orderItemId] || ""}
                            onChange={(e) =>
                              setExpiryDates((prev) => ({
                                ...prev,
                                [item.orderItemId]: e.target.value,
                              }))
                            }
                            className="h-8 text-xs"
                            disabled={isSubmitting}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {item.orderedQuantity}
                      </TableCell>
                      <TableCell className="text-center text-slate-600">
                        {item.receivedQuantity}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-blue-600">{remainingQty}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={remainingQty}
                          value={inboundQty || ""}
                          onChange={(e) => handleQuantityChange(item.orderItemId, e.target.value)}
                          placeholder="0"
                          className={cn(
                            "h-9 text-center",
                            hasError && "border-red-500 focus-visible:ring-red-500"
                          )}
                          disabled={isSubmitting}
                        />
                        {hasError && (
                          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            잔여 초과
                          </p>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* 메모 */}
          <div className="space-y-2">
            <Label htmlFor="notes">메모 (선택)</Label>
            <Textarea
              id="notes"
              placeholder="입고 관련 메모를 입력하세요"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {/* 입고 요약 */}
          {Object.keys(inboundQuantities).length > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h4 className="mb-2 font-semibold text-green-900">입고 요약</h4>
              <div className="space-y-1 text-sm text-green-800">
                <p>
                  • 입고 품목:{" "}
                  {
                    availableItems.filter(
                      (item) => (inboundQuantities[item.orderItemId] || 0) > 0
                    ).length
                  }
                  개
                </p>
                <p>
                  • 총 입고 수량:{" "}
                  {Object.values(inboundQuantities).reduce((sum, qty) => sum + qty, 0)}개
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting || isClosing}
          >
            취소
          </Button>
          {hasAnyReceived && (
            <Button
              variant="destructive"
              onClick={handleCloseOrder}
              disabled={isSubmitting || isClosing}
            >
              {isClosing ? "처리중..." : "잔여 포기 및 완료"}
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isSubmitting || isClosing}>
            {isSubmitting ? "처리중..." : "입고 확인"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
