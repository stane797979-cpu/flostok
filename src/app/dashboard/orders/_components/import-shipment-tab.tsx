"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Ship, Loader2, PackageCheck, Pencil, Check, X } from "lucide-react";
import { getImportShipments, confirmShipmentInbound, updateImportShipment, type ImportShipmentItem } from "@/server/actions/import-shipments";
import { useToast } from "@/hooks/use-toast";

function ShipmentStatusBadge({ item }: { item: ImportShipmentItem }) {
  if (item.warehouseActualDate) {
    return (
      <Badge className="bg-green-500 hover:bg-green-600 text-xs">
        입고완료
      </Badge>
    );
  }
  if (item.ataDate) {
    return (
      <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">
        입항완료
      </Badge>
    );
  }
  if (item.etaDate) {
    const eta = new Date(item.etaDate);
    const now = new Date();
    const daysUntil = Math.ceil((eta.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) {
      return (
        <Badge variant="destructive" className="text-xs">
          입항지연
        </Badge>
      );
    }
    if (daysUntil <= 3) {
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-xs">
          입항임박
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        운송중
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      대기
    </Badge>
  );
}

export function ImportShipmentTab() {
  const [items, setItems] = useState<ImportShipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inboundDialog, setInboundDialog] = useState<ImportShipmentItem | null>(null);
  const [inboundForm, setInboundForm] = useState({
    actualDate: new Date().toISOString().split("T")[0],
    receivedQuantity: "",
    location: "",
    notes: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingDate, setEditingDate] = useState<{ id: string; field: "etaDate" | "warehouseEtaDate"; value: string } | null>(null);
  const [isSavingDate, setIsSavingDate] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getImportShipments({ limit: 100 });
      setItems(result.items);
    } catch (error) {
      console.error("입항스케줄 조회 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenInbound = (item: ImportShipmentItem) => {
    setInboundDialog(item);
    setInboundForm({
      actualDate: new Date().toISOString().split("T")[0],
      receivedQuantity: String(item.quantity),
      location: "",
      notes: "",
    });
  };

  const handleConfirmInbound = async () => {
    if (!inboundDialog) return;
    const qty = parseInt(inboundForm.receivedQuantity) || 0;
    if (qty <= 0) {
      toast({ title: "수량 오류", description: "입고 수량을 입력해주세요", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await confirmShipmentInbound({
        shipmentId: inboundDialog.id,
        actualDate: inboundForm.actualDate || undefined,
        receivedQuantity: qty,
        location: inboundForm.location || undefined,
        notes: inboundForm.notes || undefined,
      });

      if (result.success) {
        toast({ title: "입고 처리 완료", description: result.message });
        setInboundDialog(null);
        loadData();
      } else {
        toast({ title: "입고 처리 실패", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "입고 처리 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditDate = (id: string, field: "etaDate" | "warehouseEtaDate", currentValue: string | null) => {
    setEditingDate({ id, field, value: currentValue || "" });
  };

  const handleSaveDate = async () => {
    if (!editingDate) return;
    setIsSavingDate(true);
    try {
      const result = await updateImportShipment(editingDate.id, {
        [editingDate.field]: editingDate.value || undefined,
      });
      if (result.success) {
        toast({ title: "날짜가 변경되었습니다", description: "발주서 예상입고일도 자동 동기화됩니다" });
        setEditingDate(null);
        loadData();
      } else {
        toast({ title: "변경 실패", description: result.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "오류", description: "날짜 변경에 실패했습니다", variant: "destructive" });
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleCancelDate = () => setEditingDate(null);

  // 요약 통계
  const totalCount = items.length;
  const inTransit = items.filter((i) => !i.ataDate && i.etaDate).length;
  const arrivedNotStored = items.filter((i) => i.ataDate && !i.warehouseActualDate).length;
  const totalAmount = items.reduce((sum, i) => {
    return sum + (i.invoiceAmountUsd ? parseFloat(i.invoiceAmountUsd) : 0);
  }, 0);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        입항스케줄을 불러오는 중...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Ship className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">입항스케줄 없음</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground/70">
            수입 발주의 입항스케줄을 등록하면 여기에 표시됩니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 건수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">운송중</CardTitle>
            <Ship className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inTransit}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">입항/창고대기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{arrivedNotStored}건</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>입항스케줄 상세</CardTitle>
          <CardDescription>B/L, 컨테이너, 수량, 금액 및 일정 현황 · 입고처리 시 재고 자동 반영</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>상태</TableHead>
                  <TableHead>제품</TableHead>
                  <TableHead>발주번호</TableHead>
                  <TableHead>B/L#</TableHead>
                  <TableHead>CNTR#</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">금액(USD)</TableHead>
                  <TableHead className="text-center">입항예정</TableHead>
                  <TableHead className="text-center">입항실제</TableHead>
                  <TableHead className="text-center">창고입고예정</TableHead>
                  <TableHead className="text-center">창고입고실제</TableHead>
                  <TableHead className="text-center w-[90px]">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <ShipmentStatusBadge item={item} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[120px]">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.productSku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{item.orderNumber || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{item.blNumber || "-"}</TableCell>
                    <TableCell className="text-xs font-mono">{item.containerNumber || "-"}</TableCell>
                    <TableCell className="text-right text-xs">
                      {item.quantity.toLocaleString()}
                      {item.cartonQty && (
                        <span className="text-muted-foreground ml-1">({item.cartonQty}ctn)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono">
                      {item.invoiceAmountUsd
                        ? `$${parseFloat(item.invoiceAmountUsd).toLocaleString("en-US", { minimumFractionDigits: 0 })}`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {editingDate?.id === item.id && editingDate.field === "etaDate" ? (
                        <div className="flex items-center gap-0.5 justify-center">
                          <Input
                            type="date"
                            value={editingDate.value}
                            onChange={(e) => setEditingDate({ ...editingDate, value: e.target.value })}
                            className="h-6 w-32 text-xs"
                            disabled={isSavingDate}
                          />
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleSaveDate} disabled={isSavingDate} aria-label="날짜 저장">
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCancelDate} disabled={isSavingDate} aria-label="날짜 취소">
                            <X className="h-3 w-3 text-slate-400" />
                          </Button>
                        </div>
                      ) : (
                        <div className="group inline-flex items-center gap-0.5">
                          <span>{item.etaDate || "-"}</span>
                          {!item.warehouseActualDate && (
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleEditDate(item.id, "etaDate", item.etaDate)}
                              aria-label="입항예정일 수정"
                            >
                              <Pencil className="h-3 w-3 text-slate-400" />
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {item.ataDate || "-"}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {editingDate?.id === item.id && editingDate.field === "warehouseEtaDate" ? (
                        <div className="flex items-center gap-0.5 justify-center">
                          <Input
                            type="date"
                            value={editingDate.value}
                            onChange={(e) => setEditingDate({ ...editingDate, value: e.target.value })}
                            className="h-6 w-32 text-xs"
                            disabled={isSavingDate}
                          />
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleSaveDate} disabled={isSavingDate} aria-label="날짜 저장">
                            <Check className="h-3 w-3 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCancelDate} disabled={isSavingDate} aria-label="날짜 취소">
                            <X className="h-3 w-3 text-slate-400" />
                          </Button>
                        </div>
                      ) : (
                        <div className="group inline-flex items-center gap-0.5">
                          <span>{item.warehouseEtaDate || "-"}</span>
                          {!item.warehouseActualDate && (
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleEditDate(item.id, "warehouseEtaDate", item.warehouseEtaDate)}
                              aria-label="창고입고예정일 수정"
                            >
                              <Pencil className="h-3 w-3 text-slate-400" />
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {item.warehouseActualDate || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.warehouseActualDate ? (
                        <Badge variant="outline" className="text-[10px] text-green-600">완료</Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleOpenInbound(item)}
                        >
                          <PackageCheck className="mr-1 h-3 w-3" />
                          입고
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 입고 처리 다이얼로그 */}
      <Dialog open={!!inboundDialog} onOpenChange={(open) => !open && setInboundDialog(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>입항스케줄 입고 처리</DialogTitle>
            <DialogDescription>
              {inboundDialog && (
                <>
                  {inboundDialog.productName} ({inboundDialog.productSku})
                  {inboundDialog.blNumber && ` · B/L: ${inboundDialog.blNumber}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">스케줄 수량</span>
                <span className="font-semibold">{inboundDialog?.quantity.toLocaleString()}개</span>
              </div>
              {inboundDialog?.orderNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">발주번호</span>
                  <span className="font-mono text-xs">{inboundDialog.orderNumber}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">입고일</Label>
              <Input
                type="date"
                value={inboundForm.actualDate}
                onChange={(e) => setInboundForm((f) => ({ ...f, actualDate: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">입고 수량</Label>
              <Input
                type="number"
                min="1"
                value={inboundForm.receivedQuantity}
                onChange={(e) => setInboundForm((f) => ({ ...f, receivedQuantity: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">적치 위치 (선택)</Label>
              <Input
                placeholder="예: A-01-02"
                value={inboundForm.location}
                onChange={(e) => setInboundForm((f) => ({ ...f, location: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">메모 (선택)</Label>
              <Input
                placeholder="입고 메모"
                value={inboundForm.notes}
                onChange={(e) => setInboundForm((f) => ({ ...f, notes: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInboundDialog(null)}>
              취소
            </Button>
            <Button onClick={handleConfirmInbound} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                "입고 처리"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
