"use client";

import { useState, useMemo, memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InboundRecord {
  id: string;
  purchaseOrderId: string | null;
  orderNumber: string | null;
  productId: string;
  productName: string;
  productSku: string;
  date: string;
  scheduledDate: string | null;
  expectedQuantity: number | null;
  receivedQuantity: number;
  acceptedQuantity: number | null;
  rejectedQuantity: number | null;
  qualityResult: string | null;
  location: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: Date;
}

/**
 * 유통기한 임박 여부 확인 (7일 이내)
 */
function isExpiringSoon(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

function isExpired(expiryDate: string | null): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
}

interface InboundRecordsTableProps {
  records: InboundRecord[];
  className?: string;
}

type SortField =
  | "date"
  | "scheduledDate"
  | "orderNumber"
  | "productSku"
  | "productName"
  | "receivedQuantity"
  | "acceptedQuantity"
  | "qualityResult"
  | "expiryDate";
type SortDirection = "asc" | "desc" | null;

function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
  }
  if (sortDirection === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-slate-900" />;
  }
  if (sortDirection === "desc") {
    return <ArrowDown className="h-3.5 w-3.5 text-slate-900" />;
  }
  return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />;
}

const qualityBadge = (result: string | null) => {
  switch (result) {
    case "pass":
      return <Badge className="bg-green-600">합격</Badge>;
    case "fail":
      return <Badge variant="destructive">불합격</Badge>;
    case "partial":
      return (
        <Badge variant="destructive" className="bg-orange-600">
          부분합격
        </Badge>
      );
    case "pending":
      return <Badge variant="secondary">검수대기</Badge>;
    default:
      return <Badge variant="outline">-</Badge>;
  }
};

export const InboundRecordsTable = memo(function InboundRecordsTable({ records, className }: InboundRecordsTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedRecords = useMemo(() => {
    if (!sortDirection) return records;

    return [...records].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // null 처리: null은 맨 뒤로
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // 문자열 비교
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal, "ko")
          : bVal.localeCompare(aVal, "ko");
      }

      // 숫자 비교
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [records, sortField, sortDirection]);

  if (records.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-slate-400">
        해당 기간의 입고 기록이 없습니다
      </div>
    );
  }

  return (
    <>
      {/* 모바일 카드 뷰 */}
      <div className={cn("space-y-3 md:hidden", className)}>
        {sortedRecords.map((record) => (
          <div key={record.id} className="rounded-lg border bg-white dark:bg-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{record.productName}</p>
                <p className="text-xs font-mono text-slate-500">{record.productSku}</p>
              </div>
              <div className="shrink-0 ml-2">
                {qualityBadge(record.qualityResult)}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-0.5">
                <p className="text-slate-600">입고일: {record.date}</p>
                <p className="text-slate-500">
                  수량: <span className="font-semibold text-slate-900">{record.receivedQuantity}</span>
                  {record.acceptedQuantity != null && ` (합격: ${record.acceptedQuantity})`}
                </p>
              </div>
              {record.expiryDate && (
                <span className={cn(
                  "text-xs",
                  isExpired(record.expiryDate) && "font-semibold text-red-600",
                  isExpiringSoon(record.expiryDate) && "font-semibold text-orange-600",
                  !isExpired(record.expiryDate) && !isExpiringSoon(record.expiryDate) && "text-slate-500"
                )}>
                  유통: {record.expiryDate}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 데스크톱 테이블 뷰 */}
      <div className={cn("hidden rounded-md border md:block", className)}>
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("date")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                입고일
                <SortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("scheduledDate")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                입고예정일
                <SortIcon field="scheduledDate" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("orderNumber")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                발주번호
                <SortIcon field="orderNumber" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("productSku")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                SKU
                <SortIcon field="productSku" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("productName")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                제품명
                <SortIcon field="productName" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">
              <button
                onClick={() => handleSort("receivedQuantity")}
                className="ml-auto flex items-center gap-1 hover:text-slate-900"
              >
                입고수량
                <SortIcon field="receivedQuantity" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap text-right">
              <button
                onClick={() => handleSort("acceptedQuantity")}
                className="ml-auto flex items-center gap-1 hover:text-slate-900"
              >
                합격수량
                <SortIcon field="acceptedQuantity" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("qualityResult")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                품질결과
                <SortIcon field="qualityResult" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="whitespace-nowrap">적치위치</TableHead>
            <TableHead className="whitespace-nowrap">LOT번호</TableHead>
            <TableHead className="whitespace-nowrap">
              <button
                onClick={() => handleSort("expiryDate")}
                className="flex items-center gap-1 hover:text-slate-900"
              >
                유통기한
                <SortIcon field="expiryDate" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRecords.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="whitespace-nowrap text-sm">{record.date}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {record.scheduledDate ? (
                  <span className="text-blue-600">{record.scheduledDate}</span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">
                {record.orderNumber || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">{record.productSku}</TableCell>
              <TableCell className="whitespace-nowrap font-medium">{record.productName}</TableCell>
              <TableCell className="whitespace-nowrap text-right font-semibold">
                {record.receivedQuantity}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {record.acceptedQuantity ?? "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">{qualityBadge(record.qualityResult)}</TableCell>
              <TableCell className="whitespace-nowrap text-sm text-slate-600">
                {record.location || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs text-slate-500">
                {record.lotNumber || "-"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-sm",
                  isExpired(record.expiryDate) && "font-semibold text-red-600",
                  isExpiringSoon(record.expiryDate) && "font-semibold text-orange-600"
                )}
              >
                {record.expiryDate || "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
});
