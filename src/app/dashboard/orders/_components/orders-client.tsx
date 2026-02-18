"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Loader2, PackagePlus, XCircle, Upload, Zap, ClipboardEdit } from "lucide-react";
import type { DeliveryComplianceResult } from "@/server/services/scm/delivery-compliance";
import { ReorderSummary } from "./reorder-summary";
import { ReorderItemsTable, type ReorderItem } from "./reorder-items-table";
import { PurchaseOrdersTable, type PurchaseOrderListItem } from "./purchase-orders-table";
import {
  AutoReorderRecommendationsTable,
  type AutoReorderRecommendation,
} from "./auto-reorder-recommendations-table";
import { InboundRecordsTable, type InboundRecord } from "./inbound-records-table";

// 다이얼로그 + 독립 탭: 사용자 인터랙션 시에만 로드 (초기 번들 감소)
const OrderDialog = dynamic(() => import("./order-dialog").then((m) => m.OrderDialog), { ssr: false });
const BulkOrderDialog = dynamic(() => import("./bulk-order-dialog").then((m) => m.BulkOrderDialog), { ssr: false });
const OrderDetailDialog = dynamic(() => import("./order-detail-dialog").then((m) => m.OrderDetailDialog), { ssr: false });
const OtherInboundDialog = dynamic(() => import("./other-inbound-dialog").then((m) => m.OtherInboundDialog), { ssr: false });
const DeliveryComplianceTab = dynamic(() => import("./delivery-compliance-tab").then((m) => m.DeliveryComplianceTab));
const ImportShipmentTab = dynamic(() => import("./import-shipment-tab").then((m) => m.ImportShipmentTab));
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
import { getInboundRecords } from "@/server/actions/inbound";
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
 * 수동발주와 차별화: 시스템이 수요예측·리드타임·재고상태를 종합 분석하여 추천
 */
function generateAutoReorderRecommendations(
  items: ReorderItem[]
): AutoReorderRecommendation[] {
  return items.map((item, index) => {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + item.leadTime);

    // 추천 근거: 수요예측 기반인지 발주점 기반인지 구분
    const forecastLabel = item.forecastBased
      ? `[수요예측 기반] ${item.forecastMethod || "분석"} 모델 적용`
      : "[발주점 기반] 현재고 < 발주점";

    const statusReasons: Record<number, string> = {
      0: `${forecastLabel} · 품절 (현재고 ${item.currentStock}개)`,
      1: `${forecastLabel} · 위험 (재고일수 ${item.daysOfInventory.toFixed(1)}일)`,
      2: `${forecastLabel} · 부족 (재고일수 ${item.daysOfInventory.toFixed(1)}일)`,
      3: `${forecastLabel} · 주의 (발주점 도달)`,
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

interface WarehouseOption {
  id: string;
  code: string;
  name: string;
  isDefault?: boolean;
}

interface OrdersClientProps {
  initialTab?: "reorder" | "auto-reorder" | "orders" | "order-history" | "inbound" | "delivery" | "import-shipment";
  serverReorderItems?: ServerReorderItem[];
  serverReorderTotal?: number;
  preselectedProductIds?: string[];
  deliveryComplianceData?: DeliveryComplianceResult | null;
  warehouses?: WarehouseOption[];
  serverPurchaseOrdersTotal?: number;
  serverInboundTotal?: number;
  serverOrderHistoryTotal?: number;
  serverOrderHistory?: Array<{
    id: string;
    orderNumber: string;
    supplier?: { name: string } | null;
    itemsCount: number;
    totalAmount: number | null;
    status: string;
    orderDate: string | null;
    expectedDate: string | null;
    createdAt?: string | null;
  }>;
  serverPurchaseOrders?: Array<{
    id: string;
    orderNumber: string;
    supplier?: { name: string } | null;
    itemsCount: number;
    totalAmount: number | null;
    status: string;
    orderDate: string | null;
    expectedDate: string | null;
    createdAt?: string | null;
  }>;
  serverInboundRecords?: Array<{
    id: string;
    date: string;
    productName: string;
    productSku: string;
    expectedQuantity: number;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    qualityResult: string | null;
    lotNumber: string | null;
    orderNumber: string | null;
    supplierName: string | null;
    location: string | null;
    notes: string | null;
    createdAt: string;
  }>;
}

export function OrdersClient({ initialTab = "reorder", serverReorderItems = [], serverReorderTotal = 0, deliveryComplianceData = null, serverPurchaseOrders, serverPurchaseOrdersTotal = 0, serverInboundRecords, serverInboundTotal = 0, serverOrderHistory, serverOrderHistoryTotal = 0, warehouses = [], preselectedProductIds }: OrdersClientProps) {
  // 발주 필요 품목 (발주 후 재조회 가능하도록 state로 관리)
  const [reorderItems, setReorderItems] = useState<ReorderItem[]>(
    () => serverReorderItems.map(mapServerToClientReorderItem)
  );

  // 승인 완료된 productId 추적 (중복 발주 방지)
  const [approvedProductIds, setApprovedProductIds] = useState<Set<string>>(new Set());

  // 자동발주 추천 생성 (발주 필요 품목 기반, 승인된 품목 제외)
  const autoReorderRecommendations = useMemo(
    () => generateAutoReorderRecommendations(
      reorderItems.filter((item) => !approvedProductIds.has(item.productId))
    ),
    [reorderItems, approvedProductIds]
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

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (!preselectedProductIds?.length) return [];
    const preselectedSet = new Set(preselectedProductIds);
    return reorderItems
      .filter((item) => preselectedSet.has(item.productId))
      .map((item) => item.productId);
  });
  const [selectedAutoReorderIds, setSelectedAutoReorderIds] = useState<string[]>([]);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [bulkOrderDialogOpen, setBulkOrderDialogOpen] = useState(false);
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ReorderItem | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderListItem[]>(() => {
    if (!serverPurchaseOrders) return [];
    return serverPurchaseOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierName: order.supplier?.name || "미지정",
      itemsCount: order.itemsCount,
      totalAmount: order.totalAmount || 0,
      status: mapOrderStatus(order.status),
      orderDate: order.orderDate || (order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : ""),
      expectedDate: order.expectedDate || null,
    }));
  });
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // 발주 현황 체크박스
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isCancellingOrders, setIsCancellingOrders] = useState(false);
  const [hideReceived, setHideReceived] = useState(false);

  // 수동발주 페이지네이션 (클라이언트)
  const [reorderPage, setReorderPage] = useState(1);
  const [reorderPageSize, setReorderPageSize] = useState(50);

  // 자동발주 페이지네이션 (클라이언트)
  const [autoReorderPage, setAutoReorderPage] = useState(1);
  const [autoReorderPageSize, setAutoReorderPageSize] = useState(50);

  // 발주현황 페이지네이션
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(50);
  const [ordersTotalItems, setOrdersTotalItems] = useState(serverPurchaseOrdersTotal);
  const ordersTotalPages = Math.max(1, Math.ceil(ordersTotalItems / ordersPageSize));

  // 발주 이력 (취소된 발주)
  const [orderHistory, setOrderHistory] = useState<PurchaseOrderListItem[]>(() => {
    if (!serverOrderHistory) return [];
    return serverOrderHistory.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierName: order.supplier?.name || "미지정",
      itemsCount: order.itemsCount,
      totalAmount: order.totalAmount || 0,
      status: mapOrderStatus(order.status),
      orderDate: order.orderDate || (order.createdAt ? new Date(order.createdAt).toISOString().split("T")[0] : ""),
      expectedDate: order.expectedDate || null,
    }));
  });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(50);
  const [historyTotalItems, setHistoryTotalItems] = useState(serverOrderHistoryTotal);
  const historyTotalPages = Math.max(1, Math.ceil(historyTotalItems / historyPageSize));

  // 입고 현황 상태
  const [inboundMonth, setInboundMonth] = useState<Date>(() => new Date());
  const [inboundRecords, setInboundRecords] = useState<InboundRecord[]>(() => {
    if (!serverInboundRecords) return [];
    return serverInboundRecords.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
  });
  const [isLoadingInbound, setIsLoadingInbound] = useState(false);
  const [isDownloadingInbound, setIsDownloadingInbound] = useState(false);
  const [otherInboundOpen, setOtherInboundOpen] = useState(false);

  // 입고현황 페이지네이션
  const [inboundPage, setInboundPage] = useState(1);
  const [inboundPageSize, setInboundPageSize] = useState(50);
  const [inboundTotalItems, setInboundTotalItems] = useState(serverInboundTotal);
  const inboundTotalPages = Math.max(1, Math.ceil(inboundTotalItems / inboundPageSize));

  // 발주 엑셀 업로드
  const orderUploadRef = useRef<HTMLInputElement>(null);
  const [isUploadingOrders, startUploadTransition] = useTransition();

  const router = useRouter();
  const { toast } = useToast();

  // DB에서 발주 목록 불러오기 (취소 제외)
  const loadPurchaseOrders = useCallback(async (page = ordersPage, size = ordersPageSize) => {
    setIsLoadingOrders(true);
    try {
      const offset = (page - 1) * size;
      const result = await getPurchaseOrders({ limit: size, offset, excludeStatus: "cancelled" });
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
      setOrdersTotalItems(result.total);
    } catch (error) {
      console.error("발주 목록 조회 오류:", error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [ordersPage, ordersPageSize]);

  // DB에서 발주 이력 불러오기 (취소된 발주)
  const loadOrderHistory = useCallback(async (page = historyPage, size = historyPageSize) => {
    setIsLoadingHistory(true);
    try {
      const offset = (page - 1) * size;
      const result = await getPurchaseOrders({ limit: size, offset, status: "cancelled" });
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
      setOrderHistory(mapped);
      setHistoryTotalItems(result.total);
    } catch (error) {
      console.error("발주 이력 조회 오류:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyPage, historyPageSize]);

  // 입고 기록 조회
  const loadInboundRecords = useCallback(async (month: Date, page = 1, size = inboundPageSize) => {
    setIsLoadingInbound(true);
    try {
      const { startDate, endDate } = getMonthRange(month);
      const offset = (page - 1) * size;
      const result = await getInboundRecords({ startDate, endDate, limit: size, offset });
      setInboundRecords(
        result.records.map((r) => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }))
      );
      setInboundTotalItems(result.total);
    } catch (error) {
      console.error("입고 기록 조회 오류:", error);
    } finally {
      setIsLoadingInbound(false);
    }
  }, [inboundPageSize]);

  // 월 이동
  const handlePrevMonth = useCallback(() => {
    setInboundMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      setInboundPage(1);
      loadInboundRecords(next, 1);
      return next;
    });
  }, [loadInboundRecords]);

  const handleNextMonth = useCallback(() => {
    setInboundMonth((prev) => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      setInboundPage(1);
      loadInboundRecords(next, 1);
      return next;
    });
  }, [loadInboundRecords]);

  // 발주현황 페이지 이동
  const handleOrdersPageChange = useCallback((page: number) => {
    setOrdersPage(page);
    loadPurchaseOrders(page);
  }, [loadPurchaseOrders]);

  const handleOrdersPageSizeChange = useCallback((size: string) => {
    const newSize = size === "all" ? 9999 : Number(size);
    setOrdersPageSize(newSize);
    setOrdersPage(1);
    loadPurchaseOrders(1, newSize);
  }, [loadPurchaseOrders]);

  // 발주이력 페이지 이동
  const handleHistoryPageChange = useCallback((page: number) => {
    setHistoryPage(page);
    loadOrderHistory(page);
  }, [loadOrderHistory]);

  const handleHistoryPageSizeChange = useCallback((size: string) => {
    const newSize = size === "all" ? 9999 : Number(size);
    setHistoryPageSize(newSize);
    setHistoryPage(1);
    loadOrderHistory(1, newSize);
  }, [loadOrderHistory]);

  // 입고현황 페이지 이동
  const handleInboundPageChange = useCallback((page: number) => {
    setInboundPage(page);
    loadInboundRecords(inboundMonth, page);
  }, [loadInboundRecords, inboundMonth]);

  const handleInboundPageSizeChange = useCallback((size: string) => {
    const newSize = Number(size);
    setInboundPageSize(newSize);
    setInboundPage(1);
    loadInboundRecords(inboundMonth, 1, newSize);
  }, [loadInboundRecords, inboundMonth]);

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

  // 초기 로드 (서버에서 프리페치된 데이터가 없는 탭만 클라이언트에서 로드)
  useEffect(() => {
    if (initialTab === "orders" && !serverPurchaseOrders) {
      loadPurchaseOrders();
    } else if (initialTab === "order-history" && !serverOrderHistory) {
      loadOrderHistory();
    } else if (initialTab === "inbound" && !serverInboundRecords) {
      loadInboundRecords(inboundMonth);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 수동발주 탭에서도 발주 완료 품목 제외
  const filteredReorderItems = useMemo(
    () => reorderItems.filter((item) => !approvedProductIds.has(item.productId)),
    [reorderItems, approvedProductIds]
  );

  // 수동발주 페이지네이션 계산
  const reorderTotalItems = filteredReorderItems.length;
  const reorderTotalPages = Math.max(1, Math.ceil(reorderTotalItems / reorderPageSize));
  const paginatedReorderItems = useMemo(
    () => filteredReorderItems.slice((reorderPage - 1) * reorderPageSize, reorderPage * reorderPageSize),
    [filteredReorderItems, reorderPage, reorderPageSize]
  );

  // 자동발주 페이지네이션 계산
  const autoReorderTotalItems = autoReorderRecommendations.length;
  const autoReorderTotalPages = Math.max(1, Math.ceil(autoReorderTotalItems / autoReorderPageSize));
  const paginatedAutoReorderRecommendations = useMemo(
    () => autoReorderRecommendations.slice((autoReorderPage - 1) * autoReorderPageSize, autoReorderPage * autoReorderPageSize),
    [autoReorderRecommendations, autoReorderPage, autoReorderPageSize]
  );

  // 긴급도별 카운트 (필터링된 목록 기준)
  const urgentCount = filteredReorderItems.filter((item) => item.urgencyLevel <= 1).length;
  const lowCount = filteredReorderItems.filter((item) => item.urgencyLevel === 2).length;
  const cautionCount = filteredReorderItems.filter((item) => item.urgencyLevel === 3).length;

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
        // 발주된 품목 즉시 목록에서 제거
        const orderedPids = new Set(data.items.map((i) => i.productId));
        setApprovedProductIds((prev) => new Set([...prev, ...orderedPids]));
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
        // 발주된 품목 즉시 목록에서 제거
        setApprovedProductIds((prev) => new Set([...prev, data.productId]));
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

      // 승인 성공한 품목의 productId를 추출하여 목록에서 제거
      const approvedPids = new Set(selectedRecs.map((r) => r.productId));

      if (result.success && result.errors.length === 0) {
        // 승인된 품목 즉시 제거
        setApprovedProductIds((prev) => new Set([...prev, ...approvedPids]));
        toast({
          title: "자동 발주 승인 완료",
          description: `${result.createdOrders.length}개의 발주서가 생성되었습니다. 발주 현황으로 이동합니다.`,
        });
        setSelectedAutoReorderIds([]);
        // 발주현황 페이지로 자동 이동
        router.push("/dashboard/orders?tab=orders");
      } else if (result.success && result.errors.length > 0) {
        // 성공한 품목만 제거 (실패한 품목은 남김)
        const failedPids = new Set(result.errors.map((e) => e.recommendationId));
        const successPids = [...approvedPids].filter((pid) => !failedPids.has(pid));
        if (successPids.length > 0) {
          setApprovedProductIds((prev) => new Set([...prev, ...successPids]));
        }
        toast({
          title: "자동 발주 부분 완료",
          description: `${result.createdOrders.length}개 생성, ${result.errors.length}개 실패 (${result.errors[0]?.error || "공급자 미지정"})`,
          variant: "destructive",
        });
        setSelectedAutoReorderIds([]);
        // 일부라도 생성되었으면 발주현황으로 이동
        if (result.createdOrders.length > 0) {
          router.push("/dashboard/orders?tab=orders");
        }
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

  // 페이지 제목 매핑
  const pageTitles: Record<string, { title: string; description: string }> = {
    reorder: { title: "수동 발주", description: "발주점 이하 품목을 확인하고, 담당자가 직접 수량·공급자를 선택하여 발주합니다" },
    "auto-reorder": { title: "자동발주 추천", description: "시스템이 재고 상태·수요예측·리드타임을 분석하여 최적 발주를 추천합니다. 승인만 하면 즉시 발주됩니다" },
    orders: { title: "발주 현황", description: "진행 중인 발주서 목록을 확인하세요" },
    "order-history": { title: "발주 이력", description: "취소된 발주서 이력을 확인하세요" },
    inbound: { title: "입고 현황", description: "월별 입고 기록을 확인하세요" },
    delivery: { title: "납기분석", description: "납기 준수율과 공급자 성과를 분석하세요" },
    "import-shipment": { title: "입항스케줄", description: "수입 화물 입항 일정을 관리하세요" },
  };

  const currentPage = pageTitles[initialTab] || pageTitles.reorder;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{currentPage.title}</h1>
        <p className="mt-2 text-slate-500">{currentPage.description}</p>
      </div>

      {initialTab === "reorder" && (
        <div className="space-y-4">
          {/* 자동발주와의 차이점 안내 */}
          <Alert className="border-emerald-200 bg-emerald-50">
            <ClipboardEdit className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-emerald-800">수동 발주란?</AlertTitle>
            <AlertDescription className="text-emerald-700">
              발주점 이하 품목을 확인하고, 담당자가 <strong>수량·공급자·납기를 직접 지정</strong>하여 발주합니다.
              시스템이 자동으로 최적 수량을 계산해서 바로 승인하려면 <strong>자동발주 추천</strong> 탭을 이용하세요.
            </AlertDescription>
          </Alert>
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
                items={paginatedReorderItems}
                selectedIds={selectedIds}
                onSelectChange={setSelectedIds}
                onOrderClick={handleOrderClick}
                onBulkOrderClick={handleBulkOrderClick}
              />
              {reorderTotalItems > 0 && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>전체 {reorderTotalItems.toLocaleString()}건</span>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <span>표시</span>
                      <Select value={String(reorderPageSize)} onValueChange={(v) => { setReorderPageSize(Number(v)); setReorderPage(1); }}>
                        <SelectTrigger className="h-8 w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50개</SelectItem>
                          <SelectItem value="100">100개</SelectItem>
                          <SelectItem value="200">200개</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={reorderPage <= 1} onClick={() => setReorderPage(reorderPage - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{reorderPage} / {reorderTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={reorderPage >= reorderTotalPages} onClick={() => setReorderPage(reorderPage + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {initialTab === "auto-reorder" && (
        <div className="space-y-4">
          {/* 수동발주와의 차이점 안내 */}
          <Alert className="border-blue-200 bg-blue-50">
            <Zap className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">자동발주 추천이란?</AlertTitle>
            <AlertDescription className="text-blue-700">
              시스템이 <strong>재고 상태, 수요예측, 리드타임, 안전재고</strong>를 종합 분석하여 최적 수량을 자동 계산합니다.
              담당자는 추천 내용을 확인 후 <strong>승인만 하면 즉시 발주서가 생성</strong>됩니다.
              수량·공급자를 직접 지정하려면 <strong>수동 발주</strong> 탭을 이용하세요.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>자동 발주 추천 목록</CardTitle>
              <CardDescription>
                추천 수량과 공급자가 자동 지정되어 있습니다. 확인 후 승인/거부하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AutoReorderRecommendationsTable
                recommendations={paginatedAutoReorderRecommendations}
                selectedIds={selectedAutoReorderIds}
                onSelectChange={setSelectedAutoReorderIds}
                onApprove={handleApproveAutoReorders}
                onReject={handleRejectAutoReorders}
              />
              {autoReorderTotalItems > 0 && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <span>전체 {autoReorderTotalItems.toLocaleString()}건</span>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <span>표시</span>
                      <Select value={String(autoReorderPageSize)} onValueChange={(v) => { setAutoReorderPageSize(Number(v)); setAutoReorderPage(1); }}>
                        <SelectTrigger className="h-8 w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50개</SelectItem>
                          <SelectItem value="100">100개</SelectItem>
                          <SelectItem value="200">200개</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={autoReorderPage <= 1} onClick={() => setAutoReorderPage(autoReorderPage - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{autoReorderPage} / {autoReorderTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={autoReorderPage >= autoReorderTotalPages} onClick={() => setAutoReorderPage(autoReorderPage + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {initialTab === "orders" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <CardTitle>발주 현황</CardTitle>
                    <CardDescription>진행 중인 발주서 목록입니다</CardDescription>
                  </div>
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
                {selectedOrderIds.length > 0 && (
                  <div className="flex gap-2">
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
                <>
                  <PurchaseOrdersTable
                    orders={hideReceived ? purchaseOrders.filter((o) => o.status !== "received") : purchaseOrders}
                    onViewClick={handleViewOrder}
                    onDownloadClick={handleDownloadOrder}
                    selectedIds={selectedOrderIds}
                    onSelectChange={setSelectedOrderIds}
                  />
                  {ordersTotalItems > 0 && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>전체 {ordersTotalItems.toLocaleString()}건</span>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <span>표시</span>
                          <Select value={ordersPageSize >= 9999 ? "all" : String(ordersPageSize)} onValueChange={handleOrdersPageSizeChange}>
                            <SelectTrigger className="h-8 w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="50">50개</SelectItem>
                              <SelectItem value="100">100개</SelectItem>
                              <SelectItem value="200">200개</SelectItem>
                              <SelectItem value="all">전체</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ordersPage <= 1}
                          onClick={() => handleOrdersPageChange(ordersPage - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">
                          {ordersPage} / {ordersTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ordersPage >= ordersTotalPages}
                          onClick={() => handleOrdersPageChange(ordersPage + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {initialTab === "order-history" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>발주 이력</CardTitle>
                <CardDescription>취소된 발주서 이력입니다</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  발주 이력을 불러오는 중...
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  취소된 발주서가 없습니다
                </div>
              ) : (
                <>
                  <PurchaseOrdersTable
                    orders={orderHistory}
                    onViewClick={handleViewOrder}
                    onDownloadClick={handleDownloadOrder}
                  />
                  {historyTotalItems > 0 && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>전체 {historyTotalItems.toLocaleString()}건</span>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <span>표시</span>
                          <Select value={historyPageSize >= 9999 ? "all" : String(historyPageSize)} onValueChange={handleHistoryPageSizeChange}>
                            <SelectTrigger className="h-8 w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="50">50개</SelectItem>
                              <SelectItem value="100">100개</SelectItem>
                              <SelectItem value="200">200개</SelectItem>
                              <SelectItem value="all">전체</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={historyPage <= 1}
                          onClick={() => handleHistoryPageChange(historyPage - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">
                          {historyPage} / {historyTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={historyPage >= historyTotalPages}
                          onClick={() => handleHistoryPageChange(historyPage + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {initialTab === "inbound" && (
        <div className="space-y-4">
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
                  <InboundRecordsTable records={inboundRecords} />
                  {inboundTotalItems > 0 && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>전체 {inboundTotalItems.toLocaleString()}건</span>
                        <span>·</span>
                        <div className="flex items-center gap-1">
                          <span>표시</span>
                          <Select value={String(inboundPageSize)} onValueChange={handleInboundPageSizeChange}>
                            <SelectTrigger className="h-8 w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="50">50개</SelectItem>
                              <SelectItem value="100">100개</SelectItem>
                              <SelectItem value="200">200개</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={inboundPage <= 1}
                          onClick={() => handleInboundPageChange(inboundPage - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">
                          {inboundPage} / {inboundTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={inboundPage >= inboundTotalPages}
                          onClick={() => handleInboundPageChange(inboundPage + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {initialTab === "delivery" && (
        <DeliveryComplianceTab data={deliveryComplianceData} />
      )}

      {initialTab === "import-shipment" && (
        <ImportShipmentTab />
      )}

      <OrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        product={selectedProduct}
        warehouses={warehouses}
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
