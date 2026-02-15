"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { PSIProductRow } from "@/server/services/scm/psi-aggregation";

interface PSITableProps {
  products: PSIProductRow[];
  periods: string[];
}

type SortField = "sku" | "productName" | "abcXyzGrade" | "orderMethod" | "currentStock";
type SortDirection = "asc" | "desc" | null;

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${year}.${parseInt(month)}월`;
}

function SortIcon({ field, currentField, currentDirection }: {
  field: SortField;
  currentField: SortField | null;
  currentDirection: SortDirection;
}) {
  if (field !== currentField || currentDirection === null) {
    return <ArrowUpDown className="ml-0.5 h-3 w-3 text-muted-foreground/40" />;
  }
  if (currentDirection === "asc") {
    return <ArrowUp className="ml-0.5 h-3 w-3 text-primary" />;
  }
  return <ArrowDown className="ml-0.5 h-3 w-3 text-primary" />;
}

function NumCell({ value, color, italic }: { value: number; color?: string; italic?: boolean }) {
  if (value === 0) return <span className="text-slate-300 text-[11px]">-</span>;
  return (
    <span className={cn("tabular-nums text-[11px]", color, italic && "italic")}>
      {value.toLocaleString()}
    </span>
  );
}

function StockCell({ value, safetyStock, italic }: { value: number; safetyStock: number; italic?: boolean }) {
  if (value === 0 && italic) return <span className="text-slate-300 text-[11px]">-</span>;
  return (
    <span
      className={cn(
        "tabular-nums text-[11px] font-medium",
        italic && "italic",
        value === 0
          ? "text-red-600 font-bold"
          : value < safetyStock
            ? "text-orange-600"
            : "text-slate-900 dark:text-slate-100"
      )}
    >
      {value.toLocaleString()}
    </span>
  );
}

/** 월별 8개 서브컬럼 정의 */
const SUB_COLUMNS = [
  { key: "forecast", label: "수요예측(F/C)", shortLabel: "F/C" },
  { key: "sop", label: "SCM 가이드", shortLabel: "SCM" },
  { key: "inboundPlan", label: "입고(계획)", shortLabel: "입고P" },
  { key: "inboundActual", label: "입고(실적)", shortLabel: "입고A" },
  { key: "outboundPlan", label: "출고(계획)", shortLabel: "출고P" },
  { key: "outboundActual", label: "출고(실적)", shortLabel: "출고A" },
  { key: "endingPlan", label: "기말(예상)", shortLabel: "기말P" },
  { key: "endingActual", label: "기말(실적)", shortLabel: "기말A" },
] as const;

const ABC_XYZ_ORDER: Record<string, number> = {
  AX: 1, AY: 2, AZ: 3, BX: 4, BY: 5, BZ: 6, CX: 7, CY: 8, CZ: 9,
};
const ORDER_METHOD_ORDER: Record<string, number> = { fixed_quantity: 1, fixed_period: 2 };

export function PSITable({ products, periods }: PSITableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else {
      setSortField(null);
      setSortDirection(null);
    }
  };

  const sortedProducts = useMemo(() => {
    if (!sortField || !sortDirection) return products;

    return [...products].sort((a, b) => {
      let cmp = 0;

      switch (sortField) {
        case "sku":
          cmp = a.sku.localeCompare(b.sku, "ko");
          break;
        case "productName":
          cmp = a.productName.localeCompare(b.productName, "ko");
          break;
        case "abcXyzGrade": {
          const aKey = a.abcGrade && a.xyzGrade ? `${a.abcGrade}${a.xyzGrade}` : null;
          const bKey = b.abcGrade && b.xyzGrade ? `${b.abcGrade}${b.xyzGrade}` : null;
          cmp = (aKey ? ABC_XYZ_ORDER[aKey] ?? 99 : 99) - (bKey ? ABC_XYZ_ORDER[bKey] ?? 99 : 99);
          break;
        }
        case "orderMethod": {
          const aO = a.orderMethod ? ORDER_METHOD_ORDER[a.orderMethod] ?? 99 : 99;
          const bO = b.orderMethod ? ORDER_METHOD_ORDER[b.orderMethod] ?? 99 : 99;
          cmp = aO - bO;
          break;
        }
        case "currentStock":
          cmp = a.currentStock - b.currentStock;
          break;
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [products, sortField, sortDirection]);

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        데이터가 없습니다.
      </div>
    );
  }

  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="overflow-x-auto max-h-[75vh] overflow-y-auto border rounded-lg">
      <Table className="text-xs">
        <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-950">
          {/* 1행: 기본정보 + 월 레이블 */}
          <TableRow>
            <TableHead rowSpan={2} className="sticky left-0 z-20 bg-white dark:bg-slate-950 min-w-[70px] border-r">
              <button
                className="flex items-center hover:text-foreground transition-colors"
                onClick={() => handleSort("sku")}
              >
                SKU
                <SortIcon field="sku" currentField={sortField} currentDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead rowSpan={2} className="sticky left-[70px] z-20 bg-white dark:bg-slate-950 min-w-[90px] border-r">
              <button
                className="flex items-center hover:text-foreground transition-colors"
                onClick={() => handleSort("productName")}
              >
                제품명
                <SortIcon field="productName" currentField={sortField} currentDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead rowSpan={2} className="text-center min-w-[36px] border-r">
              <button
                className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                onClick={() => handleSort("abcXyzGrade")}
              >
                등급
                <SortIcon field="abcXyzGrade" currentField={sortField} currentDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead rowSpan={2} className="text-center min-w-[32px] border-r">
              <button
                className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                onClick={() => handleSort("orderMethod")}
              >
                발주
                <SortIcon field="orderMethod" currentField={sortField} currentDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead rowSpan={2} className="text-center min-w-[50px] border-r">
              <button
                className="flex items-center justify-center w-full hover:text-foreground transition-colors"
                onClick={() => handleSort("currentStock")}
              >
                현재고
                <SortIcon field="currentStock" currentField={sortField} currentDirection={sortDirection} />
              </button>
            </TableHead>
            {periods.map((period) => (
              <TableHead
                key={period}
                className={cn(
                  "text-center border-r py-1",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}
                colSpan={8}
              >
                <span className="font-bold text-xs">{formatPeriodLabel(period)}</span>
              </TableHead>
            ))}
          </TableRow>
          {/* 2행: 각 월별 세부 컬럼 */}
          <TableRow>
            {periods.map((period) => (
              <Fragment key={period}>
                {SUB_COLUMNS.map((col, idx) => (
                  <TableHead
                    key={`${period}-${col.key}`}
                    className={cn(
                      "text-center px-0.5 py-0.5 text-[9px] font-normal text-muted-foreground min-w-[44px] whitespace-nowrap",
                      period === currentPeriod && "bg-blue-50 dark:bg-blue-950",
                      idx === SUB_COLUMNS.length - 1 && "border-r",
                      // 계획컬럼 배경
                      (col.key === "forecast" || col.key === "sop" || col.key === "inboundPlan" || col.key === "outboundPlan" || col.key === "endingPlan") && "bg-purple-50/50 dark:bg-purple-950/30",
                    )}
                  >
                    {col.shortLabel}
                  </TableHead>
                ))}
              </Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProducts.map((product) => (
            <TableRow key={product.productId} className="hover:bg-slate-50 dark:hover:bg-slate-900">
              <TableCell className="sticky left-0 z-10 bg-white dark:bg-slate-950 font-mono text-[10px] whitespace-nowrap border-r">
                {product.sku}
              </TableCell>
              <TableCell className="sticky left-[70px] z-10 bg-white dark:bg-slate-950 text-[11px] max-w-[90px] truncate border-r">
                {product.productName}
              </TableCell>
              <TableCell className="text-center border-r">
                {product.abcGrade && product.xyzGrade ? (
                  <Badge variant="outline" className={cn(
                    "font-mono text-[9px] px-0.5 py-0",
                    product.abcGrade === "A" && "border-red-300 text-red-700 bg-red-50",
                    product.abcGrade === "B" && "border-yellow-300 text-yellow-700 bg-yellow-50",
                    product.abcGrade === "C" && "border-slate-300 text-slate-600 bg-slate-50",
                  )}>
                    {product.abcGrade}{product.xyzGrade}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-[10px]">-</span>
                )}
              </TableCell>
              <TableCell className="text-center border-r">
                {product.orderMethod ? (
                  <Badge variant="outline" className={cn(
                    "font-mono text-[9px] px-0.5 py-0",
                    product.orderMethod === "fixed_quantity" && "border-blue-300 text-blue-700 bg-blue-50",
                    product.orderMethod === "fixed_period" && "border-green-300 text-green-700 bg-green-50",
                  )}>
                    {product.orderMethod === "fixed_quantity" ? "정량" : "정기"}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-[10px]">-</span>
                )}
              </TableCell>
              <TableCell className="text-center border-r">
                <StockCell value={product.currentStock} safetyStock={product.safetyStock} />
              </TableCell>
              {product.months.map((month) => {
                const isCurrent = month.period === currentPeriod;
                const bg = isCurrent ? "bg-blue-50/50 dark:bg-blue-950/50" : "";
                const planBg = "bg-purple-50/30 dark:bg-purple-950/20";

                return (
                  <Fragment key={month.period}>
                    {/* 수요예측 (F/C) */}
                    <TableCell className={cn("text-center p-0.5", bg, planBg)}>
                      {month.forecast !== null || month.manualForecast !== null ? (
                        <span className="flex items-center justify-center gap-0.5">
                          <span className={cn(
                            "tabular-nums text-[11px] italic",
                            month.manualForecast !== null ? "text-amber-600" : "text-sky-600"
                          )}>
                            {(month.manualForecast ?? month.forecast ?? 0).toLocaleString()}
                          </span>
                          <span className={cn(
                            "text-[8px] font-bold leading-none",
                            month.manualForecast !== null ? "text-amber-500" : "text-sky-500"
                          )}>
                            {month.manualForecast !== null ? "M" : "A"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </TableCell>
                    {/* SCM (AI 가이드 수량) */}
                    <TableCell className={cn("text-center p-0.5", bg, planBg)}>
                      <NumCell value={month.sopQuantity} color="text-purple-600" italic />
                    </TableCell>
                    {/* 입고(계획) */}
                    <TableCell className={cn("text-center p-0.5", bg, planBg)}>
                      <NumCell value={month.inboundPlan} color="text-purple-500" italic />
                    </TableCell>
                    {/* 입고(실적) */}
                    <TableCell className={cn("text-center p-0.5", bg)}>
                      <NumCell value={month.inbound} color="text-blue-600" />
                    </TableCell>
                    {/* 출고(계획) */}
                    <TableCell className={cn("text-center p-0.5", bg, planBg)}>
                      <NumCell value={month.outboundPlan} color="text-purple-500" italic />
                    </TableCell>
                    {/* 출고(실적) */}
                    <TableCell className={cn("text-center p-0.5", bg)}>
                      <NumCell value={month.outbound} color="text-orange-600" />
                    </TableCell>
                    {/* 기말(예상) */}
                    <TableCell className={cn("text-center p-0.5", bg, planBg)}>
                      <StockCell value={month.plannedEndingStock} safetyStock={product.safetyStock} italic />
                    </TableCell>
                    {/* 기말(실적) */}
                    <TableCell className={cn("text-center p-0.5 border-r", bg)}>
                      <StockCell value={month.endingStock} safetyStock={product.safetyStock} />
                    </TableCell>
                  </Fragment>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// React Fragment for grouping without extra DOM
function Fragment({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}
