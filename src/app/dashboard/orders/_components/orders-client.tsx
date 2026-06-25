"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, Loader2, XCircle, Upload } from "lucide-react";
import { ReorderSummary } from "./reorder-summary";
import { ReorderItemsTable, type ReorderItem } from "./reorder-items-table";
import { PurchaseOrdersTable, type PurchaseOrderListItem } from "./purchase-orders-table";
import {
  AutoReorderRecommendationsTable,
  type AutoReorderRecommendation,
} from "./auto-reorder-recommendations-table";
import { OrderDialog } from "./order-dialog";
import { BulkOrderDialog } from "./bulk-order-dialog";
import { OrderDetailDialog } from "./order-detail-dialog";
import { InboundRecordsTable, type InboundRecord } from "./inbound-records-table";
import { DeliveryComplianceTab } from "./delivery-compliance-tab";
import { ImportShipmentTab } from "./import-shipment-tab";
import { getInboundRecords } from "@/server/actions/inbound";
import { getDeliveryComplianceData } from "@/server/actions/delivery-compliance";
import type { DeliveryComplianceResult } from "@/server/services/scm/delivery-compliance";
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
import { exportPurchaseOrderToExcel } from "@/server/actions/excel-export";
import { submitForApproval } from "@/server/actions/purchase-order-approvals";
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
    daysOfInventory: item.daysOfStock ?? null,
    recommendedQty: item.recommendedQty,
    urgencyLevel: item.urgencyLevel,
    supplierId: item.supplier?.id,
    supplierName: item.supplier?.name,
    leadTime: item.supplier?.leadTime ?? 7,
    avgDailySales: item.avgDailySales,
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
      1: `위험 상태 (재고일수 ${item.daysOfInventory !== null ? item.daysOfInventory.toFixed(1) + "일" : "판매실적 없음"})`,
      2: `부족 상태 (재고일수 ${item.daysOfInventory !== null ? item.daysOfInventory.toFixed(1) + "일" : "판매실적 없음"})`,
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
      avgDailySales: item.avgDailySales,
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
    pending: "pending",
    approved: "approved",
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

type ServerPurchaseOrder = Awaited<ReturnType<typeof getPurchaseOrders>>["orders"][number];

interface OrdersClientProps {
  serverReorderItems?: ServerReorderItem[];
  serverPurchaseOrders?: ServerPurchaseOrder[];
  initialTab?: string;
}

const VALID_TABS_SET = new Set(["order", "orders", "inbound", "delivery", "import-shipment"]);
// URL 하위 호환: reorder, auto-reorder → order로 리다이렉트
const TAB_ALIAS: Record<string, string> = { reorder: "order", "auto-reorder": "order" };

type TabType = "order" | "orders" | "inbound" | "delivery" | "import-shipment";

export function OrdersClient({ serverReorderItems = [], serverPurchaseOrders, initialTab }: OrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getTabFromUrl = (): TabType => {
    const raw = searchParams.get("tab") || initialTab || "order";
    const tab = TAB_ALIAS[raw] ?? raw;
    return VALID_TABS_SET.has(tab) ? (tab as TabType) : "order";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromUrl);

  // 사이드바 링크 클릭 등 외부 URL 변경 시 activeTab 동기화
  useEffect(() => {
    const raw = searchParams.get("tab") || "order";
    const tab = TAB_ALIAS[raw] ?? raw;
    if (VALID_TABS_SET.has(tab)) {
      setActiveTab(tab as TabType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const switchTab = useCallback((tab: string) => {
    setActiveTab(tab as TabType);
    router.replace(`/dashboard/orders?tab=${tab}`, { scroll: false });
  }, [router]);

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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItem[]>(() => {
    if (serverPurchaseOrders) {
      return serverPurchaseOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        supplierName: order.supplier?.name || "미지정",
        itemsCount: order.itemsCount,
        totalAmount: order.totalAmount || 0,
        status: mapOrderStatus(order.status),
        orderDate: order.orderDate || (order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : ""),
        expectedDate: order.expectedDate || null,
        actualDate: order.actualDate || null,
      }));
    }
    return [];
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // 입고현황 데이터
  const [inboundRecords, setInboundRecords] = useState<InboundRecord[]>([]);
  const [isLoadingInbound, setIsLoadingInbound] = useState(false);

  // 납기분석 데이터
  const [deliveryData, setDeliveryData] = useState<DeliveryComplianceResult | null>(null);
  const [isLoadingDelivery, setIsLoadingDelivery] = useState(false);

  // 발주현황 KPI
  const orderKPI = useMemo(() => {
    const pending = purchaseOrders.filter((o) => o.status === "pending" || o.status === "draft").length;
    const inbound = purchaseOrders.filter((o) => o.status === "ordered" || o.status === "pending_receipt").length;
    const completed = purchaseOrders.filter((o) => o.status === "received").length;
    const total = purchaseOrders.filter((o) => o.status !== "cancelled").length;
    return { pending, inbound, completed, total };
  }, [purchaseOrders]);

  // 발주 현황 체크박스
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isCancellingOrders, setIsCancellingOrders] = useState(false);
  const [hideReceived, setHideReceived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
        actualDate: order.actualDate || null,
      }));
      setPurchaseOrders(mapped);
    } catch (error) {
      console.error("발주 목록 조회 오류:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  // activeTab 변경 시 필요한 데이터 로드
  useEffect(() => {
    if (activeTab === "orders") {
      loadPurchaseOrders();
    }
    if (activeTab === "inbound") {
      setIsLoadingInbound(true);
      getInboundRecords({ limit: 200 }).then((result) => {
        setInboundRecords(result.records as unknown as InboundRecord[]);
      }).catch(console.error).finally(() => setIsLoadingInbound(false));
    }
    if (activeTab === "delivery") {
      setIsLoadingDelivery(true);
      getDeliveryComplianceData().then((data) => {
        setDeliveryData(data);
      }).catch(console.error).finally(() => setIsLoadingDelivery(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
        const orderedProductIds = data.items.map((i) => i.productId);
        setReorderItems((prev) => prev.filter((item) => !orderedProductIds.includes(item.productId)));
        setSelectedIds([]);
        setBulkOrderDialogOpen(false);
        loadPurchaseOrders();
        switchTab("orders");
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
    productName: string;
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

      if (result.success && result.orderId) {
        // 발주서 생성 즉시 결재 상신 (draft → pending)
        await submitForApproval(result.orderId);
        toast({
          title: "발주 등록 완료",
          description: `${data.productName} ${data.quantity}개 발주가 결재 상신되었습니다`,
        });
        setReorderItems((prev) => prev.filter((item) => item.productId !== data.productId));
        setSelectedProduct(null);
        setOrderDialogOpen(false);
        loadPurchaseOrders();
        switchTab("orders");
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


  const handleApproveAutoReorders = async (ids: string[]) => {
    try {
      // 선택된 추천 목록에서 발주 데이터 추출
      const selectedRecs = autoReorderRecommendations.filter((r) =>
        ids.includes(r.id)
      );

      // 공급자 미지정 항목 사전 차단
      const noSupplierItems = selectedRecs.filter((r) => !r.supplierId);
      if (noSupplierItems.length > 0) {
        const names = noSupplierItems.map((r) => r.productName).join(", ");
        toast({
          title: "공급자 미지정 품목 있음",
          description: `공급자가 없는 품목은 발주할 수 없습니다. 제품 관리에서 공급자를 먼저 등록해주세요.\n미지정: ${names}`,
          variant: "destructive",
        });
        return;
      }

      const items = selectedRecs.map((r) => ({
        productId: r.productId,
        quantity: r.recommendedQty,
        supplierId: r.supplierId!,
      }));

      const result = await approveAutoReorders(ids, items);

      if (result.success && result.errors.length === 0) {
        toast({
          title: "AI발주 승인 완료",
          description: `${result.createdOrders.length}개의 발주서가 생성되었습니다`,
        });
        const approvedProductIds = selectedRecs.map((r) => r.productId);
        setReorderItems((prev) => prev.filter((item) => !approvedProductIds.includes(item.productId)));
        setSelectedAutoReorderIds([]);
        loadPurchaseOrders();
        switchTab("orders");
      } else if (result.success && result.errors.length > 0) {
        const failedIds = new Set(result.errors.map((e) => e.recommendationId));
        const successProductIds = selectedRecs.filter((r) => !failedIds.has(r.id)).map((r) => r.productId);
        setReorderItems((prev) => prev.filter((item) => !successProductIds.includes(item.productId)));
        toast({
          title: "AI발주 부분 완료",
          description: `${result.createdOrders.length}개 생성, ${result.errors.length}개 실패 (${result.errors[0]?.error || "공급자 미지정"})`,
          variant: "destructive",
        });
        setSelectedAutoReorderIds([]);
        loadPurchaseOrders();
        switchTab("orders");
      } else {
        toast({
          title: "AI발주 승인 실패",
          description: result.errors[0]?.error || "AI발주 승인에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("자동 발주 승인 오류:", error);
      toast({
        title: "오류",
        description: "AI발주 승인 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  const handleRejectAutoReorders = async (ids: string[]) => {
    try {
      const result = await rejectAutoReorders(ids);

      if (result.success) {
        toast({
          title: "AI발주 거부 완료",
          description: `${ids.length}개의 AI발주가 거부되었습니다`,
        });
        setSelectedAutoReorderIds([]);
        loadReorderItems();
      } else if (result.errors.length > 0) {
        toast({
          title: "일부 AI발주 거부 실패",
          description: result.errors[0]?.error || "AI발주 거부에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("자동 발주 거부 오류:", error);
      toast({
        title: "오류",
        description: "AI발주 거부 중 오류가 발생했습니다",
        variant: "destructive",
      });
    }
  };

  const pageTitles: Record<TabType, { title: string; description: string }> = {
    order:             { title: "AI발주 권고",  description: "발주 필요 품목을 확인하고 AI추천 또는 직접 발주를 진행하세요" },
    orders:            { title: "발주현황",     description: "생성된 발주서 목록을 확인하세요" },
    inbound:           { title: "입고현황",     description: "발주서별 입고 현황을 확인하세요" },
    delivery:          { title: "납기분석",     description: "납기 준수율 및 지연 현황을 분석합니다" },
    "import-shipment": { title: "입항스케줄",   description: "수입 화물의 입항 스케줄을 관리합니다" },
  };

  const currentPage = pageTitles[activeTab] || pageTitles.order;

  const TAB_LABELS: Record<TabType, string> = {
    order:             "AI발주 권고",
    orders:            "발주현황",
    inbound:           "입고현황",
    delivery:          "납기분석",
    "import-shipment": "입항스케줄",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{currentPage.title}</h1>
        <p className="mt-2 text-slate-500">{currentPage.description}</p>
      </div>

      {activeTab === "order" && (
        <div className="space-y-4">
          <ReorderSummary
            urgentCount={urgentCount}
            lowCount={lowCount}
            cautionCount={cautionCount}
          />

          {/* AI 발주 권고 (승인/거부 워크플로우) */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="flex items-center justify-between w-full">
                <div>
                  <CardTitle>AI 발주 권고</CardTitle>
                  <CardDescription>
                    AI가 재고 상태와 수요 예측을 분석하여 생성한 발주 권고입니다. 승인하면 발주서가 자동 생성됩니다
                  </CardDescription>
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
              <AutoReorderRecommendationsTable
                recommendations={autoReorderRecommendations}
                selectedIds={selectedAutoReorderIds}
                onSelectChange={setSelectedAutoReorderIds}
                onApprove={handleApproveAutoReorders}
                onReject={handleRejectAutoReorders}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* KPI 카드 4개 */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg border border-orange-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium text-orange-600">승인대기</div>
              <div className="text-3xl font-bold text-orange-500">{orderKPI.pending}</div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium text-blue-600">입고예정</div>
              <div className="text-3xl font-bold text-blue-600">{orderKPI.inbound}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium text-emerald-600">완료</div>
              <div className="text-3xl font-bold text-emerald-600">{orderKPI.completed}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 text-sm font-medium text-slate-500">전체</div>
              <div className="text-3xl font-bold text-slate-800">{orderKPI.total}</div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>전체 발주 현황</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setOrderDialogOpen(true)}>
                      + 발주 등록
                    </Button>
                    {selectedOrderIds.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkCancel}
                        disabled={isCancellingOrders}
                      >
                        {isCancellingOrders ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        {selectedOrderIds.length}건 일괄 취소
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { value: "all", label: `전체 (${orderKPI.total})` },
                    { value: "pending", label: `승인대기 (${orderKPI.pending})` },
                    { value: "ordered", label: `입고예정 (${orderKPI.inbound})` },
                    { value: "received", label: `완료 (${orderKPI.completed})` },
                  ].map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setStatusFilter(f.value)}
                      className={`rounded-md border px-3 py-1 text-sm font-semibold transition-colors ${
                        statusFilter === f.value
                          ? "border-blue-300 bg-blue-50 text-blue-600"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <div className="mx-1 h-5 w-px bg-slate-200" />
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id="hide-received"
                      checked={hideReceived}
                      onCheckedChange={(checked) => setHideReceived(!!checked)}
                    />
                    <Label htmlFor="hide-received" className="text-xs text-slate-500 cursor-pointer">
                      입고완료 숨기기
                    </Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingOrders ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  발주 목록을 불러오는 중...
                </div>
              ) : (
                <PurchaseOrdersTable
                  orders={purchaseOrders.filter((o) => {
                    if (hideReceived && o.status === "received") return false;
                    if (statusFilter === "all") return true;
                    if (statusFilter === "pending") return o.status === "pending" || o.status === "draft";
                    if (statusFilter === "ordered") return o.status === "ordered" || o.status === "pending_receipt";
                    return o.status === statusFilter;
                  })}
                  onViewClick={handleViewOrder}
                  onDownloadClick={handleDownloadOrder}
                  selectedIds={selectedOrderIds}
                  onSelectChange={setSelectedOrderIds}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}


      {activeTab === "inbound" && (
        isLoadingInbound
          ? <div className="flex h-48 items-center justify-center text-slate-400">입고현황 불러오는 중...</div>
          : <InboundRecordsTable records={inboundRecords} />
      )}
      {activeTab === "delivery" && (
        isLoadingDelivery
          ? <div className="flex h-48 items-center justify-center text-slate-400">납기분석 불러오는 중...</div>
          : <DeliveryComplianceTab data={deliveryData} />
      )}
      {activeTab === "import-shipment" && <ImportShipmentTab />}

      <OrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        product={selectedProduct}
        onSubmit={handleOrderSubmit}
        onExcelUpload={(file) => {
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
        }}
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

    </div>
  );
}
