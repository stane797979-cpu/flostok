"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, Loader2, PackagePlus, XCircle, PackageCheck, Upload } from "lucide-react";
import { DeliveryComplianceTab } from "./delivery-compliance-tab";
import { ImportShipmentTab } from "./import-shipment-tab";
import type { DeliveryComplianceResult } from "@/server/services/scm/delivery-compliance";
import { ReorderSummary } from "./reorder-summary";
import { ReorderItemsTable, type ReorderItem } from "./reorder-items-table";
import { PurchaseOrdersTable, type PurchaseOrderListItem } from "./purchase-orders-table";
import {
  AutoReorderRecommendationsTable,
  type AutoReorderRecommendation,
} from "./auto-reorder-recommendations-table";
import { InboundRecordsTable, type InboundRecord } from "./inbound-records-table";
import { OrderDialog } from "./order-dialog";
import { BulkOrderDialog } from "./bulk-order-dialog";
import { OrderDetailDialog } from "./order-detail-dialog";
import { OtherInboundDialog } from "./other-inbound-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  createPurchaseOrder,
  createBulkPurchaseOrders,
  approveAutoReorders,
  rejectAutoReorders,
  getPurchaseOrders,
  getReorderItems,
  cancelBulkPurchaseOrders,
  uploadPurchaseOrderExcel,
} from "@/server/actions/purchase-orders";
import { exportPurchaseOrderToExcel, exportInboundRecordsToExcel } from "@/server/actions/excel-export";
import { getInboundRecords, bulkConfirmInbound } from "@/server/actions/inbound";
import type { ReorderItem as ServerReorderItem } from "@/server/services/scm/reorder-recommendation";

/**
 * 서버 ReorderItem → 클라이언트 ReorderItem 매핑
 */
function mapServerToClientReorderItem(item: ServerReorderItem): ReorderItem {
  return {
    productId: item.productId,
    sku: item.sku,
    productName: item.productName,
    currentStock: item.currentStock,
    safetyStock: item.safetyStock,
    reorderPoint: item.reorderPoint,
    daysOfInventory: item.daysOfStock ?? 0,
    recommendedQty: item.recommendedQty,
    urgencyLevel: item.urgencyLevel,
    supplierId: item.supplier?.id,
    supplierName: item.supplier?.name,
    leadTime: item.supplier?.leadTime ?? 7,
    forecastBased: item.forecastBased,
    forecastMethod: item.forecastMethod,
  };
}

/**
 * 발주 필요 품목 → 자동발주 추천 변환
 */
function generateAutoReorderRecommendations(
  items: ReorderItem[]
): AutoReorderRecommendation[] {
  return items.map((item, index) => {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + item.leadTime);

    const statusReasons: Record<number, string> = {
      0: `품절 상태 (현재고 ${item.currentStock}개)`,
      1: `위험 상태 (재고일수 ${item.daysOfInventory.toFixed(1)}일)`,
      2: `부족 상태 (재고일수 ${item.daysOfInventory.toFixed(1)}일)`,
      3: `주의 상태 (발주점 도달)`,
    };

    return {
      id: `auto-rec-${index}`,
      productId: item.productId,
      sku: item.sku,
      productName: item.productName,
      currentStock: item.currentStock,
      safetyStock: item.safetyStock,
      reorderPoint: item.reorderPoint,
      recommendedQty: item.recommendedQty,
      urgencyLevel: item.urgencyLevel,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      leadTime: item.leadTime,
      estimatedCost: 0,
      expectedDate: expectedDate.toISOString().split("T")[0],
      reason: statusReasons[item.urgencyLevel] || "발주 필요",
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };
  });
}

// 발주 상태를 PurchaseOrderListItem 타입에 맞게 매핑
const mapOrderStatus = (
  status: string
): PurchaseOrderListItem["status"] => {
  const statusMap: Record<string, PurchaseOrderListItem["status"]> = {
    draft: "draft",
    pending: "draft",
    approved: "ordered",
    ordered: "ordered",
    confirmed: "ordered",
    shipped: "pending_receipt",
    partially_received: "pending_receipt",
    received: "received",
    completed: "received",
    cancelled: "cancelled",
  };
  return statusMap[status] || "draft";
};

/**
 * 월의 시작일/종료일 계산
 */
function getMonthRange(date: Date): { startDate: string; endDate: string } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startDate = new Date(year, month, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { startDate, endDate };
}

/**
 * 월 표시 포맷
 */
function formatMonth(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

interface OrdersClientProps {
  initialTab?: "reorder" | "auto-reorder" | "orders" | "inbound" | "delivery";
  serverReorderItems?: ServerReorderItem[];
  deliveryComplianceData?: DeliveryComplianceResult | null;
}

export function OrdersClient({ initialTab = "reorder", serverReorderItems = [], deliveryComplianceData = null }: OrdersClientProps) {
  // 발주 필요 품목 (발주 후 재조회 가능하도록 state로 관리)
  const [reorderItems, setReorderItems] = useState<ReorderItem[]>(
    () => serverReorderItems.map(mapServerToClientReorderItem)
  );

  // 자동발주 추천 생성 (발주 필요 품목 기반)
  const autoReorderRecommendations = useMemo(
    () => generateAutoReorderRecommendations(reorderItems),
    [reorderItems]
  );

  // 발주 필요 품목 재조회
  const loadReorderItems = useCallback(async () => {
    try {
      const result = await getReorderItems();
      setReorderItems(result.items.map(mapServerToClientReorderItem));
    } catch (error) {
      console.error("발주 필요 품목 재조회 오류:", error);
    }
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedAutoReorderIds, setSelectedAutoReorderIds] = useState<string[]>([]);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [bulkOrderDialogOpen, setBulkOrderDialogOpen] = useState(false);
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ReorderItem | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // 발주 현황 체크박스
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isCancellingOrders, setIsCancellingOrders] = useState(false);
  const [isConfirmingInbound, setIsConfirmingInbound] = useState(false);

  // 입고 현황 상태
  const [inboundMonth, setInboundMonth] = useState<Date>(() => new Date());
  const [inboundRecords, setInboundRecords] = useState<InboundRecord[]>([]);
  const [isLoadingInbound, setIsLoadingInbound] = useState(false);
  const [isDownloadingInbound, setIsDownloadingInbound] = useState(false);
  const [otherInboundOpen, setOtherInboundOpen] = useState(false);

  // 발주 엑셀 업로드
  const orderUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingOrders, startUploadTransition] = useTransition();

  const { toast } = useToast();

  // DB에서 발주 목록 불러오기
  const loadPurchaseOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const result = await getPurchaseOrders({ limit: 100 });
      const mapped: PurchaseOrderListItem[] = result.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        supplierName: order.supplier?.name || "미지정",
        itemsCount: order.itemsCount,
        totalAmount: order.totalAmount || 0,
        status: mapOrderStatus(order.status),
        orderDate: order.orderDate || (order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : ""),
        expectedDate: order.expectedDate || null,
      }));
      setPurchaseOrders(mapped);
    } catch (error) {
      console.error("발주 목록 조회 오류:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  // 입고 기록 조회
  const loadInboundRecords = useCallback(async (month: Date) => {
    setIsLoadingInbound(true);
    try {
      const { startDate, endDate } = getMonthRange(month);
      const result = await getInboundRecords({ startDate, endDate, limit: 500 });
      setInboundRecords(
        result.records.map((r) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }))
      );
    } catch (error) {
      console.error("입고 기록 조회 오류:", error);
    } finally {
      setIsLoadingInbound(false);
    }
  }, []);

  // 월 이동
  const handlePrevMonth = useCallback(() => {
    setInboundMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      loadInboundRecords(next);
      return next;
    });
  }, [loadInboundRecords]);

  const handleNextMonth = useCallback(() => {
    setInboundMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      loadInboundRecords(next);
      return next;
    });
  }, [loadInboundRecords]);

  // 입고 엑셀 다운로드
  const handleDownloadInbound = useCallback(async () => {
    setIsDownloadingInbound(true);
    try {
      const { startDate, endDate } = getMonthRange(inboundMonth);
      const result = await exportInboundRecordsToExcel({ startDate, endDate });

      if (result.success && result.data) {
        const binaryString = atob(result.data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "다운로드 완료",
          description: `${result.data.filename} 파일이 다운로드되었습니다`,
        });
      } else {
        toast({
          title: "다운로드 실패",
          description: result.error || "입고 현황 Excel 다운로드에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("입고 현황 Excel 다운로드 오류:", error);
      toast({
        title: "오류",
        description: "Excel 다운로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingInbound(false);
    }
  }, [inboundMonth, toast]);

  // 초기 로드
  useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  // 긴급도별 카운트
  const urgentCount = reorderItems.filter((item) => item.urgencyLevel <= 1).length;
  const lowCount = reorderItems.filter((item) => item.urgencyLevel === 2).length;
  const cautionCount = reorderItems.filter((item) => item.urgencyLevel === 3).length;

  const handleOrderClick = (item: ReorderItem) => {
    if (!item.supplierId) {
      toast({
        title: "공급자 미지정",
        description: `${item.productName}에 공급자가 지정되지 않았습니다. 제품 관리에서 공급자를 먼저 등록해주세요.`,
        variant: "destructive",
      });
      return;
    }
    setSelectedProduct(item);
    setOrderDialogOpen(true);
  };

  const handleBulkOrderClick = () => {
    if (selectedIds.length === 0) {
      toast({
        title: "알림",
        description: "발주할 품목을 선택해주세요",
        variant: "destructive",
      });
      return;
    }
    setBulkOrderDialogOpen(true);
  };

  const handleBulkOrderSubmit = async (data: {
    items: Array<{
      productId: string;
      quantity: number;
      supplierId: string;
    }>;
    notes: string;
  }) => {
    try {
      const result = await createBulkPurchaseOrders({
        items: data.items,
        notes: data.notes,
      });

      if (result.success && result.createdOrders.length > 0) {
        toast({
          title: "일괄 발주 완료",
          description: `${result.createdOrders.length}개의 발주서가 생성되었습니다`,
        });
        setSelectedIds([]);
        setBulkOrderDialogOpen(false);
        loadPurchaseOrders();
        loadReorderItems();
      } else if (result.errors.length > 0) {
        toast({
          title: "일괄 발주 실패",
          description: result.errors[0]?.error || "발주서 생성에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("일괄 발주 오류:", error);
      toast({
        title: "오류",
        description: "일괄 발주 처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  const handleOrderSubmit = async (data: {
    productId: string;
    quantity: number;
    supplierId: string;
    expectedDate: string;
    notes: string;
  }) => {
    try {
      const result = await createPurchaseOrder({
        items: [
          {
            productId: data.productId,
            quantity: data.quantity,
          },
        ],
        supplierId: data.supplierId,
        expectedDate: data.expectedDate,
        notes: data.notes,
      });

      if (result.success) {
        toast({
          title: "발주 완료",
          description: `${selectedProduct?.productName} ${data.quantity}개 발주가 생성되었습니다`,
        });
        setSelectedProduct(null);
        setOrderDialogOpen(false);
        loadPurchaseOrders();
        loadReorderItems();
      } else {
        toast({
          title: "발주 실패",
          description: result.error || "발주서 생성에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("발주 오류:", error);
      toast({
        title: "오류",
        description: "발주 처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setOrderDetailDialogOpen(true);
  };

  const handleDownloadOrder = async (orderId: string) => {
    try {
      const result = await exportPurchaseOrderToExcel(orderId);

      if (result.success && result.data) {
        // Base64 디코딩 후 Blob 생성
        const binaryString = atob(result.data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        // 다운로드 링크 생성 및 클릭
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast({
          title: "다운로드 완료",
          description: `${result.data.filename} 파일이 다운로드되었습니다`,
        });
      } else {
        toast({
          title: "다운로드 실패",
          description: result.error || "Excel 다운로드에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Excel 다운로드 오류:", error);
      toast({
        title: "오류",
        description: "Excel 다운로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  const handleBulkCancel = async () => {
    if (selectedOrderIds.length === 0) return;

    setIsCancellingOrders(true);
    try {
      const result = await cancelBulkPurchaseOrders(selectedOrderIds);

      if (result.success) {
        toast({
          title: "일괄 취소 완료",
          description: `${result.cancelledCount}건의 발주서가 취소되었습니다`,
        });
        setSelectedOrderIds([]);
        loadPurchaseOrders();
        loadReorderItems();
      }

      if (result.errors.length > 0) {
        toast({
          title: result.cancelledCount > 0 ? "일부 취소 실패" : "취소 실패",
          description: result.errors[0]?.error || "취소 처리에 실패한 발주서가 있습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("일괄 취소 오류:", error);
      toast({
        title: "오류",
        description: "일괄 취소 처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsCancellingOrders(false);
    }
  };

  const handleOrderExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    startUploadTransition(async () => {
      const result = await uploadPurchaseOrderExcel(formData);
      if (result.success) {
        toast({ title: "업로드 완료", description: result.message });
        loadPurchaseOrders();
        loadReorderItems();
      } else {
        toast({ title: "업로드 실패", description: result.message, variant: "destructive" });
      }
    });

    e.target.value = "";
  };

  const handleBulkInbound = async () => {
    if (selectedOrderIds.length === 0) return;

    // 입고 가능한 상태의 발주만 필터
    const inboundCapableStatuses = ["ordered", "pending_receipt"];
    const inboundableIds = purchaseOrders
      .filter((o) => selectedOrderIds.includes(o.id) && inboundCapableStatuses.includes(o.status))
      .map((o) => o.id);

    if (inboundableIds.length === 0) {
      toast({
        title: "입고 처리 불가",
        description: "선택된 발주서 중 입고 가능한 발주서가 없습니다 (발주완료/입고대기 상태만 가능)",
        variant: "destructive",
      });
      return;
    }

    setIsConfirmingInbound(true);
    try {
      const result = await bulkConfirmInbound(inboundableIds);

      if (result.success) {
        toast({
          title: "일괄 입고 완료",
          description: `${result.processedCount}건의 발주서가 전량 입고 처리되었습니다`,
        });
        setSelectedOrderIds([]);
        loadPurchaseOrders();
        loadReorderItems();
      }

      if (result.errors.length > 0) {
        toast({
          title: result.processedCount > 0 ? "일부 입고 실패" : "입고 실패",
          description: result.errors[0]?.error || "입고 처리에 실패한 발주서가 있습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("일괄 입고확인 오류:", error);
      toast({
        title: "오류",
        description: "일괄 입고확인 처리 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsConfirmingInbound(false);
    }
  };

  const handleApproveAutoReorders = async (ids: string[]) => {
    try {
      // 선택된 추천 목록에서 발주 데이터 추출
      const selectedRecs = autoReorderRecommendations.filter((r) =>
        ids.includes(r.id)
      );
      const items = selectedRecs.map((r) => ({
        productId: r.productId,
        quantity: r.recommendedQty,
        supplierId: r.supplierId || "",
      }));

      const result = await approveAutoReorders(ids, items);

      if (result.success && result.errors.length === 0) {
        toast({
          title: "자동 발주 승인 완료",
          description: `${result.createdOrders.length}개의 발주서가 생성되었습니다`,
        });
        setSelectedAutoReorderIds([]);
        loadPurchaseOrders();
        loadReorderItems();
      } else if (result.success && result.errors.length > 0) {
        toast({
          title: "자동 발주 부분 완료",
          description: `${result.createdOrders.length}개 생성, ${result.errors.length}개 실패 (${result.errors[0]?.error || "공급자 미지정"})`,
          variant: "destructive",
        });
        setSelectedAutoReorderIds([]);
        loadPurchaseOrders();
        loadReorderItems();
      } else {
        toast({
          title: "자동 발주 승인 실패",
          description: result.errors[0]?.error || "자동 발주 승인에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("자동 발주 승인 오류:", error);
      toast({
        title: "오류",
        description: "자동 발주 승인 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  const handleRejectAutoReorders = async (ids: string[]) => {
    try {
      const result = await rejectAutoReorders(ids);

      if (result.success) {
        toast({
          title: "자동 발주 거부 완료",
          description: `${ids.length}개의 자동 발주가 거부되었습니다`,
        });
        setSelectedAutoReorderIds([]);
        loadReorderItems();
      } else if (result.errors.length > 0) {
        toast({
          title: "일부 자동 발주 거부 실패",
          description: result.errors[0]?.error || "자동 발주 거부에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("자동 발주 거부 오류:", error);
      toast({
        title: "오류",
        description: "자동 발주 거부 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">발주 관리</h1>
        <p className="mt-2 text-slate-500">재고 상태를 확인하고 발주를 진행하세요</p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="reorder">발주 필요</TabsTrigger>
          <TabsTrigger value="auto-reorder">자동발주</TabsTrigger>
          <TabsTrigger value="orders">발주 현황</TabsTrigger>
          <TabsTrigger value="inbound" onClick={() => loadInboundRecords(inboundMonth)}>
            입고 현황
          </TabsTrigger>
          <TabsTrigger value="delivery">납기분석</TabsTrigger>
          <TabsTrigger value="import-shipment">입항스케줄</TabsTrigger>
        </TabsList>

        <TabsContent value="reorder" className="space-y-4">
          <ReorderSummary
            urgentCount={urgentCount}
            lowCount={lowCount}
            cautionCount={cautionCount}
          />

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>발주 필요 품목</CardTitle>
                  <CardDescription>현재고가 발주점 이하인 품목 목록입니다</CardDescription>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={orderUploadRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={handleOrderExcelUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
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
                    <Download className="mr-1 h-4 w-4" />
                    양식 다운로드
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUploadingOrders}
                    onClick={() => orderUploadRef.current?.click()}
                  >
                    <Upload className="mr-1 h-4 w-4" />
                    {isUploadingOrders ? "업로드 중..." : "발주 엑셀 업로드"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ReorderItemsTable
                items={reorderItems}
                selectedIds={selectedIds}
                onSelectChange={setSelectedIds}
                onOrderClick={handleOrderClick}
                onBulkOrderClick={handleBulkOrderClick}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto-reorder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>자동 발주 추천</CardTitle>
              <CardDescription>
                AI가 재고 상태와 수요 예측을 분석하여 자동으로 생성한 발주 추천 목록입니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AutoReorderRecommendationsTable
                recommendations={autoReorderRecommendations}
                selectedIds={selectedAutoReorderIds}
                onSelectChange={setSelectedAutoReorderIds}
                onApprove={handleApproveAutoReorders}
                onReject={handleRejectAutoReorders}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>발주 현황</CardTitle>
                  <CardDescription>진행 중인 발주서 목록입니다</CardDescription>
                </div>
                {selectedOrderIds.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleBulkInbound}
                      disabled={isConfirmingInbound || isCancellingOrders}
                    >
                      {isConfirmingInbound ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <PackageCheck className="mr-2 h-4 w-4" />
                      )}
                      {selectedOrderIds.length}건 일괄 입고확인
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkCancel}
                      disabled={isCancellingOrders || isConfirmingInbound}
                    >
                      {isCancellingOrders ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      {selectedOrderIds.length}건 일괄 취소
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingOrders ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  발주 목록을 불러오는 중...
                </div>
              ) : (
                <PurchaseOrdersTable
                  orders={purchaseOrders}
                  onViewClick={handleViewOrder}
                  onDownloadClick={handleDownloadOrder}
                  selectedIds={selectedOrderIds}
                  onSelectChange={setSelectedOrderIds}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbound" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>입고 현황</CardTitle>
                  <CardDescription>월별 입고 기록을 확인하고 엑셀로 다운로드할 수 있습니다</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[120px] text-center font-medium">
                    {formatMonth(inboundMonth)}
                  </span>
                  <Button variant="outline" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOtherInboundOpen(true)}
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    기타 입고
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadInbound}
                    disabled={isDownloadingInbound || inboundRecords.length === 0}
                  >
                    {isDownloadingInbound ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    엑셀 다운로드
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingInbound ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  입고 기록을 불러오는 중...
                </div>
              ) : (
                <>
                  <div className="mb-3 text-sm text-slate-500">
                    총 {inboundRecords.length}건
                  </div>
                  <InboundRecordsTable records={inboundRecords} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="space-y-4">
          <DeliveryComplianceTab data={deliveryComplianceData} />
        </TabsContent>

        <TabsContent value="import-shipment" className="space-y-4">
          <ImportShipmentTab />
        </TabsContent>
      </Tabs>

      <OrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        product={selectedProduct}
        onSubmit={handleOrderSubmit}
      />

      <BulkOrderDialog
        open={bulkOrderDialogOpen}
        onOpenChange={setBulkOrderDialogOpen}
        items={reorderItems.filter((item) => selectedIds.includes(item.productId))}
        onSubmit={handleBulkOrderSubmit}
      />

      {selectedOrderId && (
        <OrderDetailDialog
          open={orderDetailDialogOpen}
          onOpenChange={setOrderDetailDialogOpen}
          orderId={selectedOrderId}
          onStatusChange={() => {
            loadPurchaseOrders();
            loadReorderItems();
          }}
        />
      )}

      <OtherInboundDialog
        open={otherInboundOpen}
        onOpenChange={setOtherInboundOpen}
        onSuccess={() => loadInboundRecords(inboundMonth)}
      />
    </div>
  );
}
