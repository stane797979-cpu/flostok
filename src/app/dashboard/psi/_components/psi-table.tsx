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
  const [year, month] = period.split("-");
  return `${year}.${parseInt(month)}월`;
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

/** 월별 7개 서브컬럼 정의 */
const SUB_COLUMNS = [
  { key: "sop", label: "공급계획", shortLabel: "S&OP" },
  { key: "inboundPlan", label: "입고(계획)", shortLabel: "입고P" },
  { key: "inboundActual", label: "입고(실적)", shortLabel: "입고A" },
  { key: "outboundPlan", label: "출고(계획)", shortLabel: "출고P" },
  { key: "outboundActual", label: "출고(실적)", shortLabel: "출고A" },
  { key: "endingPlan", label: "기말(예상)", shortLabel: "기말P" },
  { key: "endingActual", label: "기말(실적)", shortLabel: "기말A" },
] as const;

export function PSITable({ products, periods }: PSITableProps) {
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
              SKU
            </TableHead>
            <TableHead rowSpan={2} className="sticky left-[70px] z-20 bg-white dark:bg-slate-950 min-w-[90px] border-r">
              제품명
            </TableHead>
            <TableHead rowSpan={2} className="text-center min-w-[32px] border-r">ABC</TableHead>
            <TableHead rowSpan={2} className="text-center min-w-[32px] border-r">XYZ</TableHead>
            <TableHead rowSpan={2} className="text-center min-w-[50px] border-r">현재고</TableHead>
            {periods.map((period) => (
              <TableHead
                key={period}
                className={cn(
                  "text-center border-r py-1",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}
                colSpan={7}
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
                      (col.key === "sop" || col.key === "inboundPlan" || col.key === "outboundPlan" || col.key === "endingPlan") && "bg-purple-50/50 dark:bg-purple-950/30",
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
          {products.map((product) => (
            <TableRow key={product.productId} className="hover:bg-slate-50 dark:hover:bg-slate-900">
              <TableCell className="sticky left-0 z-10 bg-white dark:bg-slate-950 font-mono text-[10px] whitespace-nowrap border-r">
                {product.sku}
              </TableCell>
              <TableCell className="sticky left-[70px] z-10 bg-white dark:bg-slate-950 text-[11px] max-w-[90px] truncate border-r">
                {product.productName}
              </TableCell>
              <TableCell className="text-center border-r">
                {product.abcGrade ? (
                  <Badge variant="outline" className={cn(
                    "font-mono text-[9px] px-0.5 py-0",
                    product.abcGrade === "A" && "border-red-300 text-red-700 bg-red-50",
                    product.abcGrade === "B" && "border-yellow-300 text-yellow-700 bg-yellow-50",
                    product.abcGrade === "C" && "border-slate-300 text-slate-600 bg-slate-50",
                  )}>
                    {product.abcGrade}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-[10px]">-</span>
                )}
              </TableCell>
              <TableCell className="text-center border-r">
                {product.xyzGrade ? (
                  <Badge variant="outline" className={cn(
                    "font-mono text-[9px] px-0.5 py-0",
                    product.xyzGrade === "X" && "border-green-300 text-green-700 bg-green-50",
                    product.xyzGrade === "Y" && "border-blue-300 text-blue-700 bg-blue-50",
                    product.xyzGrade === "Z" && "border-purple-300 text-purple-700 bg-purple-50",
                  )}>
                    {product.xyzGrade}
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
                    {/* S&OP (공급계획) */}
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
