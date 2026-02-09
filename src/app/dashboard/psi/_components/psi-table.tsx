"use client";

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
import type { PSIProductRow } from "@/server/services/scm/psi-aggregation";

interface PSITableProps {
  products: PSIProductRow[];
  periods: string[];
}

function formatPeriodLabel(period: string): string {
  const [, month] = period.split("-");
  return `${parseInt(month)}월`;
}

function StockCell({ value, safetyStock }: { value: number; safetyStock: number }) {
  return (
    <span
      className={cn(
        "tabular-nums text-xs",
        value === 0
          ? "text-red-600 font-bold"
          : value < safetyStock
            ? "text-orange-600 font-medium"
            : ""
      )}
    >
      {value.toLocaleString()}
    </span>
  );
}

export function PSITable({ products, periods }: PSITableProps) {
  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        데이터가 없습니다.
      </div>
    );
  }

  // 현재 월 확인
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-white dark:bg-slate-950">
          <TableRow>
            <TableHead className="sticky left-0 z-20 bg-white dark:bg-slate-950 min-w-[60px]">SKU</TableHead>
            <TableHead className="sticky left-[60px] z-20 bg-white dark:bg-slate-950 min-w-[100px]">제품명</TableHead>
            <TableHead className="text-center min-w-[50px]">등급</TableHead>
            <TableHead className="text-center min-w-[60px]">현재고</TableHead>
            {periods.map((period) => (
              <TableHead
                key={period}
                className={cn(
                  "text-center min-w-[140px]",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}
                colSpan={1}
              >
                <div>
                  <div className="font-bold">{formatPeriodLabel(period)}</div>
                  <div className="text-[10px] text-muted-foreground font-normal grid grid-cols-3 gap-0">
                    <span>입고</span>
                    <span>출고</span>
                    <span>기말</span>
                  </div>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.productId}>
              <TableCell className="sticky left-0 z-10 bg-white dark:bg-slate-950 font-mono text-xs whitespace-nowrap">
                {product.sku}
              </TableCell>
              <TableCell className="sticky left-[60px] z-10 bg-white dark:bg-slate-950 text-xs max-w-[100px] truncate">
                {product.productName}
              </TableCell>
              <TableCell className="text-center">
                {product.abcGrade && product.xyzGrade ? (
                  <Badge variant="outline" className="font-mono text-[10px] px-1">
                    {product.abcGrade}{product.xyzGrade}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <StockCell value={product.currentStock} safetyStock={product.safetyStock} />
              </TableCell>
              {product.months.map((month) => (
                <TableCell
                  key={month.period}
                  className={cn(
                    "text-center p-1",
                    month.period === currentPeriod && "bg-blue-50/50 dark:bg-blue-950/50"
                  )}
                >
                  <div className="grid grid-cols-3 gap-0 text-[11px] tabular-nums">
                    <span className={cn(month.inbound > 0 ? "text-blue-600" : "text-slate-300")}>
                      {month.inbound > 0 ? month.inbound.toLocaleString() : "-"}
                    </span>
                    <span className={cn(month.outbound > 0 ? "text-orange-600" : "text-slate-300")}>
                      {month.outbound > 0 ? month.outbound.toLocaleString() : "-"}
                    </span>
                    <StockCell value={month.endingStock} safetyStock={product.safetyStock} />
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
