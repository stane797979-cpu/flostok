"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getKPIDrilldown } from "@/server/actions/kpi";
import type {
  KPIDrilldownType,
  KPIDrilldownResult,
  StockoutDrilldownItem,
  TurnoverDrilldownItem,
  LeadTimeDrilldownItem,
  FulfillmentDrilldownItem,
} from "@/server/actions/kpi";
import { AlertCircle, PackageX, RotateCcw, Truck, ClipboardList } from "lucide-react";

interface KpiDrilldownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drilldownType: KPIDrilldownType | null;
}

const DRILLDOWN_META: Record<
  KPIDrilldownType,
  { title: string; description: string; icon: React.ElementType }
> = {
  stockout: {
    title: "품절·위험 재고 현황",
    description: "현재 품절(out_of_stock) 또는 위험(critical) 상태인 제품 목록",
    icon: PackageX,
  },
  turnover: {
    title: "재고회전율 하위 제품",
    description: "재고일수가 높아 회전율이 낮은 제품 TOP 10",
    icon: RotateCcw,
  },
  leadtime: {
    title: "납기 준수율 하위 공급자",
    description: "납기 준수율이 낮은 공급자 TOP 5 (최근 1년 완료 발주 기준)",
    icon: Truck,
  },
  fulfillment: {
    title: "미완납 발주서 현황",
    description: "아직 완납되지 않은 진행 중인 발주서 목록",
    icon: ClipboardList,
  },
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  ordered: "발주완료",
  confirmed: "공급자확인",
  shipped: "출하됨",
  partially_received: "부분입고",
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  ordered: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  confirmed: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  shipped: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  partially_received: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
};

// ─── 품절 테이블 ─────────────────────────────────────────────
function StockoutTable({ items }: { items: StockoutDrilldownItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState message="현재 품절 또는 위험 상태의 제품이 없습니다." />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 dark:border-slate-700">
            <th className="pb-2 pr-4 font-medium">제품명</th>
            <th className="pb-2 pr-4 font-medium">SKU</th>
            <th className="pb-2 pr-4 font-medium">카테고리</th>
            <th className="pb-2 pr-4 text-right font-medium">현재고</th>
            <th className="pb-2 text-right font-medium">안전재고</th>
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-slate-700">
          {items.map((item) => (
            <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 pr-4 font-medium">{item.productName}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{item.sku}</td>
              <td className="py-2.5 pr-4 text-slate-500">{item.category ?? "-"}</td>
              <td className="py-2.5 pr-4 text-right">
                <span className={cn(
                  "font-semibold",
                  item.currentStock === 0 ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
                )}>
                  {item.currentStock.toLocaleString("ko-KR")}
                </span>
              </td>
              <td className="py-2.5 text-right text-slate-500">
                {item.safetyStock.toLocaleString("ko-KR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 재고회전율 테이블 ────────────────────────────────────────
function TurnoverTable({ items }: { items: TurnoverDrilldownItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="재고 데이터가 없습니다." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 dark:border-slate-700">
            <th className="pb-2 pr-4 font-medium">제품명</th>
            <th className="pb-2 pr-4 font-medium">SKU</th>
            <th className="pb-2 pr-4 text-right font-medium">회전율</th>
            <th className="pb-2 pr-4 text-right font-medium">재고일수</th>
            <th className="pb-2 text-right font-medium">재고금액</th>
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-slate-700">
          {items.map((item) => (
            <tr key={item.productId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 pr-4 font-medium">{item.productName}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{item.sku}</td>
              <td className="py-2.5 pr-4 text-right">
                <span className={cn(
                  "font-semibold",
                  item.inventoryTurnoverRate < 3 ? "text-red-600 dark:text-red-400" :
                  item.inventoryTurnoverRate < 6 ? "text-orange-600 dark:text-orange-400" :
                  "text-slate-700 dark:text-slate-300"
                )}>
                  {item.inventoryTurnoverRate.toFixed(1)}회
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-400">
                {item.daysOfInventory > 0 ? `${item.daysOfInventory}일` : "-"}
              </td>
              <td className="py-2.5 text-right text-slate-500">
                {item.inventoryValue > 0
                  ? `${(item.inventoryValue / 10000).toFixed(0)}만원`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 납기 준수율 테이블 ──────────────────────────────────────
function LeadTimeTable({ items }: { items: LeadTimeDrilldownItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="완료된 발주 데이터가 없습니다." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 dark:border-slate-700">
            <th className="pb-2 pr-4 font-medium">공급자</th>
            <th className="pb-2 pr-4 text-right font-medium">총 발주</th>
            <th className="pb-2 pr-4 text-right font-medium">준수율</th>
            <th className="pb-2 pr-4 text-right font-medium">평균 리드타임</th>
            <th className="pb-2 text-right font-medium">평균 지연</th>
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-slate-700">
          {items.map((item) => (
            <tr key={item.supplierId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 pr-4 font-medium">{item.supplierName}</td>
              <td className="py-2.5 pr-4 text-right text-slate-500">
                {item.totalOrders.toLocaleString("ko-KR")}건
              </td>
              <td className="py-2.5 pr-4 text-right">
                <span className={cn(
                  "font-semibold",
                  item.onTimeRate < 70 ? "text-red-600 dark:text-red-400" :
                  item.onTimeRate < 85 ? "text-orange-600 dark:text-orange-400" :
                  "text-green-600 dark:text-green-400"
                )}>
                  {item.onTimeRate.toFixed(1)}%
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right text-slate-600 dark:text-slate-400">
                {item.avgLeadTime}일
              </td>
              <td className="py-2.5 text-right">
                <span className={cn(
                  item.avgDelay > 0 ? "text-red-500 dark:text-red-400" : "text-slate-400"
                )}>
                  {item.avgDelay > 0 ? `+${item.avgDelay}일` : "-"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 미완납 발주서 테이블 ─────────────────────────────────────
function FulfillmentTable({ items }: { items: FulfillmentDrilldownItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="진행 중인 미완납 발주서가 없습니다." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-500 dark:border-slate-700">
            <th className="pb-2 pr-4 font-medium">발주번호</th>
            <th className="pb-2 pr-4 font-medium">공급자</th>
            <th className="pb-2 pr-4 font-medium">상태</th>
            <th className="pb-2 pr-4 text-right font-medium">충족률</th>
            <th className="pb-2 text-right font-medium">예상입고일</th>
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-slate-700">
          {items.map((item) => (
            <tr key={item.orderId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="py-2.5 pr-4 font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                {item.orderNumber}
              </td>
              <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-400">
                {item.supplierName ?? "-"}
              </td>
              <td className="py-2.5 pr-4">
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  ORDER_STATUS_COLORS[item.status] ?? "bg-slate-100 text-slate-700"
                )}>
                  {ORDER_STATUS_LABELS[item.status] ?? item.status}
                </span>
              </td>
              <td className="py-2.5 pr-4 text-right">
                <span className={cn(
                  "font-semibold",
                  item.fulfillmentRate < 50 ? "text-red-600 dark:text-red-400" :
                  item.fulfillmentRate < 80 ? "text-orange-600 dark:text-orange-400" :
                  "text-slate-700 dark:text-slate-300"
                )}>
                  {item.totalOrdered > 0 ? `${item.fulfillmentRate.toFixed(1)}%` : "-"}
                </span>
              </td>
              <td className="py-2.5 text-right text-slate-500">
                {item.expectedDate ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 빈 상태 ─────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <AlertCircle className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ─── 스켈레톤 ─────────────────────────────────────────────────
function DrilldownSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

// ─── 메인 Dialog ─────────────────────────────────────────────
export function KpiDrilldownDialog({
  open,
  onOpenChange,
  drilldownType,
}: KpiDrilldownDialogProps) {
  const [data, setData] = useState<KPIDrilldownResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !drilldownType) return;

    setData(null);
    setFetchError(null);

    startTransition(async () => {
      try {
        const result = await getKPIDrilldown(drilldownType);
        setData(result);
      } catch {
        setFetchError("데이터를 불러오는 중 오류가 발생했습니다.");
      }
    });
  }, [open, drilldownType]);

  if (!drilldownType) return null;

  const meta = DRILLDOWN_META[drilldownType];
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-slate-500" />
            <DialogTitle>{meta.title}</DialogTitle>
          </div>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          {fetchError ? (
            <EmptyState message={fetchError} />
          ) : isPending || !data ? (
            <DrilldownSkeleton />
          ) : (
            <>
              {data.type === "stockout" && (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      총 {data.items.length}건
                    </Badge>
                    <span className="text-xs text-slate-500">
                      즉시 보충 발주가 필요한 품목입니다
                    </span>
                  </div>
                  <StockoutTable items={data.items} />
                </>
              )}
              {data.type === "turnover" && (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      재고일수 높은 순
                    </Badge>
                    <span className="text-xs text-slate-500">
                      재고 정리 또는 수요 촉진이 필요한 품목입니다
                    </span>
                  </div>
                  <TurnoverTable items={data.items} />
                </>
              )}
              {data.type === "leadtime" && (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      납기 준수율 낮은 순
                    </Badge>
                    <span className="text-xs text-slate-500">
                      공급자 성과 개선 협의가 필요합니다
                    </span>
                  </div>
                  <LeadTimeTable items={data.items} />
                </>
              )}
              {data.type === "fulfillment" && (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      예상입고일 빠른 순
                    </Badge>
                    <span className="text-xs text-slate-500">
                      입고 확인 및 공급자 독촉이 필요한 발주입니다
                    </span>
                  </div>
                  <FulfillmentTable items={data.items} />
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
