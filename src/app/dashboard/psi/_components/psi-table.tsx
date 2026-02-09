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

function NumCell({ value, color }: { value: number; color?: string }) {
  if (value === 0) return <span className="text-slate-300 text-[11px]">-</span>;
  return (
    <span className={cn("tabular-nums text-[11px]", color)}>
      {value.toLocaleString()}
    </span>
  );
}

function StockCell({ value, safetyStock }: { value: number; safetyStock: number }) {
  return (
    <span
      className={cn(
        "tabular-nums text-[11px] font-medium",
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
                  "text-center border-r min-w-[220px] py-1",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}
                colSpan={4}
              >
                <span className="font-bold text-xs">{formatPeriodLabel(period)}</span>
              </TableHead>
            ))}
          </TableRow>
          {/* 2행: 각 월별 세부 컬럼 */}
          <TableRow>
            {periods.map((period) => (
              <Fragment key={period}>
                <TableHead className={cn(
                  "text-center px-1 py-0.5 text-[10px] font-normal text-muted-foreground min-w-[55px]",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}>
                  S&OP
                </TableHead>
                <TableHead className={cn(
                  "text-center px-1 py-0.5 text-[10px] font-normal text-muted-foreground min-w-[55px]",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}>
                  입고
                </TableHead>
                <TableHead className={cn(
                  "text-center px-1 py-0.5 text-[10px] font-normal text-muted-foreground min-w-[55px]",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}>
                  출고
                </TableHead>
                <TableHead className={cn(
                  "text-center px-1 py-0.5 text-[10px] font-normal text-muted-foreground min-w-[55px] border-r",
                  period === currentPeriod && "bg-blue-50 dark:bg-blue-950"
                )}>
                  기말
                </TableHead>
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
                // S&OP칸: S&OP 물량 있으면 표시, 없으면 입고계획 표시
                const sopDisplay = month.sopQuantity || month.inboundPlan;
                // 출고칸: 실적 있으면 실적, 없으면 예측출고
                const outDisplay = month.outbound || month.forecastOutbound;
                const isOutForecast = month.outbound === 0 && month.forecastOutbound > 0;
                // 기말칸: 실적 있으면 실적, 없으면 말재고계획
                const endDisplay = month.endingStock || month.plannedEndingStock;
                const isEndPlan = month.endingStock === 0 && month.plannedEndingStock > 0;
                // 입고칸: 실적 있으면 실적, 없으면 입고계획
                const inbDisplay = month.inbound || month.inboundPlan;
                const isInbPlan = month.inbound === 0 && month.inboundPlan > 0;

                return (
                  <Fragment key={month.period}>
                    {/* S&OP */}
                    <TableCell className={cn("text-center p-0.5", bg)}>
                      <NumCell value={sopDisplay} color="text-purple-600" />
                    </TableCell>
                    {/* 입고 (실적=파란, 계획=보라 이탤릭) */}
                    <TableCell className={cn("text-center p-0.5", bg)}>
                      {isInbPlan ? (
                        <span className="text-purple-500 text-[11px] tabular-nums italic">
                          {inbDisplay.toLocaleString()}
                        </span>
                      ) : (
                        <NumCell value={inbDisplay} color="text-blue-600" />
                      )}
                    </TableCell>
                    {/* 출고 (실적=주황, 예측=보라 이탤릭) */}
                    <TableCell className={cn("text-center p-0.5", bg)}>
                      {isOutForecast ? (
                        <span className="text-purple-500 text-[11px] tabular-nums italic">
                          {outDisplay.toLocaleString()}
                        </span>
                      ) : (
                        <NumCell value={outDisplay} color="text-orange-600" />
                      )}
                    </TableCell>
                    {/* 기말 (실적=검정, 계획=보라 이탤릭) */}
                    <TableCell className={cn("text-center p-0.5 border-r", bg)}>
                      {isEndPlan ? (
                        <span className="text-purple-500 text-[11px] tabular-nums italic">
                          {endDisplay.toLocaleString()}
                        </span>
                      ) : (
                        <StockCell value={endDisplay} safetyStock={product.safetyStock} />
                      )}
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
