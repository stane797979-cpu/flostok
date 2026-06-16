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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { OutboundRecord } from "@/server/actions/outbound";

interface OutboundRecordsTableProps {
  records: OutboundRecord[];
  onEdit?: (record: OutboundRecord) => void;
  onDelete?: (record: OutboundRecord) => void;
}

type SortField = "date" | "productSku" | "productName" | "changeTypeLabel" | "changeAmount" | "stockBefore" | "stockAfter";
type SortDirection = "asc" | "desc" | null;

function SortIcon({ field, sortField, sortDirection }: { field: SortField; sortField: SortField; sortDirection: SortDirection }) {
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

export function OutboundRecordsTable({ records, onEdit, onDelete }: OutboundRecordsTableProps) {
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

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal, "ko")
          : bVal.localeCompare(aVal, "ko");
      }

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });
  }, [records, sortField, sortDirection]);

  if (records.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-400">
        해당 기간의 출고 기록이 없습니다
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-950">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button onClick={() => handleSort("date")} className="flex items-center gap-1 hover:text-slate-900">
                날짜
                <SortIcon field="date" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="w-[100px]">
              <button onClick={() => handleSort("productSku")} className="flex items-center gap-1 hover:text-slate-900">
                SKU
                <SortIcon field="productSku" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => handleSort("productName")} className="flex items-center gap-1 hover:text-slate-900">
                제품명
                <SortIcon field="productName" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead>
              <button onClick={() => handleSort("changeTypeLabel")} className="flex items-center gap-1 hover:text-slate-900">
                유형
                <SortIcon field="changeTypeLabel" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("changeAmount")} className="ml-auto flex items-center gap-1 hover:text-slate-900">
                출고수량
                <SortIcon field="changeAmount" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("stockBefore")} className="ml-auto flex items-center gap-1 hover:text-slate-900">
                변동 전
                <SortIcon field="stockBefore" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button onClick={() => handleSort("stockAfter")} className="ml-auto flex items-center gap-1 hover:text-slate-900">
                변동 후
                <SortIcon field="stockAfter" sortField={sortField} sortDirection={sortDirection} />
              </button>
            </TableHead>
            <TableHead>비고</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRecords.map((record) => (
            <TableRow key={record.id}>
              <TableCell className="font-mono text-sm">{record.date}</TableCell>
              <TableCell className="font-mono text-sm">{record.productSku}</TableCell>
              <TableCell className="font-medium">{record.productName}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {record.changeTypeLabel}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-red-600">
                {Math.abs(record.changeAmount).toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono text-slate-500">
                {record.stockBefore.toLocaleString()}
              </TableCell>
              <TableCell className="text-right font-mono">
                {record.stockAfter.toLocaleString()}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-sm text-slate-500">
                {record.notes || "-"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit?.(record)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete?.(record)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
